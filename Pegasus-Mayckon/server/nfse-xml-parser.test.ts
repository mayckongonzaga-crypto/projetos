import { describe, it, expect } from "vitest";
import { parseNfseXmlCompleto, parseNfseXmlCompletoRaw } from "./nfse-xml-parser";

// XML de exemplo simulando uma NFSe real da API Nacional
const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <infNFSe>
    <chNFSe>NFSe12345678901234567890</chNFSe>
    <nNFSe>1234</nNFSe>
    <dCompet>2025-01</dCompet>
    <dhEmi>2025-01-15T10:30:00-03:00</dhEmi>
    <nDPS>5678</nDPS>
    <serie>NFS</serie>
    <emit>
      <CNPJ>12345678000199</CNPJ>
      <IM>12345</IM>
      <fone>1199998888</fone>
      <xNome>Empresa Emitente Ltda</xNome>
      <xEmail>contato@emitente.com.br</xEmail>
      <opSN>2</opSN>
      <regApTribSN>1</regApTribSN>
      <end>
        <xLgr>Rua das Flores</xLgr>
        <nro>100</nro>
        <xCpl>Sala 5</xCpl>
        <xBairro>Centro</xBairro>
        <xMun>São Paulo</xMun>
        <UF>SP</UF>
        <CEP>01001000</CEP>
      </end>
    </emit>
    <toma>
      <CNPJ>98765432000188</CNPJ>
      <IM>67890</IM>
      <fone>1133334444</fone>
      <xNome>Empresa Tomadora SA</xNome>
      <xEmail>contato@tomadora.com.br</xEmail>
      <end>
        <xLgr>Av. Paulista</xLgr>
        <nro>2000</nro>
        <xBairro>Bela Vista</xBairro>
        <xMun>São Paulo</xMun>
        <UF>SP</UF>
        <CEP>01310100</CEP>
      </end>
    </toma>
    <serv>
      <cTribNac>01.01.01.001</cTribNac>
      <cTribMun>0105</cTribMun>
      <xLocPrestacao>São Paulo - SP</xLocPrestacao>
      <xDescServ>Desenvolvimento de software sob encomenda</xDescServ>
    </serv>
    <tribMun>
      <tribISSQN>1</tribISSQN>
      <xLocIncid>São Paulo - SP</xLocIncid>
      <regEspTrib>0</regEspTrib>
      <vServ>10000.00</vServ>
      <vDescIncond>500.00</vDescIncond>
      <vDed>0.00</vDed>
      <vBC>9500.00</vBC>
      <pAliq>0.05</pAliq>
      <tpRetISSQN>2</tpRetISSQN>
      <vISSQN>475.00</vISSQN>
    </tribMun>
    <tribFed>
      <vIRRF>150.00</vIRRF>
      <vCP>0.00</vCP>
      <vCSLL>100.00</vCSLL>
      <vPIS>65.00</vPIS>
      <vCOFINS>300.00</vCOFINS>
      <vTotTribFed>615.00</vTotTribFed>
    </tribFed>
    <valores>
      <vLiq>8460.00</vLiq>
      <vISSQNRet>475.00</vISSQNRet>
      <vTotalRet>615.00</vTotalRet>
    </valores>
    <totTrib>
      <vTotTribFed>615.00</vTotTribFed>
      <vTotTribEst>0.00</vTotTribEst>
      <vTotTribMun>475.00</vTotTribMun>
    </totTrib>
    <infCompl>
      <xInfCompl>Nota referente ao contrato 123/2025. Pagamento via boleto.</xInfCompl>
    </infCompl>
  </infNFSe>
