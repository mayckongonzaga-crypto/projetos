/**
 * Gerador de Excel profissional para o Relatório de Notas NFSe
 * Estilo LAN7 - Pegasus com cabeçalho, cards de resumo, gráficos e tabelas completas
 */

import type { NfseCompletaRaw } from "./nfse-xml-parser";
import {
  chartNotasPorMes,
  chartDistribuicaoTipo,
  chartDistribuicaoStatus,
  chartEvolucaoValores,
  chartEmitidasRecebidasMes,
} from "./excel-charts";

// Cores ARGB para ExcelJS
const C = {
  primary: "FF1E3A5F",
  primaryLight: "FF2E5A8F",
  accent: "FF3B82F6",
  accentLight: "FFDBEAFE",
  success: "FF10B981",
  successLight: "FFD1FAE5",
  warning: "FFF59E0B",
  warningLight: "FFFEF3C7",
  danger: "FFEF4444",
  dangerLight: "FFFEE2E2",
  purple: "FF8B5CF6",
  purpleLight: "FFEDE9FE",
  cyan: "FF06B6D4",
  cyanLight: "FFCFFAFE",
  white: "FFFFFFFF",
  lightBg: "FFF8FAFC",
  lightBg2: "FFF1F5F9",
  border: "FFE2E8F0",
  text: "FF334155",
  textLight: "FF64748B",
  emitente: "FF1D4ED8",
  emitenteBg: "FFD6E4FF",
  tomador: "FFB45309",
  tomadorBg: "FFFFF3CD",
};

interface NotaComXml {
  direcao: string;
  numeroNota: string | null;
  dataEmissao: Date | null;
  dataCompetencia: Date | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  tomadorCnpj: string | null;
  tomadorNome: string | null;
  valorServico: string | null;
  valorLiquido: string | null;
  status: string;
  codigoServico: string | null;
  descricaoServico: string | null;
  municipioPrestacao: string | null;
  raw: NfseCompletaRaw | null;
}

const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "";
const statusMap: Record<string, string> = { valida: "Ativa", cancelada: "Cancelada", substituida: "Substituída" };

