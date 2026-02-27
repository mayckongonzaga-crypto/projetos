/**
 * Módulo de marca d'água para relatórios PDF (pdfkit)
 * Adiciona a logo Pegasus NFe como marca d'água centralizada em cada página.
 * A imagem é carregada localmente de ./pegasus_storage/watermark.png
 * Se o arquivo não existir, a marca d'água é simplesmente ignorada.
 */

import * as fs from 'fs';
import * as path from 'path';

// Caminho local da imagem de marca d'água (coloque watermark.png na pasta pegasus_storage)
const WATERMARK_LOCAL_PATH = path.resolve(process.cwd(), 'pegasus_storage', 'watermark.png');

let cachedWatermark: Buffer | null = null;

/**
 * Carrega e cacheia a imagem da marca d'água do disco local.
 * Retorna null se o arquivo não existir (marca d'água desabilitada).
 */
async function getWatermarkBuffer(): Promise<Buffer | null> {
  if (cachedWatermark) return cachedWatermark;
  try {
    if (!fs.existsSync(WATERMARK_LOCAL_PATH)) {
      // Arquivo não encontrado - marca d'água desabilitada (comportamento normal)
      return null;
    }
    cachedWatermark = fs.readFileSync(WATERMARK_LOCAL_PATH);
    console.log("[Watermark] Imagem carregada de", WATERMARK_LOCAL_PATH);
    return cachedWatermark;
  } catch (e) {
    console.error("Erro ao carregar marca d'água local:", e);
    return null;
  }
}

/**
 * Adiciona marca d'água em todas as páginas de um documento pdfkit
 * Deve ser chamada DEPOIS de todo o conteúdo ter sido adicionado (antes de doc.end())
 * Requer bufferPages: true no PDFDocument
 * 
 * @param doc - Instância do PDFDocument com bufferPages: true
 */
export async function addWatermarkToAllPages(doc: any): Promise<void> {
  const watermark = await getWatermarkBuffer();
  if (!watermark) return;

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const imgAspect = 1920 / 1080;
    const targetWidth = pageWidth * 0.55;
    const targetHeight = targetWidth / imgAspect;
    const x = (pageWidth - targetWidth) / 2;
    const y = (pageHeight - targetHeight) / 2;

    doc.save();
    doc.opacity(0.05);
    doc.image(watermark, x, y, {
      width: targetWidth,
      height: targetHeight,
    });
    doc.opacity(1);
    doc.restore();
  }
}

export { getWatermarkBuffer };
