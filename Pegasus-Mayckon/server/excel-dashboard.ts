/**
 * Gerador de Excel profissional para o Dashboard
 * Estilo LAN7 - Pegasus com cabeçalho, cards de resumo, gráficos e tabelas
 */

import {
  chartNotasPorMes,
  chartTopEmpresas,
  chartDistribuicaoTipo,
  chartDistribuicaoStatus,
  chartEvolucaoValores,
  COLORS,
} from "./excel-charts";

// Cores ARGB para ExcelJS (sem #, com FF de alpha)
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
  headerBg: "FF0F172A",
};

interface DashboardStats {
  totalNotas: number;
  emitidas: number;
  recebidas: number;
  canceladas: number;
  validas: number;
  valorTotal: number;
  valorEmitido: number;
  valorRecebido: number;
  notasPorMes: { mes: string; total: number; emitidas: number; recebidas: number; valor: string }[];
  totalClientes: number;
  totalCertificados: number;
  certVencidos: number;
  topClientes: { clienteId: number; razaoSocial: string; cnpj: string; totalNotas: number; valorTotal: number; valorEmitido: number; valorRecebido: number }[];
}

interface ClienteData {
  clienteId: number;
  razaoSocial: string;
  cnpj: string;
  totalNotas: number;
  valorTotal: number;
  valorEmitido: number;
  valorRecebido: number;
  notasEmitidas?: number;
  notasRecebidas?: number;
}

