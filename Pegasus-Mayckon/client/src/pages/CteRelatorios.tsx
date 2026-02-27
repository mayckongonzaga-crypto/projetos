import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import {
  Truck, BarChart3, Loader2, TrendingUp, DollarSign, FileText,
  MapPin, Filter, PieChart as PieChartIcon, Download, FileSpreadsheet,
  FileDown, FolderArchive, Building2, ChevronDown, Search
} from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444",
  "#06b6d4", "#ec4899", "#14b8a6", "#f97316", "#6366f1",
];

export default function CteRelatorios() {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [direcaoFilter, setDirecaoFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [modalFilter, setModalFilter] = useState("todos");
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [zipDialogOpen, setZipDialogOpen] = useState(false);
  const [zipMode, setZipMode] = useState<"single" | "all">("all");
  const [selectedZipClientes, setSelectedZipClientes] = useState<number[]>([]);
  const [zipSearchTerm, setZipSearchTerm] = useState("");
  const [incluirPdfZip, setIncluirPdfZip] = useState(true);

  // Lista de clientes para o seletor de ZIP
  const { data: clientesList } = trpc.cliente.list.useQuery(undefined, {});

  // Mutations de exportação
  const exportExcelMutation = trpc.cte.exportExcel.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas) { toast.warning("Nenhum CT-e encontrado com os filtros selecionados"); return; }
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório Excel exportado (${data.totalNotas} CT-e)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const exportPdfMutation = trpc.cte.exportPdf.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas) { toast.warning("Nenhum CT-e encontrado com os filtros selecionados"); return; }
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório PDF exportado (${data.totalNotas} CT-e)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const zipClienteMutation = trpc.cte.gerarZipCliente.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas) { toast.warning("Nenhum CT-e encontrado para esta empresa"); return; }
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP gerado (${data.totalNotas} CT-e)`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const zipMultiplosMutation = trpc.cte.gerarZipMultiplos.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas) { toast.warning("Nenhum CT-e encontrado para as empresas selecionadas"); return; }
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = data.fileName; a.click();
      URL.revokeObjectURL(url);
      toast.success(`ZIP consolidado gerado (${data.totalNotas} CT-e)`);
      setZipDialogOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleExportExcel = () => {
    exportExcelMutation.mutate({
      clienteId: clienteFilter !== "todos" ? parseInt(clienteFilter) : undefined,
      direcao: direcaoFilter !== "todos" ? direcaoFilter as any : undefined,
      status: statusFilter !== "todos" ? statusFilter as any : undefined,
      modal: modalFilter !== "todos" ? modalFilter as any : undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });
  };

  const handleExportPdf = () => {
    exportPdfMutation.mutate({
      clienteId: clienteFilter !== "todos" ? parseInt(clienteFilter) : undefined,
      direcao: direcaoFilter !== "todos" ? direcaoFilter as any : undefined,
      status: statusFilter !== "todos" ? statusFilter as any : undefined,
      modal: modalFilter !== "todos" ? modalFilter as any : undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });
  };

  const handleOpenZipDialog = (mode: "single" | "all") => {
    setZipMode(mode);
    if (mode === "all") {
      setSelectedZipClientes(clientesList?.map((c: any) => c.id) || []);
    } else {
      setSelectedZipClientes([]);
    }
    setZipDialogOpen(true);
  };

  const handleGerarZip = () => {
    if (selectedZipClientes.length === 0) { toast.warning("Selecione ao menos uma empresa"); return; }
    if (selectedZipClientes.length === 1) {
      zipClienteMutation.mutate({
        clienteId: selectedZipClientes[0],
        periodoInicio: dataInicio || undefined,
        periodoFim: dataFim || undefined,
        incluirPdf: incluirPdfZip,
      });
    } else {
      zipMultiplosMutation.mutate({
        clienteIds: selectedZipClientes,
        periodoInicio: dataInicio || undefined,
        periodoFim: dataFim || undefined,
        incluirPdf: incluirPdfZip,
      });
    }
  };

  const isExporting = exportExcelMutation.isPending || exportPdfMutation.isPending || zipClienteMutation.isPending || zipMultiplosMutation.isPending;

  const queryInput = useMemo(() => ({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    direcao: (direcaoFilter !== "todos" ? direcaoFilter : undefined) as any,
    status: (statusFilter !== "todos" ? statusFilter : undefined) as any,
    modal: (modalFilter !== "todos" ? modalFilter : undefined) as any,
    clienteId: clienteFilter !== "todos" ? parseInt(clienteFilter) : undefined,
  }), [dataInicio, dataFim, direcaoFilter, statusFilter, modalFilter, clienteFilter]);

  const { data, isLoading } = trpc.cte.relatorio.useQuery(queryInput);

  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatCurrencyShort = (val: number) => {
    if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(1)}K`;
    return `R$ ${val.toFixed(0)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#0f1729] border border-white/20 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-white font-medium mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("valor")
              ? formatCurrency(p.value)
              : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            CT-e Relatórios
          </h1>
          <p className="text-muted-foreground mt-1">
            Análise detalhada dos Conhecimentos de Transporte Eletrônico
          </p>
        </div>

        {/* Filtros */}
        <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-[160px]">
                <label className="text-xs text-muted-foreground mb-1 block">Data Início</label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                />
              </div>
              <div className="w-[160px]">
                <label className="text-xs text-muted-foreground mb-1 block">Data Fim</label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                />
              </div>
              <div className="w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Direção</label>
                <Select value={direcaoFilter} onValueChange={setDirecaoFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="emitido">Emitido</SelectItem>
                    <SelectItem value="tomado">Tomado</SelectItem>
                    <SelectItem value="terceiro">Terceiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[140px]">
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="autorizado">Autorizado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                    <SelectItem value="denegado">Denegado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Modal</label>
                <Select value={modalFilter} onValueChange={setModalFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="rodoviario">Rodoviário</SelectItem>
                    <SelectItem value="aereo">Aéreo</SelectItem>
                    <SelectItem value="aquaviario">Aquaviário</SelectItem>
                    <SelectItem value="ferroviario">Ferroviário</SelectItem>
                    <SelectItem value="dutoviario">Dutoviário</SelectItem>
                    <SelectItem value="multimodal">Multimodal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[200px] max-w-[320px] flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Empresa</label>
                <Select value={clienteFilter} onValueChange={setClienteFilter}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent className="max-w-[400px]">
                    <SelectItem value="todos">Todas as Empresas</SelectItem>
                    {clientesList?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDataInicio("");
                  setDataFim("");
                  setDirecaoFilter("todos");
                  setStatusFilter("todos");
                  setModalFilter("todos");
                  setClienteFilter("todos");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Limpar Filtros
              </Button>

              {/* Separador visual */}
              <div className="h-8 w-px bg-border/50 mx-1 hidden md:block" />

              {/* Botões de exportação */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={isExporting || !data}
                  className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                >
                  {exportExcelMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={isExporting || !data}
                  className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                >
                  {exportPdfMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
                  PDF
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isExporting || !data}
                      className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                    >
                      {(zipClienteMutation.isPending || zipMultiplosMutation.isPending)
                        ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        : <FolderArchive className="h-4 w-4 mr-1.5" />}
                      ZIP XMLs
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenZipDialog("single")}>
                      <Building2 className="h-4 w-4 mr-2" />
                      Por Empresa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenZipDialog("all")}>
                      <FolderArchive className="h-4 w-4 mr-2" />
                      Todas as Empresas
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 text-muted-foreground">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p>Nenhum dado disponível</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-shadow">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent" />
                <CardContent className="pt-5 pb-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <p className="text-xs text-muted-foreground">Total CT-e</p>
                  </div>
                  <p className="text-3xl font-bold text-blue-400">{data.totalCtes.toLocaleString("pt-BR")}</p>
                </CardContent>
              </Card>
              <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-shadow">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent" />
                <CardContent className="pt-5 pb-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    <p className="text-xs text-muted-foreground">Valor Total</p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">{formatCurrencyShort(data.totalValor)}</p>
                </CardContent>
              </Card>
              <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] transition-shadow">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
                <CardContent className="pt-5 pb-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <p className="text-xs text-muted-foreground">ICMS Total</p>
                  </div>
                  <p className="text-3xl font-bold text-purple-400">{formatCurrencyShort(data.totalICMS)}</p>
                </CardContent>
              </Card>
              <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group hover:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-shadow">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent" />
                <CardContent className="pt-5 pb-4 relative">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-amber-400" />
                    <p className="text-xs text-muted-foreground">Valor a Receber</p>
                  </div>
                  <p className="text-3xl font-bold text-amber-400">{formatCurrencyShort(data.totalReceber)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* CT-e por Mês */}
              {data.porMes.length > 0 && (
                <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(59,130,246,0.1)] transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 dark:text-white">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      CT-e por Mês
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={data.porMes}>
                        <defs>
                          <linearGradient id="cteAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="cteValorGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => formatCurrencyShort(v)} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                        <Area yAxisId="left" type="monotone" dataKey="count" name="Quantidade" stroke="#3b82f6" fill="url(#cteAreaGrad)" strokeWidth={2} />
                        <Area yAxisId="right" type="monotone" dataKey="valor" name="Valor (R$)" stroke="#10b981" fill="url(#cteValorGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* CT-e por Modal */}
              {data.porModal.length > 0 && (
                <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 dark:text-white">
                      <PieChartIcon className="h-4 w-4 text-purple-400" />
                      CT-e por Modal
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={data.porModal.map(m => ({
                            name: getModalLabel(m.modal),
                            value: m.count,
                            valor: m.valor,
                          }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {data.porModal.map((_: any, index: number) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: "#94a3b8", fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* CT-e por UF */}
              {data.porUf.length > 0 && (
                <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 dark:text-white">
                      <MapPin className="h-4 w-4 text-cyan-400" />
                      CT-e por UF Destino (Top 10)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.porUf.slice(0, 10)} layout="vertical">
                        <defs>
                          <linearGradient id="cteUfGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => formatCurrencyShort(v)} />
                        <YAxis type="category" dataKey="uf" tick={{ fill: "#94a3b8", fontSize: 11 }} width={40} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                        <Bar dataKey="valor" name="Valor (R$)" fill="url(#cteUfGrad)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* CT-e por Cliente (Top 10) */}
              {data.porCliente.length > 0 && (
                <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm hover:shadow-[0_0_30px_rgba(245,158,11,0.1)] transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2 dark:text-white">
                      <Truck className="h-4 w-4 text-amber-400" />
                      Top 10 Emitentes por Valor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={data.porCliente.slice(0, 10)}>
                        <defs>
                          <linearGradient id="cteClienteGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="nome"
                          tick={{ fill: "#94a3b8", fontSize: 9 }}
                          interval={0}
                          angle={-30}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={v => formatCurrencyShort(v)} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
                        <Bar dataKey="valor" name="Valor (R$)" fill="url(#cteClienteGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Tabela resumo por cliente */}
            {data.porCliente.length > 0 && (
              <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 dark:text-white">
                    <FileText className="h-4 w-4 text-primary" />
                    Resumo por Emitente ({data.porCliente.length} empresa{data.porCliente.length > 1 ? "s" : ""})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead>Cliente</TableHead>
                          <TableHead>Emitente</TableHead>
                          <TableHead>CNPJ</TableHead>
                          <TableHead className="text-right">Qtd CT-e</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                          <TableHead className="text-right">ICMS</TableHead>
                          <TableHead className="text-right">Valor a Receber</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.porCliente.slice(0, 30).map((c: any, i: number) => (
                          <TableRow key={i} className="hover:bg-white/5 border-white/5">
                            <TableCell className="text-sm text-blue-400 max-w-[180px] truncate" title={c.clienteNome}>{c.clienteNome}</TableCell>
                            <TableCell className="font-medium dark:text-white max-w-[200px] truncate">{c.nome}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{c.cnpj}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline" className="border-white/20">{c.count}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-primary">{formatCurrency(c.valor)}</TableCell>
                            <TableCell className="text-right text-purple-400">{formatCurrency(c.icms || 0)}</TableCell>
                            <TableCell className="text-right text-amber-400">{formatCurrency(c.receber || 0)}</TableCell>
                          </TableRow>
                        ))}
                        {/* Linha de totais */}
                        <TableRow className="border-t-2 border-white/20 bg-white/5 font-bold">
                          <TableCell className="dark:text-white">TOTAL</TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-primary/20 text-primary border-primary/30">{data.totalCtes.toLocaleString("pt-BR")}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-primary">{formatCurrency(data.totalValor)}</TableCell>
                          <TableCell className="text-right text-purple-400">{formatCurrency(data.totalICMS)}</TableCell>
                          <TableCell className="text-right text-amber-400">{formatCurrency(data.totalReceber)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Dialog de seleção de empresas para ZIP */}
      <Dialog open={zipDialogOpen} onOpenChange={setZipDialogOpen}>
        <DialogContent className="max-w-2xl w-[90vw] sm:w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-blue-500" />
              {zipMode === "all" ? "Baixar ZIP - Todas as Empresas" : "Baixar ZIP - Selecionar Empresa"}
            </DialogTitle>
            <DialogDescription>
              {zipMode === "all"
                ? "Será gerado um ZIP consolidado com pastas separadas por empresa (Autorizadas/Canceladas/Denegadas)"
                : "Selecione a(s) empresa(s) para gerar o ZIP com XMLs organizados por status"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Campo de pesquisa */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={zipSearchTerm}
                onChange={(e) => setZipSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Seleção rápida */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedZipClientes.length} empresa(s) selecionada(s)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const filtered = clientesList?.filter((c: any) => {
                      if (!zipSearchTerm) return true;
                      const s = zipSearchTerm.toLowerCase();
                      return c.razaoSocial?.toLowerCase().includes(s) || c.cnpj?.includes(zipSearchTerm);
                    }) || [];
                    setSelectedZipClientes(filtered.map((c: any) => c.id));
                  }}
                >
                  Selecionar Todos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedZipClientes([])}
                >
                  Limpar
                </Button>
              </div>
            </div>

            {/* Lista de empresas */}
            <ScrollArea className="h-[300px] border rounded-md p-2">
              <div className="space-y-1">
                {clientesList?.filter((c: any) => {
                  if (!zipSearchTerm) return true;
                  const s = zipSearchTerm.toLowerCase();
                  return c.razaoSocial?.toLowerCase().includes(s) || c.cnpj?.includes(zipSearchTerm);
                }).map((cliente: any) => (
                  <label
                    key={cliente.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedZipClientes.includes(cliente.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedZipClientes(prev => [...prev, cliente.id]);
                        } else {
                          setSelectedZipClientes(prev => prev.filter(id => id !== cliente.id));
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cliente.razaoSocial}</p>
                      <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Opção de incluir PDFs */}
          <div className="border rounded-md p-3 bg-accent/30">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={incluirPdfZip}
                onCheckedChange={(checked) => setIncluirPdfZip(!!checked)}
              />
              <div>
                <p className="text-sm font-medium">Incluir DACTE (PDF)</p>
                <p className="text-xs text-muted-foreground">Gerar e incluir os PDFs do DACTE junto com os XMLs no ZIP</p>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setZipDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleGerarZip}
              disabled={selectedZipClientes.length === 0 || zipClienteMutation.isPending || zipMultiplosMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {(zipClienteMutation.isPending || zipMultiplosMutation.isPending)
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando ZIP...</>
                : <><FolderArchive className="h-4 w-4 mr-2" /> Gerar ZIP ({selectedZipClientes.length})</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function getModalLabel(m: string) {
  const modais: Record<string, string> = {
    rodoviario: "Rodoviário",
    aereo: "Aéreo",
    aquaviario: "Aquaviário",
    ferroviario: "Ferroviário",
    dutoviario: "Dutoviário",
    multimodal: "Multimodal",
  };
  return modais[m] || m || "N/I";
}
