import { describe, expect, it, vi } from "vitest";
import * as db from "./db";

describe("Downloads - Certificados Vencidos", () => {
  it("identifica certificado vencido quando validTo está no passado", () => {
    const cert = {
      validTo: new Date("2024-01-01"),
    };
    const isVencido = cert.validTo && new Date(cert.validTo) < new Date();
    expect(isVencido).toBeTruthy();
  });

  it("identifica certificado válido quando validTo está no futuro", () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const cert = {
      validTo: futureDate,
    };
    const isVencido = cert.validTo && new Date(cert.validTo) < new Date();
    expect(isVencido).toBeFalsy();
  });

  it("trata certificado sem validTo como não vencido", () => {
    const cert = {
      validTo: null as Date | null,
    };
    const isVencido = cert.validTo && new Date(cert.validTo) < new Date();
    expect(isVencido).toBeFalsy();
  });

  it("classifica status de certificado corretamente", () => {
    function classifyCert(validTo: Date | null) {
      if (!validTo) return "sem_certificado";
      return new Date(validTo) < new Date() ? "vencido" : "valido";
    }
    expect(classifyCert(new Date("2024-01-01"))).toBe("vencido");
    const future = new Date(); future.setFullYear(future.getFullYear() + 1);
    expect(classifyCert(future)).toBe("valido");
    expect(classifyCert(null)).toBe("sem_certificado");
  });
});

describe("Downloads - Estrutura de pastas", () => {
  it("deve separar notas por direção e status corretamente", () => {
    const notas = [
      { direcao: "emitida", status: "ativa", numeroNota: "001" },
      { direcao: "emitida", status: "cancelada", numeroNota: "002" },
      { direcao: "recebida", status: "ativa", numeroNota: "003" },
      { direcao: "recebida", status: "cancelada", numeroNota: "004" },
      { direcao: "emitida", status: "ativa", numeroNota: "005" },
    ];

    const emitidas = notas.filter(n => n.direcao === "emitida" && n.status !== "cancelada");
    const tomadas = notas.filter(n => n.direcao === "recebida" && n.status !== "cancelada");
    const canceladas = notas.filter(n => n.status === "cancelada");

    expect(emitidas).toHaveLength(2);
    expect(tomadas).toHaveLength(1);
    expect(canceladas).toHaveLength(2);
  });

  it("deve gerar nome de pasta com formato correto", () => {
    const nomeEmpresa = "EMPRESA TESTE LTDA";
    const now = new Date(2026, 1, 9, 14, 30); // 09/02/2026 14:30
    
    const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
    const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const nomeClean = nomeEmpresa.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
    const pastaRaiz = `${nomeClean}_${dateStr}_${timeStr}`;

    expect(pastaRaiz).toContain("EMPRESA-TESTE-LTDA");
    expect(pastaRaiz).toContain("1430");
  });
});

describe("Downloads - Progresso", () => {
  it("calcula percentual de progresso corretamente", () => {
    const logs = [
      { status: "executando", progresso: 5, totalEsperado: 10 },
      { status: "executando", progresso: 3, totalEsperado: 20 },
      { status: "concluido", progresso: 15, totalEsperado: 15 },
    ];

    const executando = logs.filter(l => l.status === "executando");
    const totalEsperadoGeral = executando.reduce((acc, l) => acc + (l.totalEsperado ?? 0), 0);
    const progressoGeral = executando.reduce((acc, l) => acc + (l.progresso ?? 0), 0);
    const percentGeral = totalEsperadoGeral > 0 ? Math.round((progressoGeral / totalEsperadoGeral) * 100) : 0;

    expect(executando).toHaveLength(2);
    expect(totalEsperadoGeral).toBe(30);
    expect(progressoGeral).toBe(8);
    expect(percentGeral).toBe(27);
  });

  it("retorna 0% quando não há downloads em execução", () => {
    const logs = [
      { status: "concluido", progresso: 10, totalEsperado: 10 },
    ];

    const executando = logs.filter(l => l.status === "executando");
    const totalEsperadoGeral = executando.reduce((acc, l) => acc + (l.totalEsperado ?? 0), 0);
    const progressoGeral = executando.reduce((acc, l) => acc + (l.progresso ?? 0), 0);
    const percentGeral = totalEsperadoGeral > 0 ? Math.round((progressoGeral / totalEsperadoGeral) * 100) : 0;

    expect(executando).toHaveLength(0);
    expect(percentGeral).toBe(0);
  });
});