function fmtMoney(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const sheetColumns = [
  { header: "Tipo", key: "tipo", width: 12 },
  { header: "Número NF", key: "numeroNota", width: 15 },
  { header: "Data Emissão", key: "dataEmissao", width: 15 },
  { header: "Competência", key: "dataCompetencia", width: 15 },
  { header: "CNPJ Emitente", key: "emitenteCnpj", width: 20 },
  { header: "Nome Emitente", key: "emitenteNome", width: 35 },
  { header: "Município Emit.", key: "emitenteMunicipio", width: 20 },
  { header: "CNPJ Tomador", key: "tomadorCnpj", width: 20 },
  { header: "Nome Tomador", key: "tomadorNome", width: 35 },
  { header: "Município Tom.", key: "tomadorMunicipio", width: 20 },
  { header: "Cód. Trib. Nacional", key: "codTribNac", width: 18 },
  { header: "Descrição Serviço", key: "descricaoServico", width: 45 },
  { header: "Local Prestação", key: "localPrestacao", width: 20 },
  { header: "Valor Serviço", key: "valorServico", width: 16 },
  { header: "Base Cálculo ISSQN", key: "bcIssqn", width: 18 },
  { header: "Alíquota ISSQN (%)", key: "aliquotaIssqn", width: 16 },
  { header: "ISSQN Apurado", key: "issqnApurado", width: 16 },
  { header: "Retenção ISSQN", key: "retencaoIssqn", width: 15 },
  { header: "ISSQN Retido", key: "issqnRetido", width: 15 },
  { header: "Munic. Incidência", key: "municIncidencia", width: 20 },
  { header: "IRRF", key: "irrf", width: 14 },
  { header: "CSLL", key: "csll", width: 14 },
  { header: "PIS", key: "pis", width: 14 },
  { header: "COFINS", key: "cofins", width: 14 },
  { header: "CP", key: "cp", width: 14 },
  { header: "Total Ret. Federal", key: "totalRetFed", width: 18 },
  { header: "Desc. Incondicionado", key: "descontoInc", width: 18 },
  { header: "Desc. Condicionado", key: "descontoCond", width: 18 },
  { header: "Valor Líquido", key: "valorLiquido", width: 16 },
  { header: "Trib. Federais Aprox.", key: "tribFederais", width: 18 },
  { header: "Trib. Estaduais Aprox.", key: "tribEstaduais", width: 18 },
  { header: "Trib. Municipais Aprox.", key: "tribMunicipais", width: 18 },
  { header: "Tem Retenção", key: "temRetencao", width: 14 },
  { header: "Status", key: "status", width: 12 },
  // Colunas IBS/CBS (Reforma Tributária 2026)
  { header: "IBS/CBS", key: "temIbsCbs", width: 10 },
  { header: "CST IBS/CBS", key: "cstIbsCbs", width: 14 },
  { header: "Base Cálc. IBS/CBS", key: "vBcIbsCbs", width: 18 },
  { header: "Alíq. IBS UF (%)", key: "aliqIbsUf", width: 16 },
  { header: "Alíq. IBS Mun (%)", key: "aliqIbsMun", width: 16 },
  { header: "Alíq. CBS (%)", key: "aliqCbs", width: 14 },
  { header: "IBS UF", key: "vIbsUf", width: 14 },
  { header: "IBS Municipal", key: "vIbsMun", width: 14 },
  { header: "CBS", key: "vCbs", width: 14 },
  { header: "Total IBS+CBS", key: "vTotTribIbsCbs", width: 16 },
  { header: "PIS (IBS/CBS)", key: "vPisIbsCbs", width: 14 },
  { header: "COFINS (IBS/CBS)", key: "vCofinsIbsCbs", width: 16 },
  { header: "Dif. UF (%)", key: "pDifUf", width: 12 },
  { header: "Dif. Mun (%)", key: "pDifMun", width: 12 },
  { header: "Dif. CBS (%)", key: "pDifCbs", width: 12 },
];

const moneyFmt = '#,##0.00';
const moneyColumns = ['valorServico', 'bcIssqn', 'issqnApurado', 'issqnRetido', 'irrf', 'csll', 'pis', 'cofins', 'cp', 'totalRetFed', 'descontoInc', 'descontoCond', 'valorLiquido', 'tribFederais', 'tribEstaduais', 'tribMunicipais', 'vBcIbsCbs', 'vIbsUf', 'vIbsMun', 'vCbs', 'vTotTribIbsCbs', 'vPisIbsCbs', 'vCofinsIbsCbs'];

function buildRowData(nota: NotaComXml): Record<string, any> {
  const r = nota.raw;
  const bruto = r ? r.valorServico : parseFloat(nota.valorServico ?? "0");
  const liquido = r ? r.valorLiquido : parseFloat(nota.valorLiquido ?? "0");

  return {
    tipo: nota.direcao === "emitida" ? "Emitente" : "Tomador",
    numeroNota: nota.numeroNota ?? "",
    dataEmissao: fmtDate(nota.dataEmissao),
    dataCompetencia: fmtDate(nota.dataCompetencia),
    emitenteCnpj: r?.emitenteCnpj || nota.emitenteCnpj || "",
    emitenteNome: r?.emitenteNome || nota.emitenteNome || "",
    emitenteMunicipio: r?.emitenteMunicipio || "",
    tomadorCnpj: r?.tomadorCnpj || nota.tomadorCnpj || "",
    tomadorNome: r?.tomadorNome || nota.tomadorNome || "",
    tomadorMunicipio: r?.tomadorMunicipio || "",
    codTribNac: r?.codigoTribNacional || nota.codigoServico || "",
    descricaoServico: r?.descricaoServico || nota.descricaoServico || "",
    localPrestacao: r?.localPrestacao || nota.municipioPrestacao || "",
    valorServico: bruto,
    bcIssqn: r?.bcIssqn || 0,
    aliquotaIssqn: r?.aliquotaAplicada || 0,
    issqnApurado: r?.issqnApurado || 0,
    retencaoIssqn: r?.retencaoIssqn || "",
    issqnRetido: r?.issqnRetido || 0,
    municIncidencia: r?.municipioIncidenciaIssqn || "",
    irrf: r?.irrf || 0,
    csll: r?.csll || 0,
    pis: r?.pis || 0,
    cofins: r?.cofins || 0,
    cp: r?.cp || 0,
    totalRetFed: r?.irrfCpCsllRetidos || 0,
    descontoInc: r?.descontoIncondicionado || 0,
    descontoCond: r?.descontoCondicionado || 0,
    valorLiquido: liquido,
    tribFederais: r?.tributosFederais || 0,
    tribEstaduais: r?.tributosEstaduais || 0,
    tribMunicipais: r?.tributosMunicipais || 0,
    temRetencao: r?.temRetencao ? "Sim" : r ? "Não" : "",
    status: statusMap[nota.status] ?? nota.status,
    // Campos IBS/CBS (lidos do banco - já extraídos do XML)
    temIbsCbs: (nota as any).temIbsCbs ? "Sim" : "-",
    cstIbsCbs: (nota as any).cstIbsCbs || "",
    vBcIbsCbs: parseFloat((nota as any).vBcIbsCbs ?? "0") || 0,
    aliqIbsUf: parseFloat((nota as any).aliqIbsUf ?? "0") || 0,
    aliqIbsMun: parseFloat((nota as any).aliqIbsMun ?? "0") || 0,
    aliqCbs: parseFloat((nota as any).aliqCbs ?? "0") || 0,
    vIbsUf: parseFloat((nota as any).vIbsUf ?? "0") || 0,
    vIbsMun: parseFloat((nota as any).vIbsMun ?? "0") || 0,
    vCbs: parseFloat((nota as any).vCbs ?? "0") || 0,
    vTotTribIbsCbs: parseFloat((nota as any).vTotTribIbsCbs ?? "0") || 0,
    vPisIbsCbs: parseFloat((nota as any).vPis ?? "0") || 0,
    vCofinsIbsCbs: parseFloat((nota as any).vCofins ?? "0") || 0,
    pDifUf: parseFloat((nota as any).pDifUf ?? "0") || 0,
    pDifMun: parseFloat((nota as any).pDifMun ?? "0") || 0,
    pDifCbs: parseFloat((nota as any).pDifCbs ?? "0") || 0,
  };
}

function addNotasToSheet(sheet: any, notas: NotaComXml[], headerColor: string, startRow: number) {
  // Set columns starting from startRow
  sheet.columns = sheetColumns;

  // If startRow > 1, we need to write headers manually
  if (startRow > 1) {
    // Clear auto-generated header from row 1
    const hRow = sheet.getRow(startRow);
    sheetColumns.forEach((col, idx) => {
      hRow.getCell(idx + 1).value = col.header;
    });
    hRow.font = { bold: true, color: { argb: C.white }, size: 10 };
    hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
    hRow.alignment = { horizontal: "center", wrapText: true };
    hRow.height = 28;
  } else {
    const hRow = sheet.getRow(1);
    hRow.font = { bold: true, color: { argb: C.white }, size: 10 };
    hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
    hRow.alignment = { horizontal: "center", wrapText: true };
    hRow.height = 28;
  }

  const totals: Record<string, number> = {};
  moneyColumns.forEach(c => totals[c] = 0);

  for (const nota of notas) {
    const rowData = buildRowData(nota);
    moneyColumns.forEach(c => { if (typeof rowData[c] === 'number') totals[c] += rowData[c]; });

    const row = sheet.addRow(rowData);
    row.getCell("tipo").fill = {
      type: "pattern", pattern: "solid",
      fgColor: { argb: nota.direcao === "emitida" ? C.emitenteBg : C.tomadorBg },
    };
    row.getCell("tipo").font = {
      bold: true,
      color: { argb: nota.direcao === "emitida" ? C.emitente : C.tomador },
    };
    if (nota.raw?.temRetencao) {
      row.getCell("temRetencao").fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.dangerLight } };
      row.getCell("temRetencao").font = { bold: true, color: { argb: C.danger } };
    }
  }

  // Linha de totais
  const totalData: Record<string, any> = { numeroNota: "TOTAL" };
  moneyColumns.forEach(c => totalData[c] = totals[c]);
  const totalRow = sheet.addRow(totalData);
  totalRow.font = { bold: true };
  totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.accentLight } };

  // Formatar colunas monetárias
  moneyColumns.forEach(c => { sheet.getColumn(c).numFmt = moneyFmt; });
  sheet.getColumn('aliquotaIssqn').numFmt = '0.00"%"';

  // Bordas
  sheet.eachRow((r: any, rn: number) => {
    if (rn >= startRow) {
      r.eachCell((cell: any) => {
        cell.border = {
          top: { style: "thin", color: { argb: C.border } },
          bottom: { style: "thin", color: { argb: C.border } },
          left: { style: "thin", color: { argb: C.border } },
          right: { style: "thin", color: { argb: C.border } },
        };
      });
    }
  });

  // Filtros automáticos
  const dataStart = startRow > 1 ? startRow : 1;
  sheet.autoFilter = {
    from: { row: dataStart, column: 1 },
    to: { row: dataStart + notas.length, column: sheetColumns.length },
  };

  // Congelar cabeçalho
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: dataStart }];

  return totals;
}

