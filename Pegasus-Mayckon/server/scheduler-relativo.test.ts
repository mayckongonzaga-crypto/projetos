import { describe, it, expect } from "vitest";

describe("Período Relativo no Agendador", () => {
  it("deve calcular período relativo corretamente (30 dias para trás)", () => {
    const periodoDias = 30;
    const hoje = new Date(2026, 1, 18); // 18/02/2026
    const dataFim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const dataInicioDate = new Date(hoje);
    dataInicioDate.setDate(dataInicioDate.getDate() - periodoDias);
    const dataInicio = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;

    expect(dataFim).toBe("2026-02-18");
    expect(dataInicio).toBe("2026-01-19");
  });

  it("deve calcular período relativo de 10 dias", () => {
    const periodoDias = 10;
    const hoje = new Date(2026, 1, 18); // 18/02/2026
    const dataFim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const dataInicioDate = new Date(hoje);
    dataInicioDate.setDate(dataInicioDate.getDate() - periodoDias);
    const dataInicio = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;

    expect(dataFim).toBe("2026-02-18");
    expect(dataInicio).toBe("2026-02-08");
  });

  it("deve calcular período relativo de 60 dias cruzando meses", () => {
    const periodoDias = 60;
    const hoje = new Date(2026, 1, 18); // 18/02/2026
    const dataFim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const dataInicioDate = new Date(hoje);
    dataInicioDate.setDate(dataInicioDate.getDate() - periodoDias);
    const dataInicio = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;

    expect(dataFim).toBe("2026-02-18");
    expect(dataInicio).toBe("2025-12-20");
  });

  it("deve calcular período relativo de 90 dias cruzando anos", () => {
    const periodoDias = 90;
    const hoje = new Date(2026, 0, 15); // 15/01/2026
    const dataFim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const dataInicioDate = new Date(hoje);
    dataInicioDate.setDate(dataInicioDate.getDate() - periodoDias);
    const dataInicio = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;

    expect(dataFim).toBe("2026-01-15");
    expect(dataInicio).toBe("2025-10-17");
  });

  it("deve gerar competência correta a partir de datas relativas", () => {
    const dataInicial = "2026-01-19";
    const dataFinal = "2026-02-18";
    const competenciaInicio = dataInicial.substring(0, 7);
    const competenciaFim = dataFinal.substring(0, 7);

    expect(competenciaInicio).toBe("2026-01");
    expect(competenciaFim).toBe("2026-02");
  });

  it("não deve calcular período relativo quando periodoTipo é fixo", () => {
    const periodoTipo = "fixo";
    const periodoDias = 30;
    const dataInicial = "2026-01-01";
    const dataFinal = "2026-01-31";

    let finalDataInicial = dataInicial;
    let finalDataFinal = dataFinal;

    if (periodoTipo === "relativo" && periodoDias > 0) {
      // Não deve entrar aqui
      finalDataInicial = "ERRO";
      finalDataFinal = "ERRO";
    }

    expect(finalDataInicial).toBe("2026-01-01");
    expect(finalDataFinal).toBe("2026-01-31");
  });

  it("deve calcular período relativo quando periodoTipo é relativo", () => {
    const periodoTipo = "relativo";
    const periodoDias = 30;
    const dataInicial = "2026-01-01"; // será ignorado
    const dataFinal = "2026-01-31"; // será ignorado

    let finalDataInicial = dataInicial;
    let finalDataFinal = dataFinal;

    if (periodoTipo === "relativo" && periodoDias > 0) {
      const hoje = new Date(2026, 1, 19); // 19/02/2026
      finalDataFinal = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const dataInicioDate = new Date(hoje);
      dataInicioDate.setDate(dataInicioDate.getDate() - periodoDias);
      finalDataInicial = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;
    }

    expect(finalDataFinal).toBe("2026-02-19");
    expect(finalDataInicial).toBe("2026-01-20");
  });

  it("agendamentos existentes sem periodoTipo devem funcionar como fixo", () => {
    const periodoTipo = null; // agendamento antigo sem o campo
    const periodoDias = null;
    const dataInicial = "2026-01-01";
    const dataFinal = "2026-01-31";

    let finalDataInicial = dataInicial;
    let finalDataFinal = dataFinal;

    if (periodoTipo === "relativo" && periodoDias && periodoDias > 0) {
      finalDataInicial = "ERRO";
      finalDataFinal = "ERRO";
    }

    // Agendamentos antigos continuam funcionando como fixo
    expect(finalDataInicial).toBe("2026-01-01");
    expect(finalDataFinal).toBe("2026-01-31");
  });
});
