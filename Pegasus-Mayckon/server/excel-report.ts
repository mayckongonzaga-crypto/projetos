/**
 * Gerador de relatórios Excel completos para notas NFSe
 * Extrai todos os campos fiscais do XML e gera planilha detalhada
 */
import { parseNfseXmlCompletoRaw, type NfseCompletaRaw } from "./nfse-xml-parser";
import { decodeXml } from "./nfse-api";

// Tipo genérico para notas vindas do banco
interface NotaDB {
  numeroNota: string | null;
  chaveAcesso: string;
  dataEmissao: Date | string | null;
  dataCompetencia: Date | string | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  tomadorCnpj: string | null;
  tomadorNome: string | null;
  valorServico: string | null;
  valorLiquido: string | null;
  status: string | null;
  direcao: string | null;
  xmlOriginal: string | null;
  danfsePdfUrl: string | null;
}

// Definição das colunas do relatório completo
const COLUNAS_COMPLETAS = [
  // Cabeçalho da Nota
  { header: "Nº NFSe", key: "numeroNfse", width: 14 },
  { header: "Nº DPS", key: "numeroDps", width: 12 },
  { header: "Série DPS", key: "serieDps", width: 10 },
  { header: "Chave de Acesso", key: "chaveAcesso", width: 55 },
  { header: "Data Emissão", key: "dataEmissao", width: 14 },
  { header: "Competência", key: "competencia", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Direção", key: "direcao", width: 12 },

  // Emitente
  { header: "CNPJ Emitente", key: "emitenteCnpj", width: 22 },
  { header: "Nome Emitente", key: "emitenteNome", width: 40 },
  { header: "Insc. Municipal Emit.", key: "emitenteInscMunicipal", width: 18 },
  { header: "Endereço Emitente", key: "emitenteEndereco", width: 40 },
  { header: "Município Emitente", key: "emitenteMunicipio", width: 25 },
  { header: "UF Emitente", key: "emitenteUf", width: 8 },
  { header: "CEP Emitente", key: "emitenteCep", width: 12 },
  { header: "Email Emitente", key: "emitenteEmail", width: 30 },
  { header: "Telefone Emitente", key: "emitenteTelefone", width: 16 },
  { header: "Simples Nacional", key: "emitenteSimplesNacional", width: 20 },
  { header: "Regime Apuração", key: "emitenteRegimeApuracao", width: 25 },

  // Tomador
  { header: "CNPJ/CPF Tomador", key: "tomadorCnpj", width: 22 },
  { header: "Nome Tomador", key: "tomadorNome", width: 40 },
  { header: "Insc. Municipal Tom.", key: "tomadorInscMunicipal", width: 18 },
  { header: "Endereço Tomador", key: "tomadorEndereco", width: 40 },
  { header: "Município Tomador", key: "tomadorMunicipio", width: 25 },
  { header: "UF Tomador", key: "tomadorUf", width: 8 },
  { header: "CEP Tomador", key: "tomadorCep", width: 12 },
  { header: "Email Tomador", key: "tomadorEmail", width: 30 },
  { header: "Telefone Tomador", key: "tomadorTelefone", width: 16 },

  // Serviço
  { header: "Cód. Trib. Nacional", key: "codigoTribNacional", width: 18 },
  { header: "Cód. Trib. Municipal", key: "codigoTribMunicipal", width: 18 },
  { header: "Código NBS", key: "codigoNbs", width: 16 },
  { header: "Cód. Interno Contrib.", key: "codigoInternoContrib", width: 18 },
  { header: "Descrição Serviço", key: "descricaoServico", width: 50 },
  { header: "Local Prestação", key: "localPrestacao", width: 25 },

  // Tributação Municipal
  { header: "Tributação ISSQN", key: "tributacaoIssqn", width: 20 },
  { header: "Município Incidência", key: "municipioIncidenciaIssqn", width: 25 },
  { header: "Regime Especial", key: "regimeEspecialTributacao", width: 25 },
  { header: "Valor Serviço", key: "valorServico", width: 16, numFmt: "#,##0.00" },
  { header: "Desconto Incond.", key: "descontoIncondicionado", width: 16, numFmt: "#,##0.00" },
  { header: "Total Deduções", key: "totalDeducoes", width: 16, numFmt: "#,##0.00" },
  { header: "Base Cálculo ISSQN", key: "bcIssqn", width: 18, numFmt: "#,##0.00" },
  { header: "Alíquota ISS (%)", key: "aliquotaAplicada", width: 16, numFmt: "#,##0.00" },
  { header: "Retenção ISSQN", key: "retencaoIssqn", width: 16 },
  { header: "ISSQN Apurado", key: "issqnApurado", width: 16, numFmt: "#,##0.00" },

  // Tributação Federal — PIS/COFINS
  { header: "CST PIS/COFINS", key: "cstPisCofins", width: 16 },
  { header: "Base Cálc. PIS/COFINS", key: "baseCalculoPisCofins", width: 20, numFmt: "#,##0.00" },
  { header: "Alíquota PIS (%)", key: "aliquotaPis", width: 16, numFmt: "#,##0.00" },
  { header: "Alíquota COFINS (%)", key: "aliquotaCofins", width: 18, numFmt: "#,##0.00" },
  { header: "PIS", key: "pis", width: 14, numFmt: "#,##0.00" },
  { header: "COFINS", key: "cofins", width: 14, numFmt: "#,##0.00" },
  // Tributação Federal — IRRF / CSLL / CP
  { header: "IRRF", key: "irrf", width: 14, numFmt: "#,##0.00" },
  { header: "INSS/CP", key: "cp", width: 14, numFmt: "#,##0.00" },
  { header: "CSLL", key: "csll", width: 14, numFmt: "#,##0.00" },
  { header: "Total Trib. Federal", key: "totalTributacaoFederal", width: 18, numFmt: "#,##0.00" },

  // Valores Totais
  { header: "Desconto Cond.", key: "descontoCondicionado", width: 16, numFmt: "#,##0.00" },
  { header: "ISSQN Retido", key: "issqnRetido", width: 16, numFmt: "#,##0.00" },
  { header: "IRRF/CP/CSLL Ret.", key: "irrfCpCsllRetidos", width: 18, numFmt: "#,##0.00" },
  { header: "PIS/COFINS Ret.", key: "pisCofinsRetidos", width: 16, numFmt: "#,##0.00" },
  { header: "Valor Líquido", key: "valorLiquido", width: 16, numFmt: "#,##0.00" },

  // Totais Aproximados
  { header: "Trib. Federais Aprox.", key: "tributosFederais", width: 20, numFmt: "#,##0.00" },
  { header: "Trib. Estaduais Aprox.", key: "tributosEstaduais", width: 20, numFmt: "#,##0.00" },
  { header: "Trib. Municipais Aprox.", key: "tributosMunicipais", width: 22, numFmt: "#,##0.00" },

  // Flags
  { header: "Tem Retenção ISS", key: "temRetencaoIssqn", width: 16 },
  { header: "Tem Retenção Fed.", key: "temRetencaoFederal", width: 16 },

  // Informações Complementares
  { header: "Informações Complementares", key: "informacoesComplementares", width: 60 },

  // IBS/CBS (Reforma Tributária)
  { header: "IBS/CBS", key: "ibsCbsPresente", width: 10 },
  { header: "CST IBS/CBS", key: "cstIbsCbs", width: 14 },
  { header: "Base Cálc. IBS/CBS", key: "ibsCbsBaseCalculo", width: 18, numFmt: "#,##0.00" },
  { header: "Alíq. IBS UF (%)", key: "ibsCbsAliqIbsUf", width: 16, numFmt: "#,##0.0000" },
  { header: "Alíq. IBS Mun (%)", key: "ibsCbsAliqIbsMun", width: 16, numFmt: "#,##0.0000" },
  { header: "Alíq. CBS (%)", key: "ibsCbsAliqCbs", width: 14, numFmt: "#,##0.0000" },
  { header: "IBS UF", key: "ibsCbsVIbsUf", width: 14, numFmt: "#,##0.00" },
  { header: "IBS Mun", key: "ibsCbsVIbsMun", width: 14, numFmt: "#,##0.00" },
  { header: "CBS", key: "ibsCbsVCbs", width: 14, numFmt: "#,##0.00" },
  { header: "Total IBS/CBS", key: "ibsCbsVTotalIbsCbs", width: 16, numFmt: "#,##0.00" },
];

// Colunas numéricas (para formatação e soma)
const COLUNAS_NUMERICAS = new Set([
  "valorServico", "descontoIncondicionado", "totalDeducoes", "bcIssqn",
  "aliquotaAplicada", "issqnApurado", "baseCalculoPisCofins", "aliquotaPis",
  "aliquotaCofins", "pis", "cofins", "irrf", "cp", "csll",
  "totalTributacaoFederal", "descontoCondicionado", "issqnRetido",
  "irrfCpCsllRetidos", "pisCofinsRetidos", "valorLiquido",
  "tributosFederais", "tributosEstaduais", "tributosMunicipais",
  "ibsCbsBaseCalculo", "ibsCbsAliqIbsUf", "ibsCbsAliqIbsMun", "ibsCbsAliqCbs",
  "ibsCbsVIbsUf", "ibsCbsVIbsMun", "ibsCbsVCbs", "ibsCbsVTotalIbsCbs",
]);

// Colunas para totalizar
const COLUNAS_TOTALIZAVEIS = new Set([
  "valorServico", "descontoIncondicionado", "totalDeducoes", "bcIssqn",
  "issqnApurado", "baseCalculoPisCofins", "pis", "cofins",
  "irrf", "cp", "csll",
  "totalTributacaoFederal", "descontoCondicionado", "issqnRetido",
  "irrfCpCsllRetidos", "pisCofinsRetidos", "valorLiquido",
  "tributosFederais", "tributosEstaduais", "tributosMunicipais",
  "ibsCbsBaseCalculo", "ibsCbsVIbsUf", "ibsCbsVIbsMun", "ibsCbsVCbs", "ibsCbsVTotalIbsCbs",
]);

function parseNotaParaRow(nota: NotaDB, clienteCnpj?: string): Record<string, any> {
  // Tentar parsear o XML completo
  let parsed: NfseCompletaRaw | null = null;
  if (nota.xmlOriginal) {
    try {
      const xmlText = decodeXml(nota.xmlOriginal);
      parsed = parseNfseXmlCompletoRaw(xmlText, clienteCnpj);
    } catch {
      // Fallback: usar dados do banco
    }
  }

  if (parsed) {
    return {
      numeroNfse: parsed.numeroNfse || nota.numeroNota || "",
      numeroDps: parsed.numeroDps,
      serieDps: parsed.serieDps,
      chaveAcesso: parsed.chaveAcesso || nota.chaveAcesso,
      dataEmissao: parsed.dataEmissao ? formatDate(parsed.dataEmissao) : formatDateFromDB(nota.dataEmissao),
      competencia: parsed.competencia ? formatDate(parsed.competencia) : formatDateFromDB(nota.dataCompetencia),
      status: nota.status === "cancelada" ? "Cancelada" : "Ativa",
      direcao: parsed.direcao === "emitida" ? "Emitida" : "Recebida",

      emitenteCnpj: parsed.emitenteCnpj,
      emitenteNome: parsed.emitenteNome,
      emitenteInscMunicipal: parsed.emitenteInscMunicipal,
      emitenteEndereco: parsed.emitenteEndereco,
      emitenteMunicipio: parsed.emitenteMunicipio,
      emitenteUf: parsed.emitenteUf,
      emitenteCep: parsed.emitenteCep,
      emitenteEmail: parsed.emitenteEmail,
      emitenteTelefone: parsed.emitenteTelefone,
      emitenteSimplesNacional: parsed.emitenteSimplesNacional,
      emitenteRegimeApuracao: parsed.emitenteRegimeApuracao,

      tomadorCnpj: parsed.tomadorCnpj,
      tomadorNome: parsed.tomadorNome,
      tomadorInscMunicipal: parsed.tomadorInscMunicipal,
      tomadorEndereco: parsed.tomadorEndereco,
      tomadorMunicipio: parsed.tomadorMunicipio,
      tomadorUf: parsed.tomadorUf,
      tomadorCep: parsed.tomadorCep,
      tomadorEmail: parsed.tomadorEmail,
      tomadorTelefone: parsed.tomadorTelefone,

      codigoTribNacional: parsed.codigoTribNacional,
      codigoTribMunicipal: parsed.codigoTribMunicipal,
      codigoNbs: parsed.codigoNbs,
      codigoInternoContrib: parsed.codigoInternoContrib,
      descricaoServico: parsed.descricaoServico,
      localPrestacao: parsed.localPrestacao,

      tributacaoIssqn: parsed.tributacaoIssqn,
      municipioIncidenciaIssqn: parsed.municipioIncidenciaIssqn,
      regimeEspecialTributacao: parsed.regimeEspecialTributacao,
      valorServico: parsed.valorServico,
      descontoIncondicionado: parsed.descontoIncondicionado,
      totalDeducoes: parsed.totalDeducoes,
      bcIssqn: parsed.bcIssqn,
      aliquotaAplicada: parsed.aliquotaAplicada,
      retencaoIssqn: parsed.retencaoIssqn,
      issqnApurado: parsed.issqnApurado,

      cstPisCofins: parsed.cstPisCofins,
      baseCalculoPisCofins: parsed.baseCalculoPisCofins,
      aliquotaPis: parsed.aliquotaPis,
      aliquotaCofins: parsed.aliquotaCofins,
      pis: parsed.pis,
      cofins: parsed.cofins,
      irrf: parsed.irrf,
      cp: parsed.cp,
      csll: parsed.csll,
      totalTributacaoFederal: parsed.totalTributacaoFederal,

      descontoCondicionado: parsed.descontoCondicionado,
      issqnRetido: parsed.issqnRetido,
      irrfCpCsllRetidos: parsed.irrfCpCsllRetidos,
      pisCofinsRetidos: parsed.pisCofinsRetidos,
      valorLiquido: parsed.valorLiquido,

      tributosFederais: parsed.tributosFederais,
      tributosEstaduais: parsed.tributosEstaduais,
      tributosMunicipais: parsed.tributosMunicipais,

      temRetencaoIssqn: parsed.temRetencaoIssqn ? "Sim" : "Não",
      temRetencaoFederal: parsed.temRetencaoFederal ? "Sim" : "Não",

      informacoesComplementares: parsed.informacoesComplementares,

      // IBS/CBS (Reforma Tributária)
      ibsCbsPresente: parsed.ibsCbsPresente ? "Sim" : "Não",
      cstIbsCbs: parsed.cstIbsCbs,
      ibsCbsBaseCalculo: parsed.ibsCbsBaseCalculo,
      ibsCbsAliqIbsUf: parsed.ibsCbsAliqIbsUf,
      ibsCbsAliqIbsMun: parsed.ibsCbsAliqIbsMun,
      ibsCbsAliqCbs: parsed.ibsCbsAliqCbs,
      ibsCbsVIbsUf: parsed.ibsCbsVIbsUf,
      ibsCbsVIbsMun: parsed.ibsCbsVIbsMun,
      ibsCbsVCbs: parsed.ibsCbsVCbs,
      ibsCbsVTotalIbsCbs: parsed.ibsCbsVTotalIbsCbs,
    };
  }

  // Fallback: dados básicos do banco
  return {
    numeroNfse: nota.numeroNota || "",
    numeroDps: "",
    serieDps: "",
    chaveAcesso: nota.chaveAcesso,
    dataEmissao: formatDateFromDB(nota.dataEmissao),
    competencia: formatDateFromDB(nota.dataCompetencia),
    status: nota.status === "cancelada" ? "Cancelada" : "Ativa",
    direcao: nota.direcao === "emitida" ? "Emitida" : "Recebida",
    emitenteCnpj: nota.emitenteCnpj || "",
    emitenteNome: nota.emitenteNome || "",
    tomadorCnpj: nota.tomadorCnpj || "",
    tomadorNome: nota.tomadorNome || "",
    valorServico: nota.valorServico ? parseFloat(nota.valorServico) : 0,
    valorLiquido: nota.valorLiquido ? parseFloat(nota.valorLiquido) : 0,
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
}

function formatDateFromDB(date: Date | string | null): string {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return String(date);
  }
}

/**
 * Gera um relatório Excel completo com todos os campos fiscais
 */
export async function gerarRelatorioExcelCompleto(
  notas: NotaDB[],
  tipo: string,
  clienteCnpj?: string,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(tipo || "Notas");

  // Configurar colunas
  ws.columns = COLUNAS_COMPLETAS.map(col => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  // Estilizar cabeçalho
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E7D32" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 30;

  // Adicionar dados
  for (const nota of notas) {
    const rowData = parseNotaParaRow(nota, clienteCnpj);
    const row = ws.addRow(rowData);

    // Formatar células numéricas
    row.eachCell((cell, colNumber) => {
      const colDef = COLUNAS_COMPLETAS[colNumber - 1];
      if (colDef && (colDef as any).numFmt && typeof cell.value === "number") {
        cell.numFmt = (colDef as any).numFmt;
      }
    });
  }

  // Linha de totais
  if (notas.length > 0) {
    const totals: Record<string, any> = { numeroNfse: `TOTAL (${notas.length} notas)` };
    for (const col of COLUNAS_COMPLETAS) {
      if (COLUNAS_TOTALIZAVEIS.has(col.key)) {
        totals[col.key] = 0;
      }
    }

    // Calcular totais
    for (let rowIdx = 2; rowIdx <= notas.length + 1; rowIdx++) {
      const row = ws.getRow(rowIdx);
      for (const col of COLUNAS_COMPLETAS) {
        if (COLUNAS_TOTALIZAVEIS.has(col.key)) {
          const colIdx = COLUNAS_COMPLETAS.findIndex(c => c.key === col.key) + 1;
          const cellVal = row.getCell(colIdx).value;
          if (typeof cellVal === "number") {
            totals[col.key] += cellVal;
          }
        }
      }
    }

    const totalRow = ws.addRow(totals);
    totalRow.font = { bold: true, size: 10 };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };

    // Formatar totais numéricos
    totalRow.eachCell((cell, colNumber) => {
      const colDef = COLUNAS_COMPLETAS[colNumber - 1];
      if (colDef && (colDef as any).numFmt && typeof cell.value === "number") {
        cell.numFmt = (colDef as any).numFmt;
      }
    });
  }

  // Congelar primeira linha e primeira coluna
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  // Adicionar filtros automáticos
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: notas.length + 1, column: COLUNAS_COMPLETAS.length },
  };

  // Bordas finas em todas as células
  const borderStyle: any = {
    top: { style: "thin", color: { argb: "FFD0D0D0" } },
    left: { style: "thin", color: { argb: "FFD0D0D0" } },
    bottom: { style: "thin", color: { argb: "FFD0D0D0" } },
    right: { style: "thin", color: { argb: "FFD0D0D0" } },
  };
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = borderStyle;
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
