import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { FileText, Search, Eye, FileCode, ChevronLeft, ChevronRight, Filter, X, Trash2, AlertTriangle, Download, Loader2, Package, Maximize2, Minimize2, Landmark } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";

function formatCurrency(value: string | number | null): string {
  if (!value) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function Notas() {
  const utils = trpc.useUtils();
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: clientesList } = trpc.cliente.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const [filters, setFilters] = useState({
    clienteId: "all",
    status: "all",
    direcao: "all",
    ibsCbs: "all",
    busca: "",
    dataInicio: "",
    dataFim: "",
  });
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [showIbsCbs, setShowIbsCbs] = useState(false);

  const queryFilters = useMemo(() => ({
    contabilidadeId: contabId,
    clienteId: filters.clienteId !== "all" ? parseInt(filters.clienteId) : undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    direcao: filters.direcao !== "all" ? filters.direcao : undefined,
    ibsCbs: filters.ibsCbs !== "all" ? filters.ibsCbs : undefined,
    busca: filters.busca || undefined,
    dataInicio: filters.dataInicio ? new Date(filters.dataInicio) : undefined,
    dataFim: filters.dataFim ? new Date(filters.dataFim + "T23:59:59") : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [contabId, filters, page]);

  const { data, isLoading } = trpc.nota.list.useQuery(queryFilters, { enabled: !!contabId });

  // XML Dialog
  const [xmlDialogOpen, setXmlDialogOpen] = useState(false);
  const [selectedChave, setSelectedChave] = useState("");
  const { data: xmlData } = trpc.nota.getXml.useQuery(
    { chaveAcesso: selectedChave },
    { enabled: !!selectedChave && xmlDialogOpen }
  );

  // PDF Dialog (DANFSe - prioriza PDF oficial do S3, fallback para geração local)
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  const [pdfChave, setPdfChave] = useState("");
  const [pdfNotaData, setPdfNotaData] = useState<any>(null);
  
  // Verificar se a nota tem PDF oficial do S3
  const selectedNotaForPdf = useMemo(() => {
    if (!data?.notas || !pdfChave) return null;
    return data.notas.find(n => n.chaveAcesso === pdfChave) || null;
  }, [data, pdfChave]);
  
  const hasDanfsePdf = !!selectedNotaForPdf?.danfsePdfUrl;
  
  // Só buscar XML se não tiver PDF oficial
  const { data: pdfXmlData } = trpc.nota.getXml.useQuery(
    { chaveAcesso: pdfChave },
    { enabled: !!pdfChave && pdfDialogOpen && !hasDanfsePdf }
  );

  // Parse XML para dados da nota quando o XML é carregado
  const parsedDanfse = useMemo(() => {
    if (!pdfXmlData?.xml) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(pdfXmlData.xml, "text/xml");
      const getText = (el: Element | Document, ...tags: string[]) => {
        for (const tag of tags) {
          const found = el.getElementsByTagName(tag);
          if (found.length > 0 && found[0].textContent?.trim()) return found[0].textContent.trim();
          for (const prefix of ["ns2:", "ns3:", "nfse:", "tc:", ""]) {
            const found2 = el.getElementsByTagName(prefix + tag);
            if (found2.length > 0 && found2[0].textContent?.trim()) return found2[0].textContent.trim();
          }
        }
        return "";
      };
      const fmtCnpj = (c: string) => {
        if (!c || c.includes("/")) return c;
        c = c.replace(/\D/g, "");
        if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return c;
      };
      const fmtDate = (d: string) => {
        if (!d) return "";
        try { return d.includes("T") ? new Date(d).toLocaleDateString("pt-BR") : d.includes("-") ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : d; } catch { return d; }
      };
      const fmtMoney = (v: string) => {
        if (!v) return "0,00";
        const n = parseFloat(v); return isNaN(n) ? v : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      const root = doc.documentElement;
      return {
        numero: getText(root, "Numero", "numero", "nNFSe", "NumeroNfse"),
        serie: getText(root, "Serie", "serie"),
        chaveAcesso: pdfChave,
        codigoVerificacao: getText(root, "CodigoVerificacao", "codigoVerificacao", "cVerif"),
        dataEmissao: fmtDate(getText(root, "DataEmissao", "dataEmissao", "dhEmi", "DataEmissaoNfse", "dtEmi")),
        competencia: fmtDate(getText(root, "Competencia", "competencia", "dtComp")),
        naturezaOperacao: getText(root, "NaturezaOperacao", "naturezaOperacao"),
        prestadorCnpj: fmtCnpj(getText(root, "Cnpj", "cnpj", "CNPJ")),
        prestadorNome: getText(root, "RazaoSocial", "razaoSocial", "xNome", "Nome", "NomeFantasia", "nome"),
        prestadorIM: getText(root, "InscricaoMunicipal", "inscricaoMunicipal", "IM"),
        prestadorEndereco: [getText(root, "Logradouro", "endereco", "logradouro"), getText(root, "Numero", "numero", "nro"), getText(root, "Bairro", "bairro")].filter(Boolean).join(", "),
        prestadorMunicipio: getText(root, "xMun", "Municipio", "CodigoMunicipio", "municipio", "xLocEmi"),
        prestadorUf: getText(root, "UF", "Uf", "uf"),
        tomadorCnpj: "",
        tomadorNome: "",
        tomadorEndereco: "",
        tomadorMunicipio: "",
        tomadorUf: "",
        tomadorEmail: "",
        codigoServico: getText(root, "CodigoTributacaoMunicipio", "codigoServico", "ItemListaServico", "itemListaServico"),
        discriminacao: getText(root, "Discriminacao", "discriminacao", "xServ", "Descricao"),
        valorServico: fmtMoney(getText(root, "ValorServicos", "valorServico", "vServ", "ValorLiquidoNfse")),
        valorDeducoes: fmtMoney(getText(root, "ValorDeducoes", "valorDeducoes")),
        valorPis: fmtMoney(getText(root, "ValorPis", "valorPis", "vPIS")),
        valorCofins: fmtMoney(getText(root, "ValorCofins", "valorCofins", "vCOFINS")),
        valorInss: fmtMoney(getText(root, "ValorInss", "valorInss", "vINSS")),
        valorIr: fmtMoney(getText(root, "ValorIr", "valorIr", "vIR", "vIRRF", "vRetIRRF")),
        valorCsll: fmtMoney(getText(root, "ValorCsll", "valorCsll", "vCSLL", "vRetCSLL")),
        valorIss: fmtMoney(getText(root, "ValorIss", "valorIss", "vISS", "ValorISSQN")),
        aliquotaIss: getText(root, "Aliquota", "aliquota", "AliquotaISS", "pAliqAplic", "pAliq"),
        valorLiquido: fmtMoney(getText(root, "ValorLiquidoNfse", "valorLiquido", "vLiq")),
        municipioPrestacao: getText(root, "MunicipioPrestacaoServico", "municipioPrestacao", "CodigoMunicipioGerador"),
        status: getText(root, "situacao", "Situacao", "Status", "status") || "Ativa",
      };
    } catch { return null; }
  }, [pdfXmlData, pdfChave]);

  // Buscar dados do tomador separadamente (pode estar em sub-elementos)
  const parsedDanfseComplete = useMemo(() => {
    if (!parsedDanfse || !pdfXmlData?.xml) return parsedDanfse;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(pdfXmlData.xml, "text/xml");
      const getText = (el: Element | Document, ...tags: string[]) => {
        for (const tag of tags) {
          const found = el.getElementsByTagName(tag);
          if (found.length > 0 && found[0].textContent?.trim()) return found[0].textContent.trim();
        }
        return "";
      };
      const fmtCnpj = (c: string) => {
        if (!c || c.includes("/")) return c;
        c = c.replace(/\D/g, "");
        if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
        if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
        return c;
      };
      // Find tomador element specifically
      const tomadorEl = doc.getElementsByTagName("tomador")[0] || doc.getElementsByTagName("Tomador")[0] || doc.getElementsByTagName("TomadorServico")[0] || doc.getElementsByTagName("DadosTomador")[0];
      if (tomadorEl) {
        return {
          ...parsedDanfse,
          tomadorCnpj: fmtCnpj(getText(tomadorEl, "Cnpj", "cnpj", "CNPJ", "CpfCnpj")),
          tomadorNome: getText(tomadorEl, "RazaoSocial", "razaoSocial", "xNome", "Nome", "nome"),
          tomadorEndereco: [getText(tomadorEl, "Logradouro", "endereco"), getText(tomadorEl, "Numero", "numero"), getText(tomadorEl, "Bairro", "bairro")].filter(Boolean).join(", "),
          tomadorMunicipio: getText(tomadorEl, "xMun", "Municipio", "municipio") || getText(doc.documentElement, "xLocIncid", "xLocEmi"),
          tomadorUf: getText(tomadorEl, "UF", "Uf", "uf"),
          tomadorEmail: getText(tomadorEl, "Email", "email"),
        };
      }
      return parsedDanfse;
    } catch { return parsedDanfse; }
  }, [parsedDanfse, pdfXmlData]);

  // Usar selectedNotaForPdf como selectedNotaRow (mesma lógica)
  const selectedNotaRow = selectedNotaForPdf;

  const generateDanfsePdf = useCallback(() => {
    const d = parsedDanfseComplete;
    const nota = selectedNotaRow;
    if (!d && !nota) return;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para gerar o PDF"); return; }
    
    const numero = d?.numero || nota?.numeroNota || "-";
    const dataEmissao = d?.dataEmissao || (nota?.dataEmissao ? formatDate(nota.dataEmissao) : "-");
    const competencia = d?.competencia || dataEmissao;
    const prestadorNome = d?.prestadorNome || nota?.emitenteNome || "-";
    const prestadorCnpj = d?.prestadorCnpj || nota?.emitenteCnpj || "-";
    const tomadorNome = d?.tomadorNome || nota?.tomadorNome || "-";
    const tomadorCnpj = d?.tomadorCnpj || nota?.tomadorCnpj || "-";
    const valorServico = d?.valorServico || (nota?.valorServico ? formatCurrency(nota.valorServico) : "-");
    const valorLiquido = d?.valorLiquido || valorServico;
    const discriminacao = d?.discriminacao || nota?.descricaoServico || "-";
    const codigoServico = d?.codigoServico || nota?.codigoServico || "-";
    const municipio = d?.municipioPrestacao || nota?.municipioPrestacao || "-";
    const uf = d?.prestadorUf || nota?.ufPrestacao || "-";
    const chave = pdfChave;
    const status = d?.status || nota?.status || "Ativa";
    
    w.document.write(`<!DOCTYPE html><html><head><title>DANFSe ${numero}</title>
<style>
  @media print { @page { margin: 15mm; size: A4; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; font-size: 10px; color: #1a1a1a; background: #fff; }
  .danfse { max-width: 800px; margin: 0 auto; border: 2px solid #166534; }
  .header { background: #166534; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
  .header .subtitle { font-size: 10px; opacity: 0.9; }
  .header .numero-box { text-align: right; }
  .header .numero-box .label { font-size: 9px; opacity: 0.8; }
  .header .numero-box .value { font-size: 20px; font-weight: 700; }
  .section { border-bottom: 1px solid #e5e7eb; padding: 10px 20px; }
  .section:last-child { border-bottom: none; }
  .section-title { font-size: 10px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #dcfce7; }
  .row { display: flex; gap: 15px; margin-bottom: 6px; }
  .field { flex: 1; }
  .field.w2 { flex: 2; }
  .field.w3 { flex: 3; }
  .field-label { font-size: 8px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
  .field-value { font-size: 10px; font-weight: 500; min-height: 14px; }
  .field-value.mono { font-family: 'Courier New', monospace; font-size: 9px; }
  .field-value.large { font-size: 12px; font-weight: 700; }
  .field-value.money { font-size: 11px; font-weight: 700; color: #166534; }
  .discriminacao { background: #f9fafb; padding: 8px 12px; border-radius: 4px; font-size: 9px; line-height: 1.5; white-space: pre-wrap; min-height: 40px; border: 1px solid #e5e7eb; }
  .valores-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .valor-box { background: #f9fafb; padding: 6px 10px; border-radius: 4px; text-align: center; border: 1px solid #e5e7eb; }
  .valor-box .label { font-size: 7px; color: #6b7280; text-transform: uppercase; }
  .valor-box .value { font-size: 10px; font-weight: 600; margin-top: 2px; }
  .total-box { background: #dcfce7; border: 2px solid #166534; padding: 10px 15px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }
  .total-box .label { font-size: 11px; font-weight: 700; color: #166534; }
  .total-box .value { font-size: 18px; font-weight: 700; color: #166534; }
  .footer { background: #f9fafb; padding: 10px 20px; text-align: center; font-size: 8px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .status-ativa { background: #dcfce7; color: #166534; }
  .status-cancelada { background: #fee2e2; color: #991b1b; }
  .chave { font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 1px; word-break: break-all; background: #f3f4f6; padding: 6px 10px; border-radius: 4px; text-align: center; margin-top: 6px; }
</style></head><body>
<div class="danfse">
  <div class="header">
    <div>
      <h1>DANFSe</h1>
      <div class="subtitle">Documento Auxiliar da Nota Fiscal de Servi\u00e7o Eletr\u00f4nica</div>
    </div>
    <div class="numero-box">
      <div class="label">N\u00famero da Nota</div>
      <div class="value">${numero}</div>
    </div>
  </div>
  
  <div class="section">
    <div class="row">
      <div class="field w2"><div class="field-label">Data de Emiss\u00e3o</div><div class="field-value">${dataEmissao}</div></div>
      <div class="field w2"><div class="field-label">Compet\u00eancia</div><div class="field-value">${competencia}</div></div>
      <div class="field"><div class="field-label">Status</div><div class="field-value"><span class="status-badge ${status.toLowerCase().includes('cancel') ? 'status-cancelada' : 'status-ativa'}">${status}</span></div></div>
    </div>
    <div class="chave">Chave de Acesso: ${chave}</div>
  </div>

  <div class="section">
    <div class="section-title">Prestador de Servi\u00e7os</div>
    <div class="row">
      <div class="field w3"><div class="field-label">Raz\u00e3o Social</div><div class="field-value large">${prestadorNome}</div></div>
      <div class="field w2"><div class="field-label">CNPJ</div><div class="field-value mono">${prestadorCnpj}</div></div>
    </div>
    <div class="row">
      <div class="field w2"><div class="field-label">Inscri\u00e7\u00e3o Municipal</div><div class="field-value">${d?.prestadorIM || "-"}</div></div>
      <div class="field w3"><div class="field-label">Endere\u00e7o</div><div class="field-value">${d?.prestadorEndereco || "-"}</div></div>
    </div>
    <div class="row">
      <div class="field w2"><div class="field-label">Munic\u00edpio</div><div class="field-value">${d?.prestadorMunicipio || municipio}</div></div>
      <div class="field"><div class="field-label">UF</div><div class="field-value">${uf}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Tomador de Servi\u00e7os</div>
    <div class="row">
      <div class="field w3"><div class="field-label">Raz\u00e3o Social</div><div class="field-value large">${tomadorNome}</div></div>
      <div class="field w2"><div class="field-label">CNPJ/CPF</div><div class="field-value mono">${tomadorCnpj}</div></div>
    </div>
    <div class="row">
      <div class="field w3"><div class="field-label">Endere\u00e7o</div><div class="field-value">${d?.tomadorEndereco || "-"}</div></div>
      <div class="field w2"><div class="field-label">Munic\u00edpio</div><div class="field-value">${d?.tomadorMunicipio || "-"}</div></div>
      <div class="field"><div class="field-label">UF</div><div class="field-value">${d?.tomadorUf || "-"}</div></div>
    </div>
    ${d?.tomadorEmail ? `<div class="row"><div class="field"><div class="field-label">E-mail</div><div class="field-value">${d.tomadorEmail}</div></div></div>` : ""}
  </div>

  <div class="section">
    <div class="section-title">Servi\u00e7o Prestado</div>
    <div class="row">
      <div class="field"><div class="field-label">C\u00f3digo do Servi\u00e7o</div><div class="field-value">${codigoServico}</div></div>
      <div class="field w2"><div class="field-label">Munic\u00edpio de Presta\u00e7\u00e3o</div><div class="field-value">${municipio}</div></div>
      <div class="field"><div class="field-label">Natureza da Opera\u00e7\u00e3o</div><div class="field-value">${d?.naturezaOperacao || "-"}</div></div>
    </div>
    <div style="margin-top: 6px;">
      <div class="field-label">Discrimina\u00e7\u00e3o dos Servi\u00e7os</div>
      <div class="discriminacao">${discriminacao}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Valores e Tributos</div>
    <div class="valores-grid">
      <div class="valor-box"><div class="label">Valor dos Servi\u00e7os</div><div class="value">R$ ${valorServico}</div></div>
      <div class="valor-box"><div class="label">Dedu\u00e7\u00f5es</div><div class="value">R$ ${d?.valorDeducoes || "0,00"}</div></div>
      <div class="valor-box"><div class="label">PIS</div><div class="value">R$ ${d?.valorPis || "0,00"}</div></div>
      <div class="valor-box"><div class="label">COFINS</div><div class="value">R$ ${d?.valorCofins || "0,00"}</div></div>
      <div class="valor-box"><div class="label">INSS</div><div class="value">R$ ${d?.valorInss || "0,00"}</div></div>
      <div class="valor-box"><div class="label">IR</div><div class="value">R$ ${d?.valorIr || "0,00"}</div></div>
      <div class="valor-box"><div class="label">CSLL</div><div class="value">R$ ${d?.valorCsll || "0,00"}</div></div>
      <div class="valor-box"><div class="label">ISS${d?.aliquotaIss ? " (" + d.aliquotaIss + "%)" : ""}</div><div class="value">R$ ${d?.valorIss || "0,00"}</div></div>
    </div>
    <div class="total-box">
      <div class="label">VALOR L\u00cdQUIDO DA NOTA</div>
      <div class="value">R$ ${valorLiquido}</div>
    </div>
  </div>

  <div class="footer">
    Documento gerado pelo Portal XML NFSe &bull; ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}
  </div>
</div>
<script>setTimeout(() => window.print(), 500);</script>
</body></html>`);
    w.document.close();
  }, [parsedDanfseComplete, selectedNotaRow, pdfChave]);

  // Delete dialogs
  const [deleteClienteDialogOpen, setDeleteClienteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);

  const deleteByCliente = trpc.nota.deleteByCliente.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} nota(s) excluída(s) com sucesso`);
      utils.nota.list.invalidate();
      setDeleteClienteDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAll = trpc.nota.deleteAll.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted} nota(s) excluída(s) com sucesso`);
      utils.nota.list.invalidate();
      setDeleteAllDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Download XML em lote
  const [downloadingXml, setDownloadingXml] = useState(false);

  const handleDownloadXmls = async (tipo: "xml" | "pdf" | "ambos", porCliente: boolean) => {
    if (!data?.notas?.length) { toast.error("Nenhuma nota para baixar"); return; }
    setDownloadingXml(true);
    try {
      // Fetch decoded XMLs from backend (decodes base64+gzip to raw XML)
      const decodedNotas = await utils.nota.getXmlBatch.fetch({
        contabilidadeId: contabId,
        clienteId: filters.clienteId !== "all" ? parseInt(filters.clienteId) : undefined,
        status: filters.status !== "all" ? filters.status : undefined,
        direcao: filters.direcao !== "all" ? (filters.direcao as "emitida" | "recebida") : undefined,
        dataInicio: filters.dataInicio ? new Date(filters.dataInicio) : undefined,
        dataFim: filters.dataFim ? new Date(filters.dataFim) : undefined,
      });
      if (!decodedNotas?.length) { toast.error("Nenhuma nota encontrada"); setDownloadingXml(false); return; }

      // Build client name map
      const clienteMap = new Map<number, string>();
      clientesList?.forEach(c => clienteMap.set(c.id, c.razaoSocial.replace(/[/\\?%*:|"<>]/g, "_").substring(0, 50)));

      // Build file structure with decoded XML
      const files: { path: string; content: string; type: string }[] = [];

      for (const nota of decodedNotas) {
        const clienteNome = clienteMap.get(nota.clienteId) || `Cliente_${nota.clienteId}`;
        const nomeBase = nota.chaveAcesso || `NF_${nota.numeroNota || nota.id}_${nota.emitenteCnpj || ""}`;
        const prefix = porCliente ? `${clienteNome}/` : "";

        if ((tipo === "xml" || tipo === "ambos") && nota.xml) {
          files.push({
            path: `${prefix}${nomeBase}.xml`,
            content: nota.xml,
            type: "xml",
          });
        }
      }

      if (files.length === 0) {
        toast.error("Nenhum arquivo XML disponível para download");
        setDownloadingXml(false);
        return;
      }

      // Create ZIP
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const file of files) {
        zip.file(file.path, file.content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const tipoLabel = tipo === "xml" ? "XMLs" : tipo === "pdf" ? "PDFs" : "XMLs_PDFs";
      a.download = `${tipoLabel}_NFSe_${new Date().toISOString().split("T")[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${files.length} arquivo(s) baixado(s) com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao gerar download: " + (err.message || "Erro desconhecido"));
    } finally {
      setDownloadingXml(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const clearFilters = () => {
    setFilters({ clienteId: "all", status: "all", direcao: "all", ibsCbs: "all", busca: "", dataInicio: "", dataFim: "" });
    setPage(0);
  };

  const hasFilters = filters.clienteId !== "all" || filters.status !== "all" || filters.direcao !== "all" || filters.ibsCbs !== "all" || filters.busca || filters.dataInicio || filters.dataFim;

  const selectedClienteName = filters.clienteId !== "all"
    ? clientesList?.find(c => String(c.id) === filters.clienteId)?.razaoSocial || "Cliente"
    : "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notas Fiscais</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data ? `${data.total} nota(s) encontrada(s)` : "Consulte as NFSe dos seus clientes"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {contabilidades && contabilidades.length > 1 && (
              <Select value={selectedContab || String(contabilidades[0]?.id ?? "")} onValueChange={(v) => { setSelectedContab(v); setPage(0); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Contabilidade" />
                </SelectTrigger>
                <SelectContent>
                  {contabilidades.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* Download buttons */}
            <div className="flex items-center gap-1 border rounded-md p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleDownloadXmls("xml", true)}
                disabled={downloadingXml || !data?.notas?.length}
                title="Download XMLs separados por pasta do cliente"
              >
                {downloadingXml ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                XMLs por Cliente
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleDownloadXmls("xml", false)}
                disabled={downloadingXml || !data?.notas?.length}
                title="Download todos XMLs em uma pasta"
              >
                <Package className="h-3.5 w-3.5" />
                Todos XMLs
              </Button>
            </div>
            <Button
              variant={showIbsCbs ? "default" : "outline"}
              size="sm"
              className={showIbsCbs ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-600 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:bg-emerald-500/10"}
              onClick={() => setShowIbsCbs(!showIbsCbs)}
            >
              <Landmark className="h-4 w-4 mr-1" />
              IBS/CBS
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 dark:border-red-800 hover:bg-red-50 dark:bg-red-500/10"
              onClick={() => setDeleteAllDialogOpen(true)}
              disabled={!contabId}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Apagar Todas
            </Button>
            {filters.clienteId !== "all" && (
              <Button
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:bg-orange-500/10"
                onClick={() => setDeleteClienteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Apagar do Cliente
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros</span>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs">
                  <X className="h-3 w-3 mr-1" />Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <Select value={filters.clienteId} onValueChange={(v) => { setFilters({ ...filters, clienteId: v }); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Clientes</SelectItem>
                  {clientesList?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.razaoSocial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.direcao} onValueChange={(v) => { setFilters({ ...filters, direcao: v }); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="emitida">Emitidas</SelectItem>
                  <SelectItem value="recebida">Recebidas</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filters.status} onValueChange={(v) => { setFilters({ ...filters, status: v }); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="valida">Válidas</SelectItem>
                  <SelectItem value="cancelada">Canceladas</SelectItem>
                  <SelectItem value="substituida">Substituídas</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                className="h-9 text-sm"
                value={filters.dataInicio}
                onChange={(e) => { setFilters({ ...filters, dataInicio: e.target.value }); setPage(0); }}
                placeholder="Data início"
              />
              <Input
                type="date"
                className="h-9 text-sm"
                value={filters.dataFim}
                onChange={(e) => { setFilters({ ...filters, dataFim: e.target.value }); setPage(0); }}
                placeholder="Data fim"
              />

              <Select value={filters.ibsCbs} onValueChange={(v) => { setFilters({ ...filters, ibsCbs: v }); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="IBS/CBS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="comIbsCbs">Com IBS/CBS</SelectItem>
                  <SelectItem value="comIbs">Com IBS</SelectItem>
                  <SelectItem value="comCbs">Com CBS</SelectItem>
                  <SelectItem value="semIbsCbs">Sem IBS/CBS</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative col-span-2 md:col-span-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="h-9 text-sm pl-8"
                  placeholder="Empresa, CNPJ, cidade, UF, nº nota, valor..."
                  value={filters.busca}
                  onChange={(e) => { setFilters({ ...filters, busca: e.target.value }); setPage(0); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Número</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>Tomador</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>Status</TableHead>
                    {showIbsCbs && (
                      <>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">IBS/CBS</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">Base Cálc.</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">IBS UF</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">IBS Mun</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">CBS</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">Total Trib.</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">PIS</TableHead>
                        <TableHead className="text-emerald-600 dark:text-emerald-400">COFINS</TableHead>
                      </>
                    )}
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={showIbsCbs ? 16 : 8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                    </TableRow>
                  ) : !data || data.notas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showIbsCbs ? 16 : 8} className="text-center py-12">
                        <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                        <p className="font-medium">Nenhuma nota encontrada</p>
                        <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou faça download de notas.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.notas.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-mono text-sm">{n.numeroNota || "-"}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[200px]">{n.emitenteNome || "-"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{n.emitenteCnpj || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium truncate max-w-[200px]">{n.tomadorNome || "-"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{n.tomadorCnpj || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(n.valorServico)}</TableCell>
                        <TableCell className="text-sm">{formatDate(n.dataEmissao)}</TableCell>
                        <TableCell>
                          <Badge variant={n.direcao === "emitida" ? "default" : "secondary"} className={n.direcao === "emitida" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-500/30" : "bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-500/30"}>
                            {n.direcao === "emitida" ? "Emitida" : "Recebida"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={n.status === "valida" ? "default" : n.status === "cancelada" ? "destructive" : "secondary"}
                            className={n.status === "valida" ? "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300 hover:bg-green-100" : ""}
                          >
                            {n.status === "valida" ? "Válida" : n.status === "cancelada" ? "Cancelada" : "Substituída"}
                          </Badge>
                        </TableCell>
                        {showIbsCbs && (
                          <>
                            <TableCell>
                              {(n as any).temIbsCbs ? (
                                <Badge className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs">Sim</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm font-mono">{(n as any).vBcIbsCbs ? formatCurrency((n as any).vBcIbsCbs) : "-"}</TableCell>
                            <TableCell className="text-sm font-mono">{(n as any).vIbsUf ? formatCurrency((n as any).vIbsUf) : "-"}</TableCell>
                            <TableCell className="text-sm font-mono">{(n as any).vIbsMun ? formatCurrency((n as any).vIbsMun) : "-"}</TableCell>
                            <TableCell className="text-sm font-mono">{(n as any).vCbs ? formatCurrency((n as any).vCbs) : "-"}</TableCell>
                            <TableCell className="text-sm font-mono font-bold">{(n as any).vTotTribIbsCbs ? formatCurrency((n as any).vTotTribIbsCbs) : "-"}</TableCell>
                            <TableCell className="text-sm font-mono">{(n as any).vPis ? formatCurrency((n as any).vPis) : "-"}</TableCell>
                            <TableCell className="text-sm font-mono">{(n as any).vCofins ? formatCurrency((n as any).vCofins) : "-"}</TableCell>
                          </>
                        )}
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:bg-red-500/10"
                              onClick={() => { setPdfChave(n.chaveAcesso); setPdfDialogOpen(true); }}
                              title="Ver PDF (DANFSe)"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => { setSelectedChave(n.chaveAcesso); setXmlDialogOpen(true); }}
                              title="Ver XML"
                            >
                              <FileCode className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Mostrando {page * PAGE_SIZE + 1} a {Math.min((page + 1) * PAGE_SIZE, data.total)} de {data.total}
                </p>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PDF Dialog (DANFSe - prioriza PDF oficial, fallback local) */}
        <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
          <DialogContent className={pdfFullscreen ? "max-w-[98vw] w-[98vw] max-h-[98vh] h-[98vh]" : "max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh]"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-red-600" />
                DANFSe - Documento Auxiliar da NFSe
                {hasDanfsePdf && (
                  <Badge className="bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 text-[10px] ml-2">PDF Oficial</Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto h-7 w-7"
                  onClick={() => setPdfFullscreen(!pdfFullscreen)}
                  title={pdfFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                >
                  {pdfFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </DialogTitle>
              <DialogDescription>
                Chave de acesso: {pdfChave}
              </DialogDescription>
            </DialogHeader>
            <div className={`overflow-auto ${pdfFullscreen ? "max-h-[80vh]" : "max-h-[70vh]"}`}>
              {/* Se tem PDF oficial do S3, mostrar em iframe */}
              {hasDanfsePdf ? (
                <iframe
                  src={selectedNotaForPdf!.danfsePdfUrl!}
                  className={`w-full border rounded-lg ${pdfFullscreen ? "h-[78vh]" : "h-[68vh]"}`}
                  title="DANFSe PDF"
                />
              ) : (
              (parsedDanfseComplete || selectedNotaRow) ? (
                <div className="border rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="bg-emerald-800 text-white p-4 flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-bold tracking-wide">DANFSe</h3>
                      <p className="text-xs opacity-80">Documento Auxiliar da Nota Fiscal de Servi\u00e7o Eletr\u00f4nica</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs opacity-80">N\u00famero da Nota</p>
                      <p className="text-2xl font-bold">{parsedDanfseComplete?.numero || selectedNotaRow?.numeroNota || "-"}</p>
                    </div>
                  </div>

                  {/* Info b\u00e1sica */}
                  <div className="p-4 border-b bg-gray-50 dark:bg-gray-800/50">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Data de Emiss\u00e3o</p>
                        <p className="text-sm font-medium">{parsedDanfseComplete?.dataEmissao || (selectedNotaRow?.dataEmissao ? formatDate(selectedNotaRow.dataEmissao) : "-")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Compet\u00eancia</p>
                        <p className="text-sm font-medium">{parsedDanfseComplete?.competencia || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Status</p>
                        <Badge className={`${(parsedDanfseComplete?.status || selectedNotaRow?.status || "").toLowerCase().includes("cancel") ? "bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 dark:text-red-300" : "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300"}`}>
                          {parsedDanfseComplete?.status || selectedNotaRow?.status || "Ativa"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-2 bg-gray-100 rounded px-3 py-1.5 text-center">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500">Chave de Acesso</p>
                      <p className="font-mono text-xs tracking-wider">{pdfChave}</p>
                    </div>
                  </div>

                  {/* Prestador */}
                  <div className="p-4 border-b">
                    <p className="text-xs font-bold text-emerald-800 uppercase mb-2 pb-1 border-b border-emerald-100">Prestador de Servi\u00e7os</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Raz\u00e3o Social</p>
                        <p className="text-sm font-semibold">{parsedDanfseComplete?.prestadorNome || selectedNotaRow?.emitenteNome || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">CNPJ</p>
                        <p className="text-sm font-mono">{parsedDanfseComplete?.prestadorCnpj || selectedNotaRow?.emitenteCnpj || "-"}</p>
                      </div>
                    </div>
                    {parsedDanfseComplete?.prestadorEndereco && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Endere\u00e7o</p>
                        <p className="text-xs">{parsedDanfseComplete.prestadorEndereco} - {parsedDanfseComplete.prestadorMunicipio || "-"}/{parsedDanfseComplete.prestadorUf || "-"}</p>
                      </div>
                    )}
                  </div>

                  {/* Tomador */}
                  <div className="p-4 border-b">
                    <p className="text-xs font-bold text-emerald-800 uppercase mb-2 pb-1 border-b border-emerald-100">Tomador de Servi\u00e7os</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Raz\u00e3o Social</p>
                        <p className="text-sm font-semibold">{parsedDanfseComplete?.tomadorNome || selectedNotaRow?.tomadorNome || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">CNPJ/CPF</p>
                        <p className="text-sm font-mono">{parsedDanfseComplete?.tomadorCnpj || selectedNotaRow?.tomadorCnpj || "-"}</p>
                      </div>
                    </div>
                    {parsedDanfseComplete?.tomadorEndereco && (
                      <div className="mt-2">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Endere\u00e7o</p>
                        <p className="text-xs">{parsedDanfseComplete.tomadorEndereco} - {parsedDanfseComplete.tomadorMunicipio || "-"}/{parsedDanfseComplete.tomadorUf || "-"}</p>
                      </div>
                    )}
                  </div>

                  {/* Servi\u00e7o */}
                  <div className="p-4 border-b">
                    <p className="text-xs font-bold text-emerald-800 uppercase mb-2 pb-1 border-b border-emerald-100">Servi\u00e7o Prestado</p>
                    <div className="grid grid-cols-3 gap-3 mb-2">
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">C\u00f3digo do Servi\u00e7o</p>
                        <p className="text-sm">{parsedDanfseComplete?.codigoServico || selectedNotaRow?.codigoServico || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Munic\u00edpio de Presta\u00e7\u00e3o</p>
                        <p className="text-sm">{parsedDanfseComplete?.municipioPrestacao || selectedNotaRow?.municipioPrestacao || "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Natureza da Opera\u00e7\u00e3o</p>
                        <p className="text-sm">{parsedDanfseComplete?.naturezaOperacao || "-"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">Discrimina\u00e7\u00e3o dos Servi\u00e7os</p>
                      <div className="bg-gray-50 dark:bg-gray-800/50 border rounded p-2 mt-1 text-xs leading-relaxed whitespace-pre-wrap">
                        {parsedDanfseComplete?.discriminacao || selectedNotaRow?.descricaoServico || "-"}
                      </div>
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="p-4">
                    <p className="text-xs font-bold text-emerald-800 uppercase mb-2 pb-1 border-b border-emerald-100">Valores e Tributos</p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: "Valor dos Servi\u00e7os", value: parsedDanfseComplete?.valorServico || (selectedNotaRow?.valorServico ? formatCurrency(selectedNotaRow.valorServico) : "-") },
                        { label: "Dedu\u00e7\u00f5es", value: parsedDanfseComplete?.valorDeducoes || "0,00" },
                        { label: "PIS", value: parsedDanfseComplete?.valorPis || "0,00" },
                        { label: "COFINS", value: parsedDanfseComplete?.valorCofins || "0,00" },
                        { label: "INSS", value: parsedDanfseComplete?.valorInss || "0,00" },
                        { label: "IR", value: parsedDanfseComplete?.valorIr || "0,00" },
                        { label: "CSLL", value: parsedDanfseComplete?.valorCsll || "0,00" },
                        { label: `ISS${parsedDanfseComplete?.aliquotaIss ? " (" + parsedDanfseComplete.aliquotaIss + "%)" : ""}`, value: parsedDanfseComplete?.valorIss || "0,00" },
                      ].map((v, i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-800/50 border rounded p-2 text-center">
                          <p className="text-[9px] text-gray-500 dark:text-gray-400 dark:text-gray-500 uppercase">{v.label}</p>
                          <p className="text-xs font-semibold mt-0.5">R$ {v.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border-2 border-emerald-700 dark:border-emerald-500/30 rounded-lg p-3 flex justify-between items-center">
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">VALOR LÍQUIDO DA NOTA</span>
                      <span className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                        R$ {parsedDanfseComplete?.valorLiquido || (selectedNotaRow?.valorLiquido ? formatCurrency(selectedNotaRow.valorLiquido) : parsedDanfseComplete?.valorServico || "-")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[40vh] bg-muted rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3 animate-spin" />
                    <p className="text-muted-foreground">Carregando dados da nota...</p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPdfDialogOpen(false)}>Fechar</Button>
              {hasDanfsePdf ? (
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = selectedNotaForPdf!.danfsePdfUrl!;
                    a.download = `DANFSe_${selectedNotaForPdf?.numeroNota || pdfChave}.pdf`;
                    a.target = "_blank";
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF Oficial
                </Button>
              ) : (
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={generateDanfsePdf}
                  disabled={!parsedDanfseComplete && !selectedNotaRow}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar PDF
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* XML Dialog */}
        <Dialog open={xmlDialogOpen} onOpenChange={setXmlDialogOpen}>
          <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                XML da Nota Fiscal
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-auto max-h-[60vh] bg-muted rounded-lg p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {xmlData?.xml || "Carregando..."}
              </pre>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete by Cliente AlertDialog */}
        <AlertDialog open={deleteClienteDialogOpen} onOpenChange={setDeleteClienteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Apagar notas do cliente
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja apagar <strong>todas as notas</strong> do cliente <strong>{selectedClienteName}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (filters.clienteId !== "all" && contabId) {
                    deleteByCliente.mutate({ clienteId: parseInt(filters.clienteId), contabilidadeId: contabId });
                  }
                }}
                disabled={deleteByCliente.isPending}
              >
                {deleteByCliente.isPending ? "Apagando..." : "Sim, apagar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All AlertDialog */}
        <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Apagar TODAS as notas
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja apagar <strong>TODAS as notas de TODOS os clientes</strong> desta contabilidade?
                Esta ação é irreversível e removerá permanentemente todos os XMLs baixados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (contabId) {
                    deleteAll.mutate({ contabilidadeId: contabId });
                  }
                }}
                disabled={deleteAll.isPending}
              >
                {deleteAll.isPending ? "Apagando..." : "Sim, apagar TUDO"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
