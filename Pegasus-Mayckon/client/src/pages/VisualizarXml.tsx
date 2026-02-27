import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload,
  FileText,
  FileCode,
  FileDown,
  Eye,
  Building2,
  Hash,
  Calendar,
  DollarSign,
  MapPin,
  User,
  Info,
  Loader2,
} from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface NotaData {
  // Identificação
  numero: string;
  serie: string;
  chaveAcesso: string;
  codigoVerificacao: string;
  dataEmissao: string;
  competencia: string;
  naturezaOperacao: string;
  tipoDocumento: string;
  // Prestador
  prestadorCnpj: string;
  prestadorNome: string;
  prestadorInscMunicipal: string;
  prestadorEndereco: string;
  prestadorMunicipio: string;
  prestadorUf: string;
  prestadorCep: string;
  // Tomador
  tomadorCnpj: string;
  tomadorNome: string;
  tomadorInscMunicipal: string;
  tomadorEndereco: string;
  tomadorMunicipio: string;
  tomadorUf: string;
  tomadorCep: string;
  tomadorEmail: string;
  // Serviço
  codigoServico: string;
  discriminacao: string;
  municipioPrestacao: string;
  // Valores
  valorServico: string;
  valorDeducoes: string;
  valorPis: string;
  valorCofins: string;
  valorInss: string;
  valorIr: string;
  valorCsll: string;
  valorIss: string;
  aliquotaIss: string;
  valorLiquido: string;
  baseCalculo: string;
  // Status
  status: string;
  xmlRaw: string;
}

function getTextContent(el: Element | null, tag: string): string {
  if (!el) return "";
  // Try direct child first, then deep search
  const found = el.getElementsByTagName(tag);
  if (found.length > 0) return found[0].textContent?.trim() || "";
  // Try with namespace prefix variations
  for (const prefix of ["ns2:", "ns3:", "nfse:", "tc:", ""]) {
    const found2 = el.getElementsByTagName(prefix + tag);
    if (found2.length > 0) return found2[0].textContent?.trim() || "";
  }
  return "";
}

function findElement(doc: Document, ...tags: string[]): Element | null {
  for (const tag of tags) {
    const els = doc.getElementsByTagName(tag);
    if (els.length > 0) return els[0];
    // Try without namespace
    const parts = tag.split(":");
    if (parts.length > 1) {
      const els2 = doc.getElementsByTagName(parts[1]);
      if (els2.length > 0) return els2[0];
    }
  }
  return null;
}

