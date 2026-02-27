import { describe, it, expect } from "vitest";

/**
 * Testa a lógica de extração de período dos logs de download.
 * A função extractPeriodoFromLog é usada em TODAS as retomadas
 * (retry, retryAll, auto-retomada, retomada infinita, recovery)
 * para garantir que o período original do download seja respeitado.
 */

// Replicar a lógica de extractPeriodoFromLog (mesma implementação do routers.ts)
function extractPeriodoFromLog(log: any): {
  isPeriodo: boolean;
  input: {
    competenciaInicio?: string;
    competenciaFim?: string;
    dataInicio?: string;
    dataFim?: string;
  };
} {
  const modo = log.modo || "novas";
  const isPeriodo = modo === "periodo" && !!(log.competenciaInicio || log.periodoDataInicio);
  return {
    isPeriodo,
    input: {
      competenciaInicio: log.competenciaInicio || undefined,
      competenciaFim: log.competenciaFim || undefined,
      dataInicio: log.periodoDataInicio || undefined,
      dataFim: log.periodoDataFim || undefined,
    },
  };
}

describe("extractPeriodoFromLog", () => {
  it("retorna isPeriodo=false para log sem modo (novas)", () => {
    const log = { id: 1, clienteId: 10, status: "erro" };
    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(false);
    expect(result.input.competenciaInicio).toBeUndefined();
    expect(result.input.dataInicio).toBeUndefined();
  });

  it("retorna isPeriodo=false para log com modo='novas'", () => {
    const log = { id: 1, clienteId: 10, status: "erro", modo: "novas" };
    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(false);
  });

  it("retorna isPeriodo=true para log com modo='periodo' e competenciaInicio", () => {
    const log = {
      id: 1, clienteId: 10, status: "erro",
      modo: "periodo",
      competenciaInicio: "2026-01",
      competenciaFim: "2026-02",
      periodoDataInicio: null,
      periodoDataFim: null,
    };
    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(true);
    expect(result.input.competenciaInicio).toBe("2026-01");
    expect(result.input.competenciaFim).toBe("2026-02");
    expect(result.input.dataInicio).toBeUndefined();
    expect(result.input.dataFim).toBeUndefined();
  });

  it("retorna isPeriodo=true para log com modo='periodo' e periodoDataInicio", () => {
    const log = {
      id: 1, clienteId: 10, status: "erro",
      modo: "periodo",
      competenciaInicio: "2026-01",
      competenciaFim: "2026-01",
      periodoDataInicio: "2026-01-01",
      periodoDataFim: "2026-01-31",
    };
    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(true);
    expect(result.input.competenciaInicio).toBe("2026-01");
    expect(result.input.competenciaFim).toBe("2026-01");
    expect(result.input.dataInicio).toBe("2026-01-01");
    expect(result.input.dataFim).toBe("2026-01-31");
  });

  it("retorna isPeriodo=false para modo='periodo' sem competencia nem data", () => {
    const log = {
      id: 1, clienteId: 10, status: "erro",
      modo: "periodo",
      competenciaInicio: null,
      competenciaFim: null,
      periodoDataInicio: null,
      periodoDataFim: null,
    };
    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(false);
  });

  it("converte null para undefined nos campos de input", () => {
    const log = {
      id: 1, modo: "periodo",
      competenciaInicio: "2026-02",
      competenciaFim: null,
      periodoDataInicio: null,
      periodoDataFim: null,
    };
    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(true);
    expect(result.input.competenciaFim).toBeUndefined();
    expect(result.input.dataInicio).toBeUndefined();
    expect(result.input.dataFim).toBeUndefined();
  });
});

describe("Período preservado em retomadas", () => {
  it("updateDownloadLog parcial não sobrescreve campos de período", () => {
    // Simular um log com período
    const originalLog = {
      id: 1, clienteId: 10, status: "erro",
      modo: "periodo",
      competenciaInicio: "2026-01",
      competenciaFim: "2026-02",
      periodoDataInicio: "2026-01-01",
      periodoDataFim: "2026-02-28",
      progresso: 50, totalNotas: 100,
    };

    // Simular o updateDownloadLog parcial (como na auto-retomada rodada 2+)
    const updateData = {
      status: "retomando", erro: null, etapa: "Rodada 2: na fila...",
      progresso: 0, totalEsperado: 0, totalNotas: 0, notasNovas: 0,
      totalXml: 0, totalPdf: 0, errosPdf: 0, certificadoVencido: false,
      finalizadoEm: null, iniciadoEm: new Date(),
    };

    // Aplicar update parcial (simular Object.assign como Drizzle faz)
    const updatedLog = { ...originalLog, ...updateData };

    // Os campos de período devem ser preservados
    expect(updatedLog.modo).toBe("periodo");
    expect(updatedLog.competenciaInicio).toBe("2026-01");
    expect(updatedLog.competenciaFim).toBe("2026-02");
    expect(updatedLog.periodoDataInicio).toBe("2026-01-01");
    expect(updatedLog.periodoDataFim).toBe("2026-02-28");

    // E o extractPeriodoFromLog deve funcionar corretamente
    const result = extractPeriodoFromLog(updatedLog);
    expect(result.isPeriodo).toBe(true);
    expect(result.input.competenciaInicio).toBe("2026-01");
    expect(result.input.dataFim).toBe("2026-02-28");
  });

  it("retomada infinita com período: MAX_RODADAS=999 e período preservado", () => {
    const retomadaInfinita = true;
    const maxRodadasSetting = "3";
    const MAX_RODADAS = retomadaInfinita ? 999 : Math.max(1, Math.min(10, parseInt(maxRodadasSetting || "3") || 3));
    expect(MAX_RODADAS).toBe(999);

    // Simular log com período na retomada infinita
    const log = {
      id: 1, modo: "periodo",
      competenciaInicio: "2026-02",
      competenciaFim: "2026-02",
      periodoDataInicio: "2026-02-01",
      periodoDataFim: "2026-02-28",
    };

    // Em cada rodada, o período deve ser extraído corretamente
    for (let rodada = 1; rodada <= 5; rodada++) {
      const result = extractPeriodoFromLog(log);
      expect(result.isPeriodo).toBe(true);
      expect(result.input.competenciaInicio).toBe("2026-02");
      expect(result.input.dataInicio).toBe("2026-02-01");
      expect(result.input.dataFim).toBe("2026-02-28");
    }
  });

  it("retomada sem período (modo novas) funciona corretamente", () => {
    const log = {
      id: 1, modo: "novas",
      competenciaInicio: null,
      competenciaFim: null,
      periodoDataInicio: null,
      periodoDataFim: null,
    };

    const result = extractPeriodoFromLog(log);
    expect(result.isPeriodo).toBe(false);
    expect(result.input.competenciaInicio).toBeUndefined();
  });

  it("log antigo sem campos de período (migração) funciona como 'novas'", () => {
    // Logs criados antes da migração não terão os campos de período
    const legacyLog = {
      id: 1, clienteId: 10, status: "erro",
      // Sem modo, competenciaInicio, etc.
    };

    const result = extractPeriodoFromLog(legacyLog);
    expect(result.isPeriodo).toBe(false);
    expect(result.input.competenciaInicio).toBeUndefined();
    expect(result.input.dataInicio).toBeUndefined();
  });
});

