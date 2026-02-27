import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import bwipjs from "bwip-js";

// ─── Helpers ────────────────────────────────────────────────────────────
function getTag(xml: string, tag: string): string {
  const r = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_]+:)?${tag}>`, "i");
  const m = xml.match(r);
  return m ? m[1].trim() : "";
}
function getTagBlock(xml: string, tag: string): string {
  const r = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tag}[^>]*>[\\s\\S]*?<\\/(?:[a-zA-Z0-9_]+:)?${tag}>`, "i");
  const m = xml.match(r);
  return m ? m[0] : "";
}
function getAllTagBlocks(xml: string, tag: string): string[] {
  const r = new RegExp(`<(?:[a-zA-Z0-9_]+:)?${tag}[^>]*>[\\s\\S]*?<\\/(?:[a-zA-Z0-9_]+:)?${tag}>`, "gi");
  return xml.match(r) || [];
}

function formatCnpjCpf(v: string): string {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return v;
}
function formatMoney(v: string): string {
  const n = parseFloat(v || "0");
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatWeight(v: string): string {
  if (!v) return "";
  const n = parseFloat(v);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function formatDate(v: string): string {
  if (!v) return "";
  try {
    const dt = new Date(v);
    return dt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return v; }
}
function formatChave(c: string): string {
  if (!c) return "";
  return c.replace(/(\d{4})(?=\d)/g, "$1 ");
}
function formatNumero(n: string): string {
  if (!n) return "";
  return parseInt(n, 10).toLocaleString("pt-BR");
}

function getModalLabel(m: string): string {
  const map: Record<string, string> = { "01": "Rodoviário", "02": "Aéreo", "03": "Aquaviário", "04": "Ferroviário", "05": "Dutoviário", "06": "Multimodal" };
  return map[m] || m;
}
function getTipoCte(t: string): string {
  const map: Record<string, string> = { "0": "Normal", "1": "Complementar", "2": "Anulação", "3": "Substituto" };
  return map[t] || t;
}
function getTipoServico(t: string): string {
  const map: Record<string, string> = { "0": "Normal", "1": "Subcontratação", "2": "Redespacho", "3": "Redespacho Intermediário", "4": "Serviço Vinculado a Multimodal" };
  return map[t] || t;
}
function getTomador(t: string): string {
  const map: Record<string, string> = { "0": "Remetente", "1": "Expedidor", "2": "Recebedor", "3": "Destinatário", "4": "Outros" };
  return map[t] || t;
}
function getCstLabel(cst: string): string {
  const map: Record<string, string> = {
    "00": "00 - Tributação normal ICMS",
    "20": "20 - Tributação com BC reduzida do ICMS",
    "40": "40 - ICMS isento, não tributado ou diferido",
    "41": "41 - ICMS não tributado",
    "45": "45 - ICMS isento, não tributado ou diferido",
    "51": "51 - ICMS diferido",
    "60": "60 - ICMS cobrado por substituição tributária",
    "90": "90 - ICMS outros",
    "SN": "Simples Nacional",
  };
  return map[cst] || cst || "N/I";
}
function getFormaPagamento(v: string): string {
  const map: Record<string, string> = { "0": "Pago", "1": "A Pagar", "2": "Outros" };
  return map[v] || "Pago";
}

async function generateBarcodePng(code: string): Promise<Buffer> {
  if (!code || code.length < 10) return Buffer.alloc(0);
  try {
    return await bwipjs.toBuffer({ bcid: "code128", text: code, scale: 2, height: 10, includetext: false });
  } catch { return Buffer.alloc(0); }
}
async function generateQrCodePng(chaveOrUrl: string): Promise<Buffer> {
  if (!chaveOrUrl) return Buffer.alloc(0);
  try {
    const url = chaveOrUrl.startsWith("http") ? chaveOrUrl : `https://www.cte.fazenda.gov.br/portal/consultaRecebimento.aspx?chave=${chaveOrUrl}`;
    return await QRCode.toBuffer(url, { width: 200, margin: 1, errorCorrectionLevel: "M" });
  } catch { return Buffer.alloc(0); }
}

// ─── XML Parse ──────────────────────────────────────────────────────────
interface DacteData {
  modelo: string; serie: string; numero: string; modal: string; dataEmissao: string;
  chaveAcesso: string; protocolo: string; dataProtocolo: string;
  tipoCte: string; tipoServico: string; tomador: string;
  cteGlobalizado: boolean; infGlobalizado: string;
  cfop: string; natOp: string; formaPag: string;
  ufInicio: string; munInicio: string; ufFim: string; munFim: string;
  emitNome: string; emitFantasia: string; emitCnpj: string; emitIE: string;
  emitEndereco: string; emitBairro: string; emitMun: string; emitUF: string; emitCEP: string; emitFone: string;
  remNome: string; remCnpj: string; remIE: string; remEndereco: string; remBairro: string; remMun: string; remUF: string; remCEP: string; remFone: string; remPais: string;
  destNome: string; destCnpj: string; destIE: string; destEndereco: string; destBairro: string; destMun: string; destUF: string; destCEP: string; destFone: string; destPais: string;
  expNome: string; expCnpj: string; expIE: string; expEndereco: string; expBairro: string; expMun: string; expUF: string; expCEP: string; expFone: string; expPais: string;
  recNome: string; recCnpj: string; recIE: string; recEndereco: string; recBairro: string; recMun: string; recUF: string; recCEP: string; recFone: string; recPais: string;
  tomaNome: string; tomaCnpj: string; tomaIE: string; tomaEndereco: string; tomaBairro: string; tomaMun: string; tomaUF: string; tomaCEP: string; tomaFone: string; tomaPais: string;
  prodPredominante: string; outrasCaract: string; valorCarga: string;
  pesoBruto: string; pesoBaseCalc: string; pesoAferido: string; cubagem: string; qtdVolumes: string;
  valorTotal: string; valorReceber: string;
  componentes: { nome: string; valor: string }[];
  cst: string; baseCalculo: string; aliqICMS: string; valorICMS: string; redBC: string; valorICMSST: string;
  documentos: { tipo: string; chaveOuDoc: string; serieNumero: string }[];
  fluxoOrigem: string; fluxoPassagens: string[]; fluxoDestino: string;
  obsGeral: string; rntrc: string; statusCte: string;
  qrCodeUrl: string; insSuframa: string;
}

function parseXml(xml: string): DacteData {
  const infCte = getTagBlock(xml, "infCte");
  const ide = getTagBlock(infCte, "ide");
  const emit = getTagBlock(infCte, "emit");
  const rem = getTagBlock(infCte, "rem");
  const dest = getTagBlock(infCte, "dest");
  const exped = getTagBlock(infCte, "exped");
  const receb = getTagBlock(infCte, "receb");
  const vPrest = getTagBlock(infCte, "vPrest");
  const imp = getTagBlock(infCte, "imp");
  const infCarga = getTagBlock(infCte, "infCarga");
  const compl = getTagBlock(infCte, "compl");
  const infDoc = getTagBlock(infCte, "infDoc");
  const infModal = getTagBlock(infCte, "infModal");
  const rodo = getTagBlock(infModal, "rodo");
  const infCTeSupl = getTagBlock(xml, "infCTeSupl");

  // Endereco blocks
  const enderEmit = getTagBlock(emit, "enderEmit");
  const enderRem = getTagBlock(rem, "enderReme");
  const enderDest = getTagBlock(dest, "enderDest");
  const enderExped = getTagBlock(exped, "enderExped");
  const enderReceb = getTagBlock(receb, "enderReceb");

  // Chave de acesso
  const infCteTag = xml.match(/<infCte[^>]*Id="CTe(\d{44})"/i);
  const chaveAcesso = infCteTag ? infCteTag[1] : "";

  // Protocolo
  const protCTe = getTagBlock(xml, "protCTe");
  const nProt = getTag(protCTe, "nProt");
  const dhRecbto = getTag(protCTe, "dhRecbto");
  const cStat = getTag(protCTe, "cStat");
  let statusCte = "AUTORIZADO";
  if (cStat === "101" || cStat === "135") statusCte = "CANCELADO";
  else if (cStat === "110" || cStat === "301" || cStat === "302") statusCte = "DENEGADO";

  // Tomador
  const tomaBlock = getTagBlock(ide, "toma3") || getTagBlock(ide, "toma4") || getTagBlock(ide, "toma03") || getTagBlock(ide, "toma04");
  // Extract only the <toma> tag value - use exact match to avoid matching toma3/toma4
  const tomaExactMatch = tomaBlock.match(/<toma>([^<]*)<\/toma>/i);
  const tomaVal = tomaExactMatch ? tomaExactMatch[1].trim() : "0";
  let tomaNome = "", tomaCnpj = "", tomaIE = "", tomaEndereco = "", tomaBairro = "", tomaMun = "", tomaUF = "", tomaCEP = "", tomaFone = "", tomaPais = "BRASIL";
  const toma4 = getTagBlock(ide, "toma4") || getTagBlock(ide, "toma04");
  if (toma4) {
    tomaNome = getTag(toma4, "xNome");
    tomaCnpj = getTag(toma4, "CNPJ") || getTag(toma4, "CPF");
    tomaIE = getTag(toma4, "IE");
    const enderToma = getTagBlock(toma4, "enderToma");
    tomaEndereco = `${getTag(enderToma, "xLgr")}${getTag(enderToma, "nro") ? ", " + getTag(enderToma, "nro") : ""}`;
    tomaBairro = getTag(enderToma, "xBairro");
    tomaMun = getTag(enderToma, "xMun");
    tomaUF = getTag(enderToma, "UF");
    tomaCEP = getTag(enderToma, "CEP");
    tomaFone = getTag(enderToma, "fone") || getTag(toma4, "fone");
    tomaPais = getTag(enderToma, "xPais") || "BRASIL";
  }

  // ICMS
  const icmsBlock = getTagBlock(imp, "ICMS00") || getTagBlock(imp, "ICMS20") || getTagBlock(imp, "ICMS45") ||
    getTagBlock(imp, "ICMS60") || getTagBlock(imp, "ICMS90") || getTagBlock(imp, "ICMSOutraUF") || getTagBlock(imp, "ICMSSN") || "";
  const icmsST = getTagBlock(imp, "ICMSUFFim") || "";

  // Componentes
  const compBlocks = getAllTagBlocks(vPrest, "Comp");
  const componentes = compBlocks.map(c => ({ nome: getTag(c, "xNome"), valor: getTag(c, "vComp") }));

  // Documentos originários
  const documentos: { tipo: string; chaveOuDoc: string; serieNumero: string }[] = [];
  const infNFes = getAllTagBlocks(infDoc, "infNFe");
  for (const nfe of infNFes) {
    const chave = getTag(nfe, "chave");
    const serie = chave ? chave.substring(22, 25) : "";
    const nNF = chave ? String(parseInt(chave.substring(25, 34), 10)) : "";
    documentos.push({ tipo: "NF-e", chaveOuDoc: chave, serieNumero: serie && nNF ? `${serie}/${nNF.padStart(9, "0")}` : "" });
  }
  const infNFs = getAllTagBlocks(infDoc, "infNF");
  for (const nf of infNFs) {
    documentos.push({ tipo: "NF", chaveOuDoc: getTag(nf, "nDoc"), serieNumero: `${getTag(nf, "serie")}/${getTag(nf, "nDoc")}` });
  }
  const infOutros = getAllTagBlocks(infDoc, "infOutros");
  for (const o of infOutros) {
    documentos.push({ tipo: getTag(o, "tpDoc") || "Outros", chaveOuDoc: getTag(o, "descOutros") || getTag(o, "nDoc"), serieNumero: getTag(o, "nDoc") });
  }

  // Pesos e volumes
  let pesoBruto = "", pesoBaseCalc = "", pesoAferido = "", cubagem = "", qtdVolumes = "";
  const infQBlocks = getAllTagBlocks(infCarga, "infQ");
  for (const infQ of infQBlocks) {
    const cUnid = getTag(infQ, "cUnid");
    const tpMed = getTag(infQ, "tpMed").toUpperCase();
    const qCarga = getTag(infQ, "qCarga");
    if ((cUnid === "01" || tpMed.includes("PESO") || tpMed.includes("BRUTO")) && !pesoBruto) pesoBruto = qCarga;
    if (tpMed.includes("BASE")) pesoBaseCalc = qCarga;
    if (tpMed.includes("AFERIDO") || tpMed.includes("CALCULADO") || tpMed.includes("CUBADO")) pesoAferido = qCarga;
    if (cUnid === "00" || tpMed.includes("CUBAGEM") || tpMed.includes("M3")) cubagem = qCarga;
    if (cUnid === "03" || tpMed.includes("VOLUME") || tpMed.includes("UNIDADE") || tpMed.includes("UND")) qtdVolumes = qCarga;
  }
  if (infQBlocks.length === 1 && !pesoBruto) {
    pesoBruto = getTag(infQBlocks[0], "qCarga");
  }

  // Fluxo da carga
  const fluxo = getTagBlock(compl, "fluxo") || getTagBlock(infCte, "fluxo");
  const fluxoOrigem = getTag(fluxo, "xOrig") || "";
  const fluxoDestino = getTag(fluxo, "xDest") || "";
  const fluxoPassagens: string[] = [];
  const passRegex = /<pass>([\s\S]*?)<\/pass>/gi;
  let passMatch;
  while ((passMatch = passRegex.exec(fluxo)) !== null) {
    const xPass = getTag(passMatch[1], "xPass");
    if (xPass) fluxoPassagens.push(xPass);
  }

  // QR Code URL from infCTeSupl
  const qrCodeUrl = getTag(infCTeSupl, "qrCodCTe") || "";

  // Forma de pagamento
  const tpPag = getTag(ide, "tpPag") || "";

  // Inscrição SUFRAMA
  const insSuframa = getTag(dest, "ISUF") || "";

  // CST - detect SN
  let cst = getTag(icmsBlock, "CST") || "";
  const indSN = getTag(icmsBlock, "indSN");
  if (indSN === "1" && !cst) cst = "SN";

  return {
    modelo: getTag(ide, "mod") || "57",
    serie: getTag(ide, "serie") || "0",
    numero: getTag(ide, "nCT") || "",
    modal: getTag(ide, "modal") || "01",
    dataEmissao: getTag(ide, "dhEmi") || "",
    chaveAcesso, protocolo: nProt || "", dataProtocolo: dhRecbto || "",
    tipoCte: getTag(ide, "tpCTe") || "0",
    tipoServico: getTag(ide, "tpServ") || "0",
    tomador: tomaVal,
    cteGlobalizado: !!getTagBlock(ide, "indGlobalizado"),
    infGlobalizado: getTag(ide, "indGlobalizado") || "",
    cfop: getTag(ide, "CFOP") || "",
    natOp: getTag(ide, "natOp") || "",
    formaPag: getFormaPagamento(tpPag),
    ufInicio: getTag(ide, "UFIni") || "",
    munInicio: getTag(ide, "xMunIni") || "",
    ufFim: getTag(ide, "UFFim") || "",
    munFim: getTag(ide, "xMunFim") || "",
    emitNome: getTag(emit, "xNome") || "",
    emitFantasia: getTag(emit, "xFant") || "",
    emitCnpj: getTag(emit, "CNPJ") || getTag(emit, "CPF") || "",
    emitIE: getTag(emit, "IE") || "",
    emitEndereco: `${getTag(enderEmit, "xLgr")}${getTag(enderEmit, "nro") ? ", " + getTag(enderEmit, "nro") : ""}${getTag(enderEmit, "xCpl") ? " - " + getTag(enderEmit, "xCpl") : ""}`,
    emitBairro: getTag(enderEmit, "xBairro") || "",
    emitMun: getTag(enderEmit, "xMun") || "",
    emitUF: getTag(enderEmit, "UF") || "",
    emitCEP: getTag(enderEmit, "CEP") || "",
    emitFone: getTag(enderEmit, "fone") || getTag(emit, "fone") || "",
    remNome: getTag(rem, "xNome") || getTag(rem, "xFant") || "",
    remCnpj: getTag(rem, "CNPJ") || getTag(rem, "CPF") || "",
    remIE: getTag(rem, "IE") || "",
    remEndereco: `${getTag(enderRem, "xLgr")}${getTag(enderRem, "nro") ? ", " + getTag(enderRem, "nro") : ""}`,
    remBairro: getTag(enderRem, "xBairro") || "",
    remMun: getTag(enderRem, "xMun") || "",
    remUF: getTag(enderRem, "UF") || "",
    remCEP: getTag(enderRem, "CEP") || "",
    remFone: getTag(enderRem, "fone") || getTag(rem, "fone") || "",
    remPais: getTag(enderRem, "xPais") || "BRASIL",
    destNome: getTag(dest, "xNome") || getTag(dest, "xFant") || "",
    destCnpj: getTag(dest, "CNPJ") || getTag(dest, "CPF") || "",
    destIE: getTag(dest, "IE") || "",
    destEndereco: `${getTag(enderDest, "xLgr")}${getTag(enderDest, "nro") ? ", " + getTag(enderDest, "nro") : ""}`,
    destBairro: getTag(enderDest, "xBairro") || "",
    destMun: getTag(enderDest, "xMun") || "",
    destUF: getTag(enderDest, "UF") || "",
    destCEP: getTag(enderDest, "CEP") || "",
    destFone: getTag(enderDest, "fone") || getTag(dest, "fone") || "",
    destPais: getTag(enderDest, "xPais") || "BRASIL",
    expNome: getTag(exped, "xNome") || "",
    expCnpj: getTag(exped, "CNPJ") || getTag(exped, "CPF") || "",
    expIE: getTag(exped, "IE") || "",
    expEndereco: `${getTag(enderExped, "xLgr")}${getTag(enderExped, "nro") ? ", " + getTag(enderExped, "nro") : ""}`,
    expBairro: getTag(enderExped, "xBairro") || "",
    expMun: getTag(enderExped, "xMun") || "",
    expUF: getTag(enderExped, "UF") || "",
    expCEP: getTag(enderExped, "CEP") || "",
    expFone: getTag(enderExped, "fone") || "",
    expPais: getTag(enderExped, "xPais") || "BRASIL",
    recNome: getTag(receb, "xNome") || "",
    recCnpj: getTag(receb, "CNPJ") || getTag(receb, "CPF") || "",
    recIE: getTag(receb, "IE") || "",
    recEndereco: `${getTag(enderReceb, "xLgr")}${getTag(enderReceb, "nro") ? ", " + getTag(enderReceb, "nro") : ""}`,
    recBairro: getTag(enderReceb, "xBairro") || "",
    recMun: getTag(enderReceb, "xMun") || "",
    recUF: getTag(enderReceb, "UF") || "",
    recCEP: getTag(enderReceb, "CEP") || "",
    recFone: getTag(enderReceb, "fone") || "",
    recPais: getTag(enderReceb, "xPais") || "BRASIL",
    tomaNome, tomaCnpj, tomaIE, tomaEndereco, tomaBairro, tomaMun, tomaUF, tomaCEP, tomaFone, tomaPais,
    prodPredominante: getTag(infCarga, "proPred") || "",
    outrasCaract: getTag(infCarga, "xOutCat") || "",
    valorCarga: getTag(infCarga, "vCarga") || "0",
    pesoBruto, pesoBaseCalc, pesoAferido, cubagem, qtdVolumes,
    valorTotal: getTag(vPrest, "vTPrest") || "0",
    valorReceber: getTag(vPrest, "vRec") || "0",
    componentes,
    cst,
    baseCalculo: getTag(icmsBlock, "vBC") || "0",
    aliqICMS: getTag(icmsBlock, "pICMS") || "0",
    valorICMS: getTag(icmsBlock, "vICMS") || "0",
    redBC: getTag(icmsBlock, "pRedBC") || "0",
    valorICMSST: getTag(icmsST, "vICMSUFFim") || getTag(icmsBlock, "vICMSST") || "",
    documentos,
    fluxoOrigem, fluxoPassagens, fluxoDestino,
    obsGeral: getTag(compl, "xObs") || "",
    rntrc: getTag(rodo, "RNTRC") || "",
    statusCte,
    qrCodeUrl,
    insSuframa,
  };
}

// ─── PDF Generation ─────────────────────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MG = 20;
const CW = PAGE_W - 2 * MG;

export async function generateDactePdf(xml: string): Promise<Buffer> {
  const d = parseXml(xml);
  const barcodePng = await generateBarcodePng(d.chaveAcesso);
  // Use QR Code URL from XML if available, otherwise fallback to chave
  const qrCodePng = await generateQrCodePng(d.qrCodeUrl || d.chaveAcesso);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: MG, bufferPages: true });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const F = "Helvetica";
    const FB = "Helvetica-Bold";
    const S5 = 5.5;
    const S6 = 6;
    const S7 = 7;
    const S8 = 8;
    const S9 = 9;
    const S11 = 11;
    const LC = "#000";

    let y = MG;

    function drawRect(x: number, yp: number, w: number, h: number) {
      doc.lineWidth(0.5).strokeColor(LC).rect(x, yp, w, h).stroke();
    }
    function drawFilledRect(x: number, yp: number, w: number, h: number, fill = "#e8e8e8") {
      doc.lineWidth(0.5).strokeColor(LC).rect(x, yp, w, h).fillAndStroke(fill, LC);
    }
    function drawLabel(x: number, yp: number, w: number, label: string) {
      doc.font(F).fontSize(S5).fillColor("#333").text(label.toUpperCase(), x + 3, yp + 1.5, { width: w - 6, lineBreak: false });
    }
    function drawValue(x: number, yp: number, w: number, value: string, opts?: { bold?: boolean; size?: number; align?: "left" | "center" | "right" }) {
      doc.font(opts?.bold ? FB : F).fontSize(opts?.size || S7).fillColor("#000").text(value || "", x + 3, yp + 1, { width: w - 6, align: opts?.align || "left", lineBreak: false });
    }
    function cell(x: number, yp: number, w: number, h: number, label: string, value: string, opts?: { bold?: boolean; size?: number; align?: "left" | "center" | "right" }) {
      drawRect(x, yp, w, h);
      drawLabel(x, yp, w, label);
      drawValue(x, yp + 8, w, value, opts);
    }
    function sectionBar(yp: number, title: string): number {
      const h = 11;
      drawFilledRect(MG, yp, CW, h);
      doc.font(FB).fontSize(S6).fillColor("#000").text(title, MG + 3, yp + 2.5, { width: CW - 6, lineBreak: false });
      return yp + h;
    }
    function checkPage(needed: number): void {
      if (y + needed > PAGE_H - MG - 10) { doc.addPage(); y = MG; }
    }

    function drawParticipant(x: number, yp: number, w: number, h: number, title: string, nome: string, endereco: string, bairro: string, mun: string, cep: string, cnpj: string, ie: string, uf: string, pais: string, fone: string) {
      drawRect(x, yp, w, h);
      doc.font(FB).fontSize(S5).fillColor("#000").text(title, x + 4, yp + 2, { lineBreak: false });
      if (!nome) return;
      let py = yp + 10;
      const px = x + 5;
      const pw = w - 10;
      doc.font(F).fontSize(S6).fillColor("#000");
      doc.text(`NOME: ${nome}`, px, py, { width: pw, lineBreak: false }); py += 9;
      doc.text(`ENDEREÇO: ${endereco}`, px, py, { width: pw, lineBreak: false }); py += 9;
      doc.text(`MUNICÍPIO: ${mun}    CEP: ${cep}`, px, py, { width: pw, lineBreak: false }); py += 9;
      doc.text(`CNPJ/CPF: ${formatCnpjCpf(cnpj)}    IE: ${ie}`, px, py, { width: pw, lineBreak: false }); py += 9;
      doc.text(`UF: ${uf}   PAÍS: ${pais}   FONE: ${fone}`, px, py, { width: pw, lineBreak: false });
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. RECIBO
    // ═══════════════════════════════════════════════════════════════
    const reciboH = 42;
    const rTextW = CW * 0.48;
    const rMidW = CW * 0.26;
    const rRightW = CW * 0.26;

    drawRect(MG, y, rTextW, reciboH);
    doc.font(F).fontSize(S5).fillColor("#000");
    doc.text("DECLARO QUE RECEBI OS VOLUMES DESTE CONHECIMENTO EM PERFEITO ESTADO PELO QUE DOU POR CUMPRIDO O PRESENTE CONTRATO DE TRANSPORTE", MG + 4, y + 3, { width: rTextW - 8 });

    const nameY = y + 16;
    doc.lineWidth(0.3);
    drawRect(MG, nameY, rTextW * 0.4, reciboH - 16);
    doc.font(F).fontSize(S5).fillColor("#333").text("NOME", MG + 4, nameY + 2, { lineBreak: false });
    drawRect(MG + rTextW * 0.4, nameY, rTextW * 0.2, reciboH - 16);
    doc.font(F).fontSize(S5).fillColor("#333").text("RG", MG + rTextW * 0.4 + 4, nameY + 2, { lineBreak: false });
    drawRect(MG + rTextW * 0.6, nameY, rTextW * 0.4, reciboH - 16);
    doc.font(F).fontSize(S5).fillColor("#333").text("ASSINATURA / CARIMBO", MG + rTextW * 0.6 + 4, nameY + 2, { lineBreak: false });

    const midX = MG + rTextW;
    drawRect(midX, y, rMidW, reciboH / 2);
    drawLabel(midX, y, rMidW, "TÉRMINO DA PRESTAÇÃO - DATA/HORA");
    drawRect(midX, y + reciboH / 2, rMidW, reciboH / 2);
    drawLabel(midX, y + reciboH / 2, rMidW, "INÍCIO DA PRESTAÇÃO - DATA/HORA");

    const cteX = MG + rTextW + rMidW;
    drawRect(cteX, y, rRightW, reciboH);
    doc.font(FB).fontSize(14).fillColor("#000").text("CT-E", cteX + 4, y + 4, { width: rRightW - 8, align: "center", lineBreak: false });
    doc.font(F).fontSize(S6).text(`NRO. DOCUMENTO:`, cteX + 4, y + 19, { width: rRightW - 8, align: "center", lineBreak: false });
    doc.font(FB).fontSize(S7).text(formatNumero(d.numero), cteX + 4, y + 27, { width: rRightW - 8, align: "center", lineBreak: false });
    doc.font(F).fontSize(S6).text(`SÉRIE: ${d.serie}`, cteX + 4, y + 35, { width: rRightW - 8, align: "center", lineBreak: false });

    y += reciboH + 1;

    // ═══════════════════════════════════════════════════════════════
    // 2. CABEÇALHO (Emitente + DACTE + Modal + QR Code)
    // ═══════════════════════════════════════════════════════════════
    const headerH = 96;
    const emitW = CW * 0.30;
    const dacteW = CW * 0.50;
    const qrW = CW * 0.20;

    // Emitente box
    drawRect(MG, y, emitW, headerH);
    doc.font(FB).fontSize(S5).fillColor("#333").text("IDENTIFICAÇÃO DO EMITENTE", MG + 4, y + 2, { lineBreak: false });
    let etY = y + 11;
    // Nome do emitente com tamanho adequado
    const emitNomeDisplay = d.emitFantasia || d.emitNome;
    const emitNomeFontSize = emitNomeDisplay.length > 25 ? S7 : S8;
    doc.font(FB).fontSize(emitNomeFontSize).fillColor("#000").text(emitNomeDisplay, MG + 5, etY, { width: emitW - 10, lineBreak: false }); etY += 12;
    doc.font(F).fontSize(S6).fillColor("#000");
    doc.text(`CNPJ: ${formatCnpjCpf(d.emitCnpj)}   IE: ${d.emitIE}`, MG + 5, etY, { width: emitW - 10, lineBreak: false }); etY += 10;
    doc.text(`ENDEREÇO: ${d.emitEndereco}`, MG + 5, etY, { width: emitW - 10, lineBreak: true, height: 14 }); etY += 10;
    doc.text(`BAIRRO: ${d.emitBairro}`, MG + 5, etY, { width: emitW - 10, lineBreak: false }); etY += 10;
    doc.text(`MUNICÍPIO: ${d.emitMun}   UF: ${d.emitUF}   CEP: ${d.emitCEP}`, MG + 5, etY, { width: emitW - 10, lineBreak: false }); etY += 10;
    doc.text(`FONE: ${d.emitFone}`, MG + 5, etY, { width: emitW - 10, lineBreak: false });

    // DACTE center
    const dacteXPos = MG + emitW;
    drawRect(dacteXPos, y, dacteW, headerH);

    // DACTE title + Modal
    const dacteModalY = y;
    const dacteTitleW = dacteW - 80;
    drawFilledRect(dacteXPos, dacteModalY, dacteTitleW, 14);
    doc.font(FB).fontSize(S9).fillColor("#000").text("DACTE", dacteXPos + 5, dacteModalY + 2, { lineBreak: false });
    doc.font(F).fontSize(S5).text("Documento Auxiliar do Conhecimento", dacteXPos + 44, dacteModalY + 1, { width: dacteTitleW - 48, lineBreak: false });
    doc.font(F).fontSize(S5).text("de Transporte Eletrônico", dacteXPos + 44, dacteModalY + 7, { width: dacteTitleW - 48, lineBreak: false });

    // Modal box
    drawRect(dacteXPos + dacteTitleW, dacteModalY, 80, 14);
    doc.font(FB).fontSize(S6).fillColor("#000").text("MODAL", dacteXPos + dacteTitleW + 4, dacteModalY + 1, { lineBreak: false });
    doc.font(FB).fontSize(S8).text(getModalLabel(d.modal), dacteXPos + dacteTitleW + 4, dacteModalY + 7, { width: 72, lineBreak: false });

    // MODELO/SÉRIE/NÚMERO/FL/DATA
    const infoY = y + 14;
    const infoH = 18;
    const c1 = dacteW * 0.11; const c2 = dacteW * 0.09; const c3 = dacteW * 0.13;
    const c4 = dacteW * 0.07; const c5 = dacteW * 0.30; const c6 = dacteW * 0.30;
    cell(dacteXPos, infoY, c1, infoH, "MODELO", d.modelo, { bold: true, align: "center" });
    cell(dacteXPos + c1, infoY, c2, infoH, "SÉRIE", d.serie, { bold: true, align: "center" });
    cell(dacteXPos + c1 + c2, infoY, c3, infoH, "NÚMERO", formatNumero(d.numero), { bold: true, align: "center" });
    cell(dacteXPos + c1 + c2 + c3, infoY, c4, infoH, "FL", "1/1", { align: "center" });
    cell(dacteXPos + c1 + c2 + c3 + c4, infoY, c5, infoH, "DATA E HORA DE EMISSÃO", formatDate(d.dataEmissao), { size: S6 });
    cell(dacteXPos + c1 + c2 + c3 + c4 + c5, infoY, c6, infoH, "INSC. SUFRAMA DO DESTINATÁRIO", d.insSuframa);

    // Barcode + Chave de acesso
    const barcodeY = infoY + infoH;
    const barcodeH = headerH - 14 - infoH;
    drawRect(dacteXPos, barcodeY, dacteW, barcodeH);
    if (barcodePng.length > 0) {
      try { doc.image(barcodePng, dacteXPos + 10, barcodeY + 3, { width: dacteW - 20, height: 20 }); } catch {}
    }
    doc.font(F).fontSize(S5).fillColor("#333").text("CHAVE DE ACESSO", dacteXPos + 6, barcodeY + 25, { lineBreak: false });
    doc.font(FB).fontSize(S6).fillColor("#000").text(formatChave(d.chaveAcesso), dacteXPos + 6, barcodeY + 33, { width: dacteW - 12, align: "center" });
    doc.font(F).fontSize(4.5).fillColor("#555").text(
      "Consulta de autenticidade no portal nacional do CT-e, no site da Sefaz Autorizadora,",
      dacteXPos + 6, barcodeY + 43, { width: dacteW - 12, lineBreak: false }
    );
    doc.font(F).fontSize(4.5).text(
      "ou em http://www.cte.fazenda.gov.br",
      dacteXPos + 6, barcodeY + 49, { width: dacteW - 12, lineBreak: false }
    );

    // QR Code
    const qrXPos = MG + emitW + dacteW;
    drawRect(qrXPos, y, qrW, headerH);
    if (qrCodePng.length > 0) {
      try {
        const qrSize = Math.min(qrW - 8, headerH - 8);
        doc.image(qrCodePng, qrXPos + (qrW - qrSize) / 2, y + (headerH - qrSize) / 2, { width: qrSize, height: qrSize });
      } catch {}
    }

    y += headerH;

    // ═══════════════════════════════════════════════════════════════
    // 3. TIPO CT-e / SERVIÇO / TOMADOR / FORMA PAGAMENTO / PROTOCOLO
    // ═══════════════════════════════════════════════════════════════
    const tipoH = 20;
    cell(MG, y, CW * 0.14, tipoH, "TIPO DO CT-E", getTipoCte(d.tipoCte), { bold: true });
    cell(MG + CW * 0.14, y, CW * 0.14, tipoH, "TIPO DO SERVIÇO", getTipoServico(d.tipoServico), { bold: true });
    cell(MG + CW * 0.28, y, CW * 0.18, tipoH, "TOMADOR DO SERVIÇO", getTomador(d.tomador), { bold: true });
    cell(MG + CW * 0.46, y, CW * 0.14, tipoH, "FORMA DE PAGAMENTO", d.formaPag, { bold: true });
    cell(MG + CW * 0.60, y, CW * 0.40, tipoH, "PROTOCOLO DE AUTORIZAÇÃO DE USO", `${d.protocolo}  ${formatDate(d.dataProtocolo)}`, { size: S6 });
    y += tipoH;

    // ═══════════════════════════════════════════════════════════════
    // 4. CFOP / CT-e GLOBALIZADO
    // ═══════════════════════════════════════════════════════════════
    const cfopH = 18;
    cell(MG, y, CW * 0.50, cfopH, "CFOP - NATUREZA DA PRESTAÇÃO", `${d.cfop} - ${d.natOp}`, { size: S6 });
    cell(MG + CW * 0.50, y, CW * 0.50, cfopH, "PROTOCOLO DE AUTORIZAÇÃO DE USO", `${d.protocolo}`, { size: S6 });
    y += cfopH;

    // ═══════════════════════════════════════════════════════════════
    // 5. INÍCIO / TÉRMINO DA PRESTAÇÃO
    // ═══════════════════════════════════════════════════════════════
    cell(MG, y, CW / 2, 18, "INÍCIO DA PRESTAÇÃO", `${d.munInicio} - ${d.ufInicio}`, { bold: true });
    cell(MG + CW / 2, y, CW / 2, 18, "TÉRMINO DA PRESTAÇÃO", `${d.munFim} - ${d.ufFim}`, { bold: true });
    y += 18;

    // ═══════════════════════════════════════════════════════════════
    // 6. REMETENTE / DESTINATÁRIO
    // ═══════════════════════════════════════════════════════════════
    const halfW = CW / 2;
    const partH = 56;
    drawParticipant(MG, y, halfW, partH, "REMETENTE", d.remNome, d.remEndereco, d.remBairro, d.remMun, d.remCEP, d.remCnpj, d.remIE, d.remUF, d.remPais, d.remFone);
    drawParticipant(MG + halfW, y, halfW, partH, "DESTINATÁRIO", d.destNome, d.destEndereco, d.destBairro, d.destMun, d.destCEP, d.destCnpj, d.destIE, d.destUF, d.destPais, d.destFone);
    y += partH;

    // ═══════════════════════════════════════════════════════════════
    // 7. EXPEDIDOR / RECEBEDOR
    // ═══════════════════════════════════════════════════════════════
    drawParticipant(MG, y, halfW, partH, "EXPEDIDOR", d.expNome, d.expEndereco, d.expBairro, d.expMun, d.expCEP, d.expCnpj, d.expIE, d.expUF, d.expPais, d.expFone);
    drawParticipant(MG + halfW, y, halfW, partH, "RECEBEDOR", d.recNome, d.recEndereco, d.recBairro, d.recMun, d.recCEP, d.recCnpj, d.recIE, d.recUF, d.recPais, d.recFone);
    y += partH;

    // ═══════════════════════════════════════════════════════════════
    // 8. TOMADOR DO SERVIÇO
    // ═══════════════════════════════════════════════════════════════
    const tomaH = 56;
    let tN = "", tC = "", tI = "", tE = "", tB = "", tM2 = "", tU = "", tCEP = "", tFo = "", tP = "";
    if (d.tomador === "4" && d.tomaNome) {
      tN = d.tomaNome; tC = d.tomaCnpj; tI = d.tomaIE; tE = d.tomaEndereco;
      tB = d.tomaBairro; tM2 = d.tomaMun; tU = d.tomaUF; tCEP = d.tomaCEP; tFo = d.tomaFone; tP = d.tomaPais;
    } else if (d.tomador === "0") {
      tN = d.remNome; tC = d.remCnpj; tI = d.remIE; tE = d.remEndereco;
      tB = d.remBairro; tM2 = d.remMun; tU = d.remUF; tCEP = d.remCEP; tFo = d.remFone; tP = d.remPais;
    } else if (d.tomador === "1") {
      tN = d.expNome; tC = d.expCnpj; tI = d.expIE; tE = d.expEndereco;
      tB = d.expBairro; tM2 = d.expMun; tU = d.expUF; tCEP = d.expCEP; tFo = d.expFone; tP = d.expPais;
    } else if (d.tomador === "2") {
      tN = d.recNome; tC = d.recCnpj; tI = d.recIE; tE = d.recEndereco;
      tB = d.recBairro; tM2 = d.recMun; tU = d.recUF; tCEP = d.recCEP; tFo = d.recFone; tP = d.recPais;
    } else if (d.tomador === "3") {
      tN = d.destNome; tC = d.destCnpj; tI = d.destIE; tE = d.destEndereco;
      tB = d.destBairro; tM2 = d.destMun; tU = d.destUF; tCEP = d.destCEP; tFo = d.destFone; tP = d.destPais;
    }
    drawParticipant(MG, y, CW, tomaH, "TOMADOR DO SERVIÇO", tN, tE, tB, tM2, tCEP, tC, tI, tU, tP, tFo);
    y += tomaH;

    // ═══════════════════════════════════════════════════════════════
    // 9. PRODUTO PREDOMINANTE
    // ═══════════════════════════════════════════════════════════════
    const prodH = 20;
    cell(MG, y, CW * 0.40, prodH, "PRODUTO PREDOMINANTE", d.prodPredominante, { bold: true, size: S8 });
    cell(MG + CW * 0.40, y, CW * 0.30, prodH, "OUTRAS CARACTERÍSTICAS DA CARGA", d.outrasCaract);
    cell(MG + CW * 0.70, y, CW * 0.30, prodH, "VALOR TOTAL DA CARGA", formatMoney(d.valorCarga), { bold: true, align: "right", size: S8 });
    y += prodH;

    // ═══════════════════════════════════════════════════════════════
    // 10. PESOS E VOLUMES
    // ═══════════════════════════════════════════════════════════════
    const pesoH = 20;
    const pw = CW / 5;
    cell(MG, y, pw, pesoH, "PESO BRUTO (KG)", formatWeight(d.pesoBruto), { bold: true, align: "right" });
    cell(MG + pw, y, pw, pesoH, "PESO BASE CÁLCULO (KG)", formatWeight(d.pesoBaseCalc), { bold: true, align: "right" });
    cell(MG + pw * 2, y, pw, pesoH, "PESO AFERIDO (KG)", formatWeight(d.pesoAferido), { bold: true, align: "right" });
    cell(MG + pw * 3, y, pw, pesoH, "CUBAGEM(M3)", formatWeight(d.cubagem), { align: "right" });
    cell(MG + pw * 4, y, pw, pesoH, "QTDE(VOL)", d.qtdVolumes || "", { align: "right" });
    y += pesoH;

    // ═══════════════════════════════════════════════════════════════
    // 11. COMPONENTES DO VALOR DA PRESTAÇÃO
    // ═══════════════════════════════════════════════════════════════
    checkPage(50);
    y = sectionBar(y, "COMPONENTES DO VALOR DA PRESTAÇÃO DE SERVIÇO");
    const compRowH = 14;
    const compNameW = CW * 0.14;
    const compValW = CW * 0.10;
    const compPairW = compNameW + compValW;
    const remainW = CW - compPairW * 3;

    // Header row
    for (let col = 0; col < 3; col++) {
      const cx = MG + col * compPairW;
      drawRect(cx, y, compNameW, compRowH);
      doc.font(FB).fontSize(S5).fillColor("#000").text("NOME", cx + 3, y + 4, { lineBreak: false });
      drawRect(cx + compNameW, y, compValW, compRowH);
      doc.font(FB).fontSize(S5).text("VALOR", cx + compNameW + 3, y + 4, { lineBreak: false });
    }
    // Total header
    drawRect(MG + compPairW * 3, y, remainW, compRowH);
    drawLabel(MG + compPairW * 3, y, remainW, "VALOR TOTAL DO SERVIÇO");
    doc.font(FB).fontSize(S8).fillColor("#000").text(formatMoney(d.valorTotal), MG + compPairW * 3 + 3, y + 6, { width: remainW - 6, align: "right", lineBreak: false });
    y += compRowH;

    // Data rows
    const compRows = Math.max(1, Math.ceil(d.componentes.length / 3));
    for (let row = 0; row < compRows; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const comp = d.componentes[idx];
        const cx = MG + col * compPairW;
        drawRect(cx, y, compNameW, compRowH);
        drawRect(cx + compNameW, y, compValW, compRowH);
        if (comp) {
          doc.font(F).fontSize(S6).fillColor("#000").text(comp.nome, cx + 3, y + 4, { width: compNameW - 6 });
          doc.font(F).fontSize(S6).text(formatMoney(comp.valor), cx + compNameW + 3, y + 4, { width: compValW - 6, align: "right" });
        }
      }
      if (row === 0) {
        drawRect(MG + compPairW * 3, y, remainW, compRowH);
        drawLabel(MG + compPairW * 3, y, remainW, "VALOR A RECEBER");
        doc.font(FB).fontSize(S8).fillColor("#000").text(formatMoney(d.valorReceber), MG + compPairW * 3 + 3, y + 6, { width: remainW - 6, align: "right", lineBreak: false });
      } else {
        drawRect(MG + compPairW * 3, y, remainW, compRowH);
      }
      y += compRowH;
    }

    // ═══════════════════════════════════════════════════════════════
    // 12. INFORMAÇÕES RELATIVAS AO IMPOSTO
    // ═══════════════════════════════════════════════════════════════
    y = sectionBar(y, "INFORMAÇÕES RELATIVAS AO IMPOSTO");
    const impH = 20;
    const impW1 = CW * 0.28; // Situação tributária
    const impW2 = CW * 0.14; // Base cálculo
    const impW3 = CW * 0.12; // Alíq ICMS
    const impW4 = CW * 0.14; // Valor ICMS
    const impW5 = CW * 0.14; // % Red BC
    const impW6 = CW * 0.18; // Valor ICMS ST
    cell(MG, y, impW1, impH, "SITUAÇÃO TRIBUTÁRIA", getCstLabel(d.cst), { size: S6, bold: true });
    cell(MG + impW1, y, impW2, impH, "BASE DE CALCULO", formatMoney(d.baseCalculo), { align: "right", bold: true });
    cell(MG + impW1 + impW2, y, impW3, impH, "ALÍQ ICMS", parseFloat(d.aliqICMS) > 0 ? formatMoney(d.aliqICMS) : "", { align: "right" });
    cell(MG + impW1 + impW2 + impW3, y, impW4, impH, "VALOR ICMS", formatMoney(d.valorICMS), { align: "right" });
    cell(MG + impW1 + impW2 + impW3 + impW4, y, impW5, impH, "% RED. BC ICMS", parseFloat(d.redBC) > 0 ? d.redBC : "", { align: "center" });
    cell(MG + impW1 + impW2 + impW3 + impW4 + impW5, y, impW6, impH, "VALOR ICMS ST", d.valorICMSST ? formatMoney(d.valorICMSST) : "", { align: "right" });
    y += impH;

    // ═══════════════════════════════════════════════════════════════
    // 13. DOCUMENTOS ORIGINÁRIOS
    // ═══════════════════════════════════════════════════════════════
    checkPage(40);
    y = sectionBar(y, "DOCUMENTOS ORIGINÁRIOS");
    const docRowH = 12;
    const docHalf = CW / 2;
    const dw1 = docHalf * 0.12;
    const dw2 = docHalf * 0.56;
    const dw3 = docHalf * 0.32;

    // Header
    for (let col = 0; col < 2; col++) {
      const bx = MG + col * docHalf;
      drawRect(bx, y, dw1, docRowH);
      doc.font(FB).fontSize(S5).fillColor("#000").text("TIPO DOC", bx + 3, y + 3, { width: dw1 - 6, lineBreak: false });
      drawRect(bx + dw1, y, dw2, docRowH);
      doc.font(FB).fontSize(S5).text("CNPJ/CHAVE/OBS", bx + dw1 + 3, y + 3, { lineBreak: false });
      drawRect(bx + dw1 + dw2, y, dw3, docRowH);
      doc.font(FB).fontSize(S5).text("SÉRIE/NRO. DOCUMENTO", bx + dw1 + dw2 + 3, y + 3, { lineBreak: false });
    }
    y += docRowH;

    // Garantir pelo menos 4 linhas de dados (mesmo vazias) para manter layout fiel ao DACTE oficial
    const minDocRows = 4;
    const docPairs = Math.max(minDocRows, Math.ceil(d.documentos.length / 2));
    for (let i = 0; i < docPairs; i++) {
      checkPage(docRowH + 5);
      for (let col = 0; col < 2; col++) {
        const docItem = d.documentos[i * 2 + col];
        const bx = MG + col * docHalf;
        drawRect(bx, y, dw1, docRowH);
        drawRect(bx + dw1, y, dw2, docRowH);
        drawRect(bx + dw1 + dw2, y, dw3, docRowH);
        if (docItem) {
          doc.font(F).fontSize(S5).fillColor("#000");
          doc.text(docItem.tipo, bx + 3, y + 3, { width: dw1 - 6, lineBreak: false });
          doc.text(docItem.chaveOuDoc || "", bx + dw1 + 3, y + 3, { width: dw2 - 6, lineBreak: false });
          doc.text(docItem.serieNumero, bx + dw1 + dw2 + 3, y + 3, { width: dw3 - 6, lineBreak: false });
        }
      }
      y += docRowH;
    }

    // ═══════════════════════════════════════════════════════════════
    // 14. OBSERVAÇÕES GERAIS
    // ═══════════════════════════════════════════════════════════════
    checkPage(35);
    y = sectionBar(y, "OBSERVAÇÕES");
    const obsMinH = 25;
    const obsH = d.obsGeral ? Math.min(Math.max(obsMinH, Math.ceil(d.obsGeral.length / 120) * 8 + 4), 60) : obsMinH;
    drawRect(MG, y, CW, obsH);
    if (d.obsGeral) {
      doc.font(F).fontSize(S5).fillColor("#000").text(d.obsGeral, MG + 4, y + 3, { width: CW - 8, height: obsH - 6 });
    }
    y += obsH;

    // ═══════════════════════════════════════════════════════════════
    // 15. MODAL RODOVIÁRIO
    // ═══════════════════════════════════════════════════════════════
    checkPage(40);
    if (d.modal === "01" || !d.modal) {
      y = sectionBar(y, "INFORMAÇÕES ESPECÍFICAS DO MODAL RODOVIÁRIO");
      cell(MG, y, CW, 16, "RNTRC DA EMPRESA", d.rntrc, { bold: true });
      y += 16;

      // Texto legislação
      drawRect(MG, y, CW, 16);
      doc.font(F).fontSize(4.5).fillColor("#333").text(
        "ESTE CONHECIMENTO DE TRANSPORTE ATENDE À LEGISLAÇÃO DE TRANSPORTE RODOVIÁRIO EM VIGOR",
        MG + 4, y + 5, { width: CW - 8, align: "center", lineBreak: false }
      );
      y += 16;
    }

    // ═══════════════════════════════════════════════════════════════
    // 16. RODAPÉ
    // ═══════════════════════════════════════════════════════════════
    checkPage(22);
    const footH = 18;
    drawRect(MG, y, CW / 2, footH);
    doc.font(FB).fontSize(S5).fillColor("#000").text("USO EXCLUSIVO DO EMISSOR DO CT-E", MG + 4, y + 3, { lineBreak: false });
    drawRect(MG + CW / 2, y, CW / 2, footH);
    doc.font(FB).fontSize(S5).fillColor("#000").text("RESERVADO AO FISCO", MG + CW / 2 + 4, y + 3, { lineBreak: false });
    y += footH;

    // ═══════════════════════════════════════════════════════════════
    // STATUS WATERMARK (CANCELADO / DENEGADO)
    // ═══════════════════════════════════════════════════════════════
    if (d.statusCte === "CANCELADO" || d.statusCte === "DENEGADO") {
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        doc.save();
        doc.fontSize(70).fillColor("red").opacity(0.12);
        doc.translate(PAGE_W / 2, PAGE_H / 2);
        doc.rotate(-45, { origin: [0, 0] });
        doc.text(d.statusCte, -180, -30, { width: 400, align: "center" });
        doc.restore();
      }
    }

    // Data de impressão no rodapé
    const lastPage = doc.bufferedPageRange();
    doc.switchToPage(lastPage.start + lastPage.count - 1);
    const now = new Date();
    const impressao = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    doc.font(F).fontSize(4.5).fillColor("#999").text(
      `Impresso em ${impressao} - Pegasus by LAN7 Tecnologia`,
      MG, PAGE_H - MG - 6, { width: CW, align: "right", lineBreak: false }
    );

    doc.end();
  });
}

export { parseXml, DacteData };
