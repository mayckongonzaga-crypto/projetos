/**
 * Gerador de relatórios Excel para CT-e
 * Gera planilha detalhada com TODOS os campos fiscais do CT-e extraídos do XML
 */

interface CteNotaDB {
  numeroCte: string | null;
  chaveAcesso: string;
  serie: string | null;
  modelo: string | null;
  tipoDocumento: string;
  tipoEvento: string | null;
  direcao: string;
  status: string;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  emitenteUf: string | null;
  remetenteCnpj: string | null;
  remetenteNome: string | null;
  remetenteUf: string | null;
  destinatarioCnpj: string | null;
  destinatarioNome: string | null;
  destinatarioUf: string | null;
  tomadorCnpj: string | null;
  tomadorNome: string | null;
  tomadorUf: string | null;
  valorTotal: string | null;
  valorReceber: string | null;
  valorICMS: string | null;
  cfop: string | null;
  natOp: string | null;
  modal: string | null;
  ufInicio: string | null;
  ufFim: string | null;
  munInicio: string | null;
  munFim: string | null;
  produtoPredominante: string | null;
  pesoBruto: string | null;
  valorCarga: string | null;
  cstIcms: string | null;
  baseCalcIcms: string | null;
  aliqIcms: string | null;
  rntrc: string | null;
  placa: string | null;
  protocolo: string | null;
  chavesNfe: string | null;
  observacoes: string | null;
  dataEmissao: Date | string | null;
}

const COLUNAS_CTE = [
  // Identificação
  { header: "Nº CT-e", key: "numeroCte", width: 12 },
  { header: "Série", key: "serie", width: 8 },
  { header: "Modelo", key: "modelo", width: 8 },
  { header: "Chave de Acesso", key: "chaveAcesso", width: 52 },
  { header: "Protocolo", key: "protocolo", width: 20 },
  { header: "Tipo Documento", key: "tipoDocumento", width: 14 },
  { header: "Data Emissão", key: "dataEmissao", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Direção", key: "direcao", width: 12 },
  // Transporte
  { header: "Modal", key: "modal", width: 14 },
  { header: "CFOP", key: "cfop", width: 10 },
  { header: "Natureza Operação", key: "natOp", width: 35 },
  // Emitente (Transportadora)
  { header: "CNPJ Emitente", key: "emitenteCnpj", width: 20 },
  { header: "Emitente", key: "emitenteNome", width: 40 },
  { header: "UF Emit.", key: "emitenteUf", width: 8 },
  // Remetente
  { header: "CNPJ Remetente", key: "remetenteCnpj", width: 20 },
  { header: "Remetente", key: "remetenteNome", width: 40 },
  { header: "UF Rem.", key: "remetenteUf", width: 8 },
  // Destinatário
  { header: "CNPJ Destinatário", key: "destinatarioCnpj", width: 20 },
  { header: "Destinatário", key: "destinatarioNome", width: 40 },
  { header: "UF Dest.", key: "destinatarioUf", width: 8 },
  // Tomador
  { header: "CNPJ Tomador", key: "tomadorCnpj", width: 20 },
  { header: "Tomador", key: "tomadorNome", width: 40 },
  { header: "UF Tom.", key: "tomadorUf", width: 8 },
  // Rota
  { header: "UF Início", key: "ufInicio", width: 10 },
  { header: "Município Início", key: "munInicio", width: 25 },
  { header: "UF Fim", key: "ufFim", width: 10 },
  { header: "Município Fim", key: "munFim", width: 25 },
  // Carga
  { header: "Produto Predominante", key: "produtoPredominante", width: 35 },
  { header: "Peso Bruto (kg)", key: "pesoBruto", width: 16 },
  { header: "Valor Carga (R$)", key: "valorCarga", width: 16 },
  // Valores da Prestação
  { header: "Valor Frete (R$)", key: "valorTotal", width: 16 },
  { header: "Valor a Receber (R$)", key: "valorReceber", width: 18 },
  // ICMS
  { header: "CST ICMS", key: "cstIcms", width: 10 },
  { header: "Base Cálc. ICMS (R$)", key: "baseCalcIcms", width: 18 },
  { header: "Alíq. ICMS (%)", key: "aliqIcms", width: 14 },
  { header: "Valor ICMS (R$)", key: "valorICMS", width: 16 },
  // Modal Rodoviário
  { header: "RNTRC", key: "rntrc", width: 14 },
  { header: "Placa", key: "placa", width: 12 },
  // Documentos
  { header: "Chaves NFe Ref.", key: "chavesNfe", width: 55 },
  // Observações
  { header: "Observações", key: "observacoes", width: 60 },
];

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

function formatCurrency(val: string | null): number | string {
  if (!val) return "";
  const n = parseFloat(val);
  return isNaN(n) ? "" : n;
}

function formatDecimal(val: string | null): number | string {
  if (!val) return "";
  const n = parseFloat(val);
  return isNaN(n) ? "" : n;
}

function formatModal(modal: string | null): string {
  if (!modal) return "";
  const map: Record<string, string> = {
    rodoviario: "Rodoviário",
    aereo: "Aéreo",
    aquaviario: "Aquaviário",
    ferroviario: "Ferroviário",
    dutoviario: "Dutoviário",
    multimodal: "Multimodal",
  };
  return map[modal] || modal;
}

function formatDirecao(d: string): string {
  const map: Record<string, string> = {
    emitido: "Emitido",
    tomado: "Tomado",
    terceiro: "Terceiro",
  };
  return map[d] || d;
}

function formatStatus(s: string): string {
  const map: Record<string, string> = {
    autorizado: "Autorizado",
    cancelado: "Cancelado",
    denegado: "Denegado",
  };
  return map[s] || s;
}

function formatChavesNfe(json: string | null): string {
  if (!json) return "";
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join(", ") : json;
  } catch {
    return json;
  }
}

