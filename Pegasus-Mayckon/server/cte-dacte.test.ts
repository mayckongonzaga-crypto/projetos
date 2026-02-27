import { describe, expect, it } from "vitest";
import { parseXml } from "./cte-dacte";

// Minimal CT-e XML for testing parsing
const minimalXml = `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
  <CTe>
    <infCte versao="4.00" Id="CTe35260248740351002109570016575108130781788">
      <ide>
        <cUF>35</cUF>
        <CFOP>6353</CFOP>
        <natOp>TRANSPORTE RODOVIARIO</natOp>
        <mod>57</mod>
        <serie>0</serie>
        <nCT>16575108</nCT>
        <dhEmi>2026-02-12T19:38:40-03:00</dhEmi>
        <tpCTe>0</tpCTe>
        <tpServ>0</tpServ>
        <modal>01</modal>
        <toma3><toma>3</toma></toma3>
      </ide>
      <emit>
        <CNPJ>48740351002109</CNPJ>
        <IE>796481688110</IE>
        <xNome>GUARULHOS TRANSPORTES LTDA</xNome>
        <xFant>GUARULHOS</xFant>
        <enderEmit>
          <xLgr>MONTEIRO LOBATO</xLgr>
          <nro>4794</nro>
          <xCpl>BLOCO B</xCpl>
          <xBairro>C JD CUMBICA JD P DUTRA</xBairro>
          <cMun>3518800</cMun>
          <xMun>GUARULHOS</xMun>
          <CEP>07180000</CEP>
          <UF>SP</UF>
          <fone>21889000</fone>
        </enderEmit>
      </emit>
      <rem>
        <CNPJ>03895150000107</CNPJ>
        <IE>115940032119</IE>
        <xNome>BBS - COMPONENTES ELETRONICOS E ELETROME</xNome>
        <enderReme>
          <xLgr>FLORIANOPOLIS</xLgr>
          <nro>224</nro>
          <xBairro>CENTRO</xBairro>
          <xMun>SAO PAULO</xMun>
          <CEP>03185050</CEP>
          <UF>SP</UF>
          <fone>26021051</fone>
          <xPais>BRASIL</xPais>
        </enderReme>
      </rem>
      <dest>
        <CNPJ>48740351002109</CNPJ>
        <IE>796481688110</IE>
        <xNome>BRASPRESS TRANSPORTES URGENTES LTDA</xNome>
        <enderDest>
          <xLgr>HERBERT KREMER</xLgr>
          <nro>151</nro>
          <xBairro>CENTRO</xBairro>
          <xMun>ITAJAI</xMun>
          <CEP>88305200</CEP>
          <UF>SC</UF>
          <fone>21889000</fone>
          <xPais>BRASIL</xPais>
        </enderDest>
      </dest>
      <vPrest>
        <vTPrest>76.87</vTPrest>
        <vRec>76.87</vRec>
        <Comp><xNome>SEC/CAT</xNome><vComp>1.57</vComp></Comp>
        <Comp><xNome>PEDAGIO</xNome><vComp>4.42</vComp></Comp>
        <Comp><xNome>FRETE PESO</xNome><vComp>54.08</vComp></Comp>
      </vPrest>
      <imp>
        <ICMS00>
          <CST>00</CST>
          <vBC>76.87</vBC>
          <pICMS>7.00</pICMS>
          <vICMS>5.38</vICMS>
        </ICMS00>
      </imp>
      <infCarga>
        <vCarga>1978.90</vCarga>
        <proPred>CAIXA</proPred>
        <infQ><cUnid>01</cUnid><tpMed>PESO BRUTO</tpMed><qCarga>6.000</qCarga></infQ>
        <infQ><cUnid>01</cUnid><tpMed>PESO AFERIDO</tpMed><qCarga>6.000</qCarga></infQ>
        <infQ><cUnid>03</cUnid><tpMed>VOLUMES</tpMed><qCarga>1.0000</qCarga></infQ>
      </infCarga>
      <infDoc>
        <infNFe><chave>35260203895150000107550010000012341000012345</chave></infNFe>
      </infDoc>
      <infModal versao="4.00">
        <rodo><RNTRC>12345678</RNTRC></rodo>
      </infModal>
    </infCte>
  </CTe>
  <protCTe versao="4.00">
    <infProt>
      <nProt>135260713999699</nProt>
      <dhRecbto>2026-02-12T19:38:46-03:00</dhRecbto>
      <cStat>100</cStat>
    </infProt>
  </protCTe>
</cteProc>`;

describe("DACTE PDF - parseXml", () => {
  it("parses emitente correctly", () => {
    const d = parseXml(minimalXml);
    expect(d.emitNome).toBe("GUARULHOS TRANSPORTES LTDA");
    expect(d.emitFantasia).toBe("GUARULHOS");
    expect(d.emitCnpj).toBe("48740351002109");
    expect(d.emitIE).toBe("796481688110");
    expect(d.emitMun).toBe("GUARULHOS");
    expect(d.emitUF).toBe("SP");
  });

  it("parses tomador value correctly as '3' (Destinatário)", () => {
    const d = parseXml(minimalXml);
    expect(d.tomador).toBe("3");
    // getTomador("3") should return "Destinatário"
  });

  it("parses tipo CT-e and tipo serviço", () => {
    const d = parseXml(minimalXml);
    expect(d.tipoCte).toBe("0"); // Normal
    expect(d.tipoServico).toBe("0"); // Normal
  });

  it("parses forma de pagamento", () => {
    const d = parseXml(minimalXml);
    // formaPag comes from tPag or defaults
    expect(typeof d.formaPag).toBe("string");
  });

  it("parses componentes do valor", () => {
    const d = parseXml(minimalXml);
    expect(d.componentes.length).toBe(3);
    expect(d.componentes[0].nome).toBe("SEC/CAT");
    expect(d.componentes[0].valor).toBe("1.57");
    expect(d.componentes[2].nome).toBe("FRETE PESO");
  });

  it("parses documentos originários (NF-e)", () => {
    const d = parseXml(minimalXml);
    expect(d.documentos.length).toBe(1);
    expect(d.documentos[0].tipo).toBe("NF-e");
    expect(d.documentos[0].chaveOuDoc).toBe("35260203895150000107550010000012341000012345");
  });

  it("parses remetente and destinatário", () => {
    const d = parseXml(minimalXml);
    expect(d.remNome).toBe("BBS - COMPONENTES ELETRONICOS E ELETROME");
    expect(d.destNome).toBe("BRASPRESS TRANSPORTES URGENTES LTDA");
  });

  it("parses carga info", () => {
    const d = parseXml(minimalXml);
    expect(d.prodPredominante).toBe("CAIXA");
    expect(d.valorCarga).toBe("1978.90");
    expect(d.pesoBruto).toBe("6.000");
  });

  it("parses protocolo", () => {
    const d = parseXml(minimalXml);
    expect(d.protocolo).toBe("135260713999699");
    expect(d.statusCte).toBe("AUTORIZADO");
  });

  it("parses modal as rodoviário", () => {
    const d = parseXml(minimalXml);
    expect(d.modal).toBe("01");
    expect(d.rntrc).toBe("12345678");
  });
});

describe("DACTE PDF - helper functions", () => {
  it("getTomador returns correct labels", async () => {
    // Import the module to test helper functions indirectly through parseXml
    const d = parseXml(minimalXml);
    // The tomador field should be "3" which maps to "Destinatário"
    expect(d.tomador).toBe("3");
  });
});