function parseNfseXml(xmlString: string): NotaData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "text/xml");

  // Find main elements - NFSe Nacional or legacy formats
  const infNfse = findElement(doc, "infNFSe", "InfNfse", "Nfse", "CompNfse", "NFSe");
  
  // NFSe Nacional: prestador is <emit> at infNFSe level
  const emit = findElement(doc, "emit");
  const prestadorLegacy = findElement(doc, "Prestador", "PrestadorServico", "DadosPrestador", "prestador");
  const prestador = emit || prestadorLegacy;
  
  // NFSe Nacional: tomador is <toma> inside DPS > infDPS
  const toma = findElement(doc, "toma");
  const tomadorLegacy = findElement(doc, "Tomador", "TomadorServico", "DadosTomador", "tomador");
  const tomador = toma || tomadorLegacy;
  
  // NFSe Nacional: serviço is <serv> inside DPS > infDPS, description in <cServ>
  const serv = findElement(doc, "serv");
  const servicoLegacy = findElement(doc, "Servico", "DadosServico", "ListaServico", "servico");
  const servico = serv || servicoLegacy;
  
  // NFSe Nacional: DPS contains additional info
  const infDPS = findElement(doc, "infDPS");
  
  const valores = findElement(doc, "valores", "Valores", "ValoresNfse", "ValoresServico");

  // Try to get values from various XML structures
  const getVal = (el: Element | null, ...tags: string[]) => {
    for (const tag of tags) {
      const v = getTextContent(el, tag);
      if (v) return v;
    }
    // Fallback: search entire document
    for (const tag of tags) {
      const v = getTextContent(doc.documentElement, tag);
      if (v) return v;
    }
    return "";
  };

  const formatCnpj = (cnpj: string) => {
    if (!cnpj || cnpj.includes("/")) return cnpj;
    cnpj = cnpj.replace(/\D/g, "");
    if (cnpj.length === 14) return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    if (cnpj.length === 11) return cnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
    return cnpj;
  };

  const formatDate = (d: string) => {
    if (!d) return "";
    try {
      if (d.includes("T")) return new Date(d).toLocaleDateString("pt-BR");
      if (d.includes("-")) return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
      return d;
    } catch { return d; }
  };

  const formatMoney = (v: string) => {
    if (!v) return "0,00";
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Build address string
  const buildEndereco = (el: Element | null) => {
    const logradouro = getVal(el, "Logradouro", "endereco", "logradouro", "xLgr");
    const numero = getVal(el, "Numero", "numero", "nro");
    const complemento = getVal(el, "Complemento", "complemento", "xCpl");
    const bairro = getVal(el, "Bairro", "bairro", "xBairro");
    const parts = [logradouro, numero, complemento, bairro].filter(Boolean);
    return parts.join(", ");
  };

  // Helper to get value specifically from an element's scope (not fallback to doc)
  const getValScoped = (el: Element | null, ...tags: string[]) => {
    if (!el) return "";
    for (const tag of tags) {
      const v = getTextContent(el, tag);
      if (v) return v;
    }
    return "";
  };

  // For NFSe Nacional: get serie from DPS
  const serieVal = getVal(infDPS, "serie") || getVal(infNfse, "Serie", "serie");
  // For NFSe Nacional: get competencia from DPS
  const competenciaVal = getVal(infDPS, "dCompet") || getVal(infNfse, "Competencia", "competencia", "dtComp");
  // For NFSe Nacional: get data emissao from DPS or infNFSe
  const dataEmissaoVal = getVal(infNfse, "dhProc") || getVal(infDPS, "dhEmi") || getVal(infNfse, "DataEmissao", "dataEmissao", "dhEmi", "DataEmissaoNfse", "dtEmi");

  return {
    numero: getVal(infNfse, "Numero", "numero", "nNFSe", "NumeroNfse"),
    serie: serieVal,
    chaveAcesso: getVal(infNfse, "chaveAcesso", "ChaveAcesso", "CodigoVerificacao", "chNFSe"),
    codigoVerificacao: getVal(infNfse, "CodigoVerificacao", "codigoVerificacao", "cVerif"),
    dataEmissao: formatDate(dataEmissaoVal),
    competencia: formatDate(competenciaVal),
    naturezaOperacao: getVal(infNfse, "NaturezaOperacao", "naturezaOperacao", "xTribNac"),
    tipoDocumento: getVal(infNfse, "tipoDocumento", "TipoDocumento") || "NFSe",
    // Prestador (emit in NFSe Nacional)
    prestadorCnpj: formatCnpj(getValScoped(prestador, "Cnpj", "cnpj", "CNPJ", "CpfCnpj")),
    prestadorNome: getValScoped(prestador, "RazaoSocial", "razaoSocial", "xNome", "Nome", "NomeFantasia", "nome"),
    prestadorInscMunicipal: getValScoped(prestador, "InscricaoMunicipal", "inscricaoMunicipal", "IM"),
    prestadorEndereco: buildEndereco(prestador),
    prestadorMunicipio: getValScoped(prestador, "xMun", "Municipio", "CodigoMunicipio", "municipio", "cidade") || getVal(infNfse, "xLocEmi"),
    prestadorUf: getValScoped(prestador, "UF", "Uf", "uf"),
    prestadorCep: getValScoped(prestador, "Cep", "cep", "CEP"),
    // Tomador (toma in NFSe Nacional - inside DPS)
    tomadorCnpj: formatCnpj(getValScoped(tomador, "Cnpj", "cnpj", "CNPJ", "CpfCnpj")),
    tomadorNome: getValScoped(tomador, "RazaoSocial", "razaoSocial", "xNome", "Nome", "nome"),
    tomadorInscMunicipal: getValScoped(tomador, "InscricaoMunicipal", "inscricaoMunicipal", "IM"),
    tomadorEndereco: buildEndereco(tomador),
    tomadorMunicipio: getValScoped(tomador, "xMun", "Municipio", "CodigoMunicipio", "municipio") || getVal(infNfse, "xLocIncid", "xLocEmi"),
    tomadorUf: getValScoped(tomador, "UF", "Uf", "uf"),
    tomadorCep: getValScoped(tomador, "Cep", "cep", "CEP"),
    tomadorEmail: getValScoped(tomador, "Email", "email"),
    // Serviço - NFSe Nacional: description in cServ > xDescServ
    codigoServico: getVal(servico, "cTribNac", "ItemListaServico", "CodigoServico", "codigoServico", "CodigoCnae"),
    discriminacao: getVal(servico, "xDescServ", "Discriminacao", "discriminacao", "xServ", "Descricao", "descricao"),
    municipioPrestacao: getVal(servico, "cLocPrestacao", "MunicipioPrestacaoServico", "CodigoMunicipioIncidencia", "municipioPrestacao"),
    // Valores
    valorServico: formatMoney(getVal(valores, "ValorServicos", "valorServico", "vServ", "ValorServico")),
    valorDeducoes: formatMoney(getVal(valores, "ValorDeducoes", "valorDeducoes", "vDed")),
    valorPis: formatMoney(getVal(valores, "ValorPis", "valorPis", "vPIS")),
    valorCofins: formatMoney(getVal(valores, "ValorCofins", "valorCofins", "vCOFINS")),
    valorInss: formatMoney(getVal(valores, "ValorInss", "valorInss", "vINSS")),
    valorIr: formatMoney(getVal(valores, "ValorIr", "valorIr", "vIR", "vIRRF", "vRetIRRF")),
    valorCsll: formatMoney(getVal(valores, "ValorCsll", "valorCsll", "vCSLL", "vRetCSLL")),
    valorIss: formatMoney(getVal(valores, "ValorIss", "valorIss", "vISS", "ValorIssRetido")),
    aliquotaIss: formatMoney(getVal(valores, "Aliquota", "aliquota", "aliqISS", "pAliqAplic", "pAliq")),
    valorLiquido: formatMoney(getVal(valores, "ValorLiquidoNfse", "valorLiquido", "vLiq", "ValorLiquido")),
    baseCalculo: formatMoney(getVal(valores, "BaseCalculo", "baseCalculo", "vBC")),
    // Status
    status: getVal(infNfse, "situacao", "Situacao", "Status", "status") || "Ativa",
    xmlRaw: xmlString,
  };
}

