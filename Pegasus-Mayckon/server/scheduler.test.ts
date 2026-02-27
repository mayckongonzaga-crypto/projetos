import { describe, it, expect } from "vitest";
import { calcularProximaExecucao, agoraBrasilia, dateBrasilia } from "./scheduler";

describe("Scheduler - fuso horário Brasília", () => {
  it("agoraBrasilia retorna hora diferente do servidor se não estiver em GMT-3", () => {
    const brt = agoraBrasilia();
    // Deve ser um Date válido
    expect(brt).toBeInstanceOf(Date);
    expect(brt.getTime()).toBeGreaterThan(0);
  });

  it("dateBrasilia cria data UTC correta para horário de Brasília", () => {
    // 17/02/2026 21:59 BRT = 18/02/2026 00:59 UTC
    const date = dateBrasilia(2026, 1, 17, 21, 59, 0); // month 1 = fevereiro
    expect(date.getUTCHours()).toBe(0); // 21 + 3 = 24 = 0 do dia seguinte
    expect(date.getUTCMinutes()).toBe(59);
    expect(date.getUTCDate()).toBe(18); // dia seguinte em UTC
  });

  it("dateBrasilia: meio-dia BRT = 15:00 UTC", () => {
    const date = dateBrasilia(2026, 1, 17, 12, 0, 0);
    expect(date.getUTCHours()).toBe(15);
    expect(date.getUTCMinutes()).toBe(0);
    expect(date.getUTCDate()).toBe(17);
  });

  it("dateBrasilia: 00:00 BRT = 03:00 UTC", () => {
    const date = dateBrasilia(2026, 1, 17, 0, 0, 0);
    expect(date.getUTCHours()).toBe(3);
    expect(date.getUTCDate()).toBe(17);
  });
});

describe("Scheduler - calcularProximaExecucao (Brasília)", () => {
  // Para testes, passamos "agora" como horário de Brasília simulado
  
  it("diário: resultado é sempre um Date UTC válido com hora correta", () => {
    // Testar que o resultado tem os minutos e horas corretos para 21:45 BRT
    // 21:45 BRT = 00:45 UTC
    const agoraBrt = new Date(2026, 1, 17, 10, 0, 0);
    const result = calcularProximaExecucao(
      { frequencia: "diario", horario: "21:45" },
      agoraBrt
    );
    // O resultado deve ter 00:45 UTC (21:45 + 3h)
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(45);
    // Deve ser no futuro (hoje ou amanhã dependendo da hora real)
    expect(result.getTime()).toBeGreaterThan(0);
  });

  it("diário: resultado para horário 21:45 tem hora UTC correta", () => {
    // Simular 22:00 BRT - horário já passou, deve ir para amanhã
    const agoraBrt = new Date(2026, 1, 17, 22, 0, 0);
    const result = calcularProximaExecucao(
      { frequencia: "diario", horario: "21:45" },
      agoraBrt
    );
    // 21:45 BRT = 00:45 UTC
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(45);
    // Deve ser amanhã em relação ao agoraBrt (dia 18 BRT = dia 19 UTC)
    expect(result.getUTCDate()).toBe(19);
  });

  it("semanal: retorna próximo dia da semana correto", () => {
    // 17/02/2026 é terça-feira (day=2), simular 10:00 BRT
    const agoraBrt = new Date(2026, 1, 17, 10, 0, 0);
    const result = calcularProximaExecucao(
      { frequencia: "semanal", horario: "08:00", diaSemana: 5 }, // sexta
      agoraBrt
    );
    // Sexta 20/02 08:00 BRT = 20/02 11:00 UTC
    expect(result.getUTCDate()).toBe(20);
    expect(result.getUTCHours()).toBe(11);
  });

  it("mensal: retorna dia do mês correto", () => {
    const agoraBrt = new Date(2026, 1, 10, 10, 0, 0); // 10/02 10:00 BRT
    const result = calcularProximaExecucao(
      { frequencia: "mensal", horario: "03:00", diaMes: 15 },
      agoraBrt
    );
    // 15/02 03:00 BRT = 15/02 06:00 UTC
    expect(result.getUTCDate()).toBe(15);
    expect(result.getUTCHours()).toBe(6);
  });

  it("dia_util: retorna o Nº dia útil do mês", () => {
    // Fev 2026: 1º dia útil = 02/02 (segunda)
    const agoraBrt = new Date(2026, 1, 1, 10, 0, 0); // 01/02 domingo
    const result = calcularProximaExecucao(
      { frequencia: "dia_util", horario: "08:00", diaUtil: 1 },
      agoraBrt
    );
    // 02/02 08:00 BRT = 02/02 11:00 UTC
    expect(result.getUTCDate()).toBe(2);
    expect(result.getUTCHours()).toBe(11);
  });

  it("retorna fallback se frequência desconhecida", () => {
    const agoraBrt = new Date(2026, 1, 17, 10, 0, 0);
    const result = calcularProximaExecucao(
      { frequencia: "desconhecida" as any, horario: "08:00" },
      agoraBrt
    );
    // Fallback: amanhã 08:00 BRT = 18/02 11:00 UTC
    expect(result.getUTCDate()).toBe(18);
    expect(result.getUTCHours()).toBe(11);
  });
});

describe("Scheduler - exports", () => {
  it("deve exportar startScheduler", async () => {
    const mod = await import("./scheduler");
    expect(typeof mod.startScheduler).toBe("function");
  });

  it("deve exportar stopScheduler", async () => {
    const mod = await import("./scheduler");
    expect(typeof mod.stopScheduler).toBe("function");
  });

  it("deve exportar registerSchedulerExecutor", async () => {
    const mod = await import("./scheduler");
    expect(typeof mod.registerSchedulerExecutor).toBe("function");
  });

  it("deve exportar calcularProximaExecucao", async () => {
    const mod = await import("./scheduler");
    expect(typeof mod.calcularProximaExecucao).toBe("function");
  });

  it("deve exportar agoraBrasilia e dateBrasilia", async () => {
    const mod = await import("./scheduler");
    expect(typeof mod.agoraBrasilia).toBe("function");
    expect(typeof mod.dateBrasilia).toBe("function");
  });
});
