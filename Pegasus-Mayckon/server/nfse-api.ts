import https from "https";
import { decrypt } from "./crypto";
import { gunzipSync } from "zlib";

const NFSE_API_BASE = "https://adn.nfse.gov.br";
const DANFSE_API_BASE = "https://adn.nfse.gov.br/danfse";

interface NfseDocument {
  NSU: number;
  ChaveAcesso: string;
  TipoDocumento: "NFSE" | "EVENTO";
  TipoEvento?: string;
  ArquivoXml: string; // base64 gzipped XML
  DataHoraGeracao: string;
}

interface NfseApiResponse {
  StatusProcessamento: string;
  LoteDFe: NfseDocument[];
  Alertas: any[];
  Erros: any[];
  TipoAmbiente: string;
  VersaoAplicativo: string;
  DataHoraProcessamento: string;
}

export interface ParsedNfse {
  chaveAcesso: string;
  nsu: number;
  tipoDocumento: "NFSE" | "EVENTO";
  tipoEvento?: string;
  xmlOriginal: string;
  // Parsed fields
  numeroNota?: string;
  serie?: string;
  emitenteCnpj?: string;
  emitenteNome?: string;
  tomadorCnpj?: string;
  tomadorNome?: string;
  valorServico?: string;
  valorLiquido?: string;
  valorRetencao?: string;
  codigoServico?: string;
  descricaoServico?: string;
  dataEmissao?: Date;
  dataCompetencia?: Date;
  municipioPrestacao?: string;
  ufPrestacao?: string;
  status: "valida" | "cancelada" | "substituida";
  direcao: "emitida" | "recebida";
  // Campos IBS/CBS (Reforma Tributaria 2026)
  cstIbsCbs?: string;
  cIndOp?: string;
  finNFSe?: string;
  vBcIbsCbs?: string;
  aliqIbsUf?: string;
  aliqIbsMun?: string;
  aliqCbs?: string;
  vIbsUf?: string;
  vIbsMun?: string;
  vCbs?: string;
  vTotTribIbsCbs?: string;
  indZfmalc?: number;
  vPis?: string;
  vCofins?: string;
  cstPisCofins?: string;
  pDifUf?: string;
  pDifMun?: string;
  pDifCbs?: string;
  temIbsCbs?: boolean;
}

/**
 * Creates an HTTPS agent with mTLS using the client certificate
 */