describe("Downloads - Cancelamento", () => {
  it("filtra downloads cancelados corretamente", () => {
    const logs = [
      { id: 1, status: "executando", clienteNome: "Empresa A" },
      { id: 2, status: "concluido", clienteNome: "Empresa B" },
      { id: 3, status: "cancelado", clienteNome: "Empresa C" },
      { id: 4, status: "executando", clienteNome: "Empresa D" },
      { id: 5, status: "erro", clienteNome: "Empresa E" },
    ];

    const executando = logs.filter(l => l.status === "executando");
    const cancelados = logs.filter(l => l.status === "cancelado");
    const concluidos = logs.filter(l => l.status === "concluido");

    expect(executando).toHaveLength(2);
    expect(cancelados).toHaveLength(1);
    expect(concluidos).toHaveLength(1);
    expect(executando.map(l => l.clienteNome)).toEqual(["Empresa A", "Empresa D"]);
  });

  it("identifica downloads que podem ser limpos (concluídos, erros, cancelados)", () => {
    const logs = [
      { id: 1, status: "executando" },
      { id: 2, status: "concluido" },
      { id: 3, status: "cancelado" },
      { id: 4, status: "erro" },
      { id: 5, status: "executando" },
    ];

    const limpavel = logs.filter(l =>
      l.status === "concluido" || l.status === "erro" || l.status === "cancelado"
    );

    expect(limpavel).toHaveLength(3);
    // Executando não deve ser limpo
    expect(limpavel.every(l => l.status !== "executando")).toBe(true);
  });

  it("mostra nome da empresa nos downloads em execução", () => {
    const logs = [
      { id: 1, status: "executando", clienteNome: "EMPRESA TESTE LTDA", progresso: 5, totalEsperado: 10 },
      { id: 2, status: "executando", clienteNome: "OUTRA EMPRESA SA", progresso: 3, totalEsperado: 20 },
    ];

    const executando = logs.filter(l => l.status === "executando");
    const empresasExecutando = executando
      .map(l => l.clienteNome || "Empresa desconhecida")
      .filter((v, i, a) => a.indexOf(v) === i);

    expect(empresasExecutando).toEqual(["EMPRESA TESTE LTDA", "OUTRA EMPRESA SA"]);
    expect(empresasExecutando).toHaveLength(2);
  });

  it("calcula progresso individual por download", () => {
    const log = { progresso: 7, totalEsperado: 20 };
    const percent = (log.totalEsperado ?? 0) > 0
      ? Math.round(((log.progresso ?? 0) / (log.totalEsperado ?? 1)) * 100)
      : 0;

    expect(percent).toBe(35);
  });

  it("retorna 0% quando totalEsperado é 0", () => {
    const log = { progresso: 0, totalEsperado: 0 };
    const percent = (log.totalEsperado ?? 0) > 0
      ? Math.round(((log.progresso ?? 0) / (log.totalEsperado ?? 1)) * 100)
      : 0;

    expect(percent).toBe(0);
  });
});

describe("Downloads - Filtro de Período", () => {
  it("calcula datas de início e fim do mês corretamente", () => {
    const mes = 2; // Fevereiro
    const ano = 2026;
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    expect(inicio.getFullYear()).toBe(2026);
    expect(inicio.getMonth()).toBe(1); // 0-indexed
    expect(inicio.getDate()).toBe(1);
    expect(fim.getDate()).toBe(28); // Fevereiro 2026 tem 28 dias
    expect(fim.getHours()).toBe(23);
    expect(fim.getMinutes()).toBe(59);
  });

  it("filtra notas dentro do período corretamente", () => {
    const notas = [
      { dataEmissao: new Date("2026-01-15"), numero: "001" },
      { dataEmissao: new Date("2026-02-10"), numero: "002" },
      { dataEmissao: new Date("2026-02-25"), numero: "003" },
      { dataEmissao: new Date("2026-03-05"), numero: "004" },
    ];

    const inicio = new Date(2026, 1, 1); // 01/02/2026
    const fim = new Date(2026, 2, 0, 23, 59, 59); // 28/02/2026

    const filtradas = notas.filter(n => {
      const d = new Date(n.dataEmissao);
      return d >= inicio && d <= fim;
    });

    expect(filtradas).toHaveLength(2);
    expect(filtradas.map(n => n.numero)).toEqual(["002", "003"]);
  });

  it("retorna todas as notas quando modo é 'novas' (sem filtro)", () => {
    const downloadMode = "novas";
    const periodoRange = downloadMode === "novas"
      ? { inicio: undefined, fim: undefined }
      : { inicio: "2026-02-01", fim: "2026-02-28" };

    expect(periodoRange.inicio).toBeUndefined();
    expect(periodoRange.fim).toBeUndefined();
  });

  it("gera range correto quando modo é 'periodo'", () => {
    const downloadMode = "periodo";
    const periodoMes = "3";
    const periodoAno = "2026";

    const mes = parseInt(periodoMes);
    const ano = parseInt(periodoAno);
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);

    expect(inicio.getMonth()).toBe(2); // Março
    expect(fim.getDate()).toBe(31); // Março tem 31 dias
  });
});