</NFSe>`;

describe("parseNfseXmlCompleto", () => {
  it("deve extrair dados do cabeçalho corretamente", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.chaveAcesso).toBe("NFSe12345678901234567890");
    expect(result.numeroNfse).toBe("1234");
    expect(result.competencia).toBe("2025-01");
    expect(result.dataEmissao).toContain("2025-01-15");
    expect(result.numeroDps).toBe("5678");
    expect(result.serieDps).toBe("NFS");
  });

  it("deve extrair dados do emitente com formatação de CNPJ", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.emitenteCnpj).toBe("12.345.678/0001-99");
    expect(result.emitenteNome).toBe("Empresa Emitente Ltda");
    expect(result.emitenteEmail).toBe("contato@emitente.com.br");
    expect(result.emitenteInscMunicipal).toBe("12345");
    expect(result.emitenteEndereco).toContain("Rua das Flores");
    expect(result.emitenteEndereco).toContain("100");
    expect(result.emitenteMunicipio).toContain("São Paulo");
    expect(result.emitenteCep).toBe("01001000");
    expect(result.emitenteSimplesNacional).toContain("Optante");
    expect(result.emitenteRegimeApuracao).toContain("Simples Nacional");
  });

  it("deve extrair dados do tomador com formatação de CNPJ", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.tomadorCnpj).toBe("98.765.432/0001-88");
    expect(result.tomadorNome).toBe("Empresa Tomadora SA");
    expect(result.tomadorEmail).toBe("contato@tomadora.com.br");
    expect(result.tomadorInscMunicipal).toBe("67890");
    expect(result.tomadorEndereco).toContain("Av. Paulista");
    expect(result.tomadorMunicipio).toContain("São Paulo");
  });

  it("deve extrair dados do serviço", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.codigoTribNacional).toBe("01.01.01.001");
    expect(result.codigoTribMunicipal).toBe("0105");
    expect(result.localPrestacao).toBe("São Paulo - SP");
    expect(result.descricaoServico).toBe("Desenvolvimento de software sob encomenda");
  });

  it("deve extrair tributação municipal com formatação monetária", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.tributacaoIssqn).toBe("Operação Tributável");
    expect(result.municipioIncidenciaIssqn).toBe("São Paulo - SP");
    expect(result.regimeEspecialTributacao).toBe("Nenhum");
    expect(result.valorServico).toContain("10.000,00");
    expect(result.descontoIncondicionado).toContain("500,00");
    expect(result.bcIssqn).toContain("9.500,00");
    expect(result.aliquotaAplicada).toBe("5.00%");
    expect(result.retencaoIssqn).toBe("Retido");
    expect(result.issqnApurado).toContain("475,00");
  });

  it("deve extrair tributação federal", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.irrf).toContain("150,00");
    expect(result.csll).toContain("100,00");
    expect(result.pis).toContain("65,00");
    expect(result.cofins).toContain("300,00");
    expect(result.totalTributacaoFederal).toContain("615,00");
  });

  it("deve extrair valores totais e valor líquido", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.valorLiquido).toContain("8.460,00");
    expect(result.issqnRetido).toContain("475,00");
    expect(result.irrfCpCsllRetidos).toContain("615,00");
  });

  it("deve extrair totais aproximados de tributos", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.tributosFederais).toContain("615,00");
    expect(result.tributosEstaduais).toContain("0,00");
    expect(result.tributosMunicipais).toContain("475,00");
  });

  it("deve extrair informações complementares", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.informacoesComplementares).toContain("contrato 123/2025");
  });

  it("deve detectar direção como emitida quando CNPJ do cliente é o emitente", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.direcao).toBe("emitida");
  });

  it("deve detectar direção como recebida quando CNPJ do cliente é o tomador", () => {
    const result = parseNfseXmlCompleto(sampleXml, "98765432000188");
    expect(result.direcao).toBe("recebida");
  });

  it("deve detectar flags de retenção corretamente", () => {
    const result = parseNfseXmlCompleto(sampleXml, "12345678000199");
    expect(result.temRetencaoIssqn).toBe(true);
    expect(result.temRetencaoFederal).toBe(true);
    expect(result.temRetencao).toBe(true);
  });
});

describe("parseNfseXmlCompletoRaw", () => {
  it("deve retornar valores numéricos sem formatação", () => {
    const result = parseNfseXmlCompletoRaw(sampleXml, "12345678000199");
    expect(result.valorServico).toBe(10000);
    expect(result.bcIssqn).toBe(9500);
    expect(result.aliquotaAplicada).toBe(5);
    expect(result.issqnApurado).toBe(475);
    expect(result.irrf).toBe(150);
    expect(result.csll).toBe(100);
    expect(result.pis).toBe(65);
    expect(result.cofins).toBe(300);
    expect(result.valorLiquido).toBe(8460);
    expect(result.issqnRetido).toBe(475);
    expect(result.irrfCpCsllRetidos).toBe(615);
    expect(result.descontoIncondicionado).toBe(500);
  });

  it("deve manter campos de texto inalterados", () => {
    const result = parseNfseXmlCompletoRaw(sampleXml, "12345678000199");
    expect(result.emitenteCnpj).toBe("12.345.678/0001-99");
    expect(result.emitenteNome).toBe("Empresa Emitente Ltda");
    expect(result.descricaoServico).toBe("Desenvolvimento de software sob encomenda");
    expect(result.retencaoIssqn).toBe("Retido");
    expect(result.temRetencao).toBe(true);
  });
});

// Teste com XML sem retenção
const xmlSemRetencao = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <infNFSe>
    <nNFSe>9999</nNFSe>
    <dCompet>2025-02</dCompet>
    <dhEmi>2025-02-01T08:00:00-03:00</dhEmi>
    <emit>
      <CNPJ>11111111000100</CNPJ>
      <xNome>Empresa Simples</xNome>
    </emit>
    <toma>
      <CNPJ>22222222000200</CNPJ>
      <xNome>Tomador Simples</xNome>
    </toma>
    <serv>
      <xDescServ>Consultoria empresarial</xDescServ>
    </serv>
    <tribMun>
      <tribISSQN>1</tribISSQN>
      <vServ>5000.00</vServ>
      <vBC>5000.00</vBC>
      <pAliq>0.02</pAliq>
      <tpRetISSQN>1</tpRetISSQN>
      <vISSQN>100.00</vISSQN>
    </tribMun>
    <valores>
      <vLiq>5000.00</vLiq>
    </valores>
  </infNFSe>
</NFSe>`;