function createMtlsAgent(certPem: string, keyPem: string): https.Agent {
  return new https.Agent({
    cert: certPem,
    key: keyPem,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
}

/**
 * Extract PEM cert and key from PFX buffer
 */
export async function extractPfxCertAndKey(pfxBuffer: Buffer, password: string): Promise<{ cert: string; key: string; cnpj: string; razaoSocial: string; serialNumber: string; issuer: string; validFrom: Date; validTo: Date }> {
  // Use node-forge for PFX parsing
  const forgeModule = await import("node-forge");
  const forge = forgeModule.default || forgeModule;
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("Certificado não encontrado no arquivo PFX");

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no arquivo PFX");

  const cert = certBag.cert;
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Extract subject info
  const subject = cert.subject;
  const cnAttr = subject.getField("CN");
  const cn = cnAttr ? cnAttr.value : "";

  // Parse CNPJ from CN (format: "RAZAO SOCIAL:CNPJ")
  let cnpj = "";
  let razaoSocial = "";
  if (cn.includes(":")) {
    const parts = cn.split(":");
    razaoSocial = parts[0].trim();
    cnpj = parts[1].trim().replace(/[^\d]/g, "");
  } else {
    razaoSocial = cn;
    // Try OU field for CNPJ
    const ouFields = subject.attributes.filter((a: any) => a.shortName === "OU");
    for (const ou of ouFields) {
      const val = String(ou.value || "").replace(/[^\d]/g, "");
      if (val && val.length === 14) {
        cnpj = val;
        break;
      }
    }
  }

  // Format CNPJ
  const cnpjFormatted = cnpj.length === 14
    ? `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12)}`
    : cnpj;

  return {
    cert: certPem,
    key: keyPem,
    cnpj: cnpjFormatted,
    razaoSocial,
    serialNumber: cert.serialNumber,
    issuer: cert.issuer.getField("CN")?.value || "",
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
}

/**
 * Fetch documents from NFSe API using mTLS
 */
async function fetchNfseDocumentsSingle(
  certPem: string,
  keyPem: string,
  cnpj: string,
  startNsu: number = 1
): Promise<{ response: NfseApiResponse | null; statusCode: number; rawBody: string }> {
  const cnpjClean = cnpj.replace(/[^\d]/g, "");
  const url = `${NFSE_API_BASE}/contribuintes/DFe/${startNsu}?cnpjConsulta=${cnpjClean}&lote=true`;

  const agent = createMtlsAgent(certPem, keyPem);

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent,
      headers: { "Accept": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        const statusCode = res.statusCode || 0;
        // Sempre tentar parsear o body JSON primeiro, independente do status HTTP
        // A API NFSe retorna JSON válido mesmo em HTTP 404 (NENHUM_DOCUMENTO_LOCALIZADO)
        try {
          const parsed = JSON.parse(data);
          resolve({ response: parsed as NfseApiResponse, statusCode, rawBody: data });
        } catch {
          // Não conseguiu parsear JSON - verificar status HTTP para mensagem de erro
          resolve({ response: null, statusCode, rawBody: data });
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Timeout na comunicação com a API Nacional"));
    });
  });
}

/**
 * Fetch documents from NFSe API with retry and backoff for 429/5xx errors
 */
export async function fetchNfseDocuments(
  certPem: string,
  keyPem: string,
  cnpj: string,
  startNsu: number = 1
): Promise<NfseApiResponse> {
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 5000; // 5 seconds base delay for retry (will be 5s, 10s, 20s, 40s, 80s)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { response, statusCode, rawBody } = await fetchNfseDocumentsSingle(certPem, keyPem, cnpj, startNsu);

      // Se conseguiu parsear JSON, verificar o StatusProcessamento
      if (response) {
        // JSON válido - a API respondeu normalmente (mesmo com HTTP 404)
        // StatusProcessamento pode ser "DOCUMENTOS_LOCALIZADOS" ou "NENHUM_DOCUMENTO_LOCALIZADO"
        return response;
      }

      // Não conseguiu parsear JSON - tratar por status HTTP
      if (statusCode === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt); // Backoff exponencial: 3s, 6s, 12s
          console.log(`[API NFSe] 429 Too Many Requests - aguardando ${delay}ms antes de retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error("API sobrecarregada (429) - muitas requisições simultâneas. Tente novamente em alguns minutos.");
      }
      if (statusCode === 403) {
        throw new Error("Acesso negado pela API Nacional (403) - verifique o certificado");
      }
      if (statusCode === 401) {
        throw new Error("Certificado não autorizado pela API Nacional (401)");
      }
      if (statusCode >= 500) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[API NFSe] Erro ${statusCode} - aguardando ${delay}ms antes de retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error(`API Nacional indisponível (HTTP ${statusCode})`);
      }
      // Resposta HTML ou inválida
      if (rawBody.trim().startsWith("<")) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[API NFSe] Resposta HTML inválida - aguardando ${delay}ms antes de retry ${attempt + 1}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw new Error("API retornou resposta inválida (HTML) - tente novamente em alguns minutos");
      }
      throw new Error(`Erro na API Nacional (HTTP ${statusCode}): ${rawBody.substring(0, 100)}`);
    } catch (error: any) {
      // Erros de rede (ECONNRESET, ECONNREFUSED, etc.) - retry
      if (attempt < MAX_RETRIES && (error.message.includes("ECONNRESET") || error.message.includes("ECONNREFUSED") || error.message.includes("socket") || error.message.includes("ETIMEDOUT"))) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`[API NFSe] Erro de rede: ${error.message} - aguardando ${delay}ms antes de retry ${attempt + 1}/${MAX_RETRIES}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Falha após múltiplas tentativas de comunicação com a API Nacional");
}

/**
 * Decode a GZip+Base64 XML document
 */
export function decodeXml(base64GzipXml: string): string {
  const gzipBuffer = Buffer.from(base64GzipXml, "base64");
  const xmlBuffer = gunzipSync(gzipBuffer);
  return xmlBuffer.toString("utf-8");
}

/**
 * Parse NFSe XML to extract key fields
 */
export function parseNfseXml(xml: string, clienteCnpj: string): Partial<ParsedNfse> {
  const getTag = (tag: string): string => {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
    const match = xml.match(regex);
    return match?.[1]?.trim() ?? "";
  };

  const emitenteCnpj = getTag("CNPJ") || "";
  const cnpjClean = String(clienteCnpj).replace(/[^\d]/g, "");
  const emitenteCnpjClean = String(emitenteCnpj).replace(/[^\d]/g, "");

  // Determine direction: if emitter CNPJ matches client, it's emitida
  const direcao = emitenteCnpjClean === cnpjClean ? "emitida" : "recebida";

  // Parse dates
  let dataEmissao: Date | undefined;
  const dhEmi = getTag("dhEmi") || getTag("dhProc");
  if (dhEmi) {
    try { dataEmissao = new Date(dhEmi); } catch { }
  }

  let dataCompetencia: Date | undefined;
  const dCompet = getTag("dCompet");
  if (dCompet) {
    try { dataCompetencia = new Date(dCompet + "T00:00:00"); } catch { }
  }

  // Extract tomador info - look for toma section
  let tomadorCnpj = "";
  let tomadorNome = "";
  const tomaMatch = xml.match(/<toma>([\s\S]*?)<\/toma>/i);
  if (tomaMatch) {
    const tomaXml = tomaMatch[1];
    const cnpjMatch = tomaXml.match(/<CNPJ>([^<]*)<\/CNPJ>/i);
    const nomeMatch = tomaXml.match(/<xNome>([^<]*)<\/xNome>/i);
    tomadorCnpj = cnpjMatch?.[1] || "";
    tomadorNome = nomeMatch?.[1] || "";
  }

  // --- Extrair campos IBS/CBS (Reforma Tributaria 2026) ---
  // Buscar bloco IBSCBS no XML
  const ibsCbsBlock = xml.match(/<IBSCBS>(.*?)<\/IBSCBS>/is)?.[1] || "";
  const gIbsCbsBlock = xml.match(/<gIBSCBS>(.*?)<\/gIBSCBS>/is)?.[1] || "";
  const gDifBlock = xml.match(/<gDif>(.*?)<\/gDif>/is)?.[1] || "";
  const pisCofinsBlock = xml.match(/<piscofins>(.*?)<\/piscofins>/is)?.[1] || "";
  const totTribBlock = xml.match(/<totTrib>(.*?)<\/totTrib>/is)?.[1] || xml.match(/<totCIBS>(.*?)<\/totCIBS>/is)?.[1] || "";

  // Helper para extrair tag de um bloco especifico
  const getTagFrom = (block: string, tag: string): string => {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
    const match = block.match(regex);
    return match?.[1]?.trim() ?? "";
  };

  const temIbsCbs = ibsCbsBlock.length > 0 || gIbsCbsBlock.length > 0;

  // Campos do grupo IBSCBS na DPS
  const cstIbsCbs = getTagFrom(gIbsCbsBlock || ibsCbsBlock, "CST") || getTagFrom(xml, "cstIBSCBS") || "";
  const cIndOp = getTagFrom(ibsCbsBlock, "cIndOp") || getTag("cIndOp") || "";
  const finNFSeVal = getTagFrom(ibsCbsBlock, "finNFSe") || getTag("finNFSe") || "";
  const indZfmalcVal = getTagFrom(ibsCbsBlock, "indZFMALC") || getTag("indZFMALC") || "";

  // Base de calculo e aliquotas
  const vBcIbsCbs = getTagFrom(gIbsCbsBlock || totTribBlock, "vBC") || "";
  const aliqIbsUf = getTagFrom(totTribBlock || gIbsCbsBlock, "pAliqEfetRegIBSUF") || getTagFrom(xml, "pAliqEfetRegIBSUF") || "";
  const aliqIbsMun = getTagFrom(totTribBlock || gIbsCbsBlock, "pAliqEfetRegIBSMun") || getTagFrom(xml, "pAliqEfetRegIBSMun") || "";
  const aliqCbs = getTagFrom(totTribBlock || gIbsCbsBlock, "pAliqEfetRegCBS") || getTagFrom(xml, "pAliqEfetRegCBS") || "";

  // Valores calculados
  const vIbsUf = getTagFrom(totTribBlock, "vTribRegIBSUF") || getTagFrom(xml, "vTribRegIBSUF") || "";
  const vIbsMun = getTagFrom(totTribBlock, "vTribRegIBSMun") || getTagFrom(xml, "vTribRegIBSMun") || "";
  const vCbs = getTagFrom(totTribBlock, "vTribRegCBS") || getTagFrom(xml, "vTribRegCBS") || "";

  // Total tributos IBS+CBS
  let vTotTribIbsCbs = "";
  if (vIbsUf || vIbsMun || vCbs) {
    const total = (parseFloat(vIbsUf || "0") + parseFloat(vIbsMun || "0") + parseFloat(vCbs || "0"));
    vTotTribIbsCbs = total > 0 ? total.toFixed(2) : "";
  }

  // Diferimento
  const pDifUf = getTagFrom(gDifBlock, "pDifUF") || getTagFrom(xml, "pDifUF") || "";
  const pDifMun = getTagFrom(gDifBlock, "pDifMun") || getTagFrom(xml, "pDifMun") || "";
  const pDifCbs = getTagFrom(gDifBlock, "pDifCBS") || getTagFrom(xml, "pDifCBS") || "";

  // PIS/COFINS
  const vPis = getTagFrom(pisCofinsBlock, "vPIS") || getTag("vPIS") || getTag("vPis") || "";
  const vCofins = getTagFrom(pisCofinsBlock, "vCOFINS") || getTag("vCOFINS") || getTag("vCofins") || "";
  const cstPisCofins = getTagFrom(pisCofinsBlock, "CST") || "";

  return {
    numeroNota: getTag("nNF") || getTag("nNFSe") || "",
    serie: getTag("serie") || "",
    emitenteCnpj,
    emitenteNome: getTag("xNome") || "",
    tomadorCnpj,
    tomadorNome,
    valorServico: getTag("vServ") || "",
    valorLiquido: getTag("vLiq") || "",
    valorRetencao: getTag("vRet") || "",
    codigoServico: getTag("cServ") || "",
    descricaoServico: getTag("xServ") || "",
    dataEmissao,
    dataCompetencia,
    municipioPrestacao: getTag("cMun") || "",
    ufPrestacao: getTag("UF") || "",
    direcao,
    // Campos IBS/CBS
    ...(temIbsCbs ? {
      temIbsCbs: true,
      cstIbsCbs: cstIbsCbs || undefined,
      cIndOp: cIndOp || undefined,
      finNFSe: finNFSeVal || undefined,
      vBcIbsCbs: vBcIbsCbs || undefined,
      aliqIbsUf: aliqIbsUf || undefined,
      aliqIbsMun: aliqIbsMun || undefined,
      aliqCbs: aliqCbs || undefined,
      vIbsUf: vIbsUf || undefined,
      vIbsMun: vIbsMun || undefined,
      vCbs: vCbs || undefined,
      vTotTribIbsCbs: vTotTribIbsCbs || undefined,
      indZfmalc: indZfmalcVal ? parseInt(indZfmalcVal) : undefined,
      vPis: vPis || undefined,
      vCofins: vCofins || undefined,
      cstPisCofins: cstPisCofins || undefined,
      pDifUf: pDifUf || undefined,
      pDifMun: pDifMun || undefined,
      pDifCbs: pDifCbs || undefined,
    } : {
      temIbsCbs: false,
      // Ainda extrair PIS/COFINS mesmo sem IBSCBS (notas antigas)
      vPis: vPis || undefined,
      vCofins: vCofins || undefined,
    }),
  };
}

/**
 * Download all documents from NFSe API with pagination
 */
export async function downloadAllDocuments(
  certPem: string,
  keyPem: string,
  cnpj: string,
  startNsu: number = 1,
  onProgress?: (count: number) => Promise<void>,
  periodFilter?: {
    competenciaInicio?: string;
    competenciaFim?: string;
    dataInicio?: string;
    dataFim?: string;
    smartStartNsu?: number;
    isCancelled?: () => Promise<boolean>;
  }
): Promise<ParsedNfse[]> {
  const allDocs: ParsedNfse[] = [];
  let currentNsu = startNsu;
  let pagesQueried = 0;
  const MAX_EMPTY_PAGES = 3;
  let consecutivePagesOutOfRange = 0;

  const hasPeriodFilter = periodFilter && (periodFilter.competenciaInicio || periodFilter.dataInicio);
  let periodoInicio: Date | undefined;
  let periodoFim: Date | undefined;

  if (hasPeriodFilter) {
    if (periodFilter.dataInicio) {
      periodoInicio = new Date(periodFilter.dataInicio);
      periodoFim = periodFilter.dataFim ? new Date(periodFilter.dataFim) : undefined;
    } else if (periodFilter.competenciaInicio) {
      periodoInicio = new Date(periodFilter.competenciaInicio + "-01T00:00:00");
      if (periodFilter.competenciaFim) {
        const [ano, mes] = periodFilter.competenciaFim.split("-");
        const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0).getDate();
        periodoFim = new Date(periodFilter.competenciaFim + `-${ultimoDia}T23:59:59`);
      } else {
        const ultimoDia = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth() + 1, 0).getDate();
        periodoFim = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth(), ultimoDia, 23, 59, 59);
      }
    }
  }

  if (periodFilter?.smartStartNsu && periodFilter.smartStartNsu > 0) {
    currentNsu = periodFilter.smartStartNsu;
  }

  while (true) {
    const wasCancelled = periodFilter?.isCancelled ? await periodFilter.isCancelled() : false;
    if (wasCancelled) {
      console.log("[API NFSe] Download cancelado pelo usuário");
      break;
    }

    pagesQueried++;
    const response = await fetchNfseDocuments(certPem, keyPem, cnpj, currentNsu);

    if (response.StatusProcessamento === "NENHUM_DOCUMENTO_LOCALIZADO" || response.LoteDFe.length === 0) {
      consecutivePagesOutOfRange++;
      if (consecutivePagesOutOfRange >= MAX_EMPTY_PAGES) {
        console.log(`[API NFSe] ${MAX_EMPTY_PAGES} páginas vazias consecutivas - parando consulta`);
        break;
      }
      await new Promise(r => setTimeout(r, 300));
      currentNsu = Math.max(currentNsu + 1, currentNsu);
      continue;
    }

    let docsAddedThisPage = 0;
    let allDocsAfterPeriod = true; // Track if ALL docs in this page are after the period
    let allDocsBeforePeriod = true; // Track if ALL docs in this page are before the period

    for (const doc of response.LoteDFe) {
      try {
        const xmlOriginal = decodeXml(doc.ArquivoXml);
        const parsed = parseNfseXml(xmlOriginal, cnpj);

        const isCancel = doc.TipoDocumento === "EVENTO" && doc.TipoEvento === "CANCELAMENTO";

        // If period filter is active, check competência
        if (hasPeriodFilter) {
          const docDate = parsed.dataCompetencia || parsed.dataEmissao;
          if (docDate) {
            const isBeforePeriod = periodoInicio ? docDate < periodoInicio : false;
            const isAfterPeriod = periodoFim ? docDate > periodoFim : false;
            if (!isAfterPeriod) allDocsAfterPeriod = false;
            if (!isBeforePeriod) allDocsBeforePeriod = false;
            if (isBeforePeriod || isAfterPeriod) continue;
          } else {
            // Sem data, não podemos determinar - não é "after" nem "before"
            allDocsAfterPeriod = false;
            allDocsBeforePeriod = false;
          }
        }

        allDocs.push({
          chaveAcesso: doc.ChaveAcesso,
          nsu: doc.NSU,
          tipoDocumento: doc.TipoDocumento,
          tipoEvento: doc.TipoEvento,
          xmlOriginal: doc.ArquivoXml,
          status: isCancel ? "cancelada" : "valida",
          direcao: parsed.direcao ?? "emitida",
          ...parsed,
        });
        docsAddedThisPage++;
      } catch (e) {
        console.error(`Error parsing document NSU ${doc.NSU}:`, e);
      }
    }

    currentNsu = Math.max(...response.LoteDFe.map(d => d.NSU)) + 1;
    onProgress?.(allDocs.length);

    // EARLY TERMINATION: Se temos filtro de período e TODOS os docs da página
    // estão APÓS o período, significa que já passamos do período desejado.
    // NSUs são sequenciais/cronológicos, então não haverá mais notas no período.
    if (hasPeriodFilter && periodoFim) {
      if (allDocsAfterPeriod && response.LoteDFe.length > 0) {
        consecutivePagesOutOfRange++;
        console.log(`[API NFSe] Página ${pagesQueried}: todas as ${response.LoteDFe.length} notas estão APÓS o período. ` +
          `Consecutivas fora do período: ${consecutivePagesOutOfRange}/${MAX_EMPTY_PAGES}`);
        if (consecutivePagesOutOfRange >= MAX_EMPTY_PAGES) {
          console.log(`[API NFSe] Early termination: ${MAX_EMPTY_PAGES} páginas consecutivas após o período. Parando consulta.`);
          break;
        }
      } else {
        consecutivePagesOutOfRange = 0;
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[API NFSe] Consulta finalizada: ${pagesQueried} página(s) consultada(s), ${allDocs.length} nota(s) no período`);
  return allDocs;
}

/**
 * Get DANFSe PDF URL (direct URL - requires mTLS)
 */
export function getDanfseUrl(chaveAcesso: string): string {
  return `${DANFSE_API_BASE}/${chaveAcesso}`;
}

/**
 * Download DANFSe PDF via mTLS using the client certificate
 * Returns the PDF as a Buffer, or null if not available
 * 
 * Retry strategy: aggressive backoff for network errors and rate limiting
 * - Network errors (ECONNRESET, ETIMEDOUT, etc): retry with exponential backoff
 * - HTTP 503/429: retry with exponential backoff
 * - HTTP 404: fail immediately (PDF not available)
 * - Invalid signature: fail immediately (not a valid PDF)
 */
export async function fetchDanfsePdf(
  certPem: string,
  keyPem: string,
  chaveAcesso: string,
  retryCount: number = 0,
  maxRetries: number = 5
): Promise<Buffer | null> {
  const url = `${DANFSE_API_BASE}/${chaveAcesso}`;
  const agent = createMtlsAgent(certPem, keyPem);

  return new Promise((resolve) => {
    const req = https.get(url, {
      agent,
      headers: { 
        "Accept": "application/pdf",
        "User-Agent": "Pegasus-NFSe/1.0"
      },
    }, (res) => {
      if (res.statusCode !== 200) {
        const statusMsg = `HTTP ${res.statusCode}`;
        const contentType = res.headers["content-type"] || "unknown";
        const retryInfo = retryCount > 0 ? ` [Retry ${retryCount}/${maxRetries}]` : "";
        console.warn(`[PDF] ${chaveAcesso}: ${statusMsg} (${contentType})${retryInfo}`);
        res.resume();
        
        // HTTP 404: PDF nao existe, nao fazer retry
        if (res.statusCode === 404) {
          console.warn(`[PDF] ${chaveAcesso}: PDF nao disponivel no Portal Nacional (404)`);
          resolve(null);
          return;
        }
        
        // HTTP 503/429: Retry com backoff exponencial
        if ((res.statusCode === 503 || res.statusCode === 429) && retryCount < maxRetries) {
          const delayMs = 2000 * Math.pow(2, retryCount); // 2s, 4s, 8s, 16s, 32s
          console.log(`[PDF] ${chaveAcesso}: ${statusMsg} - aguardando ${delayMs}ms antes de retry ${retryCount + 1}/${maxRetries}`);
          setTimeout(() => {
            fetchDanfsePdf(certPem, keyPem, chaveAcesso, retryCount + 1, maxRetries).then(resolve);
          }, delayMs);
        } else {
          resolve(null);
        }
        return;
      }

      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxSize = 50 * 1024 * 1024;
      
      res.on("data", (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          req.destroy();
          console.error(`[PDF] ${chaveAcesso}: Response too large`);
          resolve(null);
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      
      res.on("end", () => {
        const pdfBuffer = Buffer.concat(chunks);
        if (pdfBuffer.length > 4 && pdfBuffer.toString("utf-8", 0, 4) === "%PDF") {
          console.log(`[PDF] OK ${chaveAcesso}: ${pdfBuffer.length} bytes`);
          resolve(pdfBuffer);
        } else {
          console.warn(`[PDF] ${chaveAcesso}: Invalid signature (${pdfBuffer.length} bytes)`);
          resolve(null);
        }
      });
    });

    req.on("error", (err: any) => {
      const retryInfo = retryCount > 0 ? ` [Retry ${retryCount}/${maxRetries}]` : "";
      console.error(`[PDF] ${chaveAcesso}: ${err.code} - ${err.message}${retryInfo}`);
      
      // Network errors: retry com backoff exponencial
      if (retryCount < maxRetries && ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(err.code)) {
        const delayMs = 2000 * Math.pow(2, retryCount); // 2s, 4s, 8s, 16s, 32s
        console.log(`[PDF] ${chaveAcesso}: Erro de rede ${err.code} - aguardando ${delayMs}ms antes de retry ${retryCount + 1}/${maxRetries}`);
        setTimeout(() => {
          fetchDanfsePdf(certPem, keyPem, chaveAcesso, retryCount + 1, maxRetries).then(resolve);
        }, delayMs);
      } else {
        resolve(null);
      }
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      const retryInfo = retryCount > 0 ? ` [Retry ${retryCount}/${maxRetries}]` : "";
      console.warn(`[PDF] ${chaveAcesso}: Timeout${retryInfo}`);
      
      // Timeout: retry com backoff exponencial
      if (retryCount < maxRetries) {
        const delayMs = 2000 * Math.pow(2, retryCount); // 2s, 4s, 8s, 16s, 32s
        console.log(`[PDF] ${chaveAcesso}: Timeout - aguardando ${delayMs}ms antes de retry ${retryCount + 1}/${maxRetries}`);
        setTimeout(() => {
          fetchDanfsePdf(certPem, keyPem, chaveAcesso, retryCount + 1, maxRetries).then(resolve);
        }, delayMs);
      } else {
        resolve(null);
      }
    });
  });
}
