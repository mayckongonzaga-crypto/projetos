import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useState, useMemo, useCallback } from "react";
import {
  Truck, Download, Play, Square, CheckCircle2, XCircle,
  Loader2, AlertTriangle, Shield, Building2, Calendar, CalendarRange,
  LayoutGrid, List, Info, StopCircle, FileArchive, FileText, TrendingUp,
  RefreshCw, Ban
} from "lucide-react";

type ModoData = "mes" | "periodo";
type ViewMode = "cards" | "lista";

export default function CteDownloads() {
  const [selectedClientes, setSelectedClientes] = useState<number[]>([]);
  const [modoData, setModoData] = useState<ModoData>("mes");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [activeTab, setActiveTab] = useState("iniciar");

  // Modo mês
  const [competencia, setCompetencia] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  // Modo período
  const [dataInicio, setDataInicio] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  });

  const periodoLabel = useMemo(() => {
    if (modoData === "mes") {
      const [y, m] = competencia.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    }
    return `${new Date(dataInicio + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(dataFim + "T00:00:00").toLocaleDateString("pt-BR")}`;
  }, [modoData, competencia, dataInicio, dataFim]);

  const { data: clientes, isLoading: loadingClientes } = trpc.cte.clientesComStatus.useQuery({});
  const { data: activeDownloads, refetch: refetchActive } = trpc.cte.downloadStatus.useQuery({}, {
    refetchInterval: (query) => {
      const downloads = query.state.data as any[] | undefined;
      if (!downloads || downloads.length === 0) return false;
      const hasActive = downloads.some((d: any) => d.status === "executando" || d.status === "pendente");
      return hasActive ? 3000 : false;
    },
  });

  const iniciarDownloadTodosMutation = trpc.cte.executeForAll.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Download CT-e iniciado para ${data?.totalClientes || 0} empresa(s)`);
      setSelectedClientes([]);
      refetchActive();
      setActiveTab("acompanhar");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const atualizarCtesMutation = trpc.cte.updateAll.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Atualização CT-e iniciada para ${data?.totalClientes || 0} empresa(s)`);
      refetchActive();
      setActiveTab("acompanhar");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [hiddenLogIds, setHiddenLogIds] = useState<Set<number>>(new Set());

  const cancelarMutation = trpc.cte.cancelDownload.useMutation({
    onSuccess: () => {
      toast.info("Download CT-e cancelado");
      refetchActive();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelAllMutation = trpc.cte.cancelAllDownloads.useMutation({
    onSuccess: () => {
      toast.success("Todos os downloads CT-e foram parados");
      // Limpar lista imediatamente
      if (activeDownloads) {
        const allIds = activeDownloads.map((d: any) => d.id);
        setHiddenLogIds(prev => {
          const next = new Set(Array.from(prev));
          allIds.forEach((id: number) => next.add(id));
          return next;
        });
      }
      refetchActive();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const clearHistoryMutation = trpc.cte.clearHistory.useMutation({
    onSuccess: () => {
      setHiddenLogIds(new Set());
      refetchActive();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const retryOneMutation = trpc.cte.retryOne.useMutation({
    onSuccess: () => {
      toast.success("Retomando download CT-e...");
      refetchActive();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const retryAllMutation = trpc.cte.retryAll.useMutation({
    onSuccess: (data: any) => {
      toast.success(`Retomando ${data?.totalRetomados || 0} download(s) com erro`);
      refetchActive();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handlePararTodos = useCallback(() => {
    cancelAllMutation.mutate({});
  }, [cancelAllMutation]);

  const handleLimparLista = useCallback(() => {
    // Limpar do banco (apenas finalizados) e da tela
    clearHistoryMutation.mutate({});
    if (activeDownloads) {
      const finishedIds = activeDownloads
        .filter((d: any) => d.status !== "executando" && d.status !== "pendente")
        .map((d: any) => d.id);
      setHiddenLogIds(prev => {
        const next = new Set(Array.from(prev));
        finishedIds.forEach((id: number) => next.add(id));
        return next;
      });
    }
    toast.success("Lista limpa");
  }, [activeDownloads, clearHistoryMutation]);

  const clientesValidos = useMemo(() =>
    clientes?.filter((c: any) => c.certStatus === "valido") || [],
    [clientes]
  );

  const clientesSemCert = useMemo(() =>
    clientes?.filter((c: any) => c.certStatus !== "valido") || [],
    [clientes]
  );

  const toggleCliente = (id: number) => {
    setSelectedClientes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedClientes.length === clientesValidos.length) {
      setSelectedClientes([]);
    } else {
      setSelectedClientes(clientesValidos.map((c: any) => c.id));
    }
  };

  const handleIniciarDownload = () => {
    if (selectedClientes.length === 0) {
      toast.warning("Selecione ao menos uma empresa");
      return;
    }
    iniciarDownloadTodosMutation.mutate({ clienteIds: selectedClientes });
  };

  const handleBaixarTodos = () => {
    iniciarDownloadTodosMutation.mutate({});
  };

  // Separar downloads (filtrar os ocultos) e ordenar: executando > pendente > concluído > sem CT-e > erro > cancelado
  const statusOrder: Record<string, number> = { executando: 0, pendente: 1, concluido: 2, erro: 3, cancelado: 4 };
  const visibleDownloads = useMemo(() => {
    const filtered = activeDownloads?.filter((dl: any) => !hiddenLogIds.has(dl.id)) || [];
    return [...filtered].sort((a: any, b: any) => {
      const orderA = statusOrder[a.status] ?? 5;
      const orderB = statusOrder[b.status] ?? 5;
      if (orderA !== orderB) return orderA - orderB;
      // Dentro do mesmo status, concluídos com CT-e primeiro, sem CT-e depois
      if (a.status === "concluido" && b.status === "concluido") {
        const aHas = (a.totalCtes || 0) > 0 ? 0 : 1;
        const bHas = (b.totalCtes || 0) > 0 ? 0 : 1;
        return aHas - bHas;
      }
      return 0;
    });
  }, [activeDownloads, hiddenLogIds]);

  const downloadsAtivos = useMemo(() =>
    visibleDownloads.filter((dl: any) => dl.status === "executando" || dl.status === "pendente"),
    [visibleDownloads]
  );

  const downloadsFinalizados = useMemo(() =>
    visibleDownloads.filter((dl: any) => dl.status !== "executando" && dl.status !== "pendente"),
    [visibleDownloads]
  );

  const totalAtivos = downloadsAtivos.length;

  // Helpers de status
  const getStatusInfo = (dl: any) => {
    if (dl.status === "executando") return { color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30", icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />, label: "Executando" };
    if (dl.status === "pendente") return { color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", icon: <Loader2 className="h-4 w-4 text-amber-500" />, label: "Pendente" };
    if (dl.status === "erro") return { color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", icon: <XCircle className="h-4 w-4 text-red-500" />, label: "Erro" };
    if (dl.status === "cancelado") return { color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", icon: <Square className="h-4 w-4 text-amber-500" />, label: "Cancelado" };
    if (!dl.totalCtes || dl.totalCtes === 0) return { color: "text-slate-400", bg: "bg-slate-500/10 border-slate-500/30", icon: <Info className="h-4 w-4 text-slate-400" />, label: "Sem CT-e" };
    return { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />, label: `${dl.ctesNovos || 0} novo(s)` };
  };

  const getProgressValue = (dl: any) => {
    if (dl.status === "concluido" || dl.status === "cancelado") return 100;
    if (dl.totalEsperado > 0) return Math.round((dl.progresso / dl.totalEsperado) * 100);
    if (dl.status === "executando") return 15; // indeterminate
    return 0;
  };

  const getResultText = (dl: any) => {
    if (dl.status === "concluido" && (!dl.totalCtes || dl.totalCtes === 0)) return "Nenhum CT-e encontrado na SEFAZ";
    if (dl.status === "concluido") return `${dl.ctesNovos || 0} novo(s) de ${dl.totalCtes || 0} CT-e(s)`;
    if (dl.status === "erro") return dl.erro || "Erro desconhecido";
    if (dl.status === "cancelado") return "Cancelado pelo usuário";
    if (dl.etapa) return dl.etapa;
    return `${dl.progresso || 0} CT-e(s) baixado(s)`;
  };

  // Render card de download
  const renderDownloadCard = (dl: any) => {
    const info = getStatusInfo(dl);
    const progressVal = getProgressValue(dl);

    return (
      <Card key={dl.id} className={`border ${info.bg} transition-all`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {info.icon}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">{dl.clienteNome || dl.clienteCnpj}</p>
                <p className="text-xs text-muted-foreground">{dl.clienteCnpj}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={`text-xs ${info.color} border-current/30`}>
                {info.label}
              </Badge>
              {dl.status === "executando" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => cancelarMutation.mutate({ logId: dl.id })}
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              )}
              {dl.status === "erro" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  onClick={() => retryOneMutation.mutate({ logId: dl.id })}
                  disabled={retryOneMutation.isPending}
                  title="Retomar download"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <Progress value={progressVal} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{getResultText(dl)}</p>
        </CardContent>
      </Card>
    );
  };

  // Render linha de download (modo lista)
  const renderDownloadRow = (dl: any) => {
    const info = getStatusInfo(dl);
    const progressVal = getProgressValue(dl);

    return (
      <div key={dl.id} className={`flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors`}>
        <div className="shrink-0">{info.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{dl.clienteNome || dl.clienteCnpj}</p>
          <p className="text-xs text-muted-foreground">{getResultText(dl)}</p>
        </div>
        <div className="w-32 shrink-0 hidden sm:block">
          <Progress value={progressVal} className="h-1.5" />
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 ${info.color} border-current/30`}>
          {info.label}
        </Badge>
        {dl.status === "executando" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
            onClick={() => cancelarMutation.mutate({ logId: dl.id })}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
        {dl.status === "erro" && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10 shrink-0"
            onClick={() => retryOneMutation.mutate({ logId: dl.id })}
            disabled={retryOneMutation.isPending}
            title="Retomar download"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            CT-e Downloads
          </h1>
          <p className="text-muted-foreground mt-1">
            Baixe os Conhecimentos de Transporte Eletrônico (CT-e) dos seus clientes
          </p>
        </div>

        {/* Tabs: Iniciar Download / Acompanhar Downloads */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="iniciar" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Iniciar Download
            </TabsTrigger>
            <TabsTrigger value="acompanhar" className="flex items-center gap-2 relative">
              <Play className="h-4 w-4" />
              Acompanhar
              {totalAtivos > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {totalAtivos}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* TAB: INICIAR DOWNLOAD                                  */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="iniciar" className="space-y-6 mt-6">
            {/* Seletor de período */}
            <Card className="futuristic-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Período de Download
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant={modoData === "mes" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setModoData("mes")}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Mês
                    </Button>
                    <Button
                      variant={modoData === "periodo" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setModoData("periodo")}
                    >
                      <CalendarRange className="h-4 w-4 mr-1" />
                      Período
                    </Button>
                  </div>

                  {modoData === "mes" ? (
                    <Select value={competencia} onValueChange={setCompetencia}>
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Competência" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - i);
                          const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                          const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                          return <SelectItem key={val} value={val}>{label}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-end gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Data Inicial</Label>
                        <Input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="w-[160px]"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Data Final</Label>
                        <Input
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="w-[160px]"
                        />
                      </div>
                    </div>
                  )}

                  <Badge variant="secondary" className="text-xs py-1.5 px-3">
                    {periodoLabel}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Ações de download */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={handleBaixarTodos}
                disabled={iniciarDownloadTodosMutation.isPending || clientesValidos.length === 0}
                className="futuristic-button"
              >
                {iniciarDownloadTodosMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Baixar Todos CT-e
              </Button>
              <Button
                onClick={handleIniciarDownload}
                disabled={selectedClientes.length === 0 || iniciarDownloadTodosMutation.isPending}
                variant="outline"
              >
                {iniciarDownloadTodosMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Baixar Selecionados ({selectedClientes.length})
              </Button>
              <Button
                onClick={() => atualizarCtesMutation.mutate({})}
                disabled={atualizarCtesMutation.isPending}
                variant="outline"
                className="border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10"
              >
                {atualizarCtesMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Atualizar CT-e (só novos)
              </Button>
              {selectedClientes.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedClientes([])}>
                  Limpar Seleção
                </Button>
              )}
            </div>

            {/* Lista de clientes com certificado válido */}
            <Card className="futuristic-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Empresas com Certificado Válido ({clientesValidos.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedClientes.length === clientesValidos.length ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingClientes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : clientesValidos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma empresa com certificado válido encontrada</p>
                    <p className="text-sm mt-1">Cadastre certificados digitais para começar a baixar CT-e</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {clientesValidos.map((cliente: any) => (
                      <div
                        key={cliente.id}
                        onClick={() => toggleCliente(cliente.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedClientes.includes(cliente.id)
                            ? "border-primary bg-primary/10 dark:bg-primary/5 shadow-sm shadow-primary/20"
                            : "border-border/50 bg-card/50 hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedClientes.includes(cliente.id)}
                            onCheckedChange={() => toggleCliente(cliente.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{cliente.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Empresas sem certificado */}
            {clientesSemCert.length > 0 && (
              <Card className="futuristic-card border-amber-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    Sem Certificado Válido ({clientesSemCert.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {clientesSemCert.map((cliente: any) => (
                      <div key={cliente.id} className="p-3 rounded-lg border border-border/30 bg-card/30 opacity-60">
                        <div className="flex items-center gap-3">
                          <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{cliente.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground">{cliente.cnpj}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                            {cliente.certStatus === "vencido" ? "Vencido" : "Sem cert."}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* TAB: ACOMPANHAR DOWNLOADS                              */}
          {/* ═══════════════════════════════════════════════════════ */}
          <TabsContent value="acompanhar" className="space-y-6 mt-6">
            {/* KPI Cards em tempo real */}
            {activeDownloads && activeDownloads.length > 0 && (() => {
              const totalEmpresas = activeDownloads.length;
              const emAndamento = activeDownloads.filter((d: any) => d.status === "executando" || d.status === "pendente").length;
              const concluidos = activeDownloads.filter((d: any) => d.status === "concluido").length;
              const comErro = activeDownloads.filter((d: any) => d.status === "erro").length;
              const cancelados = activeDownloads.filter((d: any) => d.status === "cancelado").length;
              const semCte = activeDownloads.filter((d: any) => d.status === "concluido" && (!d.totalCtes || d.totalCtes === 0)).length;
              const totalCteBaixados = activeDownloads.reduce((acc: number, d: any) => acc + (d.totalCtes || 0), 0);
              const totalCteNovos = activeDownloads.reduce((acc: number, d: any) => acc + (d.ctesNovos || 0), 0);
              const progressoGeral = totalEmpresas > 0 ? Math.round(((concluidos + comErro + cancelados) / totalEmpresas) * 100) : 0;

              return (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                  {/* Progresso Geral */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-3 text-center">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
                      <p className="text-2xl font-bold text-primary">{progressoGeral}%</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Progresso Geral</p>
                    </CardContent>
                  </Card>
                  {/* Em Andamento */}
                  <Card className={`${emAndamento > 0 ? 'border-blue-500/30 bg-blue-500/5' : 'border-slate-500/20 bg-slate-500/5'}`}>
                    <CardContent className="p-3 text-center">
                      {emAndamento > 0 ? (
                        <Loader2 className="h-5 w-5 mx-auto mb-1 text-blue-500 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-slate-400" />
                      )}
                      <p className={`text-2xl font-bold ${emAndamento > 0 ? 'text-blue-500' : 'text-slate-400'}`}>{emAndamento}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Em Andamento</p>
                    </CardContent>
                  </Card>
                  {/* Concluídos */}
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardContent className="p-3 text-center">
                      <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                      <p className="text-2xl font-bold text-emerald-500">{concluidos}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Concluídos</p>
                    </CardContent>
                  </Card>
                  {/* CT-e Baixados */}
                  <Card className="border-cyan-500/30 bg-cyan-500/5">
                    <CardContent className="p-3 text-center">
                      <FileText className="h-5 w-5 mx-auto mb-1 text-cyan-500" />
                      <p className="text-2xl font-bold text-cyan-500">{totalCteBaixados}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">CT-e Encontrados</p>
                      {totalCteNovos > 0 && <p className="text-[10px] text-cyan-400">{totalCteNovos} novo(s)</p>}
                    </CardContent>
                  </Card>
                  {/* Sem CT-e */}
                  <Card className="border-slate-500/30 bg-slate-500/5">
                    <CardContent className="p-3 text-center">
                      <Info className="h-5 w-5 mx-auto mb-1 text-slate-400" />
                      <p className="text-2xl font-bold text-slate-400">{semCte}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Sem CT-e</p>
                    </CardContent>
                  </Card>
                  {/* Erros */}
                  <Card className={`border-red-500/30 ${comErro > 0 ? 'bg-red-500/10' : 'bg-red-500/5'}`}>
                    <CardContent className="p-3 text-center">
                      <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
                      <p className="text-2xl font-bold text-red-500">{comErro}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Erros</p>
                      {cancelados > 0 && <p className="text-[10px] text-amber-400">{cancelados} cancelado(s)</p>}
                    </CardContent>
                  </Card>
                </div>
              );
            })()}

            {/* Controles de visualização + botões de ação */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Visualização:</span>
                <Button
                  variant={viewMode === "cards" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("cards")}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Cards
                </Button>
                <Button
                  variant={viewMode === "lista" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("lista")}
                >
                  <List className="h-4 w-4 mr-1" />
                  Lista
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {visibleDownloads.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePararTodos}
                    disabled={cancelarMutation.isPending}
                  >
                    <StopCircle className="h-4 w-4 mr-1" />
                    {downloadsAtivos.length > 0 ? `Parar Todos (${downloadsAtivos.length})` : "Parar e Limpar"}
                  </Button>
                )}
                {downloadsFinalizados.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLimparLista}
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Limpar Lista
                  </Button>
                )}
                {activeDownloads && activeDownloads.filter((d: any) => d.status === "erro").length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                    onClick={() => retryAllMutation.mutate({})}
                    disabled={retryAllMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${retryAllMutation.isPending ? 'animate-spin' : ''}`} />
                    Retomar Erros ({activeDownloads.filter((d: any) => d.status === "erro").length})
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={async () => {
                  toast.info("Atualizando lista de downloads...");
                  await refetchActive();
                  toast.success("Lista atualizada!");
                }}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Downloads em andamento */}
            {downloadsAtivos.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Em Andamento ({downloadsAtivos.length})
                </h3>
                {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {downloadsAtivos.map(renderDownloadCard)}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      {downloadsAtivos.map(renderDownloadRow)}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Downloads finalizados */}
            {downloadsFinalizados.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Finalizados ({downloadsFinalizados.length})
                </h3>
                {viewMode === "cards" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {downloadsFinalizados.map(renderDownloadCard)}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      {downloadsFinalizados.map(renderDownloadRow)}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Estado vazio */}
            {(visibleDownloads.length === 0) && (
              <Card className="futuristic-card">
                <CardContent className="py-12 text-center">
                  <Download className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground">Nenhum download CT-e recente</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Vá para a aba "Iniciar Download" para começar
                  </p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab("iniciar")}>
                    Iniciar Download
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
