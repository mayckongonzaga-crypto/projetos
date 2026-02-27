import { describe, it, expect } from "vitest";

describe("excel-charts", () => {
  it("should generate bar chart for notas por mes", async () => {
    const { chartNotasPorMes } = await import("./excel-charts");
    const data = [
      { mes: "2026-01", total: 10, emitidas: 6, recebidas: 4 },
      { mes: "2026-02", total: 15, emitidas: 9, recebidas: 6 },
    ];
    const buf = await chartNotasPorMes(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
    // PNG magic bytes
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x4e); // N
    expect(buf[3]).toBe(0x47); // G
  });

  it("should generate top empresas horizontal bar chart", async () => {
    const { chartTopEmpresas } = await import("./excel-charts");
    const data = [
      { razaoSocial: "Empresa Alpha Ltda", valorTotal: 50000 },
      { razaoSocial: "Empresa Beta SA", valorTotal: 30000 },
      { razaoSocial: "Empresa Gamma ME", valorTotal: 15000 },
    ];
    const buf = await chartTopEmpresas(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("should generate doughnut chart for tipo distribuicao", async () => {
    const { chartDistribuicaoTipo } = await import("./excel-charts");
    const buf = await chartDistribuicaoTipo(120, 80);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("should generate doughnut chart for status distribuicao", async () => {
    const { chartDistribuicaoStatus } = await import("./excel-charts");
    const buf = await chartDistribuicaoStatus(180, 20);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("should generate line chart for evolucao valores", async () => {
    const { chartEvolucaoValores } = await import("./excel-charts");
    const data = [
      { mes: "2025-10", valor: 10000 },
      { mes: "2025-11", valor: 15000 },
      { mes: "2025-12", valor: 12000 },
      { mes: "2026-01", valor: 18000 },
    ];
    const buf = await chartEvolucaoValores(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("should generate stacked bar chart for emitidas vs recebidas por mes", async () => {
    const { chartEmitidasRecebidasMes } = await import("./excel-charts");
    const data = [
      { mes: "2026-01", emitidas: 6, recebidas: 4 },
      { mes: "2026-02", emitidas: 9, recebidas: 6 },
    ];
    const buf = await chartEmitidasRecebidasMes(data);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(100);
  });

  it("should handle empty data gracefully", async () => {
    const { chartNotasPorMes } = await import("./excel-charts");
    const buf = await chartNotasPorMes([]);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("should respect custom dimensions", async () => {
    const { chartDistribuicaoTipo } = await import("./excel-charts");
    const small = await chartDistribuicaoTipo(10, 5, { width: 200, height: 150 });
    const large = await chartDistribuicaoTipo(10, 5, { width: 800, height: 600 });
    // Larger chart should produce more bytes
    expect(large.length).toBeGreaterThan(small.length);
  });
});

describe("excel-dashboard", () => {
  it("should generate a complete dashboard Excel workbook", async () => {
    const { gerarExcelDashboard } = await import("./excel-dashboard");
    const stats = {
      totalNotas: 200,
      emitidas: 120,
      recebidas: 80,
      canceladas: 10,
      validas: 190,
      valorTotal: 500000,
      valorEmitido: 300000,
      valorRecebido: 200000,
      notasPorMes: [
        { mes: "2026-01", total: 100, emitidas: 60, recebidas: 40, valor: "250000" },
        { mes: "2026-02", total: 100, emitidas: 60, recebidas: 40, valor: "250000" },
      ],
      totalClientes: 50,
      totalCertificados: 45,
      certVencidos: 3,
      topClientes: [
        { clienteId: 1, razaoSocial: "Empresa Teste", cnpj: "12.345.678/0001-90", totalNotas: 50, valorTotal: 100000, valorEmitido: 60000, valorRecebido: 40000 },
      ],
    };
    const allClientes = [
      { clienteId: 1, razaoSocial: "Empresa Teste", cnpj: "12.345.678/0001-90", totalNotas: 50, valorTotal: 100000, valorEmitido: 60000, valorRecebido: 40000 },
      { clienteId: 2, razaoSocial: "Empresa Beta", cnpj: "98.765.432/0001-10", totalNotas: 30, valorTotal: 80000, valorEmitido: 50000, valorRecebido: 30000 },
    ];

    const buffer = await gerarExcelDashboard(stats, allClientes, "Contabilidade Teste", "Todos os períodos");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify it's a valid xlsx (ZIP magic bytes)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("should handle empty data without errors", async () => {
    const { gerarExcelDashboard } = await import("./excel-dashboard");
    const stats = {
      totalNotas: 0,
      emitidas: 0,
      recebidas: 0,
      canceladas: 0,
      validas: 0,
      valorTotal: 0,
      valorEmitido: 0,
      valorRecebido: 0,
      notasPorMes: [],
      totalClientes: 0,
      totalCertificados: 0,
      certVencidos: 0,
      topClientes: [],
    };

    const buffer = await gerarExcelDashboard(stats, [], "Contabilidade Vazia", "Janeiro/2026");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });
});

describe("excel-relatorio", () => {
  it("should generate a complete relatorio Excel workbook", async () => {
    const { gerarExcelRelatorio } = await import("./excel-relatorio");
    const notas = [
      {
        direcao: "emitida",
        numeroNota: "123",
        dataEmissao: new Date("2026-01-15"),
        dataCompetencia: new Date("2026-01-15"),
        emitenteCnpj: "12.345.678/0001-90",
        emitenteNome: "Empresa Teste",
        tomadorCnpj: "98.765.432/0001-10",
        tomadorNome: "Cliente Teste",
        valorServico: "5000.00",
        valorLiquido: "4500.00",
        status: "valida",
        codigoServico: "010701",
        descricaoServico: "Serviço de TI",
        municipioPrestacao: "Itajaí",
        raw: {
          valorServico: 5000,
          valorLiquido: 4500,
          issqnApurado: 100,
          temRetencao: true,
          emitenteCnpj: "12.345.678/0001-90",
          emitenteNome: "Empresa Teste",
          emitenteMunicipio: "Itajaí",
          tomadorCnpj: "98.765.432/0001-10",
          tomadorNome: "Cliente Teste",
          tomadorMunicipio: "São Paulo",
          codigoTribNacional: "010701",
          descricaoServico: "Serviço de TI",
          localPrestacao: "Itajaí",
          bcIssqn: 5000,
          aliquotaAplicada: 2,
          retencaoIssqn: "Retido",
          issqnRetido: 100,
          municipioIncidenciaIssqn: "Itajaí",
          irrf: 75,
          csll: 50,
          pis: 32.5,
          cofins: 150,
          cp: 0,
          irrfCpCsllRetidos: 125,
          descontoIncondicionado: 0,
          descontoCondicionado: 0,
          tributosFederais: 307.5,
          tributosEstaduais: 0,
          tributosMunicipais: 100,
        } as any,
      },
      {
        direcao: "recebida",
        numeroNota: "456",
        dataEmissao: new Date("2026-02-10"),
        dataCompetencia: new Date("2026-02-10"),
        emitenteCnpj: "11.222.333/0001-44",
        emitenteNome: "Fornecedor ABC",
        tomadorCnpj: "12.345.678/0001-90",
        tomadorNome: "Empresa Teste",
        valorServico: "3000.00",
        valorLiquido: "2800.00",
        status: "valida",
        codigoServico: "171901",
        descricaoServico: "Consultoria",
        municipioPrestacao: "São Paulo",
        raw: null,
      },
    ];

    const buffer = await gerarExcelRelatorio(notas as any, "Contabilidade Teste", "Todas");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify it's a valid xlsx (ZIP magic bytes)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("should handle only emitidas", async () => {
    const { gerarExcelRelatorio } = await import("./excel-relatorio");
    const notas = [{
      direcao: "emitida",
      numeroNota: "789",
      dataEmissao: new Date("2026-01-20"),
      dataCompetencia: new Date("2026-01-20"),
      emitenteCnpj: "12.345.678/0001-90",
      emitenteNome: "Empresa Teste",
      tomadorCnpj: "99.888.777/0001-66",
      tomadorNome: "Cliente XYZ",
      valorServico: "2000.00",
      valorLiquido: "1800.00",
      status: "valida",
      codigoServico: null,
      descricaoServico: null,
      municipioPrestacao: null,
      raw: null,
    }];

    const buffer = await gerarExcelRelatorio(notas as any, "Contabilidade Teste", "Emitidas");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("should handle empty notas array", async () => {
    const { gerarExcelRelatorio } = await import("./excel-relatorio");
    const buffer = await gerarExcelRelatorio([], "Contabilidade Vazia", "Todas");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });
});
