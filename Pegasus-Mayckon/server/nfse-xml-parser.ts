/**
 * Parser completo de XML NFSe para relatórios
 * Extrai todos os campos de tributação, emitente, tomador, serviço, etc.
 */

export interface NfseCompleta {
  // Cabeçalho
  chaveAcesso: string;
  numeroNfse: string;
  competencia: string;
  dataEmissao: string;
  numeroDps: string;
  serieDps: string;
  dataEmissaoDps: string;

  // Emitente
  emitenteCnpj: string;
  emitenteInscMunicipal: string;
  emitenteTelefone: string;
  emitenteNome: string;
  emitenteEmail: string;
  emitenteEndereco: string;
  emitenteMunicipio: string;
  emitenteUf: string;
  emitenteCep: string;
  emitenteSimplesNacional: string;
  emitenteRegimeApuracao: string;

  // Tomador
  tomadorCnpj: string;
  tomadorInscMunicipal: string;
  tomadorTelefone: string;
  tomadorNome: string;
  tomadorEmail: string;
  tomadorEndereco: string;
  tomadorMunicipio: string;
  tomadorUf: string;
  tomadorCep: string;

  // Serviço Prestado
  codigoTribNacional: string;
  codigoTribMunicipal: string;
  localPrestacao: string;
  paisPrestacao: string;
  descricaoServico: string;
  codigoNbs: string;
  codigoInternoContrib: string;

  // Tributação Municipal
  tributacaoIssqn: string;
  paisResultadoPrestacao: string;
  municipioIncidenciaIssqn: string;
  regimeEspecialTributacao: string;
  tipoImunidade: string;
  suspensaoExigibilidade: string;
  numProcessoSuspensao: string;
  beneficioMunicipal: string;
  valorServico: string;
  descontoIncondicionado: string;
  totalDeducoes: string;
  calculoBm: string;
  bcIssqn: string;
  aliquotaAplicada: string;
  retencaoIssqn: string; // "Retido" ou "Não Retido"
  issqnApurado: string;

  // Tributação Federal — PIS/COFINS
  cstPisCofins: string;
  baseCalculoPisCofins: string;
  aliquotaPis: string;
  aliquotaCofins: string;
  pis: string;
  cofins: string;
  retencaoPisCofins: string;
  // Tributação Federal — IRRF / CSLL / CP
  irrf: string;
  cp: string;
  csll: string;
  totalTributacaoFederal: string;

  // Valor Total
  valorServicoTotal: string;
  descontoCondicionado: string;
  descontoIncondicionadoTotal: string;
  issqnRetido: string;
  irrfCpCsllRetidos: string;
  pisCofinsRetidos: string;
  valorLiquido: string;

  // Totais Aproximados
  tributosFederais: string;
  tributosEstaduais: string;
  tributosMunicipais: string;

  // Informações Complementares
  informacoesComplementares: string;

  // Direção
  direcao: "emitida" | "recebida";

  // Flags calculados
  temRetencaoIssqn: boolean;
  temRetencaoFederal: boolean;
  temRetencao: boolean;

  // IBS/CBS (Reforma Tributária)
  ibsCbsPresente: boolean;
  cstIbsCbs: string;
  ibsCbsBaseCalculo: string;
  ibsCbsAliqIbsUf: string;
  ibsCbsAliqIbsMun: string;
  ibsCbsAliqCbs: string;
  ibsCbsVIbsUf: string;
  ibsCbsVIbsMun: string;
  ibsCbsVCbs: string;
  ibsCbsVTotalIbsCbs: string;
}

/**
 * Extrai um valor de tag XML simples
 */
function getTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? "";
}

/**
 * Extrai valor de um atributo XML
 */
function getAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? "";
}

/**
 * Extrai conteúdo de uma seção XML
 */
function getSection(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1] ?? "";
}

/**
 * Formata CNPJ
 */
function formatCnpj(cnpj: string): string {
  if (!cnpj) return "";
  const clean = cnpj.replace(/[^\d]/g, "");
  if (clean.length === 14) {
    return `${clean.slice(0,2)}.${clean.slice(2,5)}.${clean.slice(5,8)}/${clean.slice(8,12)}-${clean.slice(12)}`;
  }
  if (clean.length === 11) {
    return `${clean.slice(0,3)}.${clean.slice(3,6)}.${clean.slice(6,9)}-${clean.slice(9)}`;
  }
  return cnpj;
}

