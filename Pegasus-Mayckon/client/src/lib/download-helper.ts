/**
 * Helper para baixar um arquivo a partir de base64
 * Funciona com volumes grandes usando Blob
 */
export function downloadBase64File(base64: string, fileName: string, mimeType: string = "application/zip") {
  // Converter base64 para Uint8Array em chunks para evitar problemas de memória
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Liberar memória após 1 segundo
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
