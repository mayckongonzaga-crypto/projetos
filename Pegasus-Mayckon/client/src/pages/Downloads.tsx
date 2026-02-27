import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Download, Loader2, ShieldAlert, ShieldCheck, ShieldX, FileArchive,
  StopCircle, Calendar, Trash2, Building2, Search, CheckSquare, Square,
  ArrowRight, X, CheckCircle, AlertTriangle, XCircle, FolderArchive, Clock
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { downloadBase64File } from "@/lib/download-helper";

export default function Downloads() {
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: clientesComStatus, isLoading: clientesLoading } = trpc.download.clientesComStatus.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const utils = trpc.useUtils();
  const [downloading, setDownloading] = useState<number | "all" | "selected" | null>(null);
  const [downloadingName, setDownloadingName] = useState<string>("");
  const [generatingZip, setGeneratingZip] = useState<number | null>(null);
  const [generatingZipName, setGeneratingZipName] = useState<string>("");
  const [stopping, setStopping] = useState(false);


  // Seleção de empresas via checkbox
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Filtro de período
  const [downloadMode, setDownloadMode] = useState<"novas" | "periodo">("novas");
  const now = new Date();
  // Formato de data: YYYY-MM-DD para input type="date"
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const [periodoDataInicio, setPeriodoDataInicio] = useState<string>(firstDayStr);
  const [periodoDataFim, setPeriodoDataFim] = useState<string>(todayStr);

  // Filtrar clientes por busca
  const filteredClientes = useMemo(() => {
    if (!clientesComStatus) return [];
    if (!searchQuery.trim()) return clientesComStatus;
    const q = searchQuery.toLowerCase().trim();
    return clientesComStatus.filter(c =>
      c.razaoSocial.toLowerCase().includes(q) ||
      c.cnpj.includes(q) ||
      (c.cidade && c.cidade.toLowerCase().includes(q))
    );
  }, [clientesComStatus, searchQuery]);

  // Clientes válidos (com certificado válido) da lista filtrada
  const clientesValidos = useMemo(() =>
    filteredClientes.filter(c => c.certStatus === "valido"),
    [filteredClientes]
  );

  // Clientes selecionados válidos
  const selectedValidIds = useMemo(() => {
    if (!clientesComStatus) return [];
    return Array.from(selectedIds).filter(id => {
      const c = clientesComStatus.find(cl => cl.id === id);
      return c?.certStatus === "valido";
    });
  }, [selectedIds, clientesComStatus]);

  // Toggle seleção individual (só permite clientes com certificado válido)
  const toggleSelect = useCallback((id: number) => {
    const cliente = clientesComStatus?.find(c => c.id === id);
    if (cliente?.certStatus !== "valido") return; // Não permite selecionar vencido/sem cert
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [clientesComStatus]);

  // Selecionar/desselecionar todos visíveis (só válidos)
  const toggleSelectAll = useCallback(() => {
    const visibleValidIds = filteredClientes.filter(c => c.certStatus === "valido").map(c => c.id);
    const allSelected = visibleValidIds.length > 0 && visibleValidIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleValidIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleValidIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [filteredClientes, selectedIds]);

  // Selecionar apenas válidos visíveis
  const selectAllValid = useCallback(() => {
    const validIds = clientesValidos.map(c => c.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      validIds.forEach(id => next.add(id));
      return next;
    });
  }, [clientesValidos]);

  // Limpar seleção
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const visibleValidClientes = filteredClientes.filter(c => c.certStatus === "valido");
  const allVisibleSelected = visibleValidClientes.length > 0 && visibleValidClientes.every(c => selectedIds.has(c.id));
  const someVisibleSelected = filteredClientes.some(c => selectedIds.has(c.id));

  // Calcular competência no formato YYYY-MM para enviar à API
  // A API Nacional usa competência (mês/ano), então extraimos o mês das datas
  // e passamos também as datas exatas para filtro refinado
  const getCompetencia = () => {
    if (downloadMode === "novas") return {};
    // Extrair YYYY-MM das datas para a API Nacional (busca por competência)
    const compInicio = periodoDataInicio.substring(0, 7); // YYYY-MM
    const compFim = periodoDataFim.substring(0, 7);       // YYYY-MM
    return {
      modo: "periodo" as const,
      competenciaInicio: compInicio,
      competenciaFim: compFim,
      dataInicio: periodoDataInicio,  // YYYY-MM-DD
      dataFim: periodoDataFim,        // YYYY-MM-DD
    };
  };

  // Período formatado para exibição
  const periodoLabel = useMemo(() => {
    if (downloadMode === "novas") return "Novas";
    const formatDate = (d: string) => {
      const [y, m, day] = d.split("-");
      return `${day}/${m}/${y}`;
    };
    if (periodoDataInicio === periodoDataFim) {
      return formatDate(periodoDataInicio);
    }
    return `${formatDate(periodoDataInicio)} a ${formatDate(periodoDataFim)}`;
  }, [downloadMode, periodoDataInicio, periodoDataFim]);

  // Mutations
  const downloadForCliente = trpc.download.executeForCliente.useMutation({
    onSuccess: (data) => {
      toast.success(`Download concluído: ${data.totalDownloaded} nota(s) baixada(s), ${data.notasNovas} nova(s)`);
      utils.download.logs.invalidate();
      utils.download.clientesComStatus.invalidate();
      utils.nota.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDownloading(null);
      setDownloadingName("");
    },
    onError: (err) => {
      toast.error(`Erro no download: ${err.message}`);
      setDownloading(null);
      setDownloadingName("");
    },
  });

  const downloadForAll = trpc.download.executeForAll.useMutation({
    onSuccess: (data) => {
      const count = data.results.length;
      toast.success(data.message || `${count} empresa(s) adicionadas à fila de download`);
      utils.download.logs.invalidate();
      utils.download.clientesComStatus.invalidate();
      setDownloading(null);
      setDownloadingName("");
    },
    onError: (err) => {
      toast.error(`Erro no download em lote: ${err.message}`);
      setDownloading(null);
      setDownloadingName("");
    },
  });

  const downloadForSelected = trpc.download.executeForSelected.useMutation({
    onSuccess: (data) => {
      const count = data.results.length;
      toast.success(data.message || `${count} empresa(s) adicionadas à fila de download`);
      utils.download.logs.invalidate();
      utils.download.clientesComStatus.invalidate();
      setDownloading(null);
      setDownloadingName("");
      clearSelection();
    },
    onError: (err) => {
      toast.error(`Erro no download: ${err.message}`);
      setDownloading(null);
      setDownloadingName("");
    },
  });

  const gerarZip = trpc.download.gerarZipCliente.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas || data.totalNotas === 0) {
        toast.info("Nenhuma nota encontrada para este cliente no período selecionado");
      } else {
        toast.success(`ZIP gerado: ${data.totalNotas} nota(s)`);
        downloadBase64File(data.base64, data.fileName);
      }
      setGeneratingZip(null);
      setGeneratingZipName("");
    },
    onError: (err) => {
      toast.error(`Erro ao gerar ZIP: ${err.message}`);
      setGeneratingZip(null);
      setGeneratingZipName("");
    },
  });

  const [generatingZipMultiplos, setGeneratingZipMultiplos] = useState(false);

  // ═══ Modal de Seleção de Período para ZIP ═══
  const [zipPeriodoDialogOpen, setZipPeriodoDialogOpen] = useState(false);
  const [zipPeriodoMode, setZipPeriodoMode] = useState<"individual" | "selecionadas">("individual");
  const [zipPeriodoClienteId, setZipPeriodoClienteId] = useState<number | null>(null);
  const [zipPeriodoClienteNome, setZipPeriodoClienteNome] = useState<string>("");
  const [zipPeriodoClienteIds, setZipPeriodoClienteIds] = useState<number[]>([]);
  const [zipPeriodoSelecionados, setZipPeriodoSelecionados] = useState<Set<string>>(new Set()); // "MM/YYYY"
  const [zipPeriodoTodos, setZipPeriodoTodos] = useState(true); // todos selecionados por padrão
  const [zipPeriodoLoading, setZipPeriodoLoading] = useState(false);

  // Query de períodos disponíveis (habilitada quando o modal está aberto)
  const { data: periodosDisponiveis, isLoading: periodosLoading } = trpc.download.periodosDisponiveis.useQuery(
    { clienteIds: zipPeriodoClienteIds, contabilidadeId: contabId },
    { enabled: zipPeriodoDialogOpen && zipPeriodoClienteIds.length > 0 && !!contabId }
  );

  // Abrir modal de período para ZIP individual
  const abrirZipPeriodo = (clienteId: number, nome: string) => {
    setZipPeriodoMode("individual");
    setZipPeriodoClienteId(clienteId);
    setZipPeriodoClienteNome(nome);
    setZipPeriodoClienteIds([clienteId]);
    setZipPeriodoSelecionados(new Set());
    setZipPeriodoTodos(true);
    setZipPeriodoDialogOpen(true);
  };

  // Abrir modal de período para ZIP selecionadas
  const abrirZipPeriodoSelecionadas = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setZipPeriodoMode("selecionadas");
    setZipPeriodoClienteId(null);
    setZipPeriodoClienteNome("");
    setZipPeriodoClienteIds(ids);
    setZipPeriodoSelecionados(new Set());
    setZipPeriodoTodos(true);
    setZipPeriodoDialogOpen(true);
  };

  // Toggle período individual
  const togglePeriodo = (label: string) => {
    setZipPeriodoTodos(false);
    setZipPeriodoSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Calcular total de notas selecionadas
  const totalNotasSelecionadas = useMemo(() => {
    if (!periodosDisponiveis) return 0;
    if (zipPeriodoTodos) return periodosDisponiveis.reduce((s, p) => s + p.totalNotas, 0);
    return periodosDisponiveis.filter(p => zipPeriodoSelecionados.has(p.label)).reduce((s, p) => s + p.totalNotas, 0);
  }, [periodosDisponiveis, zipPeriodoTodos, zipPeriodoSelecionados]);

  // Confirmar geração do ZIP com período selecionado
  const confirmarZipComPeriodo = () => {
    if (!contabId) return;
    setZipPeriodoDialogOpen(false);

    // Calcular período baseado na seleção
    let periodoInicio: string | undefined;
    let periodoFim: string | undefined;

    if (!zipPeriodoTodos && zipPeriodoSelecionados.size > 0 && periodosDisponiveis) {
      const selecionados = periodosDisponiveis.filter(p => zipPeriodoSelecionados.has(p.label));
      if (selecionados.length > 0) {
        // Encontrar o menor e maior período
        const sorted = [...selecionados].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
        const primeiro = sorted[0];
        const ultimo = sorted[sorted.length - 1];
        periodoInicio = new Date(primeiro.ano, primeiro.mes - 1, 1).toISOString();
        // Último dia do mês final
        periodoFim = new Date(ultimo.ano, ultimo.mes, 0, 23, 59, 59).toISOString();
      }
    }

    if (zipPeriodoMode === "individual" && zipPeriodoClienteId) {
      setGeneratingZip(zipPeriodoClienteId);
      setGeneratingZipName(zipPeriodoClienteNome);
      gerarZip.mutate({
        clienteId: zipPeriodoClienteId,
        contabilidadeId: contabId,
        periodoInicio,
        periodoFim,
      });
    } else if (zipPeriodoMode === "selecionadas") {
      setGeneratingZipMultiplos(true);
      const clienteIds = zipPeriodoClienteIds;
      if (clienteIds.length <= 5) {
        gerarZipMultiplosSync.mutate({
          clienteIds,
          contabilidadeId: contabId,
          periodoInicio,
          periodoFim,
        });
      } else {
        iniciarZipAsyncMutation.mutate({
          clienteIds,
          contabilidadeId: contabId,
          periodoInicio,
          periodoFim,
        });
      }
    }
  };

  // ZIP Selecionadas - versão assíncrona com progresso para muitas empresas
  const [zipJobId, setZipJobId] = useState<string | null>(null);
  const [zipDialogOpen, setZipDialogOpen] = useState(false);
  const zipStartTimeRef = useRef<number | null>(null);
  const [zipElapsed, setZipElapsed] = useState(0);

  // Timer para tempo decorrido
  useEffect(() => {
    if (!zipDialogOpen || !zipStartTimeRef.current) return;
    const interval = setInterval(() => {
      setZipElapsed(Math.floor((Date.now() - (zipStartTimeRef.current || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [zipDialogOpen]);

  // ZIP síncrono (para poucas empresas, <=5)
  const gerarZipMultiplosSync = trpc.download.gerarZipMultiplos.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas || data.totalNotas === 0) {
        toast.info("Nenhuma nota encontrada para os clientes selecionados no período");
      } else {
        toast.success(`ZIP gerado: ${data.totalEmpresas} empresa(s), ${data.totalNotas} nota(s)`);
        downloadBase64File(data.base64, data.fileName);
      }
      setGeneratingZipMultiplos(false);
    },
    onError: (err) => {
      toast.error(`Erro ao gerar ZIP: ${err.message}`);
      setGeneratingZipMultiplos(false);
    },
  });

  // ZIP assíncrono (para muitas empresas, >5)
  const iniciarZipAsyncMutation = trpc.download.iniciarZipTodas.useMutation({
    onSuccess: (data) => {
      setZipJobId(data.jobId);
      setZipDialogOpen(true);
      zipStartTimeRef.current = Date.now();
      setZipElapsed(0);
      setGeneratingZipMultiplos(false);
    },
    onError: (err) => {
      toast.error(`Erro ao iniciar ZIP: ${err.message}`);
      setGeneratingZipMultiplos(false);
    },
  });

  // Polling do status do ZIP assíncrono
  const { data: zipStatus } = trpc.download.zipTodasStatus.useQuery(
    { jobId: zipJobId! },
    {
      enabled: !!zipJobId && zipDialogOpen,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data && (data.status === "concluido" || data.status === "erro")) return false;
        return 2000;
      },
    }
  );

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}min ${s}s` : `${s}s`;
  };

  const handleGerarZipSelecionadas = () => {
    if (!contabId || selectedIds.size === 0) return;
    setGeneratingZipMultiplos(true);

    const clienteIds = Array.from(selectedIds);

    // Para 5 ou menos empresas, usar versão síncrona (rápida)
    if (clienteIds.length <= 5) {
      let periodoInicio: string | undefined;
      let periodoFim: string | undefined;
      if (downloadMode === "periodo") {
        periodoInicio = new Date(periodoDataInicio + "T00:00:00").toISOString();
        periodoFim = new Date(periodoDataFim + "T23:59:59").toISOString();
      }
      gerarZipMultiplosSync.mutate({
        clienteIds,
        contabilidadeId: contabId,
        periodoInicio,
        periodoFim,
      });
    } else {
      // Para mais de 5 empresas, usar versão assíncrona com progresso
      let periodoInicio: string | undefined;
      let periodoFim: string | undefined;
      if (downloadMode === "periodo") {
        periodoInicio = new Date(periodoDataInicio + "T00:00:00").toISOString();
        periodoFim = new Date(periodoDataFim + "T23:59:59").toISOString();
      }
      iniciarZipAsyncMutation.mutate({
        clienteIds,
        contabilidadeId: contabId,
        periodoInicio,
        periodoFim,
      });
    }
  };

  const cancelAll = trpc.download.cancelAll.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.cancelled} download(s) parado(s)`);
      utils.download.logs.invalidate();
      setDownloading(null);
      setDownloadingName("");
      setStopping(false);
    },
    onError: (err) => {
      toast.error(`Erro ao parar: ${err.message}`);
      setStopping(false);
    },
  });



  // Handlers
  const handleStartDownload = () => {
    if (!contabId) return;
    const comp = getCompetencia();

    if (selectedIds.size > 0) {
      // Baixar selecionadas
      const validIds = selectedValidIds;
      if (validIds.length === 0) {
        toast.error("Nenhuma empresa selecionada possui certificado válido.");
        return;
      }
      setDownloading("selected");
      setDownloadingName(`${validIds.length} empresa(s) selecionada(s)`);
      downloadForSelected.mutate({
        clienteIds: validIds,
        contabilidadeId: contabId,
        modo: comp.modo || "novas",
        competenciaInicio: comp.competenciaInicio,
        competenciaFim: comp.competenciaFim,
      });
    } else {
      // Baixar todas
      setDownloading("all");
      setDownloadingName("Todas as empresas");
      downloadForAll.mutate({
        contabilidadeId: contabId,
        modo: comp.modo || "novas",
        competenciaInicio: comp.competenciaInicio,
        competenciaFim: comp.competenciaFim,
      });
    }
  };

  const handleDownloadCliente = (clienteId: number, nome: string) => {
    if (!contabId) return;
    setDownloading(clienteId);
    setDownloadingName(nome);
    const comp = getCompetencia();
    downloadForCliente.mutate({
      clienteId,
      contabilidadeId: contabId,
      modo: comp.modo || "novas",
      competenciaInicio: comp.competenciaInicio,
      competenciaFim: comp.competenciaFim,
    });
  };

  const handleGerarZip = (clienteId: number, nome: string) => {
    if (!contabId) return;
    setGeneratingZip(clienteId);
    setGeneratingZipName(nome);
    // Calcular período para ZIP
    let periodoInicio: string | undefined;
    let periodoFim: string | undefined;
    if (downloadMode === "periodo") {
      periodoInicio = new Date(periodoDataInicio + "T00:00:00").toISOString();
      periodoFim = new Date(periodoDataFim + "T23:59:59").toISOString();
    }
    gerarZip.mutate({
      clienteId,
      contabilidadeId: contabId,
      periodoInicio,
      periodoFim,
    });
  };

  const handleStopAll = () => {
    if (!contabId) return;
    setStopping(true);
    cancelAll.mutate({ contabilidadeId: contabId });
  };



  const getCertStatusBadge = (status: string) => {
    switch (status) {
      case "valido":
        return (
          <Badge className="bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300 hover:bg-green-100 gap-1">
            <ShieldCheck className="h-3 w-3" />Válido
          </Badge>
        );
      case "vencido":
        return (
          <Badge variant="destructive" className="gap-1">
            <ShieldX className="h-3 w-3" />Vencido
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <ShieldAlert className="h-3 w-3" />Sem Cert.
          </Badge>
        );
    }
  };

  const isDownloadActive = downloading !== null || generatingZip !== null || generatingZipMultiplos;

  // Texto do botão principal
  const getDownloadButtonText = () => {
    if (downloading !== null) {
      return `Baixando ${downloadingName}...`;
    }
    const prefix = selectedIds.size > 0
      ? `Baixar ${selectedValidIds.length} Selecionada(s)`
      : "Baixar Todas";
    return downloadMode === "periodo"
      ? `${prefix} — ${periodoLabel}`
      : `${prefix} — Novas`;
  };

  const canStartDownload = () => {
    if (isDownloadActive) return false;
    if (selectedIds.size > 0) return selectedValidIds.length > 0;
    return clientesValidos.length > 0;
  };

  // Estatísticas
  const totalClientes = clientesComStatus?.length ?? 0;
  const totalValidos = clientesComStatus?.filter(c => c.certStatus === "valido").length ?? 0;
  const totalVencidos = clientesComStatus?.filter(c => c.certStatus === "vencido").length ?? 0;
  const totalSemCert = clientesComStatus?.filter(c => c.certStatus === "sem_certificado").length ?? 0;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Downloads</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Baixe notas fiscais do Portal Nacional NFSe. Certificados vencidos são automaticamente ignorados.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {contabilidades && contabilidades.length > 1 && (
              <Select value={selectedContab || String(contabilidades[0]?.id ?? "")} onValueChange={setSelectedContab}>
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
          </div>
        </div>

        {/* Indicador de download em andamento */}
        {downloading !== null && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                      Baixando: {downloadingName}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Acompanhe o progresso em Histórico de Downloads</p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={handleStopAll} disabled={stopping} className="shrink-0">
                  <StopCircle className="h-3.5 w-3.5 mr-1" />
                  {stopping ? "Parando..." : "Parar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {generatingZip !== null && (
          <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">Gerando ZIP: {generatingZipName}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {downloadMode === "periodo" ? `Período: ${periodoLabel}` : "Todas as notas disponíveis"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Painel de Configuração de Download */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Configuração de Download
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Tipo de download */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo</Label>
                <Select value={downloadMode} onValueChange={(v: "novas" | "periodo") => setDownloadMode(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novas">Somente novas (incremental)</SelectItem>
                    <SelectItem value="periodo">Buscar por período (via API)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Período Início e Fim com data completa */}
            {downloadMode === "periodo" && (
              <div className="space-y-3">
                <Separator />
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                  {/* Data Início */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Data Inicial</Label>
                    <Input
                      type="date"
                      value={periodoDataInicio}
                      onChange={(e) => setPeriodoDataInicio(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>

                  <div className="hidden sm:flex items-center pb-2">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Data Fim */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Data Final</Label>
                    <Input
                      type="date"
                      value={periodoDataFim}
                      onChange={(e) => setPeriodoDataFim(e.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Descrição do modo */}
            <p className="text-xs text-muted-foreground">
              {downloadMode === "novas"
                ? <><strong>Somente novas:</strong> Busca na API do Portal Nacional apenas notas que ainda não foram baixadas (a partir do último NSU).</>
                : <><strong>Por período:</strong> Busca na API do Portal Nacional todas as notas de <strong>{periodoLabel}</strong>, incluindo as já baixadas. Filtra por data de competência/emissão dentro do intervalo selecionado.</>
              }
            </p>

            {/* Botão de ação principal */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                size="lg"
                onClick={handleStartDownload}
                disabled={!canStartDownload()}
                className="flex-1 sm:flex-none sm:min-w-[350px]"
              >
                {downloading !== null ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{getDownloadButtonText()}</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" />{getDownloadButtonText()}</>
                )}
              </Button>
              {isDownloadActive && (
                <Button size="lg" variant="destructive" onClick={handleStopAll} disabled={stopping}>
                  {stopping ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Parando...</>
                  ) : (
                    <><StopCircle className="h-4 w-4 mr-2" />Parar Downloads</>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo de status */}
        {clientesComStatus && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalValidos}</p>
                  <p className="text-xs text-muted-foreground">Certificados Válidos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                  <ShieldX className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalVencidos}</p>
                  <p className="text-xs text-muted-foreground">Certificados Vencidos</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-gray-600 dark:text-gray-400 dark:text-gray-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSemCert}</p>
                  <p className="text-xs text-muted-foreground">Sem Certificado</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de Clientes com Checkboxes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Empresas ({totalClientes})
                  {selectedIds.size > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedIds.size} selecionada(s)
                    </Badge>
                  )}
                </CardTitle>

              </div>

              {/* Barra de busca e ações de seleção */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CNPJ ou cidade..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={toggleSelectAll} className="h-9 text-xs gap-1.5">
                    {allVisibleSelected ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
                    {allVisibleSelected ? "Desmarcar" : "Marcar"} Visíveis
                  </Button>
                  <Button size="sm" variant="outline" onClick={selectAllValid} className="h-9 text-xs gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Marcar Válidos
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={abrirZipPeriodoSelecionadas}
                      disabled={isDownloadActive || generatingZipMultiplos}
                      className="h-9 text-xs gap-1.5 border-green-300 text-green-700 dark:text-green-300 hover:bg-green-50 dark:bg-green-500/10"
                    >
                      {generatingZipMultiplos ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando ZIP...</>
                      ) : (
                        <><FileArchive className="h-3.5 w-3.5" />ZIP Selecionadas ({selectedIds.size})</>
                      )}
                    </Button>
                  )}
                  {selectedIds.size > 0 && (
                    <Button size="sm" variant="ghost" onClick={clearSelection} className="h-9 text-xs gap-1.5 text-muted-foreground">
                      <X className="h-3.5 w-3.5" />
                      Limpar ({selectedIds.size})
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px] pl-4">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Certificado</TableHead>
                  <TableHead className="w-[200px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Carregando empresas...
                    </TableCell>
                  </TableRow>
                ) : filteredClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? `Nenhuma empresa encontrada para "${searchQuery}"` : "Nenhum cliente cadastrado"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClientes.map((c) => {
                    const isSelected = selectedIds.has(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        className={`transition-colors ${
                          c.certStatus === "valido" ? "cursor-pointer" : "cursor-not-allowed"
                        } ${
                          isSelected ? "bg-primary/5" : ""
                        } ${c.certStatus !== "valido" ? "opacity-50" : ""}`}
                        onClick={() => toggleSelect(c.id)}
                      >
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(c.id)}
                            disabled={c.certStatus !== "valido"}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{c.razaoSocial}</TableCell>
                        <TableCell className="font-mono text-sm">{c.cnpj}</TableCell>
                        <TableCell>{c.cidade ? `${c.cidade}/${c.uf}` : "-"}</TableCell>
                        <TableCell>{getCertStatusBadge(c.certStatus)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadCliente(c.id, c.razaoSocial)}
                              disabled={isDownloadActive || c.certStatus !== "valido"}
                              className="h-8"
                              title="Baixar notas desta empresa"
                            >
                              {downloading === c.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <><Download className="h-3.5 w-3.5 mr-1" />Baixar</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => abrirZipPeriodo(c.id, c.razaoSocial)}
                              disabled={isDownloadActive || generatingZip === c.id}
                              className="h-8"
                              title="Gerar ZIP - selecionar período"
                            >
                              {generatingZip === c.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <><FileArchive className="h-3.5 w-3.5 mr-1" />ZIP</>
                              )}
                            </Button>

                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Barra flutuante de seleção */}
        {selectedIds.size > 0 && !isDownloadActive && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <Card className="shadow-xl border-primary/20 bg-background/95 backdrop-blur-sm">
              <CardContent className="p-3 flex items-center gap-4">
                <div className="text-sm font-medium whitespace-nowrap">
                  <span className="text-primary font-bold">{selectedIds.size}</span> empresa(s) selecionada(s)
                  {selectedValidIds.length < selectedIds.size && (
                    <span className="text-muted-foreground ml-1">
                      ({selectedValidIds.length} com certificado válido)
                    </span>
                  )}
                </div>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  size="sm"
                  onClick={handleStartDownload}
                  disabled={selectedValidIds.length === 0}
                  className="gap-1.5 whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar Selecionadas — {periodoLabel}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={abrirZipPeriodoSelecionadas}
                  disabled={generatingZipMultiplos}
                  className="gap-1.5 whitespace-nowrap border-green-300 text-green-700 dark:text-green-300 hover:bg-green-50 dark:bg-green-500/10"
                >
                  {generatingZipMultiplos ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando...</>
                  ) : (
                    <><FileArchive className="h-3.5 w-3.5" />ZIP Selecionadas</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  className="gap-1 text-muted-foreground whitespace-nowrap"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ═══ Dialog de Seleção de Período para ZIP ═══ */}
      <Dialog open={zipPeriodoDialogOpen} onOpenChange={setZipPeriodoDialogOpen}>
        <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Selecionar Período para ZIP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Info da empresa/seleção */}
            <div className="bg-muted/50 rounded-lg p-3">
              {zipPeriodoMode === "individual" ? (
                <p className="text-sm"><span className="font-medium">Empresa:</span> {zipPeriodoClienteNome}</p>
              ) : (
                <p className="text-sm"><span className="font-medium">{zipPeriodoClienteIds.length} empresa(s)</span> selecionada(s)</p>
              )}
            </div>

            {/* Opção Todos os períodos */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="zip-todos-periodos"
                checked={zipPeriodoTodos}
                onCheckedChange={(checked) => {
                  setZipPeriodoTodos(!!checked);
                  if (checked) setZipPeriodoSelecionados(new Set());
                }}
              />
              <label htmlFor="zip-todos-periodos" className="text-sm font-medium cursor-pointer">
                Todos os períodos
              </label>
              {zipPeriodoTodos && periodosDisponiveis && (
                <Badge variant="secondary" className="ml-auto">
                  {periodosDisponiveis.reduce((s, p) => s + p.totalNotas, 0)} notas
                </Badge>
              )}
            </div>

            <Separator />

            {/* Lista de períodos */}
            <div className="max-h-[300px] overflow-auto space-y-1">
              {periodosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando períodos...</span>
                </div>
              ) : periodosDisponiveis && periodosDisponiveis.length > 0 ? (
                periodosDisponiveis.map((p) => (
                  <div
                    key={p.label}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      zipPeriodoTodos || zipPeriodoSelecionados.has(p.label)
                        ? "bg-primary/5 border border-primary/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                    onClick={() => togglePeriodo(p.label)}
                  >
                    <Checkbox
                      checked={zipPeriodoTodos || zipPeriodoSelecionados.has(p.label)}
                      disabled={zipPeriodoTodos}
                      onCheckedChange={() => togglePeriodo(p.label)}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.label}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {p.totalNotas} nota{p.totalNotas !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileArchive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma nota encontrada</p>
                  <p className="text-xs mt-1">Faça download de notas primeiro</p>
                </div>
              )}
            </div>

            {/* Resumo */}
            {totalNotasSelecionadas > 0 && (
              <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                <p className="text-sm text-green-800 dark:text-green-300">
                  <span className="font-bold text-lg">{totalNotasSelecionadas.toLocaleString("pt-BR")}</span> nota(s) serão incluídas no ZIP
                </p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setZipPeriodoDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarZipComPeriodo}
                disabled={totalNotasSelecionadas === 0 || zipPeriodoLoading}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <FileArchive className="h-4 w-4" />
                Gerar ZIP
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Progresso do ZIP Selecionadas */}
      <Dialog open={zipDialogOpen} onOpenChange={(open) => {
        if (!open && zipStatus && (zipStatus.status === "concluido" || zipStatus.status === "erro")) {
          setZipDialogOpen(false);
          setZipJobId(null);
          zipStartTimeRef.current = null;
        }
      }}>
        <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-auto" onPointerDownOutside={(e) => {
          if (zipStatus?.status === "processando") e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-green-600 dark:text-green-400" />
              {zipStatus?.status === "concluido" ? "ZIP Gerado com Sucesso!" :
               zipStatus?.status === "erro" ? "Erro ao Gerar ZIP" :
               "Gerando ZIP das Selecionadas..."}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {zipStatus && (
              <>
                {/* Barra de progresso com percentual */}
                <div className="space-y-2">
                  <Progress
                    value={zipStatus.total > 0 ? Math.round((zipStatus.processados / zipStatus.total) * 100) : 0}
                    className="h-4"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {zipStatus.processados} de {zipStatus.total} empresas
                    </span>
                    <span className="font-bold text-lg">
                      {zipStatus.total > 0 ? Math.round((zipStatus.processados / zipStatus.total) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* Tempo decorrido */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Tempo decorrido: <strong>{formatElapsed(zipElapsed)}</strong></span>
                  {zipStatus.status === "processando" && zipStatus.processados > 0 && zipStatus.total > 0 && (
                    <span className="ml-auto">
                      Estimativa restante: <strong>
                        {formatElapsed(Math.round(((zipElapsed / zipStatus.processados) * (zipStatus.total - zipStatus.processados))))}
                      </strong>
                    </span>
                  )}
                </div>

                {/* Empresa atual sendo processada */}
                {zipStatus.status === "processando" && zipStatus.empresaAtual && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg px-3 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span className="truncate">Processando: <strong>{zipStatus.empresaAtual}</strong></span>
                  </div>
                )}

                {/* Cards de estatísticas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-700 dark:text-green-300">{zipStatus.totalEmpresas}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Com Notas</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{zipStatus.totalNotas.toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Notas</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{zipStatus.semNotas}</div>
                    <div className="text-xs text-amber-600">Sem Notas</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-red-700 dark:text-red-400">{zipStatus.erros}</div>
                    <div className="text-xs text-red-600">Erros</div>
                  </div>
                </div>

                {/* Sucesso - botão de download */}
                {zipStatus.status === "concluido" && zipStatus.downloadUrl && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">ZIP pronto para download!</span>
                    </div>
                    <a
                      href={zipStatus.downloadUrl}
                      download={zipStatus.fileName || "notas.zip"}
                      className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                    >
                      <Download className="h-5 w-5" />
                      Baixar ZIP ({zipStatus.totalNotas.toLocaleString("pt-BR")} notas de {zipStatus.totalEmpresas} empresas)
                    </a>
                    <p className="text-xs text-muted-foreground">Tempo total: {formatElapsed(zipElapsed)}</p>
                  </div>
                )}

                {/* Concluído sem notas */}
                {zipStatus.status === "concluido" && !zipStatus.downloadUrl && (
                  <div className="flex items-center gap-2 text-amber-600 justify-center pt-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Nenhuma nota encontrada para gerar o ZIP.</span>
                  </div>
                )}

                {/* Erro */}
                {zipStatus.status === "erro" && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                    <XCircle className="h-5 w-5 shrink-0" />
                    <span className="text-sm">{zipStatus.mensagem || "Erro desconhecido ao gerar o ZIP."}</span>
                  </div>
                )}

                {/* Botão fechar */}
                {(zipStatus.status === "concluido" || zipStatus.status === "erro") && (
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setZipDialogOpen(false);
                        setZipJobId(null);
                        zipStartTimeRef.current = null;
                      }}
                    >
                      Fechar
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Loading inicial */}
            {!zipStatus && (
              <div className="flex flex-col items-center justify-center gap-3 py-6">
                <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
                <span className="text-muted-foreground">Iniciando geração do ZIP...</span>
                <span className="text-xs text-muted-foreground">Preparando {selectedIds.size} empresas para processamento</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
