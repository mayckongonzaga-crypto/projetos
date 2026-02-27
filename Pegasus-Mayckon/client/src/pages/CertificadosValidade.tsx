import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Clock,
  Upload,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileUp,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

function getStatusInfo(validTo: Date | string | null) {
  if (!validTo) return { status: "desconhecido", label: "Desconhecido", color: "bg-gray-100 text-gray-700 dark:text-gray-300", icon: Clock, daysLeft: 0 };
  const now = new Date();
  const expiry = new Date(validTo);
  const diffMs = expiry.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { status: "vencido", label: "Vencido", color: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800", icon: XCircle, daysLeft };
  }
  if (daysLeft <= 30) {
    return { status: "critico", label: "Vence em breve", color: "bg-orange-100 text-orange-700 border-orange-200 dark:border-orange-800", icon: AlertTriangle, daysLeft };
  }
  if (daysLeft <= 60) {
    return { status: "atencao", label: "Atenção", color: "bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-200 border-amber-400/50", icon: Clock, daysLeft };
  }
  return { status: "valido", label: "Válido", color: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 dark:text-green-300 border-green-200 dark:border-green-800", icon: CheckCircle2, daysLeft };
}

function formatDate(d: Date | string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatCnpj(cnpj: string) {
  const c = cnpj.replace(/\D/g, "");
  if (c.length !== 14) return cnpj;
  return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export default function CertificadosValidade() {
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");
  const [renovarDialog, setRenovarDialog] = useState<{ clienteId: number; cnpj: string; razaoSocial: string } | null>(null);
  const [renovarLoteDialog, setRenovarLoteDialog] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [senha, setSenha] = useState("");

  const contabilidades = trpc.contabilidade.list.useQuery();
  const [contabId] = useState<number | undefined>(undefined);
  const firstContabId = contabilidades.data?.[0]?.id;
  const activeContabId = contabId || firstContabId;

  const monitoramento = trpc.certificado.monitoramento.useQuery(
    activeContabId ? { contabilidadeId: activeContabId } : undefined,
    { enabled: !!activeContabId }
  );

  const renovarMutation = trpc.certificado.renovar.useMutation({
    onSuccess: (data) => {
      toast.success(`Certificado renovado: ${data.razaoSocial}`);
      setRenovarDialog(null);
      setFiles([]);
      setSenha("");
      monitoramento.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const renovarLoteMutation = trpc.certificado.renovarLote.useMutation({
    onSuccess: (data) => {
      const ok = data.results.filter(r => r.success).length;
      const fail = data.results.filter(r => !r.success).length;
      toast.success(`Renovação em lote: ${ok} sucesso, ${fail} falhas`);
      setRenovarLoteDialog(false);
      setFiles([]);
      monitoramento.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRenovarIndividual = useCallback(async () => {
    if (!renovarDialog || files.length === 0 || !activeContabId) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      const fileName = file.name;
      const fileSenha = senha || fileName.split(",").pop()?.replace(".pfx", "").replace(".PFX", "") || "";
      renovarMutation.mutate({
        clienteId: renovarDialog.clienteId,
        contabilidadeId: activeContabId,
        fileName,
        fileData: base64,
        senha: fileSenha,
      });
    };
    reader.readAsDataURL(file);
  }, [renovarDialog, files, senha, activeContabId, renovarMutation]);

  const handleRenovarLote = useCallback(async () => {
    if (files.length === 0 || !activeContabId) return;
    const certificados: Array<{ fileName: string; fileData: string; senha: string }> = [];

    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const fileName = file.name;
      const fileSenha = fileName.split(",").pop()?.replace(".pfx", "").replace(".PFX", "") || "";
      certificados.push({ fileName, fileData: base64, senha: fileSenha });
    }

    renovarLoteMutation.mutate({ contabilidadeId: activeContabId, certificados });
  }, [files, activeContabId, renovarLoteMutation]);

  const certs = monitoramento.data ?? [];

  const filteredCerts = useMemo(() => {
    return certs.filter((cert) => {
      const info = getStatusInfo(cert.validTo);
      if (filtroStatus !== "todos" && info.status !== filtroStatus) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const matchCnpj = cert.cnpj?.toLowerCase().includes(q);
        const matchRazao = cert.razaoSocial?.toLowerCase().includes(q);
        const matchCliente = cert.clienteRazaoSocial?.toLowerCase().includes(q);
        if (!matchCnpj && !matchRazao && !matchCliente) return false;
      }
      return true;
    });
  }, [certs, filtroStatus, busca]);

  const stats = useMemo(() => {
    let vencidos = 0, criticos = 0, atencao = 0, validos = 0;
    certs.forEach((cert) => {
      const info = getStatusInfo(cert.validTo);
      if (info.status === "vencido") vencidos++;
      else if (info.status === "critico") criticos++;
      else if (info.status === "atencao") atencao++;
      else validos++;
    });
    return { vencidos, criticos, atencao, validos, total: certs.length };
  }, [certs]);

  const getStatusLabel = (validTo: Date | string | null) => {
    const info = getStatusInfo(validTo);
    if (info.status === "vencido") return "Vencido";
    if (info.status === "critico") return "Vence em 30 dias";
    if (info.status === "atencao") return "Vence em 60 dias";
    return "Válido";
  };

  const handleExportExcel = useCallback(async () => {
    if (filteredCerts.length === 0) {
      toast.error("Nenhum certificado para exportar com os filtros atuais.");
      return;
    }
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Pegasus - LAN7 Tecnologia";
      const ws = wb.addWorksheet("Certificados");

      // Header row with branding
      ws.mergeCells("A1:G1");
      const titleCell = ws.getCell("A1");
      titleCell.value = "PEGASUS - LAN7 Tecnologia";
      titleCell.font = { bold: true, size: 16, color: { argb: "FF1E40AF" } };
      titleCell.alignment = { horizontal: "center" };

      ws.mergeCells("A2:G2");
      const subtitleCell = ws.getCell("A2");
      const filtroLabel = filtroStatus === "todos" ? "Todos" : filtroStatus === "vencido" ? "Vencidos" : filtroStatus === "critico" ? "Vencem em 30 dias" : filtroStatus === "atencao" ? "Vencem em 60 dias" : "Válidos";
      subtitleCell.value = `Relatório de Validade dos Certificados - Filtro: ${filtroLabel} - Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;
      subtitleCell.font = { size: 10, color: { argb: "FF666666" } };
      subtitleCell.alignment = { horizontal: "center" };

      ws.mergeCells("A3:G3");
      const statsCell = ws.getCell("A3");
      statsCell.value = `Total: ${filteredCerts.length} | Vencidos: ${stats.vencidos} | Vencem 30d: ${stats.criticos} | Vencem 60d: ${stats.atencao} | Válidos: ${stats.validos}`;
      statsCell.font = { size: 10, italic: true };
      statsCell.alignment = { horizontal: "center" };

      // Column headers
      const headerRow = ws.addRow([""]);
      const colHeaders = ws.addRow(["#", "Razão Social", "CNPJ", "Cidade/UF", "Válido De", "Válido Até", "Status", "Dias Restantes"]);
      colHeaders.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
        cell.alignment = { horizontal: "center" };
        cell.border = { bottom: { style: "thin" } };
      });

      // Data rows
      filteredCerts.forEach((cert, idx) => {
        const info = getStatusInfo(cert.validTo);
        const row = ws.addRow([
          idx + 1,
          cert.clienteRazaoSocial || cert.razaoSocial || "Empresa",
          formatCnpj(cert.cnpj || ""),
          cert.clienteCidade ? `${cert.clienteCidade}/${cert.clienteUf}` : "-",
          formatDate(cert.validFrom),
          formatDate(cert.validTo),
          getStatusLabel(cert.validTo),
          info.daysLeft < 0 ? `Vencido há ${Math.abs(info.daysLeft)}d` : `${info.daysLeft}d`,
        ]);

        // Color coding by status
        const statusColors: Record<string, string> = {
          vencido: "FFFEE2E2",
          critico: "FFFFF7ED",
          atencao: "FFFFFBEB",
          valido: "FFF0FDF4",
        };
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors[info.status] || "FFFFFFFF" } };
        });
      });

      // Column widths
      ws.columns = [
        { width: 6 },
        { width: 45 },
        { width: 22 },
        { width: 20 },
        { width: 14 },
        { width: 14 },
        { width: 18 },
        { width: 16 },
      ];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificados_${filtroLabel.toLowerCase().replace(/ /g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório Excel gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar Excel: " + (err.message || "Erro desconhecido"));
    }
  }, [filteredCerts, filtroStatus, stats]);

  const handleExportPdf = useCallback(() => {
    if (filteredCerts.length === 0) {
      toast.error("Nenhum certificado para exportar com os filtros atuais.");
      return;
    }
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setTextColor(30, 64, 175);
      doc.text("PEGASUS", pageWidth / 2, 15, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("LAN7 Tecnologia", pageWidth / 2, 21, { align: "center" });

      const filtroLabel = filtroStatus === "todos" ? "Todos" : filtroStatus === "vencido" ? "Vencidos" : filtroStatus === "critico" ? "Vencem em 30 dias" : filtroStatus === "atencao" ? "Vencem em 60 dias" : "Válidos";
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Relatório de Validade dos Certificados`, pageWidth / 2, 28, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Filtro: ${filtroLabel} | Total: ${filteredCerts.length} certificados | Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`, pageWidth / 2, 33, { align: "center" });

      // Summary line
      doc.setFontSize(8);
      doc.text(`Vencidos: ${stats.vencidos} | Vencem 30d: ${stats.criticos} | Vencem 60d: ${stats.atencao} | Válidos: ${stats.validos}`, pageWidth / 2, 38, { align: "center" });

      // Table
      const tableData = filteredCerts.map((cert, idx) => {
        const info = getStatusInfo(cert.validTo);
        return [
          String(idx + 1),
          cert.clienteRazaoSocial || cert.razaoSocial || "Empresa",
          formatCnpj(cert.cnpj || ""),
          cert.clienteCidade ? `${cert.clienteCidade}/${cert.clienteUf}` : "-",
          formatDate(cert.validFrom),
          formatDate(cert.validTo),
          getStatusLabel(cert.validTo),
          info.daysLeft < 0 ? `Vencido há ${Math.abs(info.daysLeft)}d` : `${info.daysLeft}d`,
        ];
      });

      autoTable(doc, {
        startY: 42,
        head: [["#", "Razão Social", "CNPJ", "Cidade/UF", "Válido De", "Válido Até", "Status", "Dias"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: [255, 255, 255],
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 70 },
          2: { cellWidth: 38 },
          3: { cellWidth: 30 },
          4: { halign: "center", cellWidth: 22 },
          5: { halign: "center", cellWidth: 22 },
          6: { halign: "center", cellWidth: 30 },
          7: { halign: "center", cellWidth: 20 },
        },
        didParseCell: (data: any) => {
          if (data.section === "body" && data.column.index === 6) {
            const status = data.cell.raw;
            if (status === "Vencido") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            } else if (status === "Vence em 30 dias") {
              data.cell.styles.textColor = [234, 88, 12];
              data.cell.styles.fontStyle = "bold";
            } else if (status === "Vence em 60 dias") {
              data.cell.styles.textColor = [202, 138, 4];
            } else if (status === "Válido") {
              data.cell.styles.textColor = [22, 163, 74];
            }
          }
        },
        margin: { left: 10, right: 10 },
      });

      // Footer on each page
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Pegasus - LAN7 Tecnologia | Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: "center" });
      }

      doc.save(`certificados_${filtroLabel.toLowerCase().replace(/ /g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Relatório PDF gerado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar PDF: " + (err.message || "Erro desconhecido"));
    }
  }, [filteredCerts, filtroStatus, stats]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Validade dos Certificados</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Monitore a validade dos certificados digitais de todos os clientes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => monitoramento.refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Relatório Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="h-4 w-4 mr-2" />
              Relatório PDF
            </Button>
            <Button size="sm" onClick={() => setRenovarLoteDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Renovar em Lote
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-500/10 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFiltroStatus("vencido")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                  <ShieldX className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.vencidos}</p>
                  <p className="text-xs text-red-600">Vencidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-500/10 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFiltroStatus("critico")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{stats.criticos}</p>
                  <p className="text-xs text-orange-600">Vencem em 30 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-500/10 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFiltroStatus("atencao")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{stats.atencao}</p>
                  <p className="text-xs text-yellow-600">Vencem em 60 dias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-500/10 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFiltroStatus("valido")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.validos}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">Válidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress bar */}
        {stats.total > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Saúde dos certificados</span>
                <span className="font-medium">{Math.round((stats.validos / stats.total) * 100)}% válidos</span>
              </div>
              <Progress value={(stats.validos / stats.total) * 100} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por CNPJ, razão social..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="vencido">Vencidos</SelectItem>
              <SelectItem value="critico">Vencem em 30 dias</SelectItem>
              <SelectItem value="atencao">Vencem em 60 dias</SelectItem>
              <SelectItem value="valido">Válidos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Certificate List */}
        <div className="space-y-3">
          {monitoramento.isLoading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />Carregando certificados...</CardContent></Card>
          ) : filteredCerts.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum certificado encontrado com os filtros selecionados.</CardContent></Card>
          ) : (
            filteredCerts.map((cert) => {
              const info = getStatusInfo(cert.validTo);
              const Icon = info.icon;
              return (
                <Card key={cert.certId} className={`hover:shadow-md transition-shadow ${info.status === "vencido" ? "border-red-300 dark:border-red-500/30" : info.status === "critico" ? "border-orange-300 dark:border-orange-500/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${info.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{cert.clienteRazaoSocial || cert.razaoSocial || "Empresa"}</p>
                          <p className="text-xs text-muted-foreground">{formatCnpj(cert.cnpj || "")}</p>
                          {cert.clienteCidade && (
                            <p className="text-xs text-muted-foreground">{cert.clienteCidade}/{cert.clienteUf}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Válido de</p>
                          <p className="font-medium">{formatDate(cert.validFrom)}</p>
                        </div>
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Válido até</p>
                          <p className="font-medium">{formatDate(cert.validTo)}</p>
                        </div>
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Tempo restante</p>
                          <p className={`font-bold ${info.daysLeft < 0 ? "text-red-600" : info.daysLeft <= 30 ? "text-orange-600" : info.daysLeft <= 60 ? "text-yellow-600" : "text-green-600 dark:text-green-400"}`}>
                            {info.daysLeft < 0 ? `Vencido há ${Math.abs(info.daysLeft)} dias` : `${info.daysLeft} dias`}
                          </p>
                        </div>
                        <Badge variant="outline" className={info.color}>
                          {info.label}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRenovarDialog({
                            clienteId: cert.clienteId,
                            cnpj: cert.cnpj || "",
                            razaoSocial: cert.clienteRazaoSocial || cert.razaoSocial || "",
                          })}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1" />
                          Renovar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Dialog: Renovar Individual */}
        <Dialog open={!!renovarDialog} onOpenChange={(open) => { if (!open) { setRenovarDialog(null); setFiles([]); setSenha(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Renovar Certificado</DialogTitle>
              <DialogDescription>
                {renovarDialog && (
                  <>Renovar certificado de <strong>{renovarDialog.razaoSocial}</strong> ({formatCnpj(renovarDialog.cnpj)})</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Novo certificado (.pfx)</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".pfx,.p12"
                    onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                    className="hidden"
                    id="cert-file-single"
                  />
                  <label htmlFor="cert-file-single" className="cursor-pointer">
                    <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {files.length > 0 ? files[0].name : "Clique para selecionar o arquivo .pfx"}
                    </p>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cert-senha">Senha do certificado</Label>
                <Input
                  id="cert-senha"
                  type="password"
                  placeholder="Senha ou deixe vazio para extrair do nome"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se o nome do arquivo seguir o formato "nome,senha.pfx", a senha será extraída automaticamente.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRenovarDialog(null); setFiles([]); setSenha(""); }}>
                Cancelar
              </Button>
              <Button onClick={handleRenovarIndividual} disabled={files.length === 0 || renovarMutation.isPending}>
                {renovarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Renovar Certificado
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Renovar em Lote */}
        <Dialog open={renovarLoteDialog} onOpenChange={(open) => { if (!open) { setRenovarLoteDialog(false); setFiles([]); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Renovar Certificados em Lote</DialogTitle>
              <DialogDescription>
                Selecione múltiplos arquivos .pfx para renovar. O sistema identificará automaticamente cada cliente pelo CNPJ do certificado.
                Use o formato "nome,senha.pfx" para que a senha seja extraída automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".pfx,.p12"
                  multiple
                  onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
                  className="hidden"
                  id="cert-files-batch"
                />
                <label htmlFor="cert-files-batch" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Clique para selecionar os arquivos .pfx
                  </p>
                </label>
              </div>
              {files.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium">{files.length} arquivo(s) selecionado(s):</p>
                  {files.map((f, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">{f.name}</p>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRenovarLoteDialog(false); setFiles([]); }}>
                Cancelar
              </Button>
              <Button onClick={handleRenovarLote} disabled={files.length === 0 || renovarLoteMutation.isPending}>
                {renovarLoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Renovar {files.length} Certificado(s)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
