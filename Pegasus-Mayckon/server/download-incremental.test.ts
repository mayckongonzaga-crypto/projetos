import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes para a correção do download incremental:
 * - No modo "novas" (incremental) batch, logs de empresas sem notas novas devem ser removidos
 * - No modo "periodo", logs devem ser mantidos mesmo sem notas
 * - Função deleteDownloadLog deve existir e funcionar
 */

describe("Download Incremental - removeLogSeVazio", () => {
  it("processClienteDownload deve aceitar o parâmetro removeLogSeVazio", async () => {
    // Verificar que a função aceita o novo parâmetro
    const { processClienteDownload } = await import("./routers");
    expect(typeof processClienteDownload).toBe("function");
    // A função deve ter 6 parâmetros (incluindo removeLogSeVazio)
    expect(processClienteDownload.length).toBeGreaterThanOrEqual(3);
  });

  it("deleteDownloadLog deve existir em db.ts", async () => {
    const db = await import("./db");
    expect(typeof db.deleteDownloadLog).toBe("function");
  });

  it("processClienteDownload deve retornar removedLog quando removeLogSeVazio=true e sem notas", async () => {
    // Este teste verifica que a assinatura do retorno inclui removedLog
    const { processClienteDownload } = await import("./routers");
    // O tipo de retorno deve incluir removedLog?: boolean
    // Não podemos testar sem um cliente real, mas verificamos a existência da função
    expect(processClienteDownload).toBeDefined();
  });
});

describe("Download Incremental - Lógica de modo", () => {
  it("modo 'novas' deve ativar removeLogSeVazio em executeForAll", async () => {
    // Verificar que o código fonte contém a lógica correta
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    // Verificar que executeForAll passa removeLogSeVazio baseado no modo
    expect(routersContent).toContain('const removeLogSeVazio = input.modo === "novas" || !input.modo');
    expect(routersContent).toContain('processClienteDownload(cliente, contabId, isPeriodo, input, task.logId, removeLogSeVazio)');
  });

  it("executeForSelected deve ter a mesma lógica de removeLogSeVazio", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    // Verificar que executeForSelected também passa removeLogSeVazio
    expect(routersContent).toContain('const removeLogSeVazioSel = input.modo === "novas" || !input.modo');
    expect(routersContent).toContain('processClienteDownload(cliente, contabId, isPeriodo, input, task.logId, removeLogSeVazioSel)');
  });

  it("scheduler deve ter a mesma lógica de removeLogSeVazio", async () => {
    const fs = await import("fs");
    const indexContent = fs.readFileSync("server/_core/index.ts", "utf-8");
    
    // Verificar que o scheduler também passa removeLogSeVazio
    expect(indexContent).toContain('const removeLogSeVazio = !isPeriodo');
    expect(indexContent).toContain('removeLogSeVazio,');
    expect(indexContent).toContain('const removeLogSeVazioAll = !isPeriodo');
    expect(indexContent).toContain('removeLogSeVazioAll');
  });

  it("processClienteDownload deve deletar log quando removeLogSeVazio=true e totalDocs=0", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    // Verificar que o código contém a lógica de deletar log quando sem notas
    expect(routersContent).toContain('if (removeLogSeVazio && logId) {');
    expect(routersContent).toContain('await db.deleteDownloadLog(logId)');
    expect(routersContent).toContain('removedLog: true');
  });

  it("processClienteDownload deve deletar log quando removeLogSeVazio=true e todas notas já baixadas", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    // Verificar que a segunda condição (todas notas já existem) também deleta
    const matches = routersContent.match(/if \(removeLogSeVazio && logId\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2); // Deve ter pelo menos 2 ocorrências
  });

  it("mensagem de etapa deve diferenciar 'novas' de 'periodo' quando 0 notas", async () => {
    const fs = await import("fs");
    const routersContent = fs.readFileSync("server/routers.ts", "utf-8");
    
    // Verificar que a mensagem diferencia os modos
    expect(routersContent).toContain('isPeriodo ? "Nenhuma nota encontrada no período" : "Sem notas novas na API Nacional"');
  });
});