describe("Downloads - Detecção de Downloads Travados", () => {
  it("identifica download travado (mais de 10 min sem atualização)", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const log = {
      status: "executando",
      iniciadoEm: new Date(Date.now() - 15 * 60 * 1000), // 15 min atrás
    };

    const isStalled = log.status === "executando" && new Date(log.iniciadoEm) <= tenMinAgo;
    expect(isStalled).toBe(true);
  });

  it("não marca download recente como travado", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const log = {
      status: "executando",
      iniciadoEm: new Date(Date.now() - 3 * 60 * 1000), // 3 min atrás
    };

    const isStalled = log.status === "executando" && new Date(log.iniciadoEm) <= tenMinAgo;
    expect(isStalled).toBe(false);
  });

  it("não marca download concluído como travado", () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const log = {
      status: "concluido",
      iniciadoEm: new Date(Date.now() - 20 * 60 * 1000), // 20 min atrás
    };

    const isStalled = log.status === "executando" && new Date(log.iniciadoEm) <= tenMinAgo;
    expect(isStalled).toBe(false);
  });
});

describe("Downloads - Parar Todos", () => {
  it("inclui downloads pendentes e executando no cancelamento", () => {
    const logs = [
      { id: 1, status: "executando" },
      { id: 2, status: "pendente" },
      { id: 3, status: "concluido" },
      { id: 4, status: "executando" },
      { id: 5, status: "cancelado" },
    ];

    const cancelaveis = logs.filter(l => l.status === "executando" || l.status === "pendente");
    expect(cancelaveis).toHaveLength(3);
    expect(cancelaveis.map(l => l.id)).toEqual([1, 2, 4]);
  });

  it("não cancela downloads já concluídos ou cancelados", () => {
    const logs = [
      { id: 1, status: "concluido" },
      { id: 2, status: "cancelado" },
      { id: 3, status: "erro" },
    ];

    const cancelaveis = logs.filter(l => l.status === "executando" || l.status === "pendente");
    expect(cancelaveis).toHaveLength(0);
  });
});

describe("Downloads - Tratamento de 'Sem Notas'", () => {
  it("identifica download sem notas pelo totalEsperado=0 e totalNotas=0", () => {
    const log = {
      status: "concluido",
      totalEsperado: 0,
      totalNotas: 0,
      totalXml: 0,
      etapa: "Nenhuma nota encontrada no período",
    };

    const isSemNotas = log.status === "concluido" && log.totalEsperado === 0 && log.totalXml === 0;
    expect(isSemNotas).toBe(true);
    expect(log.etapa).toContain("Nenhuma nota");
  });

  it("não marca download com notas como 'sem notas'", () => {
    const log = {
      status: "concluido",
      totalEsperado: 10,
      totalNotas: 10,
      totalXml: 10,
      etapa: "Concluído",
    };

    const isSemNotas = log.status === "concluido" && log.totalEsperado === 0 && log.totalXml === 0;
    expect(isSemNotas).toBe(false);
  });

  it("diferencia 'sem notas' de 'erro real' no status", () => {
    const logSemNotas = {
      status: "concluido",
      totalEsperado: 0,
      totalXml: 0,
      etapa: "Nenhuma nota encontrada no período",
    };
    const logErro = {
      status: "erro",
      totalEsperado: 0,
      totalXml: 0,
      etapa: "API Nacional indisponível - sem conexão",
    };

    expect(logSemNotas.status).toBe("concluido");
    expect(logErro.status).toBe("erro");
  });
});