describe("parseNfseXmlCompleto - sem retenção", () => {
  it("deve detectar que não há retenção", () => {
    const result = parseNfseXmlCompleto(xmlSemRetencao, "11111111000100");
    expect(result.temRetencaoIssqn).toBe(false);
    expect(result.temRetencaoFederal).toBe(false);
    expect(result.temRetencao).toBe(false);
    expect(result.retencaoIssqn).toBe("Não Retido");
  });

  it("deve extrair valores básicos mesmo sem tributação federal", () => {
    const result = parseNfseXmlCompleto(xmlSemRetencao, "11111111000100");
    expect(result.valorServico).toContain("5.000,00");
    expect(result.bcIssqn).toContain("5.000,00");
    expect(result.aliquotaAplicada).toBe("2.00%");
    expect(result.issqnApurado).toContain("100,00");
    expect(result.valorLiquido).toContain("5.000,00");
  });

  it("deve retornar strings vazias para campos federais ausentes", () => {
    const result = parseNfseXmlCompleto(xmlSemRetencao, "11111111000100");
    expect(result.irrf).toBe("");
    expect(result.csll).toBe("");
    expect(result.pis).toBe("");
    expect(result.cofins).toBe("");
    expect(result.totalTributacaoFederal).toBe("");
  });
});

describe("parseNfseXmlCompletoRaw - sem retenção", () => {
  it("deve retornar 0 para campos federais ausentes", () => {
    const result = parseNfseXmlCompletoRaw(xmlSemRetencao, "11111111000100");
    expect(result.irrf).toBe(0);
    expect(result.csll).toBe(0);
    expect(result.pis).toBe(0);
    expect(result.cofins).toBe(0);
    expect(result.totalTributacaoFederal).toBe(0);
    expect(result.valorServico).toBe(5000);
    expect(result.valorLiquido).toBe(5000);
  });
});
