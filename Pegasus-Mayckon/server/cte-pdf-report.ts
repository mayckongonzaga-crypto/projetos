/**
 * Gerador de relatórios PDF para CT-e
 * Gera relatório tabular com resumo e detalhamento completo dos CT-e
 * Inclui todos os campos fiscais extraídos do XML
 */

interface CteNotaPdf {
  numeroCte: string | null;
  chaveAcesso: string;
  serie: string | null;
  modelo: string | null;
  tipoDocumento: string;
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

function fmtDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

function fmtCurrency(val: string | null): string {
  if (!val) return "R$ 0,00";
  const num = parseFloat(val);
  if (isNaN(num)) return "R$ 0,00";
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDecimal(val: string | null, decimals = 2): string {
  if (!val) return "-";
  const num = parseFloat(val);
  if (isNaN(num)) return "-";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtModal(modal: string | null): string {
  if (!modal) return "-";
  const map: Record<string, string> = {
    rodoviario: "Rodoviário", aereo: "Aéreo", aquaviario: "Aquaviário",
    ferroviario: "Ferroviário", dutoviario: "Dutoviário", multimodal: "Multimodal",
  };
  return map[modal] || modal;
}

function fmtDirecao(d: string): string {
  const map: Record<string, string> = { emitido: "Emitido", tomado: "Tomado", terceiro: "Terceiro" };
  return map[d] || d;
}

function fmtStatus(s: string): string {
  const map: Record<string, string> = { autorizado: "Autorizado", cancelado: "Cancelado", denegado: "Denegado" };
  return map[s] || s;
}

function truncate(s: string | null, max: number): string {
  if (!s) return "-";
  return s.length > max ? s.substring(0, max) + "..." : s;
}

export interface PdfReportFilters {
  clienteNome?: string;
  emitenteNome?: string;
  direcao?: string;
  status?: string;
  modal?: string;
  dataInicio?: string;
  dataFim?: string;
}

export async function gerarRelatorioCtesPdf(
  notas: CteNotaPdf[],
  tipo: string,
  filtros?: PdfReportFilters,
): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 25, right: 25 },
      bufferPages: true,
      info: {
        Title: `Relatório CT-e - ${tipo}`,
        Author: "LAN7 - Pegasus",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageH = doc.page.height;
    const ML = doc.page.margins.left;

    // ─── Cores ───
    const PRIMARY = "#0D47A1";
    const HEADER_BG = "#0D47A1";
    const HEADER_TEXT = "#FFFFFF";
    const ROW_EVEN = "#F5F8FF";
    const ROW_ODD = "#FFFFFF";
    const BORDER = "#E0E0E0";
    const CARD_BG = "#E3F2FD";
    const CARD_BORDER = "#90CAF9";

    // ─── Resumo ───
    const totalValor = notas.reduce((s, n) => s + (parseFloat(n.valorTotal || "0") || 0), 0);
    const totalICMS = notas.reduce((s, n) => s + (parseFloat(n.valorICMS || "0") || 0), 0);
    const totalReceber = notas.reduce((s, n) => s + (parseFloat(n.valorReceber || "0") || 0), 0);
    const totalPeso = notas.reduce((s, n) => s + (parseFloat(n.pesoBruto || "0") || 0), 0);

    const countAutorizadas = notas.filter(n => n.status === "autorizado").length;
    const countCanceladas = notas.filter(n => n.status === "cancelado").length;
    const countDenegadas = notas.filter(n => n.status === "denegado").length;

    const modalCounts: Record<string, number> = {};
    notas.forEach(n => {
      const m = fmtModal(n.modal);
      modalCounts[m] = (modalCounts[m] || 0) + 1;
    });

    // Build filter line
    const filterParts: string[] = [];
    if (filtros?.clienteNome) filterParts.push(`Cliente: ${filtros.clienteNome}`);
    if (filtros?.emitenteNome) filterParts.push(`Emitente: ${filtros.emitenteNome}`);
    if (filtros?.direcao) filterParts.push(`Direção: ${fmtDirecao(filtros.direcao)}`);
    if (filtros?.status) filterParts.push(`Status: ${fmtStatus(filtros.status)}`);
    if (filtros?.modal) filterParts.push(`Modal: ${fmtModal(filtros.modal)}`);
    if (filtros?.dataInicio) filterParts.push(`De: ${filtros.dataInicio}`);
    if (filtros?.dataFim) filterParts.push(`Até: ${filtros.dataFim}`);
    const filterLine = filterParts.length > 0 ? `Filtros: ${filterParts.join(" | ")}` : "";

    // ─── Cabeçalho ───
    const drawHeader = () => {
      doc.fontSize(14).fillColor(PRIMARY).font("Helvetica-Bold")
        .text(`LAN7 - Pegasus | Relatório CT-e`, ML, 18, { lineBreak: false });
      doc.fontSize(8).fillColor("#666666").font("Helvetica")
        .text(`Gerado em: ${new Date().toLocaleString("pt-BR")} | Total: ${notas.length} CT-e(s)`,
          ML, 34, { lineBreak: false });
      if (filterLine) {
        doc.fontSize(7).fillColor("#888888").font("Helvetica")
          .text(filterLine, ML, 44, { lineBreak: false });
      }
      const lineY = filterLine ? 54 : 46;
      doc.moveTo(ML, lineY).lineTo(ML + pageWidth, lineY)
        .strokeColor(PRIMARY).lineWidth(1).stroke();
      return lineY + 4;
    };

    let y = drawHeader();

    // ─── Resumo Cards (apenas na primeira página) ───
    const cardWidth = pageWidth / 5 - 6;
    const cards = [
      { label: "Total CT-e", value: String(notas.length) },
      { label: "Valor Frete", value: fmtCurrency(String(totalValor)) },
      { label: "ICMS Total", value: fmtCurrency(String(totalICMS)) },
      { label: "Valor a Receber", value: fmtCurrency(String(totalReceber)) },
      { label: "Peso Total", value: `${fmtDecimal(String(totalPeso), 2)} kg` },
    ];

    cards.forEach((card, i) => {
      const x = ML + i * (cardWidth + 7.5);
      doc.roundedRect(x, y, cardWidth, 36, 3).fillAndStroke(CARD_BG, CARD_BORDER);
      doc.fontSize(6.5).fillColor("#666666").font("Helvetica").text(card.label, x + 6, y + 5, { width: cardWidth - 12, lineBreak: false });
      doc.fontSize(10).fillColor(PRIMARY).font("Helvetica-Bold").text(card.value, x + 6, y + 16, { width: cardWidth - 12, lineBreak: false });
    });

    y += 44;

    // Status + Modal summary line
    doc.fontSize(7).fillColor("#333333").font("Helvetica")
      .text(`Autorizadas: ${countAutorizadas} | Canceladas: ${countCanceladas} | Denegadas: ${countDenegadas} | Modais: ${Object.entries(modalCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}`,
        ML, y, { lineBreak: false });
    y += 12;

    // ─── Tabela Principal ───
    const cols = [
      { header: "Nº CT-e", width: 42 },
      { header: "Data", width: 48 },
      { header: "Status", width: 44 },
      { header: "Dir.", width: 34 },
      { header: "Modal", width: 48 },
      { header: "CFOP", width: 32 },
      { header: "Emitente", width: 100 },
      { header: "Remetente", width: 80 },
      { header: "Destinatário", width: 80 },
      { header: "Tomador", width: 80 },
      { header: "Rota", width: 42 },
      { header: "Produto", width: 60 },
      { header: "Peso (kg)", width: 48 },
      { header: "Valor Frete", width: 55 },
      { header: "ICMS", width: 50 },
      { header: "Placa", width: 42 },
    ];

    const totalColWidth = cols.reduce((s, c) => s + c.width, 0);
    const scale = pageWidth / totalColWidth;
    cols.forEach(c => { c.width = Math.floor(c.width * scale); });

    const rowHeight = 13;
    const headerHeight = 16;
    const fontSize = 5.8;
    const headerFontSize = 6.2;

    const drawTableHeader = (startY: number) => {
      let x = ML;
      doc.rect(x, startY, pageWidth, headerHeight).fill(HEADER_BG);
      cols.forEach(col => {
        doc.fontSize(headerFontSize).fillColor(HEADER_TEXT).font("Helvetica-Bold")
          .text(col.header, x + 2, startY + 3, { width: col.width - 4, align: "left", lineBreak: false });
        x += col.width;
      });
      return startY + headerHeight;
    };

    y = drawTableHeader(y);

    const maxY = pageH - doc.page.margins.bottom - 25;

    for (let i = 0; i < notas.length; i++) {
      if (y + rowHeight > maxY) {
        doc.addPage();
        const headerEnd = drawHeader();
        y = drawTableHeader(headerEnd);
      }

      const nota = notas[i];
      const bgColor = i % 2 === 0 ? ROW_EVEN : ROW_ODD;
      let x = ML;

      doc.rect(x, y, pageWidth, rowHeight).fill(bgColor);

      const values = [
        nota.numeroCte || "-",
        fmtDate(nota.dataEmissao),
        fmtStatus(nota.status),
        fmtDirecao(nota.direcao),
        fmtModal(nota.modal),
        nota.cfop || "-",
        truncate(nota.emitenteNome, 18),
        truncate(nota.remetenteNome, 14),
        truncate(nota.destinatarioNome, 14),
        truncate(nota.tomadorNome, 14),
        `${nota.ufInicio || "-"}-${nota.ufFim || "-"}`,
        truncate(nota.produtoPredominante, 10),
        nota.pesoBruto ? fmtDecimal(nota.pesoBruto, 2) : "-",
        fmtCurrency(nota.valorTotal),
        fmtCurrency(nota.valorICMS),
        nota.placa || "-",
      ];

      values.forEach((val, j) => {
        const align = (j >= 12 && j <= 14) ? "right" : "left";
        doc.fontSize(fontSize).fillColor("#333333").font("Helvetica")
          .text(val, x + 2, y + 3, { width: cols[j].width - 4, align, lineBreak: false });
        x += cols[j].width;
      });

      doc.moveTo(ML, y + rowHeight)
        .lineTo(ML + pageWidth, y + rowHeight)
        .strokeColor(BORDER).lineWidth(0.2).stroke();

      y += rowHeight;
    }

    // ─── Rodapé em todas as páginas ───
    const range = doc.bufferedPageRange();
    const footerY = pageH - 22;
    for (let p = range.start; p < range.start + range.count; p++) {
      doc.switchToPage(p);
      doc.fontSize(7).fillColor("#999999").font("Helvetica")
        .text(`Página ${p - range.start + 1} de ${range.count} | LAN7 - Pegasus`,
          ML, footerY,
          { width: pageWidth, align: "center", lineBreak: false });
    }

    doc.end();
  });
}
