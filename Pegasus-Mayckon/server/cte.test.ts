import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock dependencies before importing
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "https://example.com/test.xml" }),
}));

vi.mock("./cte-api", () => ({
  downloadAllCteDocuments: vi.fn().mockResolvedValue({
    documentos: [],
    ultimoNsu: 0,
    maxNsu: 0,
  }),
  decodeCteXml: vi.fn().mockReturnValue("<CTe></CTe>"),
  parseCteXml: vi.fn().mockReturnValue({}),
}));

vi.mock("./nfse-api", () => ({
  extractPfxCertAndKey: vi.fn().mockResolvedValue({
    cert: "mock-cert",
    key: "mock-key",
  }),
}));

vi.mock("./crypto", () => ({
  encrypt: vi.fn().mockReturnValue("encrypted"),
  decrypt: vi.fn().mockReturnValue("decrypted"),
}));

import * as db from "./db";

describe("CT-e Backend", () => {
  describe("CT-e Database Helpers", () => {
    it("getCteStats returns stats object", async () => {
      const stats = await db.getCteStats(999999);
      expect(stats).toBeDefined();
      expect(typeof stats.totalCtes).toBe("number");
    });

    it("getCteNotasByContabilidade returns notas and total", async () => {
      const result = await db.getCteNotasByContabilidade(999999, {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty("notas");
      expect(result).toHaveProperty("total");
      expect(Array.isArray(result.notas)).toBe(true);
    });

    it("getCteNotasByContabilidade with filters returns empty for nonexistent", async () => {
      const result = await db.getCteNotasByContabilidade(999999, {
        status: "autorizado",
        direcao: "emitido",
        modal: "rodoviario",
        busca: "empresa-inexistente-xyz",
      });
      expect(result.notas).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("getCteUltimoNsu returns result for client", async () => {
      const result = await db.getCteUltimoNsu(999998, 999998);
      expect(result).toBeDefined();
      expect(typeof result.ultimoNsu).toBe("number");
    });

    it("countCteNotasByContabilidade returns number", async () => {
      const count = await db.countCteNotasByContabilidade(999999);
      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it("getCteDownloadLogsByContabilidade returns array", async () => {
      const logs = await db.getCteDownloadLogsByContabilidade(999999, 100);
      expect(Array.isArray(logs)).toBe(true);
    });

    it("createCteDownloadLog creates a log entry", async () => {
      const logId = await db.createCteDownloadLog({
        clienteId: 999999,
        contabilidadeId: 999999,
        clienteNome: "Test Company CTE",
        clienteCnpj: "12345678000199",
        tipo: "manual",
        status: "pendente",
      });
      expect(typeof logId).toBe("number");
      expect(logId).toBeGreaterThan(0);

      // Cleanup
      await db.clearCteDownloadHistory(999999);
    });

    it("updateCteDownloadLog updates log fields", async () => {
      const logId = await db.createCteDownloadLog({
        clienteId: 999999,
        contabilidadeId: 999999,
        clienteNome: "Test Update CTE",
        clienteCnpj: "12345678000199",
        tipo: "manual",
        status: "executando",
      });

      await db.updateCteDownloadLog(logId, {
        status: "concluido",
        totalCtes: 10,
        ctesNovos: 5,
        etapa: "Concluído",
        finalizadoEm: new Date(),
      });

      const logs = await db.getCteDownloadLogsByContabilidade(999999, 100);
      const updatedLog = logs.find((l: any) => l.id === logId);
      expect(updatedLog).toBeDefined();
      expect(updatedLog?.status).toBe("concluido");

      // Cleanup
      await db.clearCteDownloadHistory(999999);
    });

    it("clearCteDownloadHistory removes completed logs", async () => {
      // Create a log
      await db.createCteDownloadLog({
        clienteId: 999999,
        contabilidadeId: 999999,
        clienteNome: "Test Clear CTE",
        clienteCnpj: "12345678000199",
        tipo: "manual",
        status: "concluido",
        finalizadoEm: new Date(),
      });

      // Clear
      await db.clearCteDownloadHistory(999999);

      // Verify
      const logs = await db.getCteDownloadLogsByContabilidade(999999, 100);
      const completedLogs = logs.filter((l: any) => l.status === "concluido" && l.contabilidadeId === 999999);
      expect(completedLogs).toHaveLength(0);
    });

    it("upsertCteNota inserts a new CT-e nota", async () => {
      await db.upsertCteNota({
        clienteId: 999999,
        contabilidadeId: 999999,
        chaveAcesso: "CTE_TEST_KEY_" + Date.now(),
        nsu: 1,
        numeroCte: "12345",
        serie: "1",
        modelo: "57",
        tipoDocumento: "CTE",
        direcao: "emitido",
        status: "autorizado",
        emitenteCnpj: "12345678000199",
        emitenteNome: "Test Emitente CTE",
        valorTotal: "1000.00",
        modal: "rodoviario",
        ufInicio: "SP",
        ufFim: "RJ",
        dataEmissao: new Date(),
      });

      const result = await db.getCteNotasByContabilidade(999999, {});
      expect(result.total).toBeGreaterThanOrEqual(1);

      // Cleanup - delete test notas
      const testNotas = result.notas.filter((n: any) => n.clienteId === 999999);
      // We don't have a delete function, but that's fine for testing
    });

    it("getCteNotasForRelatorio returns array", async () => {
      const notas = await db.getCteNotasForRelatorio(999999, {});
      expect(Array.isArray(notas)).toBe(true);
    });

    it("upsertCteNsuControl creates/updates NSU control", async () => {
      await db.upsertCteNsuControl({
        clienteId: 999999,
        contabilidadeId: 999999,
        cnpj: "12345678000199",
        ultimoNsu: 100,
        maxNsu: 200,
        ultimaConsulta: new Date(),
      });

      const nsuInfo = await db.getCteUltimoNsu(999999, 999999);
      expect(nsuInfo.ultimoNsu).toBe(100);
    });

    it("getCteChavesExistentes returns Set of existing keys", async () => {
      const chaves = await db.getCteChavesExistentes(999999, ["NON_EXISTENT_KEY"]);
      expect(chaves instanceof Set).toBe(true);
    });

    it("cancelCteDownloadsEmAndamento cancels running downloads", async () => {
      const logId = await db.createCteDownloadLog({
        clienteId: 999999,
        contabilidadeId: 999999,
        clienteNome: "Test Cancel CTE",
        clienteCnpj: "12345678000199",
        tipo: "manual",
        status: "executando",
      });

      await db.cancelCteDownloadsEmAndamento(999999);

      const logs = await db.getCteDownloadLogsByContabilidade(999999, 100);
      const cancelledLog = logs.find((l: any) => l.id === logId);
      expect(cancelledLog?.status).toBe("cancelado");

      // Cleanup
      await db.clearCteDownloadHistory(999999);
    });
  });
});