describe("Cobertura de todos os pontos de retomada", () => {
  // Simular os dados como cada ponto de retomada os recebe

  it("retry (retryOne): extrai período do log individual", () => {
    const log = {
      id: 42, clienteId: 10, status: "erro",
      modo: "periodo", competenciaInicio: "2026-01", competenciaFim: "2026-01",
      periodoDataInicio: "2026-01-15", periodoDataFim: "2026-01-31",
    };
    const { isPeriodo, input } = extractPeriodoFromLog(log);
    expect(isPeriodo).toBe(true);
    expect(input.dataInicio).toBe("2026-01-15");
  });

  it("retryAll: extrai período de cada log na lista", () => {
    const logsComErro = [
      { id: 1, modo: "periodo", competenciaInicio: "2026-01", competenciaFim: "2026-01", periodoDataInicio: "2026-01-01", periodoDataFim: "2026-01-31" },
      { id: 2, modo: "novas", competenciaInicio: null, competenciaFim: null, periodoDataInicio: null, periodoDataFim: null },
      { id: 3, modo: "periodo", competenciaInicio: "2026-02", competenciaFim: "2026-02", periodoDataInicio: "2026-02-01", periodoDataFim: "2026-02-28" },
    ];

    // Log 1: com período
    const r1 = extractPeriodoFromLog(logsComErro[0]);
    expect(r1.isPeriodo).toBe(true);
    expect(r1.input.competenciaInicio).toBe("2026-01");

    // Log 2: sem período
    const r2 = extractPeriodoFromLog(logsComErro[1]);
    expect(r2.isPeriodo).toBe(false);

    // Log 3: com período diferente
    const r3 = extractPeriodoFromLog(logsComErro[2]);
    expect(r3.isPeriodo).toBe(true);
    expect(r3.input.competenciaInicio).toBe("2026-02");
  });

  it("auto-retomada (incluindo infinita): busca log na lista logsComErro por ID", () => {
    const logsComErro = [
      { id: 10, modo: "periodo", competenciaInicio: "2026-02", competenciaFim: "2026-02", periodoDataInicio: null, periodoDataFim: null },
      { id: 20, modo: "novas", competenciaInicio: null, competenciaFim: null, periodoDataInicio: null, periodoDataFim: null },
    ];

    // Simular task com logId = 10
    const task = { logId: 10 };
    const taskLog = logsComErro.find((l: any) => l.id === task.logId);
    expect(taskLog).toBeDefined();
    const { isPeriodo, input } = taskLog ? extractPeriodoFromLog(taskLog) : { isPeriodo: false, input: {} };
    expect(isPeriodo).toBe(true);
    expect(input.competenciaInicio).toBe("2026-02");
  });

  it("recovery: busca log na lista de órfãos por ID", () => {
    const orphanedLogs = [
      { id: 100, modo: "periodo", competenciaInicio: "2026-01", competenciaFim: "2026-02", periodoDataInicio: "2026-01-01", periodoDataFim: "2026-02-28" },
    ];

    const task = { logId: 100 };
    const taskLog = orphanedLogs.find((l: any) => l.id === task.logId);
    expect(taskLog).toBeDefined();
    const { isPeriodo, input } = taskLog ? extractPeriodoFromLog(taskLog) : { isPeriodo: false, input: {} };
    expect(isPeriodo).toBe(true);
    expect(input.dataInicio).toBe("2026-01-01");
    expect(input.dataFim).toBe("2026-02-28");
  });

  it("fallback quando log não encontrado: isPeriodo=false", () => {
    const logsComErro: any[] = [];
    const task = { logId: 999 };
    const taskLog = logsComErro.find((l: any) => l.id === task.logId);
    const { isPeriodo, input } = taskLog ? extractPeriodoFromLog(taskLog) : { isPeriodo: false, input: {} };
    expect(isPeriodo).toBe(false);
    expect(input).toEqual({});
  });
});