export async function gerarExcelRelatorio(
  notasComXml: NotaComXml[],
  contabNome: string,
  direcaoLabel: string,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "LAN7 - Pegasus";
  wb.created = new Date();

  const emitentes = notasComXml.filter(n => n.direcao === "emitida");
  const tomadores = notasComXml.filter(n => n.direcao === "recebida");

  // Calcular estatísticas
  let totalValorBruto = 0;
  let totalValorLiquido = 0;
  let totalIssqn = 0;
  let comRetencao = 0;
  let semRetencao = 0;

  for (const nota of notasComXml) {
    const r = nota.raw;
    const bruto = r ? r.valorServico : parseFloat(nota.valorServico ?? "0");
    const liquido = r ? r.valorLiquido : parseFloat(nota.valorLiquido ?? "0");
    totalValorBruto += bruto;
    totalValorLiquido += liquido;
    totalIssqn += r?.issqnApurado || 0;
    if (r?.temRetencao) comRetencao++;
    else semRetencao++;
  }

  // Agrupar notas por mês
  const notasPorMes = new Map<string, { total: number; emitidas: number; recebidas: number; valor: number }>();
  for (const nota of notasComXml) {
    const d = nota.dataCompetencia || nota.dataEmissao;
    if (!d) continue;
    const dt = new Date(d);
    const mes = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const entry = notasPorMes.get(mes) || { total: 0, emitidas: 0, recebidas: 0, valor: 0 };
    entry.total++;
    if (nota.direcao === "emitida") entry.emitidas++;
    else entry.recebidas++;
    const r = nota.raw;
    entry.valor += r ? r.valorServico : parseFloat(nota.valorServico ?? "0");
    notasPorMes.set(mes, entry);
  }
  const mesesOrdenados = Array.from(notasPorMes.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([mes, data]) => ({ mes, ...data }));

  // ═══════════════════════════════════════════════════════════════
  // ABA 1: RELATÓRIO (Dashboard com resumo e gráficos)
  // ═══════════════════════════════════════════════════════════════
  const wsRelatorio = wb.addWorksheet("Relatório", {
    properties: { tabColor: { argb: C.primary } },
    views: [{ showGridLines: false }],
  });

  for (let i = 1; i <= 12; i++) {
    wsRelatorio.getColumn(i).width = 14;
  }

  // ── HEADER ──────────────────────────────────────────────────
  let row = 1;
  wsRelatorio.mergeCells(row, 1, row, 12);
  const headerCell = wsRelatorio.getCell(row, 1);
  headerCell.value = "LAN7 - Pegasus";
  headerCell.font = { bold: true, size: 22, color: { argb: C.white } };
  headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primary } };
  headerCell.alignment = { horizontal: "center", vertical: "middle" };
  wsRelatorio.getRow(row).height = 45;

  row++;
  wsRelatorio.mergeCells(row, 1, row, 12);
  const subHeader = wsRelatorio.getCell(row, 1);
  subHeader.value = `Relatório Completo de NFSe | ${contabNome}`;
  subHeader.font = { size: 11, color: { argb: C.white }, italic: true };
  subHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
  subHeader.alignment = { horizontal: "center", vertical: "middle" };
  wsRelatorio.getRow(row).height = 28;

  row++;
  wsRelatorio.mergeCells(row, 1, row, 12);
  const dateCell = wsRelatorio.getCell(row, 1);
  dateCell.value = `Gerado em: ${new Date().toLocaleString("pt-BR")} | Direção: ${direcaoLabel} | Total: ${notasComXml.length} notas`;
  dateCell.font = { size: 9, color: { argb: C.textLight }, italic: true };
  dateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBg2 } };
  dateCell.alignment = { horizontal: "right", vertical: "middle" };
  wsRelatorio.getRow(row).height = 22;

  // ── CARDS DE RESUMO ─────────────────────────────────────────
  row += 2;
  wsRelatorio.mergeCells(row, 1, row, 12);
  const sectionTitle = wsRelatorio.getCell(row, 1);
  sectionTitle.value = "RESUMO GERAL";
  sectionTitle.font = { bold: true, size: 13, color: { argb: C.primary } };
  sectionTitle.border = { bottom: { style: "medium", color: { argb: C.accent } } };
  wsRelatorio.getRow(row).height = 28;

  row++;
  const cards = [
    { label: "Total de Notas", value: notasComXml.length.toLocaleString("pt-BR"), color: C.accent, bgColor: C.accentLight, cols: [1, 2] },
    { label: "Valor Bruto", value: fmtMoney(totalValorBruto), color: C.success, bgColor: C.successLight, cols: [3, 4] },
    { label: "Valor Líquido", value: fmtMoney(totalValorLiquido), color: C.purple, bgColor: C.purpleLight, cols: [5, 6] },
    { label: "ISSQN Total", value: fmtMoney(totalIssqn), color: C.warning, bgColor: C.warningLight, cols: [7, 8] },
    { label: "Com Retenção", value: comRetencao.toLocaleString("pt-BR"), color: C.danger, bgColor: C.dangerLight, cols: [9, 10] },
    { label: "Sem Retenção", value: semRetencao.toLocaleString("pt-BR"), color: C.cyan, bgColor: C.cyanLight, cols: [11, 12] },
  ];

  wsRelatorio.getRow(row).height = 32;
  for (const card of cards) {
    wsRelatorio.mergeCells(row, card.cols[0], row, card.cols[1]);
    const cell = wsRelatorio.getCell(row, card.cols[0]);
    cell.value = card.value;
    cell.font = { bold: true, size: 14, color: { argb: card.color } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: card.bgColor } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: card.color } },
      left: { style: "thin", color: { argb: card.color } },
      right: { style: "thin", color: { argb: card.color } },
    };
  }

  row++;
  wsRelatorio.getRow(row).height = 22;
  for (const card of cards) {
    wsRelatorio.mergeCells(row, card.cols[0], row, card.cols[1]);
    const cell = wsRelatorio.getCell(row, card.cols[0]);
    cell.value = card.label;
    cell.font = { size: 9, color: { argb: C.textLight } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: card.bgColor } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: card.color } },
      left: { style: "thin", color: { argb: card.color } },
      right: { style: "thin", color: { argb: card.color } },
    };
  }

  // ── SEGUNDA LINHA DE CARDS ──────────────────────────────────
  row += 2;
  const cards2 = [
    { label: "Emitidas", value: emitentes.length.toLocaleString("pt-BR"), color: C.emitente, bgColor: C.emitenteBg, colStart: 1, colEnd: 3 },
    { label: "Recebidas", value: tomadores.length.toLocaleString("pt-BR"), color: C.tomador, bgColor: C.tomadorBg, colStart: 4, colEnd: 6 },
    { label: "Ativas", value: notasComXml.filter(n => n.status === "valida").length.toLocaleString("pt-BR"), color: C.success, bgColor: C.successLight, colStart: 7, colEnd: 9 },
    { label: "Canceladas", value: notasComXml.filter(n => n.status === "cancelada").length.toLocaleString("pt-BR"), color: C.danger, bgColor: C.dangerLight, colStart: 10, colEnd: 12 },
  ];

  wsRelatorio.getRow(row).height = 32;
  for (const card of cards2) {
    wsRelatorio.mergeCells(row, card.colStart, row, card.colEnd);
    const cell = wsRelatorio.getCell(row, card.colStart);
    cell.value = card.value;
    cell.font = { bold: true, size: 14, color: { argb: card.color } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: card.bgColor } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: card.color } },
      left: { style: "thin", color: { argb: card.color } },
      right: { style: "thin", color: { argb: card.color } },
    };
  }

  row++;
  wsRelatorio.getRow(row).height = 22;
  for (const card of cards2) {
    wsRelatorio.mergeCells(row, card.colStart, row, card.colEnd);
    const cell = wsRelatorio.getCell(row, card.colStart);
    cell.value = card.label;
    cell.font = { size: 9, color: { argb: C.textLight } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: card.bgColor } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: card.color } },
      left: { style: "thin", color: { argb: card.color } },
      right: { style: "thin", color: { argb: card.color } },
    };
  }

  // ── GRÁFICOS ────────────────────────────────────────────────
  if (mesesOrdenados.length > 0) {
    row += 2;
    wsRelatorio.mergeCells(row, 1, row, 12);
    const chartSection = wsRelatorio.getCell(row, 1);
    chartSection.value = "GRÁFICOS";
    chartSection.font = { bold: true, size: 13, color: { argb: C.primary } };
    chartSection.border = { bottom: { style: "medium", color: { argb: C.accent } } };
    wsRelatorio.getRow(row).height = 28;
    row++;

    try {
      // Gráfico 1: Notas por Mês (barras)
      const chartBarBuf = await chartNotasPorMes(mesesOrdenados, { width: 600, height: 350 });
      const imgBarId = wb.addImage({ buffer: chartBarBuf as any, extension: "png" });
      wsRelatorio.addImage(imgBarId, {
        tl: { col: 0.2, row: row - 0.5 },
        ext: { width: 500, height: 290 },
      });

      // Gráfico 2: Evolução de Valores (linha)
      const chartLineBuf = await chartEvolucaoValores(
        mesesOrdenados.map(m => ({ mes: m.mes, valor: m.valor })),
        { width: 600, height: 350 },
      );
      const imgLineId = wb.addImage({ buffer: chartLineBuf as any, extension: "png" });
      wsRelatorio.addImage(imgLineId, {
        tl: { col: 6.2, row: row - 0.5 },
        ext: { width: 500, height: 290 },
      });

      row += 18;

      // Gráfico 3: Pizza Emitidas vs Recebidas
      const chartPieBuf = await chartDistribuicaoTipo(emitentes.length, tomadores.length, { width: 380, height: 320 });
      const imgPieId = wb.addImage({ buffer: chartPieBuf as any, extension: "png" });
      wsRelatorio.addImage(imgPieId, {
        tl: { col: 0.5, row: row - 0.5 },
        ext: { width: 350, height: 280 },
      });

      // Gráfico 4: Pizza Status
      const validas = notasComXml.filter(n => n.status === "valida").length;
      const canceladas = notasComXml.filter(n => n.status === "cancelada").length;
      const chartStatusBuf = await chartDistribuicaoStatus(validas, canceladas, { width: 380, height: 320 });
      const imgStatusId = wb.addImage({ buffer: chartStatusBuf as any, extension: "png" });
      wsRelatorio.addImage(imgStatusId, {
        tl: { col: 4.5, row: row - 0.5 },
        ext: { width: 350, height: 280 },
      });

      // Gráfico 5: Empilhadas por mês
      const chartStackBuf = await chartEmitidasRecebidasMes(mesesOrdenados, { width: 500, height: 320 });
      const imgStackId = wb.addImage({ buffer: chartStackBuf as any, extension: "png" });
      wsRelatorio.addImage(imgStackId, {
        tl: { col: 8.5, row: row - 0.5 },
        ext: { width: 350, height: 280 },
      });

      row += 18;
    } catch (e) {
      console.error("Erro ao gerar gráficos do relatório:", e);
    }
  }

  // ── TABELA RESUMO POR MÊS ──────────────────────────────────
  if (mesesOrdenados.length > 0) {
    row += 1;
    wsRelatorio.mergeCells(row, 1, row, 8);
    const mesSection = wsRelatorio.getCell(row, 1);
    mesSection.value = "RESUMO POR MÊS";
    mesSection.font = { bold: true, size: 13, color: { argb: C.primary } };
    mesSection.border = { bottom: { style: "medium", color: { argb: C.accent } } };
    wsRelatorio.getRow(row).height = 28;
    row++;

    const mesHeaders = ["Mês", "Total", "Emitidas", "Recebidas", "Valor (R$)", "% do Total"];
    mesHeaders.forEach((h, idx) => {
      const cell = wsRelatorio.getCell(row, idx + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: C.white }, size: 10 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
      cell.alignment = { horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: C.border } },
        bottom: { style: "thin", color: { argb: C.border } },
        left: { style: "thin", color: { argb: C.border } },
        right: { style: "thin", color: { argb: C.border } },
      };
    });
    wsRelatorio.getRow(row).height = 25;
    row++;

    const totalValorMeses = mesesOrdenados.reduce((s, m) => s + m.valor, 0);
    for (const m of mesesOrdenados) {
      const [y, mo] = m.mes.split("-");
      const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const mesNome = `${months[parseInt(mo) - 1]}/${y}`;
      const pct = totalValorMeses > 0 ? m.valor / totalValorMeses : 0;

      [mesNome, m.total, m.emitidas, m.recebidas, m.valor, pct].forEach((v, idx) => {
        const cell = wsRelatorio.getCell(row, idx + 1);
        cell.value = v;
        if (idx === 4) cell.numFmt = '#,##0.00';
        if (idx === 5) cell.numFmt = '0.0%';
        cell.border = {
          top: { style: "thin", color: { argb: C.border } },
          bottom: { style: "thin", color: { argb: C.border } },
          left: { style: "thin", color: { argb: C.border } },
          right: { style: "thin", color: { argb: C.border } },
        };
      });
      row++;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ABA 2: GERAL (todas as notas)
  // ═══════════════════════════════════════════════════════════════
  const sheetGeral = wb.addWorksheet("Geral", {
    properties: { tabColor: { argb: C.success } },
  });
  addNotasToSheet(sheetGeral, notasComXml, C.primary, 1);

  // ═══════════════════════════════════════════════════════════════
  // ABA 3: EMITENTE
  // ═══════════════════════════════════════════════════════════════
  if (emitentes.length > 0) {
    const sheetEmitente = wb.addWorksheet("Emitente", {
      properties: { tabColor: { argb: C.emitente } },
    });
    addNotasToSheet(sheetEmitente, emitentes, C.emitente, 1);
  }

  // ═══════════════════════════════════════════════════════════════
  // ABA 4: TOMADOR
  // ═══════════════════════════════════════════════════════════════
  if (tomadores.length > 0) {
    const sheetTomador = wb.addWorksheet("Tomador", {
      properties: { tabColor: { argb: C.tomador } },
    });
    addNotasToSheet(sheetTomador, tomadores, C.tomador, 1);
  }

  // ═══════════════════════════════════════════════════════════════
  // ABA 5: TRIBUTAÇÃO (resumo consolidado)
  // ═══════════════════════════════════════════════════════════════
  const wsTrib = wb.addWorksheet("Tributação", {
    properties: { tabColor: { argb: C.purple } },
  });

  // Header
  wsTrib.mergeCells(1, 1, 1, 8);
  const tribHeader = wsTrib.getCell(1, 1);
  tribHeader.value = "LAN7 - Pegasus | Resumo de Tributação";
  tribHeader.font = { bold: true, size: 16, color: { argb: C.white } };
  tribHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primary } };
  tribHeader.alignment = { horizontal: "center", vertical: "middle" };
  wsTrib.getRow(1).height = 35;

  wsTrib.getColumn(1).width = 30;
  wsTrib.getColumn(2).width = 20;
  wsTrib.getColumn(3).width = 15;
  wsTrib.getColumn(4).width = 20;
  wsTrib.getColumn(5).width = 20;
  wsTrib.getColumn(6).width = 20;
  wsTrib.getColumn(7).width = 20;
  wsTrib.getColumn(8).width = 20;

  // Cabeçalho da tabela de tributação
  const tribHeaders = ["Tributo", "Valor Total", "% sobre Bruto", "Emitidas", "Recebidas", "Com Retenção", "Sem Retenção", "Média por Nota"];
  const tribHeaderRow = wsTrib.addRow(tribHeaders);
  tribHeaderRow.font = { bold: true, color: { argb: C.white }, size: 10 };
  tribHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
  tribHeaderRow.alignment = { horizontal: "center" };
  tribHeaderRow.height = 25;

  // Calcular totais de tributação
  let totalIrrf = 0, totalCsll = 0, totalPis = 0, totalCofins = 0, totalCp = 0;
  let totalIssqnRetido = 0, totalTribFed = 0, totalTribEst = 0, totalTribMun = 0;
  let emitIssqn = 0, recIssqn = 0;
  let retIssqn = 0, nretIssqn = 0;

  for (const nota of notasComXml) {
    const r = nota.raw;
    if (!r) continue;
    totalIrrf += r.irrf || 0;
    totalCsll += r.csll || 0;
    totalPis += r.pis || 0;
    totalCofins += r.cofins || 0;
    totalCp += r.cp || 0;
    totalIssqnRetido += r.issqnRetido || 0;
    totalTribFed += r.tributosFederais || 0;
    totalTribEst += r.tributosEstaduais || 0;
    totalTribMun += r.tributosMunicipais || 0;
    if (nota.direcao === "emitida") emitIssqn += r.issqnApurado || 0;
    else recIssqn += r.issqnApurado || 0;
    if (r.temRetencao) retIssqn += r.issqnApurado || 0;
    else nretIssqn += r.issqnApurado || 0;
  }

  const pctBruto = (v: number) => totalValorBruto > 0 ? v / totalValorBruto : 0;
  const media = (v: number) => notasComXml.length > 0 ? v / notasComXml.length : 0;

  const tribRows = [
    { tributo: "ISSQN Apurado", valor: totalIssqn, emit: emitIssqn, rec: recIssqn, ret: retIssqn, nret: nretIssqn },
    { tributo: "ISSQN Retido", valor: totalIssqnRetido, emit: 0, rec: 0, ret: totalIssqnRetido, nret: 0 },
    { tributo: "IRRF", valor: totalIrrf, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "CSLL", valor: totalCsll, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "PIS", valor: totalPis, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "COFINS", valor: totalCofins, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "INSS/CP", valor: totalCp, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "Trib. Federais Aprox.", valor: totalTribFed, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "Trib. Estaduais Aprox.", valor: totalTribEst, emit: 0, rec: 0, ret: 0, nret: 0 },
    { tributo: "Trib. Municipais Aprox.", valor: totalTribMun, emit: 0, rec: 0, ret: 0, nret: 0 },
  ];

  tribRows.forEach((tr, idx) => {
    const dataRow = wsTrib.addRow([
      tr.tributo,
      tr.valor,
      pctBruto(tr.valor),
      tr.emit,
      tr.rec,
      tr.ret,
      tr.nret,
      media(tr.valor),
    ]);
    dataRow.getCell(2).numFmt = '#,##0.00';
    dataRow.getCell(3).numFmt = '0.00%';
    dataRow.getCell(4).numFmt = '#,##0.00';
    dataRow.getCell(5).numFmt = '#,##0.00';
    dataRow.getCell(6).numFmt = '#,##0.00';
    dataRow.getCell(7).numFmt = '#,##0.00';
    dataRow.getCell(8).numFmt = '#,##0.00';
    if (idx % 2 === 0) {
      dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBg } };
    }
  });

  // Bordas na aba tributação
  wsTrib.eachRow((r, rn) => {
    if (rn >= 2) {
      r.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: C.border } },
          bottom: { style: "thin", color: { argb: C.border } },
          left: { style: "thin", color: { argb: C.border } },
          right: { style: "thin", color: { argb: C.border } },
        };
      });
    }
  });

  // Linha de resumo final
  const summaryRow = wsTrib.addRow([]);
  wsTrib.addRow([]);
  const summaryTitle = wsTrib.addRow(["RESUMO DE VALORES"]);
  summaryTitle.font = { bold: true, size: 12, color: { argb: C.primary } };
  wsTrib.addRow(["Valor Bruto Total", totalValorBruto]).getCell(2).numFmt = '#,##0.00';
  wsTrib.addRow(["Valor Líquido Total", totalValorLiquido]).getCell(2).numFmt = '#,##0.00';
  wsTrib.addRow(["Total ISSQN", totalIssqn]).getCell(2).numFmt = '#,##0.00';
  wsTrib.addRow(["Total Retenções Federais", totalIrrf + totalCsll + totalPis + totalCofins + totalCp]).getCell(2).numFmt = '#,##0.00';
  wsTrib.addRow(["Notas com Retenção", comRetencao]);
  wsTrib.addRow(["Notas sem Retenção", semRetencao]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
