import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  FileText, ArrowUpRight, ArrowDownLeft, XCircle, CheckCircle, DollarSign,
  Users, ShieldCheck, ShieldX, ShieldAlert, TrendingUp, Building2, CreditCard,
  Download, Clock, Calendar, AlertTriangle, BarChart3, Eye, FileSpreadsheet,
  FileDown, X, Search, Filter,
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { toast } from "sonner";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y?.slice(2)}`;
}

function formatMonthFull(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${months[parseInt(m) - 1]} de ${y}`;
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatDateTime(d: Date | string | null): string {
  if (!d) return "Nunca";
  return new Date(d).toLocaleString("pt-BR");
}

function formatCnpj(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return cnpj || "-";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

// ─── Stat Card Component — Futuristic with glow & floating effect ────────
function StatCard({ icon: Icon, iconBg, iconColor, label, value, subtext, onClick }: {
  icon: any; iconBg: string; iconColor: string; label: string; value: string | number;
  subtext?: string; onClick?: () => void;
}) {
  return (
    <Card className={`group ${onClick ? "cursor-pointer" : ""}`} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0 stat-icon-glow transition-transform duration-300 group-hover:scale-110`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate mb-0.5">{label}</p>
            <p className="text-xl font-bold tracking-tight truncate leading-none">{value}</p>
            {subtext && <p className="text-[11px] text-muted-foreground truncate mt-1">{subtext}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────
function downloadBase64File(base64: string, filename: string, mimeType: string) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Admin Dashboard ────────────────────────────────────────────────
function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: adminStats } = trpc.admin.dashboardStats.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-muted-foreground text-sm mt-1">Visao geral da plataforma</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Building2} iconBg="bg-blue-50 dark:bg-blue-500/15" iconColor="text-blue-500" label="Contabilidades" value={adminStats?.totalContabilidades ?? 0} subtext={`${adminStats?.contabilidadesAtivas ?? 0} ativas`} onClick={() => setLocation("/contabilidades")} />
        <StatCard icon={Users} iconBg="bg-purple-500/10" iconColor="text-purple-500" label="Usuarios" value={adminStats?.totalUsuarios ?? 0} onClick={() => setLocation("/usuarios")} />
        <StatCard icon={CreditCard} iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-500" label="Planos" value={adminStats?.totalPlanos ?? 0} onClick={() => setLocation("/planos")} />
        <StatCard icon={FileText} iconBg="bg-primary/10" iconColor="text-primary" label="Total Notas" value={adminStats?.totalNotas ?? 0} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} iconBg="bg-green-50 dark:bg-green-500/15" iconColor="text-green-500" label="Total Clientes" value={adminStats?.totalClientes ?? 0} />
        <StatCard icon={ShieldCheck} iconBg="bg-green-50 dark:bg-green-500/15" iconColor="text-green-500" label="Certificados" value={adminStats?.totalCertificados ?? 0} />
        <StatCard icon={ShieldX} iconBg="bg-red-50 dark:bg-red-500/15" iconColor="text-red-500" label="Cert. Vencidos" value={adminStats?.certVencidos ?? 0} onClick={() => setLocation("/certificados-validade")} />
        <StatCard icon={ShieldAlert} iconBg="bg-orange-50 dark:bg-orange-500/15" iconColor="text-orange-500" label="Vencem em 30d" value={adminStats?.certAVencer30 ?? 0} onClick={() => setLocation("/certificados-validade")} />
      </div>
      {adminStats?.contabilidadesRecentes && adminStats.contabilidadesRecentes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Contabilidades Recentes</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {adminStats.contabilidadesRecentes.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-4 w-4 text-primary" /></div>
                    <div><p className="font-medium text-sm">{c.nome}</p>{c.cnpj && <p className="text-xs text-muted-foreground">{c.cnpj}</p>}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground"><p>{c.totalClientes || 0} clientes</p></div>
                    <Badge variant={c.ativo ? "default" : "destructive"} className="text-xs">{c.ativo ? "Ativa" : "Inativa"}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Contabilidade Dashboard ────────────────────────────────────────
function ContabilidadeDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedCliente, setSelectedCliente] = useState<string>("all");
  const [selectedMes, setSelectedMes] = useState<string | null>(null);
  const [showAllClientes, setShowAllClientes] = useState(false);
  const [allClientesSearch, setAllClientesSearch] = useState("");
  const contabId = user?.contabilidadeId;

  const { data: clientesList } = trpc.cliente.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery(
    {
      contabilidadeId: contabId ?? undefined,
      clienteId: selectedCliente !== "all" ? parseInt(selectedCliente) : undefined,
      mes: selectedMes ?? undefined,
    },
    { enabled: !!contabId }
  );

  const { data: allClientes, isLoading: loadingAllClientes } = trpc.dashboard.allClientes.useQuery(
    {
      contabilidadeId: contabId ?? undefined,
      mes: selectedMes ?? undefined,
    },
    { enabled: !!contabId && showAllClientes }
  );

  // Relatórios
  const reportPdf = trpc.dashboard.exportPdf.useMutation({
    onSuccess: (data: any) => {
      if (data?.base64) {
        downloadBase64File(data.base64, data.filename || "relatorio-dashboard.pdf", "application/pdf");
        toast.success("Relatório PDF gerado com sucesso!");
      }
    },
    onError: (err: any) => toast.error(`Erro ao gerar PDF: ${err.message}`),
  });

  const reportExcel = trpc.dashboard.exportExcel.useMutation({
    onSuccess: (data: any) => {
      if (data?.base64) {
        downloadBase64File(data.base64, data.filename || "relatorio-dashboard.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        toast.success("Relatório Excel gerado com sucesso!");
      }
    },
    onError: (err: any) => toast.error(`Erro ao gerar Excel: ${err.message}`),
  });

  const selectedClienteName = selectedCliente !== "all"
    ? clientesList?.find(c => String(c.id) === selectedCliente)?.razaoSocial
    : null;

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Válidas", value: stats.validas, color: "#22c55e" },
      { name: "Canceladas", value: stats.canceladas, color: "#ef4444" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const directionPie = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Emitidas", value: stats.emitidas, color: "#3b82f6" },
      { name: "Recebidas", value: stats.recebidas, color: "#f59e0b" },
    ].filter((d) => d.value > 0);
  }, [stats]);

  const monthlyData = useMemo(() => {
    if (!stats?.notasPorMes) return [];
    return stats.notasPorMes.map((m: any) => ({
      mes: formatMonth(m.mes),
      mesRaw: m.mes,
      emitidas: Number(m.emitidas),
      recebidas: Number(m.recebidas),
      total: Number(m.total),
      valor: parseFloat(m.valor),
    }));
  }, [stats]);

  // Handle chart click - select/deselect month
  const handleBarClick = useCallback((data: any) => {
    if (data?.activePayload?.[0]?.payload?.mesRaw) {
      const clickedMes = data.activePayload[0].payload.mesRaw;
      setSelectedMes(prev => prev === clickedMes ? null : clickedMes);
    }
  }, []);

  const handleAreaClick = useCallback((data: any) => {
    if (data?.activePayload?.[0]?.payload?.mesRaw) {
      const clickedMes = data.activePayload[0].payload.mesRaw;
      setSelectedMes(prev => prev === clickedMes ? null : clickedMes);
    }
  }, []);

  // Clear month filter
  const clearMesFilter = () => setSelectedMes(null);

  // Generate reports
  const handleReportPdf = () => {
    reportPdf.mutate({
      contabilidadeId: contabId ?? undefined,
      clienteId: selectedCliente !== "all" ? parseInt(selectedCliente) : undefined,
      mes: selectedMes ?? undefined,
    });
  };

  const handleReportExcel = () => {
    reportExcel.mutate({
      contabilidadeId: contabId ?? undefined,
      clienteId: selectedCliente !== "all" ? parseInt(selectedCliente) : undefined,
      mes: selectedMes ?? undefined,
    });
  };

  // Filtered all clientes for modal
  const filteredAllClientes = useMemo(() => {
    if (!allClientes) return [];
    if (!allClientesSearch) return allClientes;
    const s = allClientesSearch.toLowerCase();
    return allClientes.filter((c: any) =>
      c.razaoSocial?.toLowerCase().includes(s) ||
      c.cnpj?.includes(allClientesSearch)
    );
  }, [allClientes, allClientesSearch]);

  // Totals for modal
  const allClientesTotals = useMemo(() => {
    if (!filteredAllClientes || filteredAllClientes.length === 0) return null;
    return {
      totalNotas: filteredAllClientes.reduce((s: number, c: any) => s + c.totalNotas, 0),
      valorTotal: filteredAllClientes.reduce((s: number, c: any) => s + c.valorTotal, 0),
      valorEmitido: filteredAllClientes.reduce((s: number, c: any) => s + c.valorEmitido, 0),
      valorRecebido: filteredAllClientes.reduce((s: number, c: any) => s + c.valorRecebido, 0),
    };
  }, [filteredAllClientes]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {selectedClienteName
              ? `Dados de: ${selectedClienteName}`
              : "Visão geral de todos os clientes"}
            {selectedMes && (
              <span className="ml-1 text-primary font-medium"> — {formatMonthFull(selectedMes)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Month filter badge */}
          {selectedMes && (
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm cursor-pointer hover:bg-destructive/10" onClick={clearMesFilter}>
              <Filter className="h-3 w-3" />
              {formatMonthFull(selectedMes)}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {clientesList && clientesList.length > 0 && (
            <Select value={selectedCliente} onValueChange={(v) => { setSelectedCliente(v); }}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Clientes</SelectItem>
                {clientesList.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.razaoSocial}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Report buttons */}
          <Button variant="outline" size="sm" onClick={handleReportPdf} disabled={reportPdf.isPending}>
            <FileDown className="h-4 w-4 mr-1" />
            {reportPdf.isPending ? "Gerando..." : "PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReportExcel} disabled={reportExcel.isPending}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            {reportExcel.isPending ? "Gerando..." : "Excel"}
          </Button>
        </div>
      </div>

      {/* Row 1: Resumo Geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} iconBg="bg-blue-50 dark:bg-blue-500/15" iconColor="text-blue-500" label="Clientes" value={stats?.totalClientes ?? 0} subtext={stats?.clientesSemCert ? `${stats.clientesSemCert} sem certificado` : undefined} onClick={() => setLocation("/clientes")} />
        <StatCard icon={ShieldCheck} iconBg="bg-green-50 dark:bg-green-500/15" iconColor="text-green-500" label="Certificados Ativos" value={stats?.totalCertificados ?? 0} onClick={() => setLocation("/certificados")} />
        <StatCard icon={FileText} iconBg="bg-primary/10" iconColor="text-primary" label="Total de Notas" value={stats?.totalNotas ?? 0} onClick={() => setLocation("/notas")} />
        <StatCard icon={DollarSign} iconBg="bg-emerald-500/10" iconColor="text-emerald-600" label="Valor Total" value={formatCurrency(stats?.valorTotal ?? 0)} />
      </div>

      {/* Row 2: Notas detalhadas + Financeiro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={ArrowUpRight} iconBg="bg-blue-50 dark:bg-blue-500/15" iconColor="text-blue-500" label="Notas Emitidas" value={stats?.emitidas ?? 0} subtext={formatCurrency(stats?.valorEmitido ?? 0)} />
        <StatCard icon={ArrowDownLeft} iconBg="bg-amber-50 dark:bg-amber-500/15" iconColor="text-amber-500" label="Notas Recebidas" value={stats?.recebidas ?? 0} subtext={formatCurrency(stats?.valorRecebido ?? 0)} />
        <StatCard icon={CheckCircle} iconBg="bg-green-50 dark:bg-green-500/15" iconColor="text-green-500" label="Válidas" value={stats?.validas ?? 0} />
        <StatCard icon={XCircle} iconBg="bg-red-50 dark:bg-red-500/15" iconColor="text-red-500" label="Canceladas" value={stats?.canceladas ?? 0} />
      </div>

      {/* Alertas: Certificados vencidos */}
      {((stats?.certVencidos ?? 0) > 0 || (stats?.certAVencer30 ?? 0) > 0) && (
        <Card className="border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/8 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/certificados-validade")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="h-12 w-12 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                <ShieldX className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-red-700 dark:text-red-400">Atenção aos Certificados</p>
                <div className="flex flex-wrap gap-4 mt-1">
                  {(stats?.certVencidos ?? 0) > 0 && (
                    <span className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                      <ShieldX className="h-4 w-4" /> {stats?.certVencidos} vencido(s)
                    </span>
                  )}
                  {(stats?.certAVencer30 ?? 0) > 0 && (
                    <span className="text-sm text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <ShieldAlert className="h-4 w-4" /> {stats?.certAVencer30} vencem em 30 dias
                    </span>
                  )}
                  {(stats?.certAVencer60 ?? 0) > 0 && (
                    <span className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" /> {stats?.certAVencer60} vencem em 60 dias
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="destructive" className="shrink-0">Ver detalhes</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Row 3: Info cards - Último download e Próximo agendamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 stat-icon-glow">
                <Download className="h-6 w-6 text-indigo-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Último Download</p>
                {stats?.ultimoDownload ? (
                  <div>
                    <p className="text-sm font-semibold">{formatDateTime(stats.ultimoDownload.createdAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      {stats.ultimoDownload.totalNotas ?? 0} nota(s) baixadas
                      <Badge variant={stats.ultimoDownload.status === "concluido" ? "default" : "destructive"} className="ml-2 text-[10px] px-1.5 py-0">
                        {stats.ultimoDownload.status === "concluido" ? "Sucesso" : stats.ultimoDownload.status}
                      </Badge>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum download realizado</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0 stat-icon-glow">
                <Calendar className="h-6 w-6 text-teal-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Próximo Agendamento</p>
                {stats?.proximoAgendamento ? (
                  <div>
                    <p className="text-sm font-semibold">
                      {stats.proximoAgendamento.proximaExecucao
                        ? formatDateTime(stats.proximoAgendamento.proximaExecucao)
                        : `Horário: ${stats.proximoAgendamento.horario}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Frequência: {stats.proximoAgendamento.frequencia === "diario" ? "Diário" : stats.proximoAgendamento.frequencia === "semanal" ? "Semanal" : stats.proximoAgendamento.frequencia === "dia_util" ? "Dia Útil" : "Mensal"}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum agendamento ativo</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Gráficos - CLICÁVEIS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />Notas por Mês
              </CardTitle>
              <p className="text-xs text-muted-foreground">Clique em um mês para filtrar</p>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData} onClick={handleBarClick} style={{ cursor: "pointer" }}>
                  <defs>
                    <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5fd" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="barAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fde68a" stopOpacity={1} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.85} />
                    </linearGradient>
                    <filter id="barGlow">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: 'rgba(10,15,30,0.95)', color: '#fff', border: '1px solid rgba(100,180,255,0.25)', borderRadius: '12px', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.2)', backdropFilter: 'blur(12px)' }} labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: '#e2e8f0' }} />
                  <Bar dataKey="emitidas" name="Emitidas" fill="url(#barBlue)" radius={[6, 6, 0, 0]} filter="url(#barGlow)" />
                  <Bar dataKey="recebidas" name="Recebidas" fill="url(#barAmber)" radius={[6, 6, 0, 0]} filter="url(#barGlow)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p>Nenhum dado disponível</p>
                  <p className="text-xs mt-1">Faça download de notas para ver o gráfico</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />Valores por Mês
              </CardTitle>
              <p className="text-xs text-muted-foreground">Clique em um mês para filtrar</p>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyData} onClick={handleAreaClick} style={{ cursor: "pointer" }}>
                  <defs>
                    <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity={0.55} />
                      <stop offset="35%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.03} />
                    </linearGradient>
                    <filter id="lineGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ stroke: 'rgba(74,222,128,0.3)', strokeWidth: 1 }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'rgba(10,15,30,0.95)', color: '#fff', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '12px', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(74,222,128,0.2)', backdropFilter: 'blur(12px)' }} labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: '#e2e8f0' }} />
                  <Area type="monotone" dataKey="valor" name="Valor Total" stroke="#4ade80" fill="url(#areaGreen)" strokeWidth={3} filter="url(#lineGlow)" dot={{ fill: '#4ade80', strokeWidth: 0, r: 3 }} activeDot={{ r: 6, fill: '#4ade80', stroke: '#0f1623', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p>Nenhum dado disponível</p>
                  <p className="text-xs mt-1">Faça download de notas para ver o gráfico</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 5: Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Status das Notas</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <defs>
                    <filter id="pieGlow">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none" filter="url(#pieGlow)">
                    {pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10,15,30,0.95)', color: '#fff', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(74,222,128,0.2)', backdropFilter: 'blur(12px)' }} labelStyle={{ color: '#94a3b8', fontWeight: 600 }} itemStyle={{ color: '#e2e8f0', fontWeight: 400 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Nenhum dado disponível</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Emitidas vs Recebidas</CardTitle></CardHeader>
          <CardContent>
            {directionPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <defs>
                    <filter id="pieGlow2">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <Pie data={directionPie} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none" filter="url(#pieGlow2)">
                    {directionPie.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(10,15,30,0.95)', color: '#fff', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.2)', backdropFilter: 'blur(12px)' }} labelStyle={{ color: '#94a3b8', fontWeight: 600 }} itemStyle={{ color: '#e2e8f0', fontWeight: 400 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">Nenhum dado disponível</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 6: Top Clientes (apenas quando "Todos") */}
      {selectedCliente === "all" && stats?.topClientes && stats.topClientes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Top Clientes por Valor
                {selectedMes && <Badge variant="outline" className="text-xs ml-2">{formatMonthFull(selectedMes)}</Badge>}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => { setShowAllClientes(true); setAllClientesSearch(""); }}>
                <Eye className="h-4 w-4 mr-1" />
                Ver Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Notas</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topClientes.map((c: any, i: number) => (
                  <TableRow key={c.clienteId} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCliente(String(c.clienteId))}>
                    <TableCell className="font-mono text-sm text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.razaoSocial}</TableCell>
                    <TableCell className="text-right">{c.totalNotas}</TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(c.valorTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Row 7: Notas Recentes */}
      {stats?.notasRecentes && stats.notasRecentes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Notas Recentes
              {selectedMes && <Badge variant="outline" className="text-xs ml-2">{formatMonthFull(selectedMes)}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Emitente</TableHead>
                  <TableHead>Tomador</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.notasRecentes.map((n: any) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-mono text-sm">{n.numeroNota || "-"}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">{n.emitenteNome || "-"}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">{n.tomadorNome || "-"}</TableCell>
                    <TableCell className="font-medium text-sm">{n.valorServico ? formatCurrency(Number(n.valorServico)) : "-"}</TableCell>
                    <TableCell className="text-sm">{formatDate(n.dataEmissao)}</TableCell>
                    <TableCell>
                      <Badge variant={n.direcao === "emitida" ? "default" : "secondary"} className={n.direcao === "emitida" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/25" : "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25"}>
                        {n.direcao === "emitida" ? "Emitida" : "Recebida"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={n.status === "valida" ? "default" : "destructive"} className={n.status === "valida" ? "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25" : ""}>
                        {n.status === "valida" ? "Válida" : n.status === "cancelada" ? "Cancelada" : "Substituída"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ─── Modal: Ver Todos os Clientes ─── */}
      <Dialog open={showAllClientes} onOpenChange={setShowAllClientes}>
        <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Todos os Clientes
              {selectedMes && <Badge variant="outline" className="ml-2">{formatMonthFull(selectedMes)}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {/* Search + Report buttons */}
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={allClientesSearch}
                onChange={(e) => setAllClientesSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReportPdf} disabled={reportPdf.isPending}>
                <FileDown className="h-4 w-4 mr-1" />PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleReportExcel} disabled={reportExcel.isPending}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
              </Button>
            </div>
          </div>

          {/* Totals summary */}
          {allClientesTotals && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Empresas</p>
                <p className="text-lg font-bold">{filteredAllClientes.length}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Notas</p>
                <p className="text-lg font-bold">{allClientesTotals.totalNotas.toLocaleString("pt-BR")}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400">Valor Emitido</p>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(allClientesTotals.valorEmitido)}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                <p className="text-xs text-amber-600">Valor Recebido</p>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(allClientesTotals.valorRecebido)}</p>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {loadingAllClientes ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">Carregando...</div>
            ) : filteredAllClientes.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">Nenhum cliente encontrado</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] sticky top-0 bg-background">#</TableHead>
                    <TableHead className="sticky top-0 bg-background">Cliente</TableHead>
                    <TableHead className="sticky top-0 bg-background">CNPJ</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background">Notas</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background">Emitido</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background">Recebido</TableHead>
                    <TableHead className="text-right sticky top-0 bg-background">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAllClientes.map((c: any, i: number) => (
                    <TableRow key={c.clienteId} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedCliente(String(c.clienteId)); setShowAllClientes(false); }}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm">{c.razaoSocial}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCnpj(c.cnpj)}</TableCell>
                      <TableCell className="text-right text-sm">{c.totalNotas}</TableCell>
                      <TableCell className="text-right text-sm text-blue-600 dark:text-blue-400">{formatCurrency(c.valorEmitido)}</TableCell>
                      <TableCell className="text-right text-sm text-amber-600">{formatCurrency(c.valorRecebido)}</TableCell>
                      <TableCell className="text-right font-semibold text-sm text-emerald-600">{formatCurrency(c.valorTotal)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  {allClientesTotals && (
                    <TableRow className="bg-muted/30 font-bold border-t-2">
                      <TableCell></TableCell>
                      <TableCell>TOTAL ({filteredAllClientes.length} empresas)</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">{allClientesTotals.totalNotas.toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-blue-600 dark:text-blue-400">{formatCurrency(allClientesTotals.valorEmitido)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatCurrency(allClientesTotals.valorRecebido)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(allClientesTotals.valorTotal)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  return (
    <DashboardLayout>
      {user?.role === "admin" ? <AdminDashboard /> : <ContabilidadeDashboard />}
    </DashboardLayout>
  );
}