describe("Downloads - Detecção de Travamento (filtros)", () => {
  it("não marca como travado quando totalEsperado=0 e totalNotas=0 (sem notas)", () => {
    const stalledLogs = [
      { id: 1, status: "executando", totalEsperado: 0, totalNotas: 0, etapa: "Nenhuma nota encontrada" },
      { id: 2, status: "executando", totalEsperado: 10, totalNotas: 5, etapa: "Processando..." },
    ];

    const filtered = stalledLogs.filter(log => {
      if (log.totalEsperado === 0 && log.totalNotas === 0) return false;
      return true;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });

  it("não marca como travado quando etapa indica auto-correção", () => {
    const stalledLogs = [
      { id: 1, status: "executando", totalEsperado: 10, totalNotas: 10, etapa: "Auto-correção: 3 PDF(s) pendente(s)..." },
      { id: 2, status: "executando", totalEsperado: 10, totalNotas: 5, etapa: "Processando..." },
    ];

    const filtered = stalledLogs.filter(log => {
      if (log.totalEsperado === 0 && log.totalNotas === 0) return false;
      const etapa = (log.etapa || "").toLowerCase();
      if (etapa.includes("auto-correção") || etapa.includes("auto-correcao")) return false;
      return true;
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });
});

describe("Downloads - Mensagens de Erro Específicas", () => {
  function classificarErro(errMsg: string): string {
    if (errMsg.includes("PKCS12") || errMsg.includes("pkcs12") || errMsg.includes("MAC verify")) {
      return "Certificado digital inválido ou senha incorreta";
    } else if (errMsg.includes("certificate") || errMsg.includes("SSL") || errMsg.includes("TLS")) {
      return "Erro de conexão SSL/TLS com a API Nacional";
    } else if (errMsg.includes("ECONNREFUSED") || errMsg.includes("ENOTFOUND")) {
      return "API Nacional indisponível - sem conexão";
    } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
      return "Timeout na comunicação com a API Nacional";
    } else if (errMsg.includes("socket disconnected") || errMsg.includes("ECONNRESET")) {
      return "Conexão interrompida com a API Nacional";
    } else if (errMsg.includes("401") || errMsg.includes("403")) {
      return "Certificado não autorizado na API Nacional";
    } else if (errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503")) {
      return "API Nacional retornou erro interno (tente novamente)";
    } else if (errMsg.includes("decrypt") || errMsg.includes("Decrypt")) {
      return "Erro ao descriptografar certificado digital";
    }
    return errMsg;
  }

  it("classifica erro de certificado PKCS12", () => {
    expect(classificarErro("Error: PKCS12 MAC verify failure")).toBe("Certificado digital inválido ou senha incorreta");
  });

  it("classifica erro de SSL/TLS", () => {
    expect(classificarErro("SSL certificate problem")).toBe("Erro de conexão SSL/TLS com a API Nacional");
  });

  it("classifica erro de conexão recusada", () => {
    expect(classificarErro("connect ECONNREFUSED 127.0.0.1:443")).toBe("API Nacional indisponível - sem conexão");
  });

  it("classifica erro de timeout", () => {
    expect(classificarErro("Request timeout after 30000ms")).toBe("Timeout na comunicação com a API Nacional");
  });

  it("classifica erro de conexão resetada", () => {
    expect(classificarErro("socket disconnected before handshake")).toBe("Conexão interrompida com a API Nacional");
  });

  it("classifica erro ECONNRESET", () => {
    expect(classificarErro("read ECONNRESET")).toBe("Conexão interrompida com a API Nacional");
  });

  it("classifica erro 401/403", () => {
    expect(classificarErro("Request failed with status code 403")).toBe("Certificado não autorizado na API Nacional");
  });

  it("classifica erro 500/502/503", () => {
    expect(classificarErro("Request failed with status code 502")).toBe("API Nacional retornou erro interno (tente novamente)");
  });

  it("classifica erro de descriptografia", () => {
    expect(classificarErro("Decrypt error: bad padding")).toBe("Erro ao descriptografar certificado digital");
  });

  it("mantém mensagem original para erros desconhecidos", () => {
    expect(classificarErro("Erro genérico qualquer")).toBe("Erro genérico qualquer");
  });
});

describe("Downloads - Auto-Correção Tempo de Espera", () => {
  it("converte formato HH:MM:SS para milissegundos corretamente", () => {
    function parseTempoEspera(tempo: string): number {
      const partes = tempo.split(":").map(Number);
      return ((partes[0] || 0) * 3600 + (partes[1] || 0) * 60 + (partes[2] || 0)) * 1000;
    }

    expect(parseTempoEspera("00:00:30")).toBe(30000);
    expect(parseTempoEspera("00:05:00")).toBe(300000);
    expect(parseTempoEspera("01:00:00")).toBe(3600000);
    expect(parseTempoEspera("00:01:30")).toBe(90000);
    expect(parseTempoEspera("02:30:45")).toBe(9045000);
  });

  it("valida formato HH:MM:SS", () => {
    const regex = /^\d{2}:\d{2}:\d{2}$/;
    expect(regex.test("00:05:00")).toBe(true);
    expect(regex.test("01:30:00")).toBe(true);
    expect(regex.test("00:00:30")).toBe(true);
    expect(regex.test("5:00")).toBe(false);
    expect(regex.test("abc")).toBe(false);
    expect(regex.test("")).toBe(false);
    expect(regex.test("00:05")).toBe(false);
  });

  it("usa valor padrão quando setting não existe", () => {
    const tempoEspera = null || "00:00:30";
    const partes = tempoEspera.split(":").map(Number);
    const delayMs = ((partes[0] || 0) * 3600 + (partes[1] || 0) * 60 + (partes[2] || 0)) * 1000;
    expect(delayMs).toBe(30000);
  });
});

describe("Downloads - Motivos Claros na Coluna Progresso", () => {
  function getProgressoMotivo(log: { status: string; certificadoVencido?: boolean; totalEsperado: number; totalXml: number; errosPdf: number; totalPdf: number; etapa?: string; erro?: string }) {
    if (log.status === "executando") return "executando";
    if (log.certificadoVencido) return "Certificado digital vencido";
    if (log.status === "concluido" && log.totalEsperado === 0 && log.totalXml === 0) return "Nenhuma nota encontrada";
    if (log.status === "concluido" && log.errosPdf > 0) return `XML: ${log.totalXml} baixados | PDF: ${log.totalPdf} OK, ${log.errosPdf} com erro`;
    if (log.status === "concluido") return "100%";
    if (log.status === "erro") return log.etapa || log.erro || "Erro no download";
    if (log.status === "cancelado") return "Cancelado pelo usuário";
    return "-";
  }

  it("mostra 'Certificado digital vencido' para cert vencido", () => {
    expect(getProgressoMotivo({ status: "concluido", certificadoVencido: true, totalEsperado: 0, totalXml: 0, errosPdf: 0, totalPdf: 0 })).toBe("Certificado digital vencido");
  });

  it("mostra 'Nenhuma nota encontrada' para sem notas", () => {
    expect(getProgressoMotivo({ status: "concluido", totalEsperado: 0, totalXml: 0, errosPdf: 0, totalPdf: 0 })).toBe("Nenhuma nota encontrada");
  });

  it("mostra detalhes de erros de PDF quando concluído com erros", () => {
    const result = getProgressoMotivo({ status: "concluido", totalEsperado: 10, totalXml: 10, errosPdf: 3, totalPdf: 7 });
    expect(result).toContain("XML: 10 baixados");
    expect(result).toContain("PDF: 7 OK, 3 com erro");
  });

  it("mostra 100% para concluído sem erros", () => {
    expect(getProgressoMotivo({ status: "concluido", totalEsperado: 10, totalXml: 10, errosPdf: 0, totalPdf: 10 })).toBe("100%");
  });

  it("mostra mensagem de erro específica para status erro", () => {
    expect(getProgressoMotivo({ status: "erro", totalEsperado: 0, totalXml: 0, errosPdf: 0, totalPdf: 0, etapa: "API Nacional indisponível" })).toBe("API Nacional indisponível");
  });

  it("mostra 'Cancelado pelo usuário' para cancelados", () => {
    expect(getProgressoMotivo({ status: "cancelado", totalEsperado: 5, totalXml: 2, errosPdf: 0, totalPdf: 2 })).toBe("Cancelado pelo usuário");
  });

  it("mostra 'executando' para downloads em andamento", () => {
    expect(getProgressoMotivo({ status: "executando", totalEsperado: 10, totalXml: 3, errosPdf: 0, totalPdf: 3 })).toBe("executando");
  });

  it("prioriza certificado vencido sobre sem notas", () => {
    expect(getProgressoMotivo({ status: "concluido", certificadoVencido: true, totalEsperado: 0, totalXml: 0, errosPdf: 0, totalPdf: 0 })).toBe("Certificado digital vencido");
  });
});