interface FiltrosAplicados {
  clienteNome?: string;
  emitente?: string;
  modal?: string;
  direcao?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}

export async function gerarRelatorioCteExcel(
  notas: CteNotaDB[],
  tipo: string,
  clienteCnpj?: string,
  filtros?: FiltrosAplicados,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pegasus - LAN7 Tecnologia";
  wb.created = new Date();

  // ═══════════════════════════════════════════════════════════════════
  // ABA 1: Dados Detalhados
  // ═══════════════════════════════════════════════════════════════════
  const ws = wb.addWorksheet("CT-e Detalhado");

  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0D47A1" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const headerBorder = {
    top: { style: "thin" as const, color: { argb: "FF1565C0" } },
    bottom: { style: "thin" as const, color: { argb: "FF1565C0" } },
    left: { style: "thin" as const, color: { argb: "FF1565C0" } },
    right: { style: "thin" as const, color: { argb: "FF1565C0" } },
  };

  // Título
  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.value = `LAN7 - Pegasus | Relatório CT-e ${tipo}`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0D47A1" } };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 30;

  // Filtros aplicados
  const filtroTexts: string[] = [];
  if (filtros?.clienteNome) filtroTexts.push(`Empresa: ${filtros.clienteNome}`);
  if (filtros?.emitente) filtroTexts.push(`Emitente: ${filtros.emitente}`);
  if (filtros?.modal) filtroTexts.push(`Modal: ${filtros.modal}`);
  if (filtros?.direcao) filtroTexts.push(`Direção: ${filtros.direcao}`);
  if (filtros?.status) filtroTexts.push(`Status: ${filtros.status}`);
  if (filtros?.dataInicio || filtros?.dataFim) filtroTexts.push(`Período: ${filtros.dataInicio || '...'} a ${filtros.dataFim || '...'}`);
  if (clienteCnpj) filtroTexts.push(`CNPJ: ${clienteCnpj}`);

  ws.mergeCells("A2:H2");
  const infoCell = ws.getCell("A2");
  infoCell.value = `Gerado em: ${new Date().toLocaleString("pt-BR")} | Total: ${notas.length} CT-e(s)${filtroTexts.length > 0 ? ` | Filtros: ${filtroTexts.join(", ")}` : ""}`;
  infoCell.font = { size: 9, color: { argb: "FF666666" } };
  ws.getRow(2).height = 18;

  // Colunas
  ws.columns = COLUNAS_CTE.map(c => ({ header: c.header, key: c.key, width: c.width }));

  // Estilizar header (linha 3)
  const headerRow = ws.getRow(3);
  COLUNAS_CTE.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  headerRow.height = 24;

  // Dados
  for (const nota of notas) {
    const row: Record<string, any> = {
      numeroCte: nota.numeroCte || "",
      serie: nota.serie || "",
      modelo: nota.modelo || "",
      chaveAcesso: nota.chaveAcesso,
      protocolo: nota.protocolo || "",
      tipoDocumento: nota.tipoDocumento,
      dataEmissao: formatDate(nota.dataEmissao),
      status: formatStatus(nota.status),
      direcao: formatDirecao(nota.direcao),
      modal: formatModal(nota.modal),
      cfop: nota.cfop || "",
      natOp: nota.natOp || "",
      emitenteCnpj: nota.emitenteCnpj || "",
      emitenteNome: nota.emitenteNome || "",
      emitenteUf: nota.emitenteUf || "",
      remetenteCnpj: nota.remetenteCnpj || "",
      remetenteNome: nota.remetenteNome || "",
      remetenteUf: (nota as any).remetenteUf || "",
      destinatarioCnpj: nota.destinatarioCnpj || "",
      destinatarioNome: nota.destinatarioNome || "",
      destinatarioUf: (nota as any).destinatarioUf || "",
      tomadorCnpj: nota.tomadorCnpj || "",
      tomadorNome: nota.tomadorNome || "",
      tomadorUf: (nota as any).tomadorUf || "",
      ufInicio: nota.ufInicio || "",
      munInicio: nota.munInicio || "",
      ufFim: nota.ufFim || "",
      munFim: nota.munFim || "",
      produtoPredominante: nota.produtoPredominante || "",
      pesoBruto: formatDecimal(nota.pesoBruto),
      valorCarga: formatCurrency(nota.valorCarga),
      valorTotal: formatCurrency(nota.valorTotal),
      valorReceber: formatCurrency(nota.valorReceber),
      cstIcms: nota.cstIcms || "",
      baseCalcIcms: formatCurrency(nota.baseCalcIcms),
      aliqIcms: formatDecimal(nota.aliqIcms),
      valorICMS: formatCurrency(nota.valorICMS),
      rntrc: nota.rntrc || "",
      placa: nota.placa || "",
      chavesNfe: formatChavesNfe(nota.chavesNfe),
      observacoes: nota.observacoes || "",
    };
    ws.addRow(row);
  }

  // Formatar linhas de dados com zebra
  for (let i = 4; i <= ws.rowCount; i++) {
    const row = ws.getRow(i);
    const isEven = (i - 4) % 2 === 0;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        bottom: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
      };
      if (isEven) {
        cell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF5F8FF" } };
      }
      cell.font = { size: 9 };
    });
  }

  // Formatar colunas de valor como moeda
  const valorCols = ["valorTotal", "valorReceber", "valorICMS", "valorCarga", "baseCalcIcms"];
  for (const colKey of valorCols) {
    const colIdx = COLUNAS_CTE.findIndex(c => c.key === colKey);
    if (colIdx >= 0) {
      ws.getColumn(colIdx + 1).numFmt = '#,##0.00';
    }
  }

  // Formatar peso
  const pesoIdx = COLUNAS_CTE.findIndex(c => c.key === "pesoBruto");
  if (pesoIdx >= 0) ws.getColumn(pesoIdx + 1).numFmt = '#,##0.0000';

  // Formatar alíquota
  const aliqIdx = COLUNAS_CTE.findIndex(c => c.key === "aliqIcms");
  if (aliqIdx >= 0) ws.getColumn(aliqIdx + 1).numFmt = '#,##0.00';

  // Auto-filter
  ws.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: ws.rowCount, column: COLUNAS_CTE.length },
  };

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 3 }];

  // ═══════════════════════════════════════════════════════════════════
  // ABA 2: Resumo por Emitente
  // ═══════════════════════════════════════════════════════════════════
  const wsResumo = wb.addWorksheet("Resumo por Emitente");

  // Agrupar por emitente
  const porEmitente = new Map<string, { cnpj: string; nome: string; qtd: number; valorTotal: number; valorReceber: number; valorICMS: number; pesoTotal: number; valorCarga: number }>();
  for (const n of notas) {
    const key = n.emitenteCnpj || "SEM_CNPJ";
    const existing = porEmitente.get(key) || { cnpj: n.emitenteCnpj || "", nome: n.emitenteNome || "", qtd: 0, valorTotal: 0, valorReceber: 0, valorICMS: 0, pesoTotal: 0, valorCarga: 0 };
    existing.qtd++;
    existing.valorTotal += parseFloat(n.valorTotal || "0") || 0;
    existing.valorReceber += parseFloat(n.valorReceber || "0") || 0;
    existing.valorICMS += parseFloat(n.valorICMS || "0") || 0;
    existing.pesoTotal += parseFloat(n.pesoBruto || "0") || 0;
    existing.valorCarga += parseFloat(n.valorCarga || "0") || 0;
    porEmitente.set(key, existing);
  }

  // Título
  wsResumo.mergeCells("A1:H1");
  wsResumo.getCell("A1").value = "LAN7 - Pegasus | Resumo por Emitente (Transportadora)";
  wsResumo.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0D47A1" } };
  wsResumo.getRow(1).height = 30;

  const resumoCols = [
    { header: "Emitente", key: "nome", width: 45 },
    { header: "CNPJ", key: "cnpj", width: 22 },
    { header: "Qtd CT-e", key: "qtd", width: 12 },
    { header: "Valor Frete (R$)", key: "valorTotal", width: 18 },
    { header: "Valor a Receber (R$)", key: "valorReceber", width: 20 },
    { header: "Valor ICMS (R$)", key: "valorICMS", width: 18 },
    { header: "Peso Total (kg)", key: "pesoTotal", width: 18 },
    { header: "Valor Carga (R$)", key: "valorCarga", width: 18 },
  ];

  wsResumo.columns = resumoCols.map(c => ({ header: c.header, key: c.key, width: c.width }));

  const resumoHeaderRow = wsResumo.getRow(2);
  resumoCols.forEach((col, i) => {
    const cell = resumoHeaderRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  resumoHeaderRow.height = 22;

  const sorted = Array.from(porEmitente.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  for (let idx = 0; idx < sorted.length; idx++) {
    wsResumo.addRow(sorted[idx]);
  }

  // Totais
  const totalRow = wsResumo.addRow({
    nome: "TOTAL",
    cnpj: "",
    qtd: sorted.reduce((s, e) => s + e.qtd, 0),
    valorTotal: sorted.reduce((s, e) => s + e.valorTotal, 0),
    valorReceber: sorted.reduce((s, e) => s + e.valorReceber, 0),
    valorICMS: sorted.reduce((s, e) => s + e.valorICMS, 0),
    pesoTotal: sorted.reduce((s, e) => s + e.pesoTotal, 0),
    valorCarga: sorted.reduce((s, e) => s + e.valorCarga, 0),
  });
  totalRow.font = { bold: true, size: 11 };
  totalRow.eachCell((cell) => {
    cell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE3F2FD" } };
  });

  // Formatar colunas de valor
  for (const key of ["valorTotal", "valorReceber", "valorICMS", "valorCarga"]) {
    const idx = resumoCols.findIndex(c => c.key === key);
    if (idx >= 0) wsResumo.getColumn(idx + 1).numFmt = '#,##0.00';
  }
  const pesoResumoIdx = resumoCols.findIndex(c => c.key === "pesoTotal");
  if (pesoResumoIdx >= 0) wsResumo.getColumn(pesoResumoIdx + 1).numFmt = '#,##0.00';

  // Zebra
  for (let i = 3; i <= wsResumo.rowCount - 1; i++) {
    const row = wsResumo.getRow(i);
    if ((i - 3) % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF5F8FF" } };
      });
    }
  }

  wsResumo.autoFilter = { from: { row: 2, column: 1 }, to: { row: wsResumo.rowCount, column: resumoCols.length } };
  wsResumo.views = [{ state: "frozen", ySplit: 2 }];

  // ═══════════════════════════════════════════════════════════════════
  // ABA 3: Resumo por Modal
  // ═══════════════════════════════════════════════════════════════════
  const wsModal = wb.addWorksheet("Resumo por Modal");

  const porModal = new Map<string, { modal: string; qtd: number; valorTotal: number; valorICMS: number; pesoTotal: number }>();
  for (const n of notas) {
    const key = n.modal || "N/I";
    const existing = porModal.get(key) || { modal: formatModal(n.modal) || "N/I", qtd: 0, valorTotal: 0, valorICMS: 0, pesoTotal: 0 };
    existing.qtd++;
    existing.valorTotal += parseFloat(n.valorTotal || "0") || 0;
    existing.valorICMS += parseFloat(n.valorICMS || "0") || 0;
    existing.pesoTotal += parseFloat(n.pesoBruto || "0") || 0;
    porModal.set(key, existing);
  }

  wsModal.mergeCells("A1:E1");
  wsModal.getCell("A1").value = "LAN7 - Pegasus | Resumo por Modal";
  wsModal.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0D47A1" } };
  wsModal.getRow(1).height = 30;

  const modalCols = [
    { header: "Modal", key: "modal", width: 20 },
    { header: "Qtd CT-e", key: "qtd", width: 12 },
    { header: "Valor Frete (R$)", key: "valorTotal", width: 18 },
    { header: "Valor ICMS (R$)", key: "valorICMS", width: 18 },
    { header: "Peso Total (kg)", key: "pesoTotal", width: 18 },
  ];

  wsModal.columns = modalCols.map(c => ({ header: c.header, key: c.key, width: c.width }));
  const modalHeaderRow = wsModal.getRow(2);
  modalCols.forEach((col, i) => {
    const cell = modalHeaderRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  modalHeaderRow.height = 22;

  const modalArr = Array.from(porModal.values());
  for (let idx = 0; idx < modalArr.length; idx++) wsModal.addRow(modalArr[idx]);

  // Formatar
  for (const key of ["valorTotal", "valorICMS"]) {
    const idx = modalCols.findIndex(c => c.key === key);
    if (idx >= 0) wsModal.getColumn(idx + 1).numFmt = '#,##0.00';
  }

  // ═══════════════════════════════════════════════════════════════════
  // ABA 4: Resumo por Status
  // ═══════════════════════════════════════════════════════════════════
  const wsStatus = wb.addWorksheet("Resumo por Status");

  const porStatus = new Map<string, { status: string; qtd: number; valorTotal: number }>();
  for (const n of notas) {
    const key = n.status;
    const existing = porStatus.get(key) || { status: formatStatus(n.status), qtd: 0, valorTotal: 0 };
    existing.qtd++;
    existing.valorTotal += parseFloat(n.valorTotal || "0") || 0;
    porStatus.set(key, existing);
  }

  wsStatus.mergeCells("A1:C1");
  wsStatus.getCell("A1").value = "LAN7 - Pegasus | Resumo por Status";
  wsStatus.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF0D47A1" } };
  wsStatus.getRow(1).height = 30;

  const statusCols = [
    { header: "Status", key: "status", width: 20 },
    { header: "Qtd CT-e", key: "qtd", width: 12 },
    { header: "Valor Frete (R$)", key: "valorTotal", width: 18 },
  ];

  wsStatus.columns = statusCols.map(c => ({ header: c.header, key: c.key, width: c.width }));
  const statusHeaderRow = wsStatus.getRow(2);
  statusCols.forEach((col, i) => {
    const cell = statusHeaderRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  statusHeaderRow.height = 22;

  const statusArr = Array.from(porStatus.values());
  for (let idx = 0; idx < statusArr.length; idx++) wsStatus.addRow(statusArr[idx]);
  wsStatus.getColumn(3).numFmt = '#,##0.00';

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