/**
 * Formata valor monetário
 */
function formatMoney(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return `R$ ${num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formata alíquota como percentual
 */
function formatAliquota(value: string): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return `${(num * 100).toFixed(2)}%`;
}

/**
 * Resolve UF a partir do código IBGE do município (2 primeiros dígitos)
 */
function resolveUfFromCMun(cMun: string): string {
  if (!cMun || cMun.length < 2) return "";
  const ufMap: Record<string, string> = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
    "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
    "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE",
    "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
    "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT",
    "52": "GO", "53": "DF",
  };
  return ufMap[cMun.substring(0, 2)] || "";
}

/**
 * Extrai endereço completo de uma seção XML
 */
function extractEndereco(sectionXml: string, fullXml?: string): { endereco: string; municipio: string; uf: string; cep: string; cMun: string } {
  const endSection = getSection(sectionXml, "end") || getSection(sectionXml, "ender") || getSection(sectionXml, "endNac");
  const endNacSection = getSection(sectionXml, "endNac") || getSection(endSection, "endNac") || "";
  const xmlToSearch = endSection || sectionXml;
  
  const logradouro = getTag(xmlToSearch, "xLgr") || getTag(sectionXml, "xLgr");
  const numero = getTag(xmlToSearch, "nro") || getTag(sectionXml, "nro");
  const complemento = getTag(xmlToSearch, "xCpl") || getTag(sectionXml, "xCpl");
  const bairro = getTag(xmlToSearch, "xBairro") || getTag(sectionXml, "xBairro");
  const cMun = getTag(endNacSection, "cMun") || getTag(xmlToSearch, "cMun") || getTag(sectionXml, "cMun");
  // Buscar nome do município: xMun, ou resolver pelo xLocEmi/xLocIncid do XML completo
  let municipio = getTag(xmlToSearch, "xMun") || getTag(sectionXml, "xMun") || "";
  let uf = getTag(xmlToSearch, "UF") || getTag(sectionXml, "UF");
  // Fallback: resolver UF a partir do código IBGE do município
  if (!uf && cMun) {
    uf = resolveUfFromCMun(cMun);
  }
  const cep = getTag(xmlToSearch, "CEP") || getTag(sectionXml, "CEP");

  // Fallback: se não tem xMun, usar xLocEmi/xLocIncid do XML completo quando cMun bate
  if (!municipio && cMun && fullXml) {
    const xLocEmi = getTag(fullXml, "xLocEmi") || "";
    const xLocIncid = getTag(fullXml, "xLocIncid") || "";
    const cLocEmi = getTag(fullXml, "cLocEmi") || "";
    const cLocIncid = getTag(fullXml, "cLocIncid") || "";
    if (cMun === cLocEmi && xLocEmi) {
      municipio = xLocEmi;
    } else if (cMun === cLocIncid && xLocIncid) {
      municipio = xLocIncid;
    } else if (xLocEmi) {
      // Se só tem um município no XML, usar como fallback
      municipio = xLocEmi;
    }
  }

  const parts = [logradouro, numero, complemento, bairro].filter(Boolean);
  return {
    endereco: parts.join(", "),
    municipio: municipio ? (uf ? `${municipio} - ${uf}` : municipio) : "",
    uf,
    cep,
    cMun,
  };
}

/**
 * Mapeia código de tributação do ISSQN para descrição legível
 */
function mapTributacaoIssqn(code: string): string {
  const map: Record<string, string> = {
    "1": "Operação Tributável",
    "2": "Imunidade",
    "3": "Isenção",
    "4": "Exportação",
    "5": "Não Incidência",
    "6": "Operação Tributável Fixo",
  };
  return map[code] || code || "";
}

/**
 * Mapeia código de retenção do ISSQN
 * Conforme especificação NFSe Nacional:
 * 1 = Não Retido
 * 2 = Retido pelo Tomador
 * 3 = Retido pelo Intermediário
 */
function mapRetencaoIssqn(code: string): string {
  const map: Record<string, string> = {
    "1": "Não Retido",
    "2": "Retido",
    "3": "Retido",
  };
  return map[code] || (code === "" ? "" : code);
}

/**
 * Mapeia regime especial de tributação
 */
function mapRegimeEspecial(code: string): string {
  const map: Record<string, string> = {
    "0": "Nenhum",
    "1": "Microempresa Municipal",
    "2": "Estimativa",
    "3": "Sociedade de Profissionais",
    "4": "Cooperativa",
    "5": "MEI",
    "6": "ME/EPP Simples Nacional",
  };
  return map[code] || code || "";
}

/**
 * Mapeia Simples Nacional
 */
function mapSimplesNacional(code: string): string {
  const map: Record<string, string> = {
    "1": "Não Optante",
    "2": "Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)",
    "3": "Optante - MEI",
  };
  return map[code] || code || "";
}

/**
 * Mapeia regime de apuração
 */
function mapRegimeApuracao(code: string): string {
  const map: Record<string, string> = {
    "1": "Regime de apuração dos tributos federais e municipal pelo Simples Nacional",
    "2": "Regime de apuração dos tributos federais pelo Simples Nacional e municipal por regime próprio",
    "3": "Regime de apuração dos tributos por regime próprio",
  };
  return map[code] || code || "";
}

/**
 * Parseia XML completo da NFSe para relatório
 */
/**
 * Versão raw do parser - retorna valores numéricos sem formatação para uso em Excel/cálculos
 */
export interface NfseCompletaRaw extends Omit<NfseCompleta, 
  'valorServico' | 'descontoIncondicionado' | 'totalDeducoes' | 'calculoBm' | 'bcIssqn' | 
  'issqnApurado' | 'irrf' | 'cp' | 'csll' | 'pis' | 'cofins' | 'retencaoPisCofins' | 
  'totalTributacaoFederal' | 'valorServicoTotal' | 'descontoCondicionado' | 
  'descontoIncondicionadoTotal' | 'issqnRetido' | 'irrfCpCsllRetidos' | 'pisCofinsRetidos' | 
  'valorLiquido' | 'tributosFederais' | 'tributosEstaduais' | 'tributosMunicipais' | 'aliquotaAplicada' |
  'baseCalculoPisCofins' | 'aliquotaPis' | 'aliquotaCofins'
> {
  valorServico: number;
  descontoIncondicionado: number;
  totalDeducoes: number;
  calculoBm: number;
  bcIssqn: number;
  aliquotaAplicada: number;
  issqnApurado: number;
  baseCalculoPisCofins: number;
  aliquotaPis: number;
  aliquotaCofins: number;
  pis: number;
  cofins: number;
  retencaoPisCofins: number;
  irrf: number;
  cp: number;
  csll: number;
  totalTributacaoFederal: number;
  valorServicoTotal: number;
  descontoCondicionado: number;
  descontoIncondicionadoTotal: number;
  issqnRetido: number;
  irrfCpCsllRetidos: number;
  pisCofinsRetidos: number;
  valorLiquido: number;
  tributosFederais: number;
  tributosEstaduais: number;
  tributosMunicipais: number;

  // IBS/CBS (Reforma Tributária)
  ibsCbsPresente: boolean;
  ibsCbsBaseCalculo: number;
  ibsCbsAliqIbsUf: number;
  ibsCbsAliqIbsMun: number;
  ibsCbsAliqCbs: number;
  ibsCbsVIbsUf: number;
  ibsCbsVIbsMun: number;
  ibsCbsVCbs: number;
  ibsCbsVTotalIbsCbs: number;
}

export function parseNfseXmlCompletoRaw(xml: string, clienteCnpj?: string): NfseCompletaRaw {
  const parsed = parseNfseXmlCompleto(xml, clienteCnpj);
  const toNum = (s: string) => { const n = parseFloat(s.replace(/[R$\s.]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const toAliq = (s: string) => { const n = parseFloat(s.replace('%', '')); return isNaN(n) ? 0 : n; };
  return {
    ...parsed,
    valorServico: toNum(parsed.valorServico),
    descontoIncondicionado: toNum(parsed.descontoIncondicionado),
    totalDeducoes: toNum(parsed.totalDeducoes),
    calculoBm: toNum(parsed.calculoBm),
    bcIssqn: toNum(parsed.bcIssqn),
    aliquotaAplicada: toAliq(parsed.aliquotaAplicada),
    issqnApurado: toNum(parsed.issqnApurado),
    baseCalculoPisCofins: toNum(parsed.baseCalculoPisCofins),
    aliquotaPis: toAliq(parsed.aliquotaPis),
    aliquotaCofins: toAliq(parsed.aliquotaCofins),
    pis: toNum(parsed.pis),
    cofins: toNum(parsed.cofins),
    retencaoPisCofins: toNum(parsed.retencaoPisCofins),
    irrf: toNum(parsed.irrf),
    cp: toNum(parsed.cp),
    csll: toNum(parsed.csll),
    totalTributacaoFederal: toNum(parsed.totalTributacaoFederal),
    valorServicoTotal: toNum(parsed.valorServicoTotal),
    descontoCondicionado: toNum(parsed.descontoCondicionado),
    descontoIncondicionadoTotal: toNum(parsed.descontoIncondicionadoTotal),
    issqnRetido: toNum(parsed.issqnRetido),
    irrfCpCsllRetidos: toNum(parsed.irrfCpCsllRetidos),
    pisCofinsRetidos: toNum(parsed.pisCofinsRetidos),
    valorLiquido: toNum(parsed.valorLiquido),
    tributosFederais: toNum(parsed.tributosFederais),
    tributosEstaduais: toNum(parsed.tributosEstaduais),
    tributosMunicipais: toNum(parsed.tributosMunicipais),

    // IBS/CBS
    ibsCbsPresente: parsed.ibsCbsPresente,
    ibsCbsBaseCalculo: toNum(parsed.ibsCbsBaseCalculo),
    ibsCbsAliqIbsUf: toAliq(parsed.ibsCbsAliqIbsUf),
    ibsCbsAliqIbsMun: toAliq(parsed.ibsCbsAliqIbsMun),
    ibsCbsAliqCbs: toAliq(parsed.ibsCbsAliqCbs),
    ibsCbsVIbsUf: toNum(parsed.ibsCbsVIbsUf),
    ibsCbsVIbsMun: toNum(parsed.ibsCbsVIbsMun),
    ibsCbsVCbs: toNum(parsed.ibsCbsVCbs),
    ibsCbsVTotalIbsCbs: toNum(parsed.ibsCbsVTotalIbsCbs),
  };
}

export function parseNfseXmlCompleto(xml: string, clienteCnpj?: string): NfseCompleta {
  // Seções principais
  const infNfse = getSection(xml, "infNFSe") || xml;
  const emitSection = getSection(xml, "emit") || "";
  const tomaSection = getSection(xml, "toma") || "";
  const servSection = getSection(xml, "serv") || getSection(xml, "DPS") || "";
  const tribMunSection = getSection(xml, "tribMun") || getSection(xml, "trib") || "";
  const tribFedSection = getSection(xml, "tribFed") || "";
  const valoresSection = getSection(xml, "valores") || getSection(xml, "vNFSe") || "";
  const tribTotSection = getSection(xml, "totTrib") || "";
  const infComplSection = getSection(xml, "infCompl") || "";

  // Cabeçalho
  const chaveAcesso = getTag(xml, "chNFSe") || getAttr(xml, "infNFSe", "Id") || "";
  const numeroNfse = getTag(xml, "nNFSe") || getTag(infNfse, "nNFSe") || "";
  const competencia = getTag(xml, "dCompet") || "";
  const dataEmissao = getTag(xml, "dhEmi") || getTag(xml, "dhProc") || "";
  const numeroDps = getTag(xml, "nDPS") || "";
  const serieDps = getTag(xml, "serie") || "";
  const dataEmissaoDps = getTag(xml, "dhEmi") || "";

  // Emitente
  const emitenteCnpj = getTag(emitSection, "CNPJ") || getTag(emitSection, "CPF") || getTag(xml, "CNPJ") || "";
  const emitenteInscMunicipal = getTag(emitSection, "IM") || "";
  const emitenteTelefone = getTag(emitSection, "fone") || "";
  const emitenteNome = getTag(emitSection, "xNome") || "";
  const emitenteEmail = getTag(emitSection, "xEmail") || getTag(emitSection, "email") || "";
  const emitEnd = extractEndereco(emitSection, xml);
  const prestSection = getSection(xml, "prest") || "";
  const regTribSection = getSection(prestSection, "regTrib") || getSection(xml, "regTrib") || "";
  const emitenteSN = getTag(regTribSection, "opSimpNac") || getTag(xml, "opSimpNac") || getTag(xml, "opSN") || getTag(emitSection, "opSN") || "";
  const emitenteRegApur = getTag(xml, "regApTribSN") || getTag(emitSection, "regApTribSN") || "";

  // Tomador
  const tomadorCnpj = getTag(tomaSection, "CNPJ") || getTag(tomaSection, "CPF") || "";
  const tomadorInscMunicipal = getTag(tomaSection, "IM") || "";
  const tomadorTelefone = getTag(tomaSection, "fone") || "";
  const tomadorNome = getTag(tomaSection, "xNome") || "";
  const tomadorEmail = getTag(tomaSection, "xEmail") || getTag(tomaSection, "email") || "";
  const tomaEnd = extractEndereco(tomaSection, xml);

  // Serviço
  const codigoTribNacional = getTag(servSection, "cTribNac") || getTag(xml, "cTribNac") || "";
  const codigoTribMunicipal = getTag(servSection, "cTribMun") || getTag(xml, "cTribMun") || "";
  const localPrestacao = getTag(servSection, "xLocPrestacao") || getTag(xml, "xLocPrestacao") || getTag(xml, "xLocIncid") || "";
  const paisPrestacao = getTag(servSection, "xPaisPrestacao") || "";
  const descricaoServico = getTag(servSection, "xDescServ") || getTag(xml, "xDescServ") || "";
  const codigoNbs = getTag(servSection, "cNBS") || getTag(xml, "cNBS") || "";
  const codigoInternoContrib = getTag(servSection, "cIntContrib") || getTag(xml, "cIntContrib") || "";

  // Tributação Municipal
  const tribIssqnCode = getTag(tribMunSection, "tribISSQN") || getTag(xml, "tribISSQN") || "";
  const paisResultado = getTag(tribMunSection, "xPaisResult") || "";
  const municIncidencia = getTag(tribMunSection, "xLocIncid") || getTag(xml, "xLocIncid") || "";
  const regimeEspecialCode = getTag(tribMunSection, "regEspTrib") || getTag(xml, "regEspTrib") || "";
  const tipoImunidade = getTag(tribMunSection, "tpImunidade") || "";
  const suspExig = getTag(tribMunSection, "tpSusp") || "";
  const numProcSusp = getTag(tribMunSection, "nProcesso") || "";
  const benefMun = getTag(tribMunSection, "tpBM") || "";

  const valorServico = getTag(tribMunSection, "vServ") || getTag(xml, "vServ") || getTag(xml, "vServPrest") || getTag(getSection(xml, "vServPrest"), "vServ") || "";
  const descontoInc = getTag(tribMunSection, "vDescIncond") || getTag(xml, "vDescIncond") || "";
  const totalDed = getTag(tribMunSection, "vDed") || getTag(xml, "vDed") || "";
  const calcBm = getTag(tribMunSection, "vCalcBM") || "";
  const bcIssqn = getTag(tribMunSection, "vBC") || getTag(xml, "vBC") || "";
  const aliquota = getTag(tribMunSection, "pAliq") || getTag(xml, "pAliq") || getTag(xml, "pAliqAplic") || "";
  const retIssqnCode = getTag(tribMunSection, "tpRetISSQN") || getTag(xml, "tpRetISSQN") || "";
  const issqnApurado = getTag(tribMunSection, "vISSQN") || getTag(xml, "vISSQN") || "";

  // Tributação Federal
  // Seção piscofins pode estar dentro de tribFed
  const piscofinsSection = getSection(tribFedSection, "piscofins") || getSection(xml, "piscofins") || "";
  // PIS/COFINS detalhado
  const cstPisCofins = getTag(piscofinsSection, "CST") || getTag(xml, "CST") || "";
  const bcPisCofins = getTag(piscofinsSection, "vBCPisCofins") || getTag(xml, "vBCPisCofins") || "";
  const aliqPis = getTag(piscofinsSection, "pAliqPis") || getTag(xml, "pAliqPis") || "";
  const aliqCofins = getTag(piscofinsSection, "pAliqCofins") || getTag(xml, "pAliqCofins") || "";

  const irrf = getTag(tribFedSection, "vIRRF") || getTag(tribFedSection, "vRetIRRF") || getTag(xml, "vIRRF") || getTag(xml, "vRetIRRF") || "";
  const cp = getTag(tribFedSection, "vCP") || getTag(tribFedSection, "vRetCP") || getTag(xml, "vCP") || getTag(xml, "vRetCP") || "";
  const csll = getTag(tribFedSection, "vCSLL") || getTag(tribFedSection, "vRetCSLL") || getTag(xml, "vCSLL") || getTag(xml, "vRetCSLL") || "";
  const pis = getTag(piscofinsSection, "vPis") || getTag(tribFedSection, "vPIS") || getTag(tribFedSection, "vPis") || getTag(xml, "vPIS") || getTag(xml, "vPis") || "";
  const cofins = getTag(piscofinsSection, "vCofins") || getTag(tribFedSection, "vCOFINS") || getTag(tribFedSection, "vCofins") || getTag(xml, "vCOFINS") || getTag(xml, "vCofins") || "";
  const retPisCofins = getTag(tribFedSection, "vRetPisCofins") || getTag(piscofinsSection, "tpRetPisCofins") || "";
  const totalTribFed = getTag(tribFedSection, "vTotTribFed") || getTag(xml, "vTotTribFed") || "";

  // Valor Total
  const valorLiquido = getTag(xml, "vLiq") || getTag(valoresSection, "vLiq") || "";
  const descCond = getTag(xml, "vDescCond") || getTag(valoresSection, "vDescCond") || "";
  const descIncTotal = getTag(xml, "vDescIncond") || getTag(valoresSection, "vDescIncond") || descontoInc;
  // ISSQN Retido: buscar campo explícito, ou calcular a partir de tpRetISSQN + vISSQN
  let issqnRetidoVal = getTag(xml, "vISSQNRet") || getTag(valoresSection, "vISSQNRet") || "";
  if (!issqnRetidoVal && (retIssqnCode === "2" || retIssqnCode === "3") && issqnApurado) {
    // Quando ISS é retido pelo tomador/intermediário e não há campo explícito, usar vISSQN
    issqnRetidoVal = issqnApurado;
  }
  const irrfCpCsllRet = getTag(xml, "vTotalRet") || getTag(valoresSection, "vTotalRet") || "";
  const pisCofinsRet = getTag(xml, "vRetPisCofins") || getTag(valoresSection, "vRetPisCofins") || "";

  // Totais Aproximados - buscar em vTotTrib (caminho aninhado) e também diretamente
  const vTotTribSection = getSection(xml, "vTotTrib") || "";
  const tribFederais = getTag(vTotTribSection, "vTotTribFed") || getTag(tribTotSection, "vTotTribFed") || getTag(xml, "vTotTribFed") || "";
  const tribEstaduais = getTag(vTotTribSection, "vTotTribEst") || getTag(tribTotSection, "vTotTribEst") || getTag(xml, "vTotTribEst") || "";
  const tribMunicipais = getTag(vTotTribSection, "vTotTribMun") || getTag(tribTotSection, "vTotTribMun") || getTag(xml, "vTotTribMun") || "";

  // Informações Complementares
  const infoComplServ = getSection(servSection, "infoCompl") || "";
  const infCompl = getTag(infoComplServ, "xInfComp") || getTag(xml, "xInfComp") || getTag(xml, "xInfCompl") || getTag(infComplSection, "xInfCompl") || getTag(xml, "infCpl") || "";

  // Direção
  const cnpjClean = clienteCnpj ? clienteCnpj.replace(/[^\d]/g, "") : "";
  const emitCnpjClean = emitenteCnpj.replace(/[^\d]/g, "");
  const direcao: "emitida" | "recebida" = cnpjClean && emitCnpjClean === cnpjClean ? "emitida" : "recebida";

  // Flags de retenção
  const retIssqn = mapRetencaoIssqn(retIssqnCode);
  const temRetencaoIssqn = retIssqn === "Retido" || retIssqnCode === "2" || retIssqnCode === "3" || parseFloat(issqnRetidoVal || "0") > 0;
  const temRetencaoFederal = parseFloat(irrfCpCsllRet || "0") > 0 || parseFloat(irrf || "0") > 0 || parseFloat(csll || "0") > 0 || parseFloat(pis || "0") > 0 || parseFloat(cofins || "0") > 0;

  return {
    chaveAcesso,
    numeroNfse,
    competencia,
    dataEmissao,
    numeroDps,
    serieDps,
    dataEmissaoDps,

    emitenteCnpj: formatCnpj(emitenteCnpj),
    emitenteInscMunicipal,
    emitenteTelefone,
    emitenteNome,
    emitenteEmail,
    emitenteEndereco: emitEnd.endereco,
    emitenteMunicipio: emitEnd.municipio || (getTag(xml, "xLocEmi") ? (emitEnd.uf ? `${getTag(xml, "xLocEmi")} - ${emitEnd.uf}` : getTag(xml, "xLocEmi")) : ""),
    emitenteUf: emitEnd.uf,
    emitenteCep: emitEnd.cep,
    emitenteSimplesNacional: mapSimplesNacional(emitenteSN),
    emitenteRegimeApuracao: mapRegimeApuracao(emitenteRegApur),

    tomadorCnpj: formatCnpj(tomadorCnpj),
    tomadorInscMunicipal,
    tomadorTelefone,
    tomadorNome,
    tomadorEmail,
    tomadorEndereco: tomaEnd.endereco,
    tomadorMunicipio: tomaEnd.municipio,
    tomadorUf: tomaEnd.uf,
    tomadorCep: tomaEnd.cep,

    codigoTribNacional: codigoTribNacional,
    codigoTribMunicipal: codigoTribMunicipal,
    localPrestacao,
    paisPrestacao,
    descricaoServico,
    codigoNbs,
    codigoInternoContrib,

    tributacaoIssqn: mapTributacaoIssqn(tribIssqnCode),
    paisResultadoPrestacao: paisResultado,
    municipioIncidenciaIssqn: municIncidencia,
    regimeEspecialTributacao: mapRegimeEspecial(regimeEspecialCode),
    tipoImunidade,
    suspensaoExigibilidade: suspExig === "1" ? "Sim" : suspExig === "2" ? "Não" : suspExig || "",
    numProcessoSuspensao: numProcSusp,
    beneficioMunicipal: benefMun,
    valorServico: formatMoney(valorServico),
    descontoIncondicionado: formatMoney(descontoInc),
    totalDeducoes: formatMoney(totalDed),
    calculoBm: formatMoney(calcBm),
    bcIssqn: formatMoney(bcIssqn),
    aliquotaAplicada: aliquota ? (() => { const v = parseFloat(aliquota); if (isNaN(v)) return ""; return v < 1 ? `${(v * 100).toFixed(2)}%` : `${v.toFixed(2)}%`; })() : "",
    retencaoIssqn: retIssqn || "Não Retido",
    issqnApurado: formatMoney(issqnApurado),

    cstPisCofins,
    baseCalculoPisCofins: formatMoney(bcPisCofins),
    aliquotaPis: aliqPis ? `${parseFloat(aliqPis).toFixed(2)}%` : "",
    aliquotaCofins: aliqCofins ? `${parseFloat(aliqCofins).toFixed(2)}%` : "",
    pis: formatMoney(pis),
    cofins: formatMoney(cofins),
    retencaoPisCofins: formatMoney(retPisCofins),
    irrf: formatMoney(irrf),
    cp: formatMoney(cp),
    csll: formatMoney(csll),
    totalTributacaoFederal: formatMoney(totalTribFed),

    valorServicoTotal: formatMoney(valorServico),
    descontoCondicionado: formatMoney(descCond),
    descontoIncondicionadoTotal: formatMoney(descIncTotal),
    issqnRetido: formatMoney(issqnRetidoVal),
    irrfCpCsllRetidos: formatMoney(irrfCpCsllRet),
    pisCofinsRetidos: formatMoney(pisCofinsRet),
    valorLiquido: formatMoney(valorLiquido),

    tributosFederais: formatMoney(tribFederais),
    tributosEstaduais: formatMoney(tribEstaduais),
    tributosMunicipais: formatMoney(tribMunicipais),

    informacoesComplementares: infCompl,

    direcao,
    temRetencaoIssqn,
    temRetencaoFederal,
    temRetencao: temRetencaoIssqn || temRetencaoFederal,

    // IBS/CBS (Reforma Tributária) - extrair do grupo IBSCBS/gIBSCBS quando presente
    ...(() => {
      const ibsCbsSection = getSection(xml, "IBSCBS") || getSection(xml, "ibscbs") || "";
      const gIbsCbs = getSection(ibsCbsSection, "gIBSCBS") || getSection(ibsCbsSection, "gibscbs") || ibsCbsSection;
      const cst = getTag(ibsCbsSection, "CST") || getTag(gIbsCbs, "CST") || "";
      const vBC = getTag(gIbsCbs, "vBC") || getTag(ibsCbsSection, "vBC") || "";
      // Alíquotas efetivas
      const aliqIbsUf = getTag(gIbsCbs, "pAliqEfetRegIBSUF") || getTag(ibsCbsSection, "pAliqEfetRegIBSUF") || getTag(gIbsCbs, "pAliqIBSUF") || "";
      const aliqIbsMun = getTag(gIbsCbs, "pAliqEfetRegIBSMun") || getTag(ibsCbsSection, "pAliqEfetRegIBSMun") || getTag(gIbsCbs, "pAliqIBSMun") || "";
      const aliqCbs = getTag(gIbsCbs, "pAliqEfetRegCBS") || getTag(ibsCbsSection, "pAliqEfetRegCBS") || getTag(gIbsCbs, "pAliqCBS") || "";
      // Valores
      const vIbsUf = getTag(gIbsCbs, "vTribRegIBSUF") || getTag(ibsCbsSection, "vTribRegIBSUF") || getTag(gIbsCbs, "vIBSUF") || "";
      const vIbsMun = getTag(gIbsCbs, "vTribRegIBSMun") || getTag(ibsCbsSection, "vTribRegIBSMun") || getTag(gIbsCbs, "vIBSMun") || "";
      const vCbs = getTag(gIbsCbs, "vTribRegCBS") || getTag(ibsCbsSection, "vTribRegCBS") || getTag(gIbsCbs, "vCBS") || "";
      // Total
      const vTotal = getTag(gIbsCbs, "vTotIBSCBS") || getTag(ibsCbsSection, "vTotIBSCBS") || "";
      const presente = !!(cst || vBC || vIbsUf || vIbsMun || vCbs || vTotal);
      return {
        ibsCbsPresente: presente,
        cstIbsCbs: cst,
        ibsCbsBaseCalculo: formatMoney(vBC),
        ibsCbsAliqIbsUf: aliqIbsUf ? `${parseFloat(aliqIbsUf).toFixed(4)}%` : "",
        ibsCbsAliqIbsMun: aliqIbsMun ? `${parseFloat(aliqIbsMun).toFixed(4)}%` : "",
        ibsCbsAliqCbs: aliqCbs ? `${parseFloat(aliqCbs).toFixed(4)}%` : "",
        ibsCbsVIbsUf: formatMoney(vIbsUf),
        ibsCbsVIbsMun: formatMoney(vIbsMun),
        ibsCbsVCbs: formatMoney(vCbs),
        ibsCbsVTotalIbsCbs: formatMoney(vTotal || (presente ? String(parseFloat(vIbsUf || "0") + parseFloat(vIbsMun || "0") + parseFloat(vCbs || "0")) : "")),
      };
    })(),
  };
}
