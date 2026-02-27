import { describe, it, expect } from "vitest";

describe("Skip de notas já baixadas", () => {
  it("deve filtrar corretamente notas já existentes", () => {
    const docs = [
      { chaveAcesso: "AAA111", nsu: 1, tipoDocumento: "NFSE" },
      { chaveAcesso: "BBB222", nsu: 2, tipoDocumento: "NFSE" },
      { chaveAcesso: "CCC333", nsu: 3, tipoDocumento: "NFSE" },
      { chaveAcesso: "DDD444", nsu: 4, tipoDocumento: "NFSE" },
      { chaveAcesso: "EEE555", nsu: 5, tipoDocumento: "NFSE" },
    ];

    // Simular que AAA111, BBB222 e CCC333 já existem no banco
    const chavesExistentes = new Set(["AAA111", "BBB222", "CCC333"]);

    const docsParaBaixar = docs.filter(d => !chavesExistentes.has(d.chaveAcesso));
    const jaExistem = chavesExistentes.size;

    expect(jaExistem).toBe(3);
    expect(docsParaBaixar.length).toBe(2);
    expect(docsParaBaixar[0].chaveAcesso).toBe("DDD444");
    expect(docsParaBaixar[1].chaveAcesso).toBe("EEE555");
  });

  it("deve identificar notas sem PDF para rebaixar apenas o PDF", () => {
    const docs = [
      { chaveAcesso: "AAA111", nsu: 1, tipoDocumento: "NFSE" },
      { chaveAcesso: "BBB222", nsu: 2, tipoDocumento: "NFSE" },
      { chaveAcesso: "CCC333", nsu: 3, tipoDocumento: "NFSE" },
    ];

    // AAA111 e BBB222 existem no banco, mas AAA111 está sem PDF
    const chavesExistentes = new Set(["AAA111", "BBB222"]);
    const chavesSemPdf = new Set(["AAA111"]);

    const docsParaBaixar = docs.filter(d => !chavesExistentes.has(d.chaveAcesso));
    const docsParaPdfOnly = docs.filter(d => chavesSemPdf.has(d.chaveAcesso));

    expect(docsParaBaixar.length).toBe(1);
    expect(docsParaBaixar[0].chaveAcesso).toBe("CCC333");
    expect(docsParaPdfOnly.length).toBe(1);
    expect(docsParaPdfOnly[0].chaveAcesso).toBe("AAA111");
  });

  it("deve concluir imediatamente quando todas as notas já existem", () => {
    const docs = [
      { chaveAcesso: "AAA111", nsu: 1, tipoDocumento: "NFSE" },
      { chaveAcesso: "BBB222", nsu: 2, tipoDocumento: "NFSE" },
    ];

    const chavesExistentes = new Set(["AAA111", "BBB222"]);
    const chavesSemPdf = new Set<string>(); // todos têm PDF

    const docsParaBaixar = docs.filter(d => !chavesExistentes.has(d.chaveAcesso));
    const docsParaPdfOnly = docs.filter(d => chavesSemPdf.has(d.chaveAcesso));

    const totalNovos = docsParaBaixar.length;
    const totalPdfPendentes = docsParaPdfOnly.length;

    // Deve concluir imediatamente
    expect(totalNovos).toBe(0);
    expect(totalPdfPendentes).toBe(0);
  });

  it("deve funcionar normalmente quando nenhuma nota existe (primeira execução)", () => {
    const docs = [
      { chaveAcesso: "AAA111", nsu: 1, tipoDocumento: "NFSE" },
      { chaveAcesso: "BBB222", nsu: 2, tipoDocumento: "NFSE" },
      { chaveAcesso: "CCC333", nsu: 3, tipoDocumento: "NFSE" },
    ];

    const chavesExistentes = new Set<string>(); // nenhuma existe

    const docsParaBaixar = docs.filter(d => !chavesExistentes.has(d.chaveAcesso));
    const jaExistem = chavesExistentes.size;

    expect(jaExistem).toBe(0);
    expect(docsParaBaixar.length).toBe(3);
  });

  it("deve calcular contadores finais corretamente com skip", () => {
    const totalDocs = 690;
    const jaExistem = 3;
    let contXml = 0;
    let notasNovas = jaExistem; // Começa contando as já existentes

    // Simular download de 10 notas novas
    for (let i = 0; i < 10; i++) {
      contXml++;
      notasNovas++;
    }

    // Verificar contadores
    expect(notasNovas).toBe(13); // 3 existentes + 10 novas
    expect(contXml).toBe(10); // apenas as novas

    // Contadores finais para o log
    const totalXmlFinal = contXml + jaExistem;
    const notasNovasFinal = notasNovas - jaExistem;

    expect(totalXmlFinal).toBe(13); // 10 novas + 3 existentes
    expect(notasNovasFinal).toBe(10); // apenas as novas
  });

  it("deve gerar mensagem de etapa correta com skip", () => {
    const jaExistem = 3;
    const pdfPendLength = 0;
    const baixarPdf = true;

    const skipMsg = jaExistem > 0 ? ` (${jaExistem} já existiam)` : "";
    const etapaFinal = baixarPdf && pdfPendLength > 0
      ? `Concluído (${pdfPendLength} PDF(s) não baixado(s))${skipMsg}`
      : `Concluído${skipMsg}`;

    expect(etapaFinal).toBe("Concluído (3 já existiam)");
  });

  it("deve gerar mensagem sem skip quando não há notas existentes", () => {
    const jaExistem = 0;
    const pdfPendLength = 0;
    const baixarPdf = true;

    const skipMsg = jaExistem > 0 ? ` (${jaExistem} já existiam)` : "";
    const etapaFinal = baixarPdf && pdfPendLength > 0
      ? `Concluído (${pdfPendLength} PDF(s) não baixado(s))${skipMsg}`
      : `Concluído${skipMsg}`;

    expect(etapaFinal).toBe("Concluído");
  });

  it("deve processar em lotes de 500 para queries grandes", () => {
    const BATCH = 500;
    const chaves: string[] = [];
    for (let i = 0; i < 1200; i++) {
      chaves.push(`CHAVE_${i}`);
    }

    // Simular processamento em lotes
    const batches: string[][] = [];
    for (let i = 0; i < chaves.length; i += BATCH) {
      batches.push(chaves.slice(i, i + BATCH));
    }

    expect(batches.length).toBe(3); // 500 + 500 + 200
    expect(batches[0].length).toBe(500);
    expect(batches[1].length).toBe(500);
    expect(batches[2].length).toBe(200);
  });

  it("progresso deve refletir notas já baixadas + novas", () => {
    const totalDocs = 690;
    const jaExistem = 100;
    let notasNovas = jaExistem;

    // Simular progresso de download
    const progressos: number[] = [];
    for (let i = 0; i < 5; i++) {
      notasNovas++;
      progressos.push(notasNovas);
    }

    // Progresso deve começar de 100 (já existentes) e ir subindo
    expect(progressos).toEqual([101, 102, 103, 104, 105]);
    expect(notasNovas).toBe(105);
  });
});
