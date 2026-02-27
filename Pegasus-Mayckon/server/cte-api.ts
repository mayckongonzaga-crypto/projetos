import https from "https";
import { gunzipSync } from "zlib";

// ─── Endpoints CTeDistribuicaoDFe ─────────────────────────────────────
// Produção: https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx
// Homologação: https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx
const CTE_DIST_URL_PROD = "https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx";
const CTE_DIST_URL_HOM = "https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx";

// Namespace SOAP
const SOAP_NS = "http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe";
const CTE_NS = "http://www.portalfiscal.inf.br/cte";
const SOAP_ENV = "http://www.w3.org/2003/05/soap-envelope";

// ─── Tipos ────────────────────────────────────────────────────────────
export interface CteDocument {
  NSU: number;
  chaveAcesso: string;
  tipoDocumento: "CTE" | "CTE_OS" | "GTVE" | "CTE_SIMP" | "EVENTO";
  tipoEvento?: string;
  schema: string; // schema do documento (procCTe, procEventoCTe, etc.)
  xmlOriginal: string; // XML decodificado
  xmlBase64: string; // XML original em base64+gzip
}

export interface CteApiResponse {
  cStat: string; // 137=Nenhum doc, 138=Docs localizados
  xMotivo: string;
  ultNSU: number;
  maxNSU: number;
  documentos: CteDocument[];
}

export interface ParsedCte {
  chaveAcesso: string;
  nsu: number;
  tipoDocumento: "CTE" | "CTE_OS" | "GTVE" | "CTE_SIMP" | "EVENTO";
  tipoEvento?: string;
  xmlOriginal: string;
  xmlBase64: string;
  // Campos extraídos do XML
  numeroCte?: string;
  serie?: string;
  modelo?: string; // 57=CT-e, 67=CT-e OS
  status: "autorizado" | "cancelado" | "denegado";
  direcao: "emitido" | "tomado" | "terceiro";
  // Emitente
  emitenteCnpj?: string;
  emitenteNome?: string;
  emitenteUf?: string;
  // Remetente
  remetenteCnpj?: string;
  remetenteNome?: string;
  // Destinatário
  destinatarioCnpj?: string;
  destinatarioNome?: string;
  // Tomador
  tomadorCnpj?: string;
  tomadorNome?: string;
  // Valores
  valorTotal?: string;
  valorReceber?: string;
  valorICMS?: string;
  // Transporte
  cfop?: string;
  natOp?: string;
  modal?: "rodoviario" | "aereo" | "aquaviario" | "ferroviario" | "dutoviario" | "multimodal";
  ufInicio?: string;
  ufFim?: string;
  munInicio?: string;
  munFim?: string;
  // Carga
  produtoPredominante?: string;
  pesoBruto?: string;
  valorCarga?: string;
  // ICMS detalhado
  cstIcms?: string;
  baseCalcIcms?: string;
  aliqIcms?: string;
  // Modal rodoviário
  rntrc?: string;
  placa?: string;
  // Protocolo
  protocolo?: string;
  // Documentos referenciados
  chavesNfe?: string; // JSON array
  // Observações
  observacoes?: string;
  // UFs extras
  remetenteUf?: string;
  destinatarioUf?: string;
  tomadorUf?: string;
  // Datas
  dataEmissao?: Date;
}

// ─── Mapa UF → Código IBGE ─────────────────────────────────────────────
const UF_IBGE: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
  MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35,
  PR: 41, SC: 42, RS: 43,
  MS: 50, MT: 51, GO: 52, DF: 53,
};

export function getCodigoUfIbge(uf: string): number {
  return UF_IBGE[uf.toUpperCase()] || 35; // default SP
}

// ─── Helpers ──────────────────────────────────────────────────────────

function createMtlsAgent(certPem: string, keyPem: string): https.Agent {
  return new https.Agent({
    cert: certPem,
    key: keyPem,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  });
}

/**
 * Monta o envelope SOAP para consulta por distNSU (distribuição por NSU)
 */