function fmtMoney(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function gerarExcelDashboard(
  stats: DashboardStats,
  allClientes: ClienteData[],
  contabNome: string,
  mesLabel: string,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "LAN7 - Pegasus";
  wb.created = new Date();

  // ═══════════════════════════════════════════════════════════════
  // ABA 1: DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  const wsDash = wb.addWorksheet("Dashboard", {
    properties: { tabColor: { argb: C.primary } },
    views: [{ showGridLines: false }],
  });

  // Largura das colunas (A-L)
  for (let i = 1; i <= 12; i++) {
    wsDash.getColumn(i).width = 14;
  }

  // ── HEADER ──────────────────────────────────────────────────
  let row = 1;
  wsDash.mergeCells(row, 1, row, 12);
  const headerCell = wsDash.getCell(row, 1);
  headerCell.value = "LAN7 - Pegasus";
  headerCell.font = { bold: true, size: 22, color: { argb: C.white } };
  headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primary } };
  headerCell.alignment = { horizontal: "center", vertical: "middle" };
  wsDash.getRow(row).height = 45;

  row++;
  wsDash.mergeCells(row, 1, row, 12);
  const subHeaderCell = wsDash.getCell(row, 1);
  subHeaderCell.value = `Relatório do Dashboard | ${contabNome} | Período: ${mesLabel}`;
  subHeaderCell.font = { size: 11, color: { argb: C.white }, italic: true };
  subHeaderCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
  subHeaderCell.alignment = { horizontal: "center", vertical: "middle" };
  wsDash.getRow(row).height = 28;

  row++;
  wsDash.mergeCells(row, 1, row, 12);
  const dateCell = wsDash.getCell(row, 1);
  dateCell.value = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
  dateCell.font = { size: 9, color: { argb: C.textLight }, italic: true };
  dateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBg2 } };
  dateCell.alignment = { horizontal: "right", vertical: "middle" };
  wsDash.getRow(row).height = 22;

  // ── CARDS DE RESUMO ─────────────────────────────────────────
  row += 2;
  wsDash.mergeCells(row, 1, row, 12);
  const sectionTitle = wsDash.getCell(row, 1);
  sectionTitle.value = "RESUMO GERAL";
  sectionTitle.font = { bold: true, size: 13, color: { argb: C.primary } };
  sectionTitle.border = { bottom: { style: "medium", color: { argb: C.accent } } };
  wsDash.getRow(row).height = 28;

  row++;
  const cards = [
    { label: "Total de Notas", value: stats.totalNotas.toLocaleString("pt-BR"), color: C.accent, bgColor: C.accentLight, cols: [1, 2] },
    { label: "Emitidas", value: stats.emitidas.toLocaleString("pt-BR"), color: C.success, bgColor: C.successLight, cols: [3, 4] },
    { label: "Recebidas", value: stats.recebidas.toLocaleString("pt-BR"), color: C.warning, bgColor: C.warningLight, cols: [5, 6] },
    { label: "Canceladas", value: stats.canceladas.toLocaleString("pt-BR"), color: C.danger, bgColor: C.dangerLight, cols: [7, 8] },
    { label: "Valor Total", value: fmtMoney(stats.valorTotal), color: C.purple, bgColor: C.purpleLight, cols: [9, 10] },
    { label: "Clientes", value: stats.totalClientes.toLocaleString("pt-BR"), color: C.cyan, bgColor: C.cyanLight, cols: [11, 12] },
  ];

  // Valor row
  const valueRow = row;
  wsDash.getRow(valueRow).height = 32;
  for (const card of cards) {
    wsDash.mergeCells(valueRow, card.cols[0], valueRow, card.cols[1]);
    const cell = wsDash.getCell(valueRow, card.cols[0]);
    cell.value = card.value;
    cell.font = { bold: true, size: 16, color: { argb: card.color } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: card.bgColor } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: card.color } },
      left: { style: "thin", color: { argb: card.color } },
      right: { style: "thin", color: { argb: card.color } },
    };
  }

  // Label row
  row++;
  wsDash.getRow(row).height = 22;
  for (const card of cards) {
    wsDash.mergeCells(row, card.cols[0], row, card.cols[1]);
    const cell = wsDash.getCell(row, card.cols[0]);
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
    { label: "Valor Emitido", value: fmtMoney(stats.valorEmitido), color: C.success, bgColor: C.successLight, colStart: 1, colEnd: 3 },
    { label: "Valor Recebido", value: fmtMoney(stats.valorRecebido), color: C.warning, bgColor: C.warningLight, colStart: 4, colEnd: 6 },
    { label: "Certificados Ativos", value: stats.totalCertificados.toLocaleString("pt-BR"), color: C.accent, bgColor: C.accentLight, colStart: 7, colEnd: 9 },
    { label: "Cert. Vencidos", value: stats.certVencidos.toLocaleString("pt-BR"), color: C.danger, bgColor: C.dangerLight, colStart: 10, colEnd: 12 },
  ];

  wsDash.getRow(row).height = 32;
  for (const card of cards2) {
    wsDash.mergeCells(row, card.colStart, row, card.colEnd);
    const cell = wsDash.getCell(row, card.colStart);
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
  wsDash.getRow(row).height = 22;
  for (const card of cards2) {
    wsDash.mergeCells(row, card.colStart, row, card.colEnd);
    const cell = wsDash.getCell(row, card.colStart);
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
  row += 2;
  wsDash.mergeCells(row, 1, row, 12);
  const chartSection = wsDash.getCell(row, 1);
  chartSection.value = "GRÁFICOS";
  chartSection.font = { bold: true, size: 13, color: { argb: C.primary } };
  chartSection.border = { bottom: { style: "medium", color: { argb: C.accent } } };
  wsDash.getRow(row).height = 28;
  row++;

  // Gerar gráficos como imagens
  if (stats.notasPorMes.length > 0) {
    try {
      // Gráfico 1: Notas por Mês (barras)
      const chartBarBuf = await chartNotasPorMes(stats.notasPorMes, { width: 600, height: 350 });
      const imgBarId = wb.addImage({ buffer: chartBarBuf as any, extension: "png" });
      wsDash.addImage(imgBarId, {
        tl: { col: 0.2, row: row - 0.5 },
        ext: { width: 500, height: 290 },
      });

      // Gráfico 2: Evolução de Valores (linha)
      const chartLineBuf = await chartEvolucaoValores(stats.notasPorMes, { width: 600, height: 350 });
      const imgLineId = wb.addImage({ buffer: chartLineBuf as any, extension: "png" });
      wsDash.addImage(imgLineId, {
        tl: { col: 6.2, row: row - 0.5 },
        ext: { width: 500, height: 290 },
      });

      // Pular linhas para os gráficos
      row += 18;

      // Gráfico 3: Pizza Emitidas vs Recebidas
      const chartPieBuf = await chartDistribuicaoTipo(stats.emitidas, stats.recebidas, { width: 380, height: 320 });
      const imgPieId = wb.addImage({ buffer: chartPieBuf as any, extension: "png" });
      wsDash.addImage(imgPieId, {
        tl: { col: 0.5, row: row - 0.5 },
        ext: { width: 350, height: 280 },
      });

      // Gráfico 4: Pizza Status
      const chartStatusBuf = await chartDistribuicaoStatus(stats.validas, stats.canceladas, { width: 380, height: 320 });
      const imgStatusId = wb.addImage({ buffer: chartStatusBuf as any, extension: "png" });
      wsDash.addImage(imgStatusId, {
        tl: { col: 4.5, row: row - 0.5 },
        ext: { width: 350, height: 280 },
      });

      // Gráfico 5: Top Empresas (se houver dados)
      const tableData = allClientes.length > 0 ? allClientes : stats.topClientes;
      if (tableData.length > 0) {
        const chartTopBuf = await chartTopEmpresas(tableData, { width: 500, height: 350 });
        const imgTopId = wb.addImage({ buffer: chartTopBuf as any, extension: "png" });
        wsDash.addImage(imgTopId, {
          tl: { col: 8.2, row: row - 0.5 },
          ext: { width: 350, height: 280 },
        });
      }

      row += 18;
    } catch (e) {
      // Se falhar a geração de gráficos, continua sem eles
      console.error("Erro ao gerar gráficos:", e);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ABA 2: NOTAS POR MÊS
  // ═══════════════════════════════════════════════════════════════
  if (stats.notasPorMes.length > 0) {
    const wsMes = wb.addWorksheet("Notas por Mês", {
      properties: { tabColor: { argb: C.accent } },
    });

    // Header
    wsMes.mergeCells(1, 1, 1, 6);
    const mesHeader = wsMes.getCell(1, 1);
    mesHeader.value = "LAN7 - Pegasus | Notas por Mês";
    mesHeader.font = { bold: true, size: 16, color: { argb: C.white } };
    mesHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primary } };
    mesHeader.alignment = { horizontal: "center", vertical: "middle" };
    wsMes.getRow(1).height = 35;

    // Colunas
    wsMes.getColumn(1).width = 15;
    wsMes.getColumn(2).width = 12;
    wsMes.getColumn(3).width = 12;
    wsMes.getColumn(4).width = 12;
    wsMes.getColumn(5).width = 20;
    wsMes.getColumn(6).width = 15;

    // Cabeçalho da tabela
    const headers = ["Mês", "Total", "Emitidas", "Recebidas", "Valor (R$)", "% do Total"];
    const headerRow = wsMes.addRow(headers);
    headerRow.font = { bold: true, color: { argb: C.white }, size: 10 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
    headerRow.alignment = { horizontal: "center" };
    headerRow.height = 25;

    const totalValor = stats.notasPorMes.reduce((s, m) => s + parseFloat(m.valor), 0);

    stats.notasPorMes.forEach((m, idx) => {
      const [y, mo] = m.mes.split("-");
      const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
      const mesNome = `${months[parseInt(mo) - 1]}/${y}`;
      const valor = parseFloat(m.valor);
      const pct = totalValor > 0 ? (valor / totalValor * 100) : 0;

      const dataRow = wsMes.addRow([mesNome, m.total, m.emitidas, m.recebidas, valor, pct / 100]);
      dataRow.getCell(5).numFmt = '#,##0.00';
      dataRow.getCell(6).numFmt = '0.0%';
      if (idx % 2 === 0) {
        dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBg } };
      }
    });

    // Linha de total
    const totalRow = wsMes.addRow([
      "TOTAL",
      stats.notasPorMes.reduce((s, m) => s + m.total, 0),
      stats.notasPorMes.reduce((s, m) => s + m.emitidas, 0),
      stats.notasPorMes.reduce((s, m) => s + m.recebidas, 0),
      totalValor,
      1,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.accentLight } };
    totalRow.getCell(5).numFmt = '#,##0.00';
    totalRow.getCell(6).numFmt = '0.0%';

    // Bordas
    wsMes.eachRow((r, rn) => {
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
  }

  // ═══════════════════════════════════════════════════════════════
  // ABA 3: CLIENTES
  // ═══════════════════════════════════════════════════════════════
  const tableData = allClientes.length > 0 ? allClientes : stats.topClientes;
  if (tableData.length > 0) {
    const wsCli = wb.addWorksheet("Clientes", {
      properties: { tabColor: { argb: C.success } },
    });

    // Header
    wsCli.mergeCells(1, 1, 1, 8);
    const cliHeader = wsCli.getCell(1, 1);
    cliHeader.value = "LAN7 - Pegasus | Clientes por Valor";
    cliHeader.font = { bold: true, size: 16, color: { argb: C.white } };
    cliHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primary } };
    cliHeader.alignment = { horizontal: "center", vertical: "middle" };
    wsCli.getRow(1).height = 35;

    // Sub-header
    wsCli.mergeCells(2, 1, 2, 8);
    const cliSubHeader = wsCli.getCell(2, 1);
    cliSubHeader.value = `${contabNome} | ${mesLabel} | ${tableData.length} empresas`;
    cliSubHeader.font = { size: 10, color: { argb: C.white }, italic: true };
    cliSubHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
    cliSubHeader.alignment = { horizontal: "center", vertical: "middle" };
    wsCli.getRow(2).height = 25;

    // Colunas
    wsCli.getColumn(1).width = 6;
    wsCli.getColumn(2).width = 20;
    wsCli.getColumn(3).width = 45;
    wsCli.getColumn(4).width = 10;
    wsCli.getColumn(5).width = 18;
    wsCli.getColumn(6).width = 18;
    wsCli.getColumn(7).width = 18;
    wsCli.getColumn(8).width = 12;

    // Cabeçalho da tabela
    const headers = ["#", "CNPJ", "Razão Social", "Notas", "Valor Emitido", "Valor Recebido", "Valor Total", "% Total"];
    const headerRow = wsCli.addRow(headers);
    headerRow.font = { bold: true, color: { argb: C.white }, size: 10 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.primaryLight } };
    headerRow.alignment = { horizontal: "center" };
    headerRow.height = 25;

    const grandTotal = tableData.reduce((s, c) => s + c.valorTotal, 0);

    tableData.forEach((c, idx) => {
      const pct = grandTotal > 0 ? c.valorTotal / grandTotal : 0;
      const dataRow = wsCli.addRow([
        idx + 1,
        c.cnpj || "",
        c.razaoSocial,
        c.totalNotas,
        c.valorEmitido || 0,
        c.valorRecebido || 0,
        c.valorTotal,
        pct,
      ]);
      dataRow.getCell(5).numFmt = '#,##0.00';
      dataRow.getCell(6).numFmt = '#,##0.00';
      dataRow.getCell(7).numFmt = '#,##0.00';
      dataRow.getCell(8).numFmt = '0.0%';
      dataRow.getCell(3).alignment = { horizontal: "left" };
      if (idx % 2 === 0) {
        dataRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.lightBg } };
      }
    });

    // Linha de total
    const totalRow = wsCli.addRow([
      "",
      "",
      "TOTAL",
      tableData.reduce((s, c) => s + c.totalNotas, 0),
      tableData.reduce((s, c) => s + (c.valorEmitido || 0), 0),
      tableData.reduce((s, c) => s + (c.valorRecebido || 0), 0),
      grandTotal,
      1,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.accentLight } };
    totalRow.getCell(5).numFmt = '#,##0.00';
    totalRow.getCell(6).numFmt = '#,##0.00';
    totalRow.getCell(7).numFmt = '#,##0.00';
    totalRow.getCell(8).numFmt = '0.0%';

    // Bordas
    wsCli.eachRow((r, rn) => {
      if (rn >= 3) {
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

    // Filtros automáticos
    wsCli.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + tableData.length, column: 8 } };
    // Congelar
    wsCli.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