function formatXml(xml: string): string {
  let formatted = "";
  let indent = "";
  const tab = "  ";
  xml.split(/>\s*</).forEach((node) => {
    if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
    formatted += indent + "<" + node + ">\n";
    if (node.match(/^<?\w[^>]*[^/]$/) && !node.startsWith("?")) indent += tab;
  });
  return formatted.substring(1, formatted.length - 2);
}

export default function VisualizarXml() {
  const [nota, setNota] = useState<NotaData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Por favor, selecione um arquivo XML");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let xmlString = e.target?.result as string;
        
        // Detect if content is base64+gzip (not starting with <?xml or <)
        const trimmed = xmlString.trim();
        if (!trimmed.startsWith("<") && !trimmed.startsWith("<?xml")) {
          // Try to decode base64+gzip
          try {
            const binaryString = atob(trimmed);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            // Check gzip magic number (1f 8b)
            if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
              // Decompress gzip using DecompressionStream API
              const ds = new DecompressionStream("gzip");
              const blob = new Blob([bytes]);
              const decompressedStream = blob.stream().pipeThrough(ds);
              const decompressedBlob = await new Response(decompressedStream).blob();
              xmlString = await decompressedBlob.text();
            } else {
              // Plain base64 (not gzipped)
              xmlString = new TextDecoder().decode(bytes);
            }
          } catch {
            toast.error("O arquivo não é um XML válido. Pode estar em formato comprimido não suportado.");
            return;
          }
        }
        
        const parsed = parseNfseXml(xmlString);
        setNota(parsed);
        toast.success("XML carregado com sucesso!");
      } catch (err) {
        toast.error("Erro ao processar o XML. Verifique se é um XML de NFSe válido.");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleExportPDF = () => {
    if (!nota) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Permita pop-ups para exportar PDF"); return; }

    printWindow.document.write(`<!DOCTYPE html><html><head><title>NFSe ${nota.numero}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 30px; font-size: 11px; color: #1a1a1a; }
        .header { text-align: center; border-bottom: 3px solid #166534; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; color: #166534; margin-bottom: 4px; }
        .header p { font-size: 12px; color: #666; }
        .section { margin-bottom: 16px; }
        .section-title { font-size: 12px; font-weight: bold; color: #166534; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 20px; }
        .field { margin-bottom: 4px; }
        .field-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.3px; }
        .field-value { font-size: 11px; font-weight: 500; }
        .valores-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .valores-table th { background: #f0fdf4; padding: 5px 8px; text-align: left; font-size: 10px; color: #166534; border: 1px solid #e5e7eb; }
        .valores-table td { padding: 5px 8px; border: 1px solid #e5e7eb; font-size: 10px; }
        .valores-table .text-right { text-align: right; }
        .total-row { background: #f0fdf4; font-weight: bold; }
        .discriminacao { background: #f9fafb; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb; font-size: 10px; line-height: 1.5; white-space: pre-wrap; }
        .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
        .status-ativa { background: #dcfce7; color: #166534; }
        .status-cancelada { background: #fee2e2; color: #991b1b; }
        .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        @media print { body { padding: 15px; } }
      </style></head><body>
      <div class="header">
        <h1>NOTA FISCAL DE SERVI\u00c7OS ELETR\u00d4NICA - NFSe</h1>
        <p>N\u00famero: <strong>${nota.numero || "-"}</strong> | S\u00e9rie: <strong>${nota.serie || "-"}</strong> | Data: <strong>${nota.dataEmissao || "-"}</strong></p>
        <p>Chave de Acesso: ${nota.chaveAcesso || "-"}</p>
      </div>

      <div class="section">
        <div class="section-title">Tomador de Servi\u00e7os</div>
        <div class="grid">
          <div class="field"><div class="field-label">CNPJ</div><div class="field-value">${nota.tomadorCnpj || "-"}</div></div>
          <div class="field"><div class="field-label">Raz\u00e3o Social</div><div class="field-value">${nota.tomadorNome || "-"}</div></div>
          <div class="field"><div class="field-label">Inscri\u00e7\u00e3o Municipal</div><div class="field-value">${nota.tomadorInscMunicipal || "-"}</div></div>
          <div class="field"><div class="field-label">Endere\u00e7o</div><div class="field-value">${nota.tomadorEndereco || "-"}</div></div>
          <div class="field"><div class="field-label">Munic\u00edpio/UF</div><div class="field-value">${nota.tomadorMunicipio || "-"} / ${nota.tomadorUf || "-"}</div></div>
          <div class="field"><div class="field-label">E-mail</div><div class="field-value">${nota.tomadorEmail || "-"}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Prestador de Servi\u00e7os</div>
        <div class="grid">
          <div class="field"><div class="field-label">CNPJ</div><div class="field-value">${nota.prestadorCnpj || "-"}</div></div>
          <div class="field"><div class="field-label">Raz\u00e3o Social</div><div class="field-value">${nota.prestadorNome || "-"}</div></div>
          <div class="field"><div class="field-label">Inscri\u00e7\u00e3o Municipal</div><div class="field-value">${nota.prestadorInscMunicipal || "-"}</div></div>
          <div class="field"><div class="field-label">Endere\u00e7o</div><div class="field-value">${nota.prestadorEndereco || "-"}</div></div>
          <div class="field"><div class="field-label">Munic\u00edpio/UF</div><div class="field-value">${nota.prestadorMunicipio || "-"} / ${nota.prestadorUf || "-"}</div></div>
          <div class="field"><div class="field-label">CEP</div><div class="field-value">${nota.prestadorCep || "-"}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Discrimina\u00e7\u00e3o do Servi\u00e7o</div>
        <div class="grid-3" style="margin-bottom: 8px;">
          <div class="field"><div class="field-label">C\u00f3digo do Servi\u00e7o</div><div class="field-value">${nota.codigoServico || "-"}</div></div>
          <div class="field"><div class="field-label">Munic\u00edpio de Presta\u00e7\u00e3o</div><div class="field-value">${nota.municipioPrestacao || "-"}</div></div>
          <div class="field"><div class="field-label">Compet\u00eancia</div><div class="field-value">${nota.competencia || "-"}</div></div>
        </div>
        <div class="discriminacao">${nota.discriminacao || "Sem descri\u00e7\u00e3o"}</div>
      </div>

      <div class="section">
        <div class="section-title">Valores</div>
        <table class="valores-table">
          <tr><th>Descri\u00e7\u00e3o</th><th class="text-right">Valor (R$)</th></tr>
          <tr><td>Valor dos Servi\u00e7os</td><td class="text-right">${nota.valorServico}</td></tr>
          <tr><td>Dedu\u00e7\u00f5es</td><td class="text-right">${nota.valorDeducoes}</td></tr>
          <tr><td>Base de C\u00e1lculo</td><td class="text-right">${nota.baseCalculo}</td></tr>
          <tr><td>PIS</td><td class="text-right">${nota.valorPis}</td></tr>
          <tr><td>COFINS</td><td class="text-right">${nota.valorCofins}</td></tr>
          <tr><td>INSS</td><td class="text-right">${nota.valorInss}</td></tr>
          <tr><td>IR</td><td class="text-right">${nota.valorIr}</td></tr>
          <tr><td>CSLL</td><td class="text-right">${nota.valorCsll}</td></tr>
          <tr><td>ISS (Al\u00edquota: ${nota.aliquotaIss}%)</td><td class="text-right">${nota.valorIss}</td></tr>
          <tr class="total-row"><td><strong>Valor L\u00edquido</strong></td><td class="text-right"><strong>${nota.valorLiquido}</strong></td></tr>
        </table>
      </div>

      <div class="footer">
        Documento gerado pelo Portal XML NFSe em ${new Date().toLocaleString("pt-BR")}
      </div>
      </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Visualizar XML</h1>
            <p className="text-muted-foreground text-sm mt-1">Faça upload de um XML de NFSe para visualizar e converter em PDF</p>
          </div>
          {nota && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF}>
                <FileDown className="h-4 w-4 mr-1.5" />Exportar PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setNota(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                <Upload className="h-4 w-4 mr-1.5" />Novo XML
              </Button>
            </div>
          )}
        </div>

        {!nota ? (
          /* Upload area */
          <Card>
            <CardContent className="p-8">
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5 dark:bg-primary/10" : "border-muted-foreground/25 hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10"
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className={`h-12 w-12 mx-auto mb-4 ${isDragging ? "text-green-500" : "text-muted-foreground/40"}`} />
                <h3 className="text-lg font-semibold mb-2">
                  {isDragging ? "Solte o arquivo aqui" : "Arraste um arquivo XML ou clique para selecionar"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">Suporta XML de NFSe (Nacional e formatos legados)</p>
                <Button variant="outline" size="sm" className="pointer-events-none">
                  <FileCode className="h-4 w-4 mr-1.5" />Selecionar arquivo XML
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Nota visualizada */
          <Tabs defaultValue="visual" className="space-y-4">
            <TabsList>
              <TabsTrigger value="visual" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Visualização</TabsTrigger>
              <TabsTrigger value="xml" className="gap-1.5"><FileCode className="h-3.5 w-3.5" />XML Original</TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-4">
              {/* Header card */}
              <Card className="border-border dark:border-white/10 bg-muted/50 dark:bg-white/5">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary dark:text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold">NFSe N° {nota.numero || "-"}</h2>
                        <p className="text-sm text-muted-foreground">Série: {nota.serie || "-"} | Emissão: {nota.dataEmissao || "-"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={nota.status.toLowerCase().includes("cancel") ? "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 dark:text-red-300" : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"}>
                        {nota.status || "Ativa"}
                      </Badge>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Valor Líquido</p>
                        <p className="text-xl font-bold text-primary dark:text-primary">R$ {nota.valorLiquido}</p>
                      </div>
                    </div>
                  </div>
                  {nota.chaveAcesso && (
                    <p className="text-xs text-muted-foreground mt-2 font-mono">Chave: {nota.chaveAcesso}</p>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Tomador */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />Tomador de Serviços
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-xs text-muted-foreground block">CNPJ</span><span className="font-mono font-medium">{nota.tomadorCnpj || "-"}</span></div>
                      <div><span className="text-xs text-muted-foreground block">Insc. Municipal</span><span className="font-mono">{nota.tomadorInscMunicipal || "-"}</span></div>
                    </div>
                    <div><span className="text-xs text-muted-foreground block">Razão Social</span><span className="font-medium">{nota.tomadorNome || "-"}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Endereço</span><span>{nota.tomadorEndereco || "-"}</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-xs text-muted-foreground block">Município/UF</span><span>{nota.tomadorMunicipio || "-"} / {nota.tomadorUf || "-"}</span></div>
                      <div><span className="text-xs text-muted-foreground block">E-mail</span><span>{nota.tomadorEmail || "-"}</span></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Prestador */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary dark:text-primary" />Prestador de Serviços
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-xs text-muted-foreground block">CNPJ</span><span className="font-mono font-medium">{nota.prestadorCnpj || "-"}</span></div>
                      <div><span className="text-xs text-muted-foreground block">Insc. Municipal</span><span className="font-mono">{nota.prestadorInscMunicipal || "-"}</span></div>
                    </div>
                    <div><span className="text-xs text-muted-foreground block">Razão Social</span><span className="font-medium">{nota.prestadorNome || "-"}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Endereço</span><span>{nota.prestadorEndereco || "-"}</span></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-xs text-muted-foreground block">Município/UF</span><span>{nota.prestadorMunicipio || "-"} / {nota.prestadorUf || "-"}</span></div>
                      <div><span className="text-xs text-muted-foreground block">CEP</span><span className="font-mono">{nota.prestadorCep || "-"}</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Serviço */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4 text-purple-600" />Discriminação do Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-3 gap-4">
                    <div><span className="text-xs text-muted-foreground block">Código do Serviço</span><span className="font-mono font-medium">{nota.codigoServico || "-"}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Município de Prestação</span><span>{nota.municipioPrestacao || "-"}</span></div>
                    <div><span className="text-xs text-muted-foreground block">Competência</span><span>{nota.competencia || "-"}</span></div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {nota.discriminacao || "Sem descrição do serviço"}
                  </div>
                </CardContent>
              </Card>

              {/* Valores */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary dark:text-primary" />Valores
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor (R$)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow><TableCell>Valor dos Serviços</TableCell><TableCell className="text-right font-medium">{nota.valorServico}</TableCell></TableRow>
                      <TableRow><TableCell>Deduções</TableCell><TableCell className="text-right">{nota.valorDeducoes}</TableCell></TableRow>
                      <TableRow><TableCell>Base de Cálculo</TableCell><TableCell className="text-right">{nota.baseCalculo}</TableCell></TableRow>
                      <TableRow><TableCell>PIS</TableCell><TableCell className="text-right">{nota.valorPis}</TableCell></TableRow>
                      <TableRow><TableCell>COFINS</TableCell><TableCell className="text-right">{nota.valorCofins}</TableCell></TableRow>
                      <TableRow><TableCell>INSS</TableCell><TableCell className="text-right">{nota.valorInss}</TableCell></TableRow>
                      <TableRow><TableCell>IR</TableCell><TableCell className="text-right">{nota.valorIr}</TableCell></TableRow>
                      <TableRow><TableCell>CSLL</TableCell><TableCell className="text-right">{nota.valorCsll}</TableCell></TableRow>
                      <TableRow><TableCell>ISS (Alíquota: {nota.aliquotaIss}%)</TableCell><TableCell className="text-right">{nota.valorIss}</TableCell></TableRow>
                      <TableRow className="bg-muted/50 dark:bg-white/5 font-bold border-t-2 border-primary/60 dark:border-primary/40">
                        <TableCell className="font-bold">Valor Líquido</TableCell>
                        <TableCell className="text-right font-bold text-primary dark:text-primary">R$ {nota.valorLiquido}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="xml">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">XML Original</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob([nota.xmlRaw], { type: "text/xml" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `NFSe_${nota.numero || "nota"}.xml`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <FileDown className="h-3.5 w-3.5 mr-1.5" />Download XML
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[70vh]">
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                      {formatXml(nota.xmlRaw)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