function buildDistNsuEnvelope(cnpj: string, ultNSU: number, ambiente: number = 1, cUFAutor?: number): string {
  const nsuFormatted = String(ultNSU).padStart(15, "0");
  const cnpjClean = cnpj.replace(/[^\d]/g, "");
  // cUFAutor: código UF do autor do documento. Se não informado, usar 35=SP como padrão
  const ufAutor = cUFAutor || 35; // 35 = SP como padrão
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="${SOAP_ENV}">
  <soap12:Header>
    <cteCabecMsg xmlns="${SOAP_NS}">
      <cUF>${ufAutor}</cUF>
      <versaoDados>1.00</versaoDados>
    </cteCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <cteDistDFeInteresse xmlns="${SOAP_NS}">
      <cteDadosMsg>
        <distDFeInt xmlns="${CTE_NS}" versao="1.00">
          <tpAmb>${ambiente}</tpAmb>
          <cUFAutor>${ufAutor}</cUFAutor>
          <CNPJ>${cnpjClean}</CNPJ>
          <distNSU>
            <ultNSU>${nsuFormatted}</ultNSU>
          </distNSU>
        </distDFeInt>
      </cteDadosMsg>
    </cteDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Monta o envelope SOAP para consulta por chave de acesso
 */
function buildConsChaveEnvelope(cnpj: string, chaveAcesso: string, ambiente: number = 1, cUFAutor?: number): string {
  const cnpjClean = cnpj.replace(/[^\d]/g, "");
  const ufAutor = cUFAutor || 35;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="${SOAP_ENV}">
  <soap12:Header>
    <cteCabecMsg xmlns="${SOAP_NS}">
      <cUF>${ufAutor}</cUF>
      <versaoDados>1.00</versaoDados>
    </cteCabecMsg>
  </soap12:Header>
  <soap12:Body>
    <cteDistDFeInteresse xmlns="${SOAP_NS}">
      <cteDadosMsg>
        <distDFeInt xmlns="${CTE_NS}" versao="1.00">
          <tpAmb>${ambiente}</tpAmb>
          <cUFAutor>${ufAutor}</cUFAutor>
          <CNPJ>${cnpjClean}</CNPJ>
          <consChCTe>
            <chCTe>${chaveAcesso}</chCTe>
          </consChCTe>
        </distDFeInt>
      </cteDadosMsg>
    </cteDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Envia requisição SOAP para o web service CTeDistribuicaoDFe
 */
async function sendSoapRequest(
  certPem: string,
  keyPem: string,
  soapEnvelope: string,
  producao: boolean = true
): Promise<string> {
  const url = producao ? CTE_DIST_URL_PROD : CTE_DIST_URL_HOM;
  const agent = createMtlsAgent(certPem, keyPem);

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: "POST",
      agent,
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        "Content-Length": Buffer.byteLength(soapEnvelope, "utf-8"),
        "SOAPAction": `${SOAP_NS}/cteDistDFeInteresse`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`CT-e API HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        resolve(data);
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("Timeout na comunicação com a API CT-e"));
    });

    req.write(soapEnvelope);
    req.end();
  });
}

/**
 * Parseia a resposta SOAP do CTeDistribuicaoDFe
 */
function parseSoapResponse(soapXml: string): CteApiResponse {
  // Extrair o retDistDFeInt do envelope SOAP
  const retMatch = soapXml.match(/<retDistDFeInt[^>]*>([\s\S]*?)<\/retDistDFeInt>/i);
  if (!retMatch) {
    // Verificar se há erro SOAP
    const faultMatch = soapXml.match(/<(?:soap12?:)?Fault[^>]*>([\s\S]*?)<\/(?:soap12?:)?Fault>/i);
    if (faultMatch) {
      const reasonMatch = faultMatch[1].match(/<(?:soap12?:)?Text[^>]*>([^<]*)<\/(?:soap12?:)?Text>/i);
      throw new Error(`Erro SOAP CT-e: ${reasonMatch?.[1] || faultMatch[1].substring(0, 200)}`);
    }
    throw new Error("Resposta inválida da API CT-e - retDistDFeInt não encontrado");
  }

  const retXml = retMatch[1];

  // Extrair campos principais
  const getTag = (xml: string, tag: string): string => {
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
    return xml.match(regex)?.[1]?.trim() ?? "";
  };

  const cStat = getTag(retXml, "cStat");
  const xMotivo = getTag(retXml, "xMotivo");
  const ultNSU = parseInt(getTag(retXml, "ultNSU") || "0", 10);
  const maxNSU = parseInt(getTag(retXml, "maxNSU") || "0", 10);

  const documentos: CteDocument[] = [];

  // Extrair lote de documentos (docZip)
  const docZipRegex = /<docZip\s+NSU="(\d+)"\s+schema="([^"]*)"[^>]*>([^<]*)<\/docZip>/gi;
  let match;
  while ((match = docZipRegex.exec(retXml)) !== null) {
    const nsu = parseInt(match[1], 10);
    const schema = match[2];
    const base64Content = match[3].trim();

    try {
      // Decodificar base64 + gzip
      const xmlOriginal = decodeCteXml(base64Content);

      // Determinar tipo de documento pelo schema
      let tipoDocumento: CteDocument["tipoDocumento"] = "CTE";
      let tipoEvento: string | undefined;

      if (schema.includes("procEventoCTe") || schema.includes("procEvento")) {
        tipoDocumento = "EVENTO";
        // Extrair tipo do evento
        const tpEventoMatch = xmlOriginal.match(/<tpEvento>(\d+)<\/tpEvento>/i);
        if (tpEventoMatch) {
          const tpEvento = tpEventoMatch[1];
          switch (tpEvento) {
            case "110111": tipoEvento = "CANCELAMENTO"; break;
            case "110110": tipoEvento = "CARTA_CORRECAO"; break;
            case "110113": tipoEvento = "EPEC"; break;
            case "110160": tipoEvento = "REGISTRO_MULTIMODAL"; break;
            case "110170": tipoEvento = "INFORMACOES_GTV"; break;
            case "110180": tipoEvento = "COMPROVANTE_ENTREGA"; break;
            case "110181": tipoEvento = "CANCELAMENTO_COMPROVANTE_ENTREGA"; break;
            case "240170": tipoEvento = "INSUCESSO_ENTREGA"; break;
            default: tipoEvento = `EVENTO_${tpEvento}`;
          }
        }
      } else if (schema.includes("procCTeOS")) {
        tipoDocumento = "CTE_OS";
      } else if (schema.includes("GTVe") || schema.includes("procGTVe")) {
        tipoDocumento = "GTVE";
      } else if (schema.includes("CTeSimp") || schema.includes("procCTeSimp")) {
        tipoDocumento = "CTE_SIMP";
      }

      // Extrair chave de acesso
      let chaveAcesso = "";
      const chaveMatch = xmlOriginal.match(/<chCTe>(\d{44})<\/chCTe>/i);
      if (chaveMatch) {
        chaveAcesso = chaveMatch[1];
      } else {
        // Tentar extrair da infCte Id
        const idMatch = xmlOriginal.match(/Id="CTe(\d{44})"/i);
        if (idMatch) chaveAcesso = idMatch[1];
      }

      documentos.push({
        NSU: nsu,
        chaveAcesso,
        tipoDocumento,
        tipoEvento,
        schema,
        xmlOriginal,
        xmlBase64: base64Content,
      });
    } catch (e) {
      console.error(`[CT-e] Erro ao decodificar documento NSU ${nsu}:`, e);
    }
  }

  return { cStat, xMotivo, ultNSU, maxNSU, documentos };
}

/**
 * Decodifica XML de CT-e (base64 + gzip)
 */
export function decodeCteXml(base64GzipXml: string): string {
  try {
    const gzipBuffer = Buffer.from(base64GzipXml, "base64");
    const xmlBuffer = gunzipSync(gzipBuffer);
    return xmlBuffer.toString("utf-8");
  } catch {
    // Pode ser base64 sem gzip
    const buffer = Buffer.from(base64GzipXml, "base64");
    return buffer.toString("utf-8");
  }
}

/**
 * Parseia XML do CT-e para extrair campos principais
 */
export function parseCteXml(xml: string, clienteCnpj: string): Partial<ParsedCte> {
  const getTag = (tag: string, context?: string): string => {
    const searchXml = context || xml;
    const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
    return searchXml.match(regex)?.[1]?.trim() ?? "";
  };

  const getSection = (tag: string): string => {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
    return xml.match(regex)?.[1] ?? "";
  };

  // Modelo (57=CT-e, 67=CT-e OS)
  const modelo = getTag("mod");

  // Número e série
  const numeroCte = getTag("nCT");
  const serie = getTag("serie");

  // CFOP e Natureza da operação
  const cfop = getTag("CFOP") || getTag("cfop");
  const natOp = getTag("natOp");

  // Modal
  const modalCode = getTag("modal");
  let modal: ParsedCte["modal"];
  switch (modalCode) {
    case "01": modal = "rodoviario"; break;
    case "02": modal = "aereo"; break;
    case "03": modal = "aquaviario"; break;
    case "04": modal = "ferroviario"; break;
    case "05": modal = "dutoviario"; break;
    case "06": modal = "multimodal"; break;
  }

  // Emitente
  const emitSection = getSection("emit");
  const emitenteCnpj = getTag("CNPJ", emitSection);
  const emitenteNome = getTag("xNome", emitSection);
  const emitenteUf = getTag("UF", emitSection);

  // Remetente
  const remSection = getSection("rem");
  const remetenteCnpj = getTag("CNPJ", remSection);
  const remetenteNome = getTag("xNome", remSection);

  // Destinatário
  const destSection = getSection("dest");
  const destinatarioCnpj = getTag("CNPJ", destSection);
  const destinatarioNome = getTag("xNome", destSection);

  // Tomador - pode estar em diferentes seções
  let tomadorCnpj = "";
  let tomadorNome = "";
  const tomaSection = getSection("toma3") || getSection("toma4") || getSection("toma");
  if (tomaSection) {
    tomadorCnpj = getTag("CNPJ", tomaSection);
    tomadorNome = getTag("xNome", tomaSection);
    // Se toma3, o tomador é indicado pelo campo toma (0=Rem, 1=Exp, 2=Rec, 3=Dest)
    if (!tomadorNome) {
      const tomaIndicador = getTag("toma", tomaSection);
      switch (tomaIndicador) {
        case "0": tomadorCnpj = remetenteCnpj; tomadorNome = remetenteNome; break;
        case "3": tomadorCnpj = destinatarioCnpj; tomadorNome = destinatarioNome; break;
      }
    }
  }

  // Valores
  const vPrestSection = getSection("vPrest");
  const valorTotal = getTag("vTPrest", vPrestSection) || getTag("vTPrest");
  const valorReceber = getTag("vRec", vPrestSection) || getTag("vRec");

  const icmsSection = getSection("ICMS");
  const valorICMS = getTag("vICMS", icmsSection) || getTag("vICMS");

  // UF início e fim
  const ufInicio = getTag("UFIni");
  const ufFim = getTag("UFFim");
  const munInicio = getTag("xMunIni");
  const munFim = getTag("xMunFim");

  // Data de emissão
  let dataEmissao: Date | undefined;
  const dhEmi = getTag("dhEmi");
  if (dhEmi) {
    try { dataEmissao = new Date(dhEmi); } catch { }
  }

  // Determinar direção
  const cnpjClean = clienteCnpj.replace(/[^\d]/g, "");
  const emitCnpjClean = emitenteCnpj.replace(/[^\d]/g, "");
  const tomaCnpjClean = tomadorCnpj.replace(/[^\d]/g, "");

  let direcao: ParsedCte["direcao"] = "terceiro";
  if (emitCnpjClean === cnpjClean) {
    direcao = "emitido";
  } else if (tomaCnpjClean === cnpjClean) {
    direcao = "tomado";
  }

  // Carga
  const infCargaSection = getSection("infCarga");
  const produtoPredominante = getTag("proPred", infCargaSection) || getTag("proPred");
  const pesoBruto = (() => {
    // Procurar infQ com tpMed PESO BRUTO
    const infQRegex = /<infQ[^>]*>[\s\S]*?<\/infQ>/gi;
    const infQBlocks = xml.match(infQRegex) || [];
    for (const block of infQBlocks) {
      const tpMed = getTag("tpMed", block);
      if (tpMed.toUpperCase().includes("PESO") || tpMed.toUpperCase().includes("BRUTO")) {
        return getTag("qCarga", block);
      }
    }
    // Fallback: pegar primeiro qCarga
    return getTag("qCarga", infCargaSection) || getTag("qCarga");
  })();
  const valorCarga = getTag("vCarga", infCargaSection) || getTag("vCarga");

  // ICMS detalhado
  const cstIcms = getTag("CST", icmsSection) || getTag("CST");
  const baseCalcIcms = getTag("vBC", icmsSection) || getTag("vBC");
  const aliqIcms = getTag("pICMS", icmsSection) || getTag("pICMS");

  // Modal rodoviário
  const rodoSection = getSection("rodo");
  const rntrc = getTag("RNTRC", rodoSection) || getTag("RNTRC");
  // Placa pode estar em ObsCont ou veicTracao
  const placaObs = (() => {
    const obsMatch = xml.match(/xCampo="PLACA"[^>]*>[\s\S]*?<xTexto>([^<]+)<\/xTexto>/i);
    return obsMatch ? obsMatch[1].trim() : "";
  })();
  const placaVeic = getTag("placa", getSection("veicTracao")) || getTag("placa");
  const placa = placaObs || placaVeic;

  // Protocolo
  const protSection = getSection("protCTe") || getSection("infProt");
  const protocolo = getTag("nProt", protSection) || getTag("nProt");

  // Chaves NFe referenciadas
  const chavesNfeArr: string[] = [];
  const chaveRegex = /<chave>([^<]+)<\/chave>/gi;
  let chaveMatch;
  while ((chaveMatch = chaveRegex.exec(xml)) !== null) {
    chavesNfeArr.push(chaveMatch[1].trim());
  }
  const chavesNfe = chavesNfeArr.length > 0 ? JSON.stringify(chavesNfeArr) : undefined;

  // Observações
  const complSection = getSection("compl");
  const observacoes = getTag("xObs", complSection) || getTag("xObs");

  // UFs extras
  const remetenteUf = getTag("UF", getSection("enderReme")) || getTag("UF", remSection);
  const destinatarioUf = getTag("UF", getSection("enderDest")) || getTag("UF", destSection);
  // Tomador UF
  let tomadorUf = "";
  if (tomadorCnpj === remetenteCnpj) tomadorUf = remetenteUf;
  else if (tomadorCnpj === destinatarioCnpj) tomadorUf = destinatarioUf;
  else if (tomadorCnpj === emitenteCnpj) tomadorUf = emitenteUf;

  // Status
  const cStat = getTag("cStat");
  let status: ParsedCte["status"] = "autorizado";
  if (cStat === "135" || cStat === "101") status = "cancelado";
  if (cStat === "110" || cStat === "301" || cStat === "302") status = "denegado";

  return {
    numeroCte,
    serie,
    modelo,
    status,
    direcao,
    emitenteCnpj,
    emitenteNome,
    emitenteUf,
    remetenteCnpj,
    remetenteNome,
    destinatarioCnpj,
    destinatarioNome,
    tomadorCnpj,
    tomadorNome,
    valorTotal: valorTotal || undefined,
    valorReceber: valorReceber || undefined,
    valorICMS: valorICMS || undefined,
    cfop,
    natOp,
    modal,
    ufInicio,
    ufFim,
    munInicio,
    munFim,
    produtoPredominante: produtoPredominante || undefined,
    pesoBruto: pesoBruto || undefined,
    valorCarga: valorCarga || undefined,
    cstIcms: cstIcms || undefined,
    baseCalcIcms: baseCalcIcms || undefined,
    aliqIcms: aliqIcms || undefined,
    rntrc: rntrc || undefined,
    placa: placa || undefined,
    protocolo: protocolo || undefined,
    chavesNfe,
    observacoes: observacoes || undefined,
    remetenteUf: remetenteUf || undefined,
    destinatarioUf: destinatarioUf || undefined,
    tomadorUf: tomadorUf || undefined,
    dataEmissao,
  };
}

// ─── API Pública ──────────────────────────────────────────────────────

/**
 * Consulta CT-e por distribuição NSU (paginada)
 * Retorna até 50 documentos por consulta
 */
export async function fetchCteDocumentsSingle(
  certPem: string,
  keyPem: string,
  cnpj: string,
  ultNSU: number = 0,
  producao: boolean = true,
  cUFAutor?: number
): Promise<CteApiResponse> {
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 3000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const envelope = buildDistNsuEnvelope(cnpj, ultNSU, producao ? 1 : 2, cUFAutor);
      const soapResponse = await sendSoapRequest(certPem, keyPem, envelope, producao);
      return parseSoapResponse(soapResponse);
    } catch (error: any) {
      if (attempt < MAX_RETRIES && (
        error.message.includes("ECONNRESET") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("socket") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("Timeout") ||
        error.message.includes("HTTP 5")
      )) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`[CT-e API] Erro: ${error.message} - aguardando ${delay}ms antes de retry ${attempt + 1}/${MAX_RETRIES}`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Falha após múltiplas tentativas de comunicação com a API CT-e");
}

/**
 * Consulta CT-e por chave de acesso
 */
export async function fetchCteByChave(
  certPem: string,
  keyPem: string,
  cnpj: string,
  chaveAcesso: string,
  producao: boolean = true,
  cUFAutor?: number
): Promise<CteApiResponse> {
  const envelope = buildConsChaveEnvelope(cnpj, chaveAcesso, producao ? 1 : 2, cUFAutor);
  const soapResponse = await sendSoapRequest(certPem, keyPem, envelope, producao);
  return parseSoapResponse(soapResponse);
}

/**
 * Download de todos os CT-e de um CNPJ, a partir de um NSU
 * Similar ao downloadAllDocuments do NFSe
 */
export async function downloadAllCteDocuments(
  certPem: string,
  keyPem: string,
  cnpj: string,
  startNsu: number = 0,
  onProgress?: (downloaded: number) => void,
  options?: {
    dataInicio?: string; // YYYY-MM-DD
    dataFim?: string;    // YYYY-MM-DD
    isCancelled?: () => Promise<boolean>;
    onPageInfo?: (info: { pagesQueried: number; docsInPage: number; currentNsu: number; maxNsu: number }) => void;
    cUFAutor?: number; // Código IBGE da UF do autor
  }
): Promise<{ documentos: ParsedCte[]; ultimoNsu: number; maxNsu: number }> {
  const allDocs: ParsedCte[] = [];
  let currentNsu = startNsu;
  let maxNsu = 0;
  let hasMore = true;
  let pagesQueried = 0;
  let consecutivePagesOutOfRange = 0;
  const MAX_EMPTY_PAGES = 3;

  // Parse period filters
  let periodoInicio: Date | null = null;
  let periodoFim: Date | null = null;
  if (options?.dataInicio) {
    const [y, m, d] = options.dataInicio.split("-").map(Number);
    periodoInicio = new Date(y, m - 1, d, 0, 0, 0);
  }
  if (options?.dataFim) {
    const [y, m, d] = options.dataFim.split("-").map(Number);
    periodoFim = new Date(y, m - 1, d, 23, 59, 59);
  }
  const hasPeriodFilter = !!(periodoInicio || periodoFim);

  while (hasMore) {
    // Check cancellation
    if (options?.isCancelled) {
      const cancelled = await options.isCancelled();
      if (cancelled) break;
    }

    const response = await fetchCteDocumentsSingle(certPem, keyPem, cnpj, currentNsu, true, options?.cUFAutor);
    pagesQueried++;

    // cStat 137 = Nenhum doc localizado, 138 = Docs localizados
    console.log(`[CT-e] Página ${pagesQueried} - cStat: ${response.cStat}, xMotivo: ${response.xMotivo}, docs: ${response.documentos.length}, ultNSU: ${response.ultNSU}, maxNSU: ${response.maxNSU}`);
    if (response.cStat !== "138" || response.documentos.length === 0) {
      hasMore = false;
      maxNsu = response.maxNSU;
      console.log(`[CT-e] Fim da consulta - cStat: ${response.cStat} (${response.xMotivo})`);
      break;
    }

    maxNsu = response.maxNSU;

    options?.onPageInfo?.({
      pagesQueried,
      docsInPage: response.documentos.length,
      currentNsu,
      maxNsu: response.maxNSU,
    });

    let docsAddedThisPage = 0;
    let allDocsAfterPeriod = true;

    for (const doc of response.documentos) {
      try {
        const parsed = parseCteXml(doc.xmlOriginal, cnpj);

        // Se é evento de cancelamento, marcar como cancelado
        if (doc.tipoDocumento === "EVENTO" && doc.tipoEvento === "CANCELAMENTO") {
          parsed.status = "cancelado";
        }

        // Filtro por período
        if (hasPeriodFilter && parsed.dataEmissao) {
          const isBeforePeriod = periodoInicio ? parsed.dataEmissao < periodoInicio : false;
          const isAfterPeriod = periodoFim ? parsed.dataEmissao > periodoFim : false;
          if (!isAfterPeriod) allDocsAfterPeriod = false;
          if (isBeforePeriod || isAfterPeriod) continue;
        } else if (hasPeriodFilter) {
          allDocsAfterPeriod = false;
        }

        allDocs.push({
          chaveAcesso: doc.chaveAcesso,
          nsu: doc.NSU,
          tipoDocumento: doc.tipoDocumento,
          tipoEvento: doc.tipoEvento,
          xmlOriginal: doc.xmlBase64, // Guardar o base64 original para armazenamento
          xmlBase64: doc.xmlBase64,
          status: parsed.status ?? "autorizado",
          direcao: parsed.direcao ?? "terceiro",
          ...parsed,
        });
        docsAddedThisPage++;
      } catch (e) {
        console.error(`[CT-e] Erro ao parsear documento NSU ${doc.NSU}:`, e);
      }
    }

    currentNsu = response.ultNSU;
    onProgress?.(allDocs.length);

    // Se ultNSU >= maxNSU, não há mais documentos
    if (response.ultNSU >= response.maxNSU) {
      hasMore = false;
      break;
    }

    // Early termination por período
    if (hasPeriodFilter && periodoFim && allDocsAfterPeriod && response.documentos.length > 0) {
      consecutivePagesOutOfRange++;
      if (consecutivePagesOutOfRange >= MAX_EMPTY_PAGES) {
        console.log(`[CT-e] Early termination: ${MAX_EMPTY_PAGES} páginas consecutivas após o período.`);
        break;
      }
    } else {
      consecutivePagesOutOfRange = 0;
    }

    // Delay para evitar rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[CT-e] Consulta finalizada: ${pagesQueried} página(s), ${allDocs.length} CT-e(s) no período, ultNSU: ${currentNsu}, maxNSU: ${maxNsu}`);
  return { documentos: allDocs, ultimoNsu: currentNsu, maxNsu };
}

/**
 * Gera URL do DACTE para download
 * O DACTE é gerado a partir do XML do CT-e
 * Como não há API pública de DACTE, geramos localmente ou usamos serviço externo
 */
export function getDacteInfo(chaveAcesso: string) {
  return {
    chaveAcesso,
    consultaUrl: `https://dfe-portal.svrs.rs.gov.br/CTE/ConsultaDocumento?chaveAcesso=${chaveAcesso}`,
  };
}
