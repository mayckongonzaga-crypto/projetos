import { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { RetryGauge } from "@/components/RetryGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  History,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ShieldX,
  StopCircle,
  Trash2,
  Ban,
  Building2,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileCode2,
  FileWarning,
  AlertTriangle,
  Download,
  FolderArchive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trophy,
  Timer,
  FileCheck,
  FileX,
  BarChart3,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { downloadBase64File } from "@/lib/download-helper";

// Limpa mensagens de erro brutas da API para exibição legível
function limparMensagemErro(msg: string): string {
  if (!msg) return "Erro no download";
  // Remover tags HTML
  let limpa = msg.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  // Classificar erros conhecidos
  if (limpa.includes("429") || limpa.includes("Too Many Requests")) return "API sobrecarregada (429) - muitas requisições simultâneas";
  if (limpa.includes("404") || limpa.includes("não cadastrada")) return "Empresa não cadastrada na API Nacional da NFSe";
  if (limpa.includes("Failed to parse API response")) return "Resposta inválida da API Nacional";
  if (limpa.includes("PKCS12") || limpa.includes("pkcs12") || limpa.includes("MAC verify")) return "Certificado digital inválido ou senha incorreta";
  if (limpa.includes("ECONNREFUSED") || limpa.includes("ENOTFOUND")) return "API Nacional indisponível";
  if (limpa.includes("timeout") || limpa.includes("ETIMEDOUT")) return "Timeout na comunicação com a API";
  if (limpa.includes("ECONNRESET") || limpa.includes("socket disconnected")) return "Conexão interrompida com a API";
  if (limpa.includes("certificate") || limpa.includes("SSL") || limpa.includes("TLS")) return "Erro de conexão SSL/TLS";
  if (limpa.includes("401") || limpa.includes("Certificado não autorizado")) return "Certificado não autorizado pela API";
  if (limpa.includes("403") || limpa.includes("Acesso negado")) return "Acesso negado pela API Nacional";
  if (limpa.includes("500") || limpa.includes("502") || limpa.includes("503")) return "Erro interno da API Nacional";
  if (limpa.includes("decrypt") || limpa.includes("Decrypt")) return "Erro ao descriptografar certificado";
  // Truncar se ainda for muito longo
  if (limpa.length > 80) limpa = limpa.substring(0, 77) + "...";
  return limpa;
}

export default function HistoricoDownloads() {
  const utils = trpc.useUtils();
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: logs, isLoading: logsLoading } = trpc.download.logs.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId, refetchInterval: 3000, placeholderData: (prev: any) => prev }
  );

  // Status da auto-retomada (polling a cada 3s)
  const { data: autoRetomadaStatus } = trpc.settings.getAutoRetomadaStatus.useQuery(
    undefined,
    { enabled: !!contabId, refetchInterval: 3000, placeholderData: (prev: any) => prev }
  );

  // Resumo do lote de downloads
  const { data: batchSummary } = trpc.download.batchSummary.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId, refetchInterval: 3000, placeholderData: (prev: any) => prev }
  );

  // Estado para controlar se o card de resumo foi fechado pelo usuário
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  // Resetar dismiss quando um novo lote iniciar (quando há pendentes/executando)
  const isProcessing = (batchSummary?.executando ?? 0) > 0 || (batchSummary?.pendentes ?? 0) > 0 || (batchSummary?.retomando ?? 0) > 0;
  useEffect(() => {
    if (isProcessing) setSummaryDismissed(false);
  }, [isProcessing]);

  const cancelAllMutation = trpc.download.cancelAll.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.cancelled} download(s) foram parados.`);
      utils.download.logs.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const cancelOneMutation = trpc.download.cancelOne.useMutation({
    onSuccess: () => {
      toast.success("Download parado com sucesso.");
      utils.download.logs.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const clearHistoryMutation = trpc.download.clearHistory.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted} registro(s) removidos do histórico.`);
      utils.download.logs.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro ao limpar: ${err.message}`);
    },
  });

  const retryMutation = trpc.download.retry.useMutation({
    onSuccess: (data) => {
      toast.success(`Download retomado: ${data.totalDownloaded} nota(s) baixada(s), ${data.notasNovas} nova(s)`);
      utils.download.logs.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro ao retomar: ${err.message}`);
    },
  });

  const pdfMutation = trpc.download.historicoRelatorioPdf.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Relatório PDF gerado com sucesso!");
    },
    onError: (err) => {
      toast.error(`Erro ao gerar PDF: ${err.message}`);
    },
  });

  const excelMutation = trpc.download.historicoRelatorioExcel.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Relatório Excel gerado com sucesso!");
    },
    onError: (err) => {
      toast.error(`Erro ao gerar Excel: ${err.message}`);
    },
  });

  // ZIP por empresa individual
  const zipClienteMutation = trpc.download.gerarZipCliente.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas || data.totalNotas === 0) {
        toast.info("Nenhuma nota encontrada para este cliente");
      } else {
        toast.success(`ZIP gerado: ${data.totalNotas} nota(s)`);
        downloadBase64File(data.base64, data.fileName);
      }
    },
    onError: (err) => {
      toast.error(`Erro ao gerar ZIP: ${err.message}`);
    },
  });

  // ZIP de todas as empresas (múltiplos) - versão síncrona para poucas empresas
  const zipMultiplosMutation = trpc.download.gerarZipMultiplos.useMutation({
    onSuccess: (data: any) => {
      if (data.semNotas || data.totalNotas === 0) {
        toast.info("Nenhuma nota encontrada para os clientes selecionados");
      } else {
        toast.success(`ZIP gerado: ${data.totalEmpresas} empresa(s), ${data.totalNotas} nota(s)`);
        downloadBase64File(data.base64, data.fileName);
      }
    },
    onError: (err) => {
      toast.error(`Erro ao gerar ZIP: ${err.message}`);
    },
  });

  // ZIP Todas assíncrono (para muitas empresas)
  const [zipTodasJobId, setZipTodasJobId] = useState<string | null>(null);
  const [zipTodasDialogOpen, setZipTodasDialogOpen] = useState(false);

  const iniciarZipTodasMutation = trpc.download.iniciarZipTodas.useMutation({
    onSuccess: (data) => {
      setZipTodasJobId(data.jobId);
      setZipTodasDialogOpen(true);
    },
    onError: (err) => {
      toast.error(`Erro ao iniciar ZIP: ${err.message}`);
    },
  });

  const { data: zipTodasStatus } = trpc.download.zipTodasStatus.useQuery(
    { jobId: zipTodasJobId! },
    {
      enabled: !!zipTodasJobId && zipTodasDialogOpen,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data && (data.status === "concluido" || data.status === "erro" || data.status === "cancelado")) return false;
        return 2000;
      },
    }
  );

  const cancelarZipTodasMutation = trpc.download.cancelarZipTodas.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Geração do ZIP cancelada com sucesso");
      } else {
        toast.error(data.message);
      }
    },
    onError: (err) => {
      toast.error(`Erro ao cancelar: ${err.message}`);
    },
  });

  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [zippingClienteId, setZippingClienteId] = useState<number | null>(null);

  // ─── Paginação ──────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [customPageSize, setCustomPageSize] = useState("");

  // ─── Seleção com checkboxes ─────────────────────────────────────
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set());

  // Logs que podem ser selecionados para ZIP (concluídos com notas)
  const selectableLogs = useMemo(() => 
    logs?.filter(l => l.status === "concluido" && (l.totalXml ?? 0) > 0 && l.clienteId != null) ?? []
  , [logs]);

  const allSelected = selectableLogs.length > 0 && selectableLogs.every(l => selectedLogIds.has(l.id));
  const someSelected = selectableLogs.some(l => selectedLogIds.has(l.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(selectableLogs.map(l => l.id)));
    }
  };

  const toggleSelectLog = (logId: number) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  // IDs de clientes selecionados (deduplicated)
  const selectedClienteIds = useMemo(() => {
    const ids = new Set<number>();
    for (const log of selectableLogs) {
      if (selectedLogIds.has(log.id) && log.clienteId != null) {
        ids.add(log.clienteId);
      }
    }
    return Array.from(ids);
  }, [selectableLogs, selectedLogIds]);

  const handleZipSelecionadas = () => {
    if (selectedClienteIds.length === 0) {
      toast.error("Selecione ao menos uma empresa para gerar o ZIP.");
      return;
    }
    zipMultiplosMutation.mutate({
      clienteIds: selectedClienteIds,
      contabilidadeId: contabId,
    });
  };

  // Retomar somente PDFs
  const retryPdfsMutation = trpc.download.retryPdfs.useMutation({
    onSuccess: (data) => {
      if (data.totalPdfs === 0) {
        toast.info(data.message || "Todos os PDFs já foram baixados.");
      } else {
        toast.success(`Retomada de ${data.totalPdfs} PDF(s) iniciada para ${data.empresas} empresa(s)`);
      }
      utils.download.logs.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro ao retomar PDFs: ${err.message}`);
    },
  });

  const cancelRetryPdfsMutation = trpc.download.cancelRetryPdfs.useMutation({
    onSuccess: () => {
      toast.success("Retomada de PDFs cancelada.");
    },
  });

  // Status da retomada de PDFs (polling)
  const { data: retryPdfsStatus } = trpc.settings.getRetryPdfsStatus.useQuery(
    undefined,
    { enabled: !!contabId, refetchInterval: 2000, placeholderData: (prev: any) => prev }
  );

  // Contagem de PDFs pendentes
  const { data: pdfsPendentes } = trpc.settings.countPdfsPendentes.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId, refetchInterval: 10000, placeholderData: (prev: any) => prev }
  );

  // Retomar todos com erro
  const retryAllMutation = trpc.download.retryAll.useMutation({
    onSuccess: (data) => {
      if (data.total === 0) {
        toast.info("Nenhum download com erro ou cancelado para retomar.");
      } else {
        toast.success(`${data.retomados} download(s) retomado(s)${(data.falhas ?? 0) > 0 ? `, ${data.falhas} não puderam ser retomados` : ""}`);
      }
      utils.download.logs.invalidate();
    },
    onError: (err) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  // ─── Logs ordenados (para paginação) ─────────────────────────────
  const sortedLogs = useMemo(() => {
    if (!logs) return [];
    return [...logs].sort((a, b) => {
      const ordem: Record<string, number> = { concluido: 0, executando: 1, retomando: 2, pendente: 3, erro: 4, cancelado: 5 };
      const ordemA = ordem[a.status] ?? 4;
      const ordemB = ordem[b.status] ?? 4;
      if (ordemA !== ordemB) return ordemA - ordemB;
      if (a.status === "concluido" && b.status === "concluido") {
        const dateA = a.finalizadoEm ? new Date(a.finalizadoEm).getTime() : 0;
        const dateB = b.finalizadoEm ? new Date(b.finalizadoEm).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedLogs.slice(start, start + pageSize);
  }, [sortedLogs, currentPage, pageSize]);

  // Reset para página 1 quando logs mudam significativamente
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage]);

  // Calcular progresso geral
  const executandoLogs = logs?.filter(l => l.status === "executando") ?? [];
  const pendentesLogs = logs?.filter(l => l.status === "pendente") ?? [];
  const retomandoLogs = logs?.filter(l => l.status === "retomando") ?? [];
  const concluidos_list = logs?.filter(l => l.status === "concluido") ?? [];
  const erros_list = logs?.filter(l => l.status === "erro") ?? [];

  // Usar contagem do engine (batchSummary) quando disponível — é mais preciso que contar logs no banco
  // O engine atualiza em tempo real, enquanto os logs no banco podem ter timing issues
  const executandoCount = batchSummary?.executando ?? executandoLogs.length;
  const pendentesCount = batchSummary?.pendentes ?? pendentesLogs.length;
  const retomandoCount = batchSummary?.retomando ?? retomandoLogs.length;

  // Para os cards: usar activeLogIds do engine para saber exatamente quais empresas estão ativas
  // O engine salva os IDs dos logs que estão sendo processados em tempo real
  const activeLogIds = batchSummary?.activeLogIds ?? [];
  const activeLogIdSet = new Set(activeLogIds);
  
  // Cards executando: logs que o engine reporta como ativos (por ID)
  // Fallback: logs com status "executando" no banco
  const executandoCards = activeLogIds.length > 0
    ? (logs?.filter(l => activeLogIdSet.has(l.id)) ?? [])
    : executandoLogs;
  // Cards pendentes: todos os pendentes que NÃO estão nos ativos do engine
  const pendentesCards = pendentesLogs.filter(l => !activeLogIdSet.has(l.id));

  const temPendentes = pendentesCount > 0;
  const temRetomando = retomandoCount > 0;
  const temExecutando = executandoCount > 0;
  // Progresso geral: contar empresas processadas (concluídas + erros) vs total
  const totalEmpresas = logs?.length ?? 0;
  const processadas = concluidos_list.length + erros_list.length;
  const percentGeralEmpresas = totalEmpresas > 0 ? Math.min(100, Math.round((processadas / totalEmpresas) * 100)) : 0;
  // Progresso de notas (só das executando - usar executandoCards que inclui os reais)
  const totalEsperadoGeral = executandoCards.reduce((acc, l) => acc + (l.totalEsperado ?? 0), 0);
  const progressoGeral = executandoCards.reduce((acc, l) => acc + (l.progresso ?? 0), 0);
  const percentGeral = totalEsperadoGeral > 0 ? Math.min(100, Math.round((progressoGeral / totalEsperadoGeral) * 100)) : 0;

  // Contagem de histórico que pode ser limpo
  const historicoLimpavel = logs?.filter(l => l.status === "concluido" || l.status === "erro" || l.status === "cancelado").length ?? 0;

  // Downloads com erro ou cancelados (para botão Retomar Todas)
  const logsComErro = logs?.filter(l => l.status === "erro" || l.status === "cancelado") ?? [];
  const temErros = logsComErro.length > 0;

  // Empresas concluídas com notas (para ZIP Todas)
  const concluidos = logs?.filter(l => l.status === "concluido" && (l.totalXml ?? 0) > 0) ?? [];
  // IDs únicos de clientes concluídos
  const clienteIdsConcluidos = Array.from(new Set(concluidos.map(l => l.clienteId).filter((id): id is number => id != null)));

  const handleZipTodas = () => {
    if (clienteIdsConcluidos.length === 0) {
      toast.error("Nenhuma empresa com notas baixadas para gerar ZIP.");
      return;
    }
    // Para muitas empresas (>10), usar versão assíncrona
    if (clienteIdsConcluidos.length > 10) {
      iniciarZipTodasMutation.mutate({
        clienteIds: clienteIdsConcluidos,
        contabilidadeId: contabId,
      });
    } else {
      zipMultiplosMutation.mutate({
        clienteIds: clienteIdsConcluidos,
        contabilidadeId: contabId,
      });
    }
  };

  // Limpar seleção quando logs mudam
  // (não resetar automaticamente para manter seleção durante polling)

  const handleZipEmpresa = (clienteId: number) => {
    setZippingClienteId(clienteId);
    zipClienteMutation.mutate(
      { clienteId, contabilidadeId: contabId },
      { onSettled: () => setZippingClienteId(null) }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Histórico de Downloads</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Acompanhe o progresso e histórico de todos os downloads realizados
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

            {/* Botão ZIP Selecionadas */}
            {someSelected && (
              <Button
                variant="default"
                size="sm"
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleZipSelecionadas}
                disabled={zipMultiplosMutation.isPending}
              >
                {zipMultiplosMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderArchive className="h-4 w-4" />
                )}
                {zipMultiplosMutation.isPending ? "Gerando ZIP..." : `ZIP Selecionadas (${selectedClienteIds.length})`}
              </Button>
            )}

            {/* Botão ZIP Todas as Empresas */}
            {clienteIdsConcluidos.length > 0 && !someSelected && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleZipTodas}
                disabled={zipMultiplosMutation.isPending || iniciarZipTodasMutation.isPending}
              >
                {(zipMultiplosMutation.isPending || iniciarZipTodasMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderArchive className="h-4 w-4 text-purple-600" />
                )}
                {(zipMultiplosMutation.isPending || iniciarZipTodasMutation.isPending) ? "Gerando ZIP..." : `ZIP Todas (${clienteIdsConcluidos.length})`}
              </Button>
            )}

            {/* Botão Retomar Todas */}
            {temErros && !temExecutando && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:bg-blue-500/10">
                    <RefreshCw className="h-4 w-4" />
                    Retomar Todas ({logsComErro.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Retomar todos os downloads com erro?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá retomar {logsComErro.length} download(s) que falharam ou foram cancelados. Cada empresa será processada novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => contabId && retryAllMutation.mutate({ contabilidadeId: contabId })}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {retryAllMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Retomando...</>
                      ) : (
                        <>Retomar Todas</>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Botão Retomar PDFs - SEMPRE VISÍVEL */}
            {retryPdfsStatus?.ativa ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                  <span className="text-sm text-orange-700 dark:text-orange-300">
                    PDFs: {retryPdfsStatus.processados}/{retryPdfsStatus.total}
                    {retryPdfsStatus.empresa && <span className="text-xs ml-1 opacity-70">({retryPdfsStatus.empresa})</span>}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50"
                  onClick={() => contabId && cancelRetryPdfsMutation.mutate({ contabilidadeId: contabId })}
                >
                  <StopCircle className="h-3 w-3" />
                  Parar
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                onClick={() => contabId && retryPdfsMutation.mutate({ contabilidadeId: contabId })}
                disabled={retryPdfsMutation.isPending}
              >
                {retryPdfsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileCheck className="h-4 w-4" />
                )}
                Retomar PDFs{(pdfsPendentes?.total ?? 0) > 0 ? ` (${pdfsPendentes?.total})` : ""}
              </Button>
            )}

            {/* Botão Parar Todos */}
            {(temExecutando || temPendentes || temRetomando) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <StopCircle className="h-4 w-4" />
                    Parar Downloads
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Parar todos os downloads?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá cancelar {executandoCount + pendentesCount + retomandoCount} download(s) em andamento/na fila. As notas já processadas serão mantidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => contabId && cancelAllMutation.mutate({ contabilidadeId: contabId })}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Parar Todos
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Botão Limpar Histórico */}
            {historicoLimpavel > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Limpar Histórico
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar histórico de downloads?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá remover {historicoLimpavel} registro(s) concluídos, com erro ou cancelados. Downloads em andamento não serão afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => contabId && clearHistoryMutation.mutate({ contabilidadeId: contabId })}
                    >
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Botões de Relatório */}
            {logs && logs.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => contabId && pdfMutation.mutate({ contabilidadeId: contabId })}
                  disabled={pdfMutation.isPending}
                >
                  {pdfMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-600" />
                  )}
                  Relatório PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => contabId && excelMutation.mutate({ contabilidadeId: contabId })}
                  disabled={excelMutation.isPending}
                >
                  {excelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                  Relatório Excel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Banner de Auto-Retomada */}
        {autoRetomadaStatus?.ativa && (
          <Card className={`border-2 ${
            autoRetomadaStatus.fase === "aguardando" ? "border-amber-300 bg-amber-50 dark:bg-amber-500/10" :
            autoRetomadaStatus.fase === "retomando" ? "border-purple-300 dark:border-purple-500/30 bg-purple-50/70 dark:bg-purple-500/10" :
            autoRetomadaStatus.fase === "concluido" ? "border-green-300 bg-green-50 dark:bg-green-500/10" :
            "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50/70 dark:bg-gray-800/50"
          }`}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {autoRetomadaStatus.fase === "aguardando" ? (
                  <>
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-500/20">
                      <Clock className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Auto-Retomada Programada</p>
                      <p className="text-xs text-amber-600">
                        Aguardando {autoRetomadaStatus.tempoEspera || "00:00:30"} antes de retomar downloads com erro...
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-800 dark:text-amber-300 border-amber-300">
                      <Clock className="h-3 w-3 mr-1" />Aguardando
                    </Badge>
                  </>
                ) : autoRetomadaStatus.fase === "retomando" ? (
                  <>
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-500/20">
                      <RefreshCw className="h-5 w-5 text-purple-600 animate-spin" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-400">
                        Auto-Retomada em Andamento
                        {autoRetomadaStatus.retomadaInfinita && (
                          <span className="ml-2 text-[10px] font-normal bg-purple-200 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">\u221E Infinita</span>
                        )}
                      </p>
                      <p className="text-xs text-purple-600">
                        {autoRetomadaStatus.rodada
                          ? autoRetomadaStatus.retomadaInfinita
                            ? `Rodada ${autoRetomadaStatus.rodada} / \u221E: `
                            : `Rodada ${autoRetomadaStatus.rodada} / ${autoRetomadaStatus.maxRodadas ?? '?'}: `
                          : ""}
                        {autoRetomadaStatus.pendentes ?? autoRetomadaStatus.totalErros ?? 0} empresa(s) na fila
                        {(autoRetomadaStatus.retomados ?? 0) > 0 && ` \u2014 ${autoRetomadaStatus.retomados} retomado(s)`}
                        {(autoRetomadaStatus.falhas ?? 0) > 0 && ` \u2014 ${autoRetomadaStatus.falhas} falha(s)`}
                      </p>
                      <Progress
                        value={autoRetomadaStatus.totalErros ? Math.round((((autoRetomadaStatus.retomados || 0) + (autoRetomadaStatus.falhas || 0)) / autoRetomadaStatus.totalErros) * 100) : 0}
                        className="h-2 mt-2"
                      />
                    </div>
                    <Badge className="bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border-purple-300">
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />Retomando
                    </Badge>
                  </>
                ) : autoRetomadaStatus.fase === "concluido" ? (
                  <>
                    <div className="p-2 rounded-full bg-green-100 dark:bg-green-500/20">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300">Auto-Retomada Concluída</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {autoRetomadaStatus.retomados || 0} empresa(s) retomada(s)
                        {(autoRetomadaStatus.falhas ?? 0) > 0 && `, ${autoRetomadaStatus.falhas} falha(s)`}
                      </p>
                    </div>
                    <Badge className="bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300 border-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />Concluído
                    </Badge>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Card de Resumo Completo do Lote */}
        {batchSummary?.ativo && !summaryDismissed && (() => {
          const s = batchSummary;
          const tempoSeg = Math.floor((s.tempoExecucaoMs ?? 0) / 1000);
          const horas = Math.floor(tempoSeg / 3600);
          const minutos = Math.floor((tempoSeg % 3600) / 60);
          const segundos = tempoSeg % 60;
          const tempoFormatado = horas > 0
            ? `${horas}h ${minutos}m ${segundos}s`
            : minutos > 0
              ? `${minutos}m ${segundos}s`
              : `${segundos}s`;
          const todosSucesso = s.loteTerminou && (s.comErro ?? 0) === 0 && (s.cancelados ?? 0) === 0;
          const emAndamento = !s.loteTerminou;
          const borderColor = emAndamento ? "border-blue-300 dark:border-blue-500/30" : todosSucesso ? "border-green-300 dark:border-green-500/30" : "border-amber-300 dark:border-amber-500/30";
          const bgColor = emAndamento ? "bg-blue-50 dark:bg-blue-500/10" : todosSucesso ? "bg-green-50 dark:bg-green-500/10" : "bg-amber-50 dark:bg-amber-500/10";
          const headerIcon = emAndamento
            ? <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />
            : todosSucesso
              ? <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
              : <BarChart3 className="h-5 w-5 text-amber-600" />;
          const headerText = emAndamento ? "Resumo em Tempo Real" : todosSucesso ? "Downloads Concluídos com Sucesso!" : "Downloads Finalizados";
          const headerColor = emAndamento ? "text-blue-800 dark:text-blue-300" : todosSucesso ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300";

          return (
            <Card className={`border-2 ${borderColor} ${bgColor} relative`}>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setSummaryDismissed(true)}
                title="Fechar resumo"
              >
                <X className="h-4 w-4" />
              </Button>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-base font-semibold flex items-center gap-2 ${headerColor}`}>
                    {headerIcon}
                    {headerText}
                  </CardTitle>
                  {(s.percentSucesso ?? 0) > 0 && s.loteTerminou && (
                    <Badge className={`${todosSucesso ? 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300 border-green-300' : 'bg-amber-100 text-amber-800 dark:text-amber-300 border-amber-300'}`}>
                      {s.percentSucesso}% sucesso
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Grid principal de estatísticas */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-2.5">
                  {/* Total de Empresas */}
                  <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-slate-600 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <Building2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{s.totalEmpresas ?? 0}</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">empresa(s)</p>
                  </div>

                  {/* Bem Sucedidos (com notas) */}
                  <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-green-200 dark:border-green-700/50 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Sucesso</span>
                    </div>
                    <span className="text-2xl font-bold text-green-700 dark:text-green-300">{s.comNotas ?? 0}</span>
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">com notas</p>
                  </div>

                  {/* Sem Notas */}
                  <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-slate-200 dark:border-slate-600 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <FileWarning className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Sem Notas</span>
                    </div>
                    <span className="text-2xl font-bold text-slate-600 dark:text-slate-300">{s.semNotas ?? 0}</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">nenhuma nota</p>
                  </div>

                  {/* Com Erro (excluindo cert vencido) */}
                  <div className={`bg-white dark:bg-white/5 rounded-lg p-3 border text-center ${(s.errosSemCertVencido ?? 0) > 0 ? 'border-red-200 dark:border-red-700/50' : 'border-slate-200 dark:border-slate-600'}`}>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <XCircle className={`h-4 w-4 ${(s.errosSemCertVencido ?? 0) > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`} />
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${(s.errosSemCertVencido ?? 0) > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>Erros</span>
                    </div>
                    <span className={`text-2xl font-bold ${(s.errosSemCertVencido ?? 0) > 0 ? 'text-red-600 dark:text-red-300' : 'text-slate-400 dark:text-slate-500'}`}>{s.errosSemCertVencido ?? 0}</span>
                    <p className={`text-[10px] mt-0.5 ${(s.errosSemCertVencido ?? 0) > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>empresa(s)</p>
                  </div>

                  {/* Cert Vencido */}
                  {(s.certVencidos ?? 0) > 0 && (
                    <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-orange-200 dark:border-orange-700/50 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <ShieldX className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                        <span className="text-[10px] font-medium text-orange-500 dark:text-orange-400 uppercase tracking-wide">Cert. Venc.</span>
                      </div>
                      <span className="text-2xl font-bold text-orange-600 dark:text-orange-300">{s.certVencidos}</span>
                      <p className="text-[10px] text-orange-500 dark:text-orange-400 mt-0.5">vencido(s)</p>
                    </div>
                  )}

                  {/* Ainda serão processados (retomando + pendentes + executando) */}
                  {(s.aindaSerao ?? 0) > 0 && (
                    <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-purple-200 dark:border-purple-700/50 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <RefreshCw className="h-4 w-4 text-purple-500 dark:text-purple-400 animate-spin" />
                        <span className="text-[10px] font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wide">Restantes</span>
                      </div>
                      <span className="text-2xl font-bold text-purple-600 dark:text-purple-300">{s.aindaSerao}</span>
                      <p className="text-[10px] text-purple-500 dark:text-purple-400 mt-0.5">
                        {(s.executando ?? 0) > 0 && `${s.executando} exec.`}
                        {(s.executando ?? 0) > 0 && (s.pendentes ?? 0) > 0 && " + "}
                        {(s.pendentes ?? 0) > 0 && `${s.pendentes} fila`}
                        {(s.retomando ?? 0) > 0 && ((s.executando ?? 0) > 0 || (s.pendentes ?? 0) > 0) && " + "}
                        {(s.retomando ?? 0) > 0 && `${s.retomando} retom.`}
                      </p>
                    </div>
                  )}

                  {/* Total XMLs */}
                  <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-blue-200 dark:border-blue-700/50 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <FileCode2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      <span className="text-[10px] font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wide">XMLs</span>
                    </div>
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-300">{s.totalXmls ?? 0}</span>
                    <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">baixados</p>
                  </div>

                  {/* Total PDFs */}
                  <div className="bg-white dark:bg-white/5 rounded-lg p-3 border border-emerald-200 dark:border-emerald-700/50 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <FileText className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                      <span className="text-[10px] font-medium text-emerald-500 dark:text-emerald-400 uppercase tracking-wide">PDFs</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{s.totalPdfs ?? 0}</span>
                    <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5">baixados</p>
                  </div>
                  {/* Gauge visual da Auto-Retomada */}
                  {autoRetomadaStatus?.ativa && autoRetomadaStatus.rodada && (
                    <div className="rounded-lg p-3 flex items-center justify-center" style={{ minWidth: 170 }}>
                      <RetryGauge
                        rodada={autoRetomadaStatus.rodada}
                        maxRodadas={autoRetomadaStatus.maxRodadas ?? null}
                        retomadaInfinita={!!autoRetomadaStatus.retomadaInfinita}
                        fase={autoRetomadaStatus.fase}
                        retomados={autoRetomadaStatus.retomados ?? 0}
                        falhas={autoRetomadaStatus.falhas ?? 0}
                        pendentes={autoRetomadaStatus.pendentes ?? 0}
                        totalErros={autoRetomadaStatus.totalErros ?? 0}
                      />
                    </div>
                  )}
                </div>

                {/* Linha de detalhes extras */}
                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/60">
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
                    <Timer className="h-3.5 w-3.5" />
                    Tempo: <strong>{tempoFormatado}</strong>
                  </span>
                  {(s.notasNovas ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                      <FileCheck className="h-3.5 w-3.5" />
                      {s.notasNovas} nota(s) nova(s)
                    </span>
                  )}
                  {(s.totalErrosPdf ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
                      <FileX className="h-3.5 w-3.5" />
                      {s.totalErrosPdf} PDF(s) com erro
                    </span>
                  )}
                  {(s.cancelados ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-orange-600">
                      <Ban className="h-3.5 w-3.5" />
                      {s.cancelados} cancelado(s)
                    </span>
                  )}
                  {(s.totalNotas ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      <Download className="h-3.5 w-3.5" />
                      {s.totalNotas} nota(s) total
                    </span>
                  )}
                  {s.iniciadoEm && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 ml-auto">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(s.iniciadoEm).toLocaleString("pt-BR")}
                      {s.finalizadoEm && (
                        <> → {new Date(s.finalizadoEm).toLocaleTimeString("pt-BR")}</>
                      )}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Progresso Geral com nome das empresas */}
        {(temExecutando || temPendentes || temRetomando) && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-500/10">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-800 dark:text-blue-300">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  Download em Andamento
                </CardTitle>
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  {processadas}/{totalEmpresas} empresas ({percentGeralEmpresas}%)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Contadores detalhados */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300 font-medium">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {concluidos_list.length} concluído(s)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 dark:text-blue-300 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {executandoCount} executando
                  </span>
                  {temRetomando && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 font-medium">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      {retomandoCount} retomando
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {pendentesCards.length} na fila
                  </span>
                  {erros_list.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-800 dark:text-red-300 font-medium">
                      <XCircle className="h-3.5 w-3.5" />
                      {erros_list.length} erro(s)
                    </span>
                  )}
                </div>
                <Progress value={percentGeralEmpresas} className="h-3" />
                {executandoCount > 0 && totalEsperadoGeral > 0 && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {progressoGeral} de {totalEsperadoGeral} nota(s) processadas nas empresas em execução
                  </p>
                )}

                {/* Lista de empresas em execução */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {/* Empresas retomando */}
                  {retomandoLogs.map((log) => (
                    <div key={log.id} className="bg-white dark:bg-white/5 rounded-lg px-3 py-2.5 border border-purple-200 dark:border-purple-800 text-sm min-w-[220px] max-w-[280px]">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <RefreshCw className="h-3.5 w-3.5 text-purple-400 shrink-0 animate-spin" />
                          <span className="font-medium text-purple-900 dark:text-purple-200 truncate block">
                            {log.clienteNome || "Empresa"}
                          </span>
                        </div>
                        <Badge className="bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[10px] px-1.5 py-0 h-5 shrink-0">
                          Retomando
                        </Badge>
                      </div>
                      <span className="text-xs text-purple-500 block truncate" title={log.etapa || undefined}>
                        {log.etapa || 'Aguardando retomada...'}
                      </span>
                    </div>
                  ))}
                  {/* Empresas executando (usa executandoCards que inclui pendentes sendo processados) */}
                  {executandoCards.map((log) => {
                    const logPercent = (log.totalEsperado ?? 0) > 0
                      ? Math.min(100, Math.round(((log.progresso ?? 0) / (log.totalEsperado ?? 1)) * 100))
                      : 0;
                    return (
                      <div key={log.id} className="bg-white dark:bg-white/5 rounded-lg px-3 py-2.5 border border-blue-200 dark:border-blue-800/60 text-sm min-w-[220px] max-w-[280px]">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Building2 className="h-3.5 w-3.5 text-blue-400 dark:text-blue-300 shrink-0" />
                            <span className="font-medium text-blue-900 dark:text-blue-100 truncate block">
                              {log.clienteNome || "Empresa"}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => cancelOneMutation.mutate({ logId: log.id, contabilidadeId: contabId! })}
                            disabled={cancelOneMutation.isPending}
                            title="Parar este download"
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Progress value={logPercent} className="h-2 mb-1.5" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {log.progresso ?? 0}/{log.totalEsperado ?? "?"} notas
                          </span>
                          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">{logPercent}%</span>
                        </div>
                        {((log.totalXml ?? 0) > 0 || (log.totalPdf ?? 0) > 0) && (
                          <span className="text-xs text-blue-500">
                            XML: {log.totalXml ?? 0} | PDF: {log.totalPdf ?? 0}
                            {(log.errosPdf ?? 0) > 0 && <span className="text-red-500"> | Erros: {log.errosPdf}</span>}
                          </span>
                        )}
                        {log.etapa && (
                          <span className="text-xs text-blue-500 block truncate" title={log.etapa}>
                            {log.etapa}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela de Histórico */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Histórico Completo
              </CardTitle>
              {logs && logs.length > 0 && (
                <span className="text-xs text-muted-foreground">{logs.length} registro(s)</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={someSelected && !allSelected ? "indeterminate" : allSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Selecionar todas"
                        />
                      </TableHead>
                      <TableHead className="w-[50px] text-center">#</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            <FileCode2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            XMLs
                          </TooltipTrigger>
                          <TooltipContent>XMLs baixados com sucesso</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            <FileText className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            PDFs
                          </TooltipTrigger>
                          <TooltipContent>PDFs (DANFSe) baixados com sucesso</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1 mx-auto">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            Erros
                          </TooltipTrigger>
                          <TooltipContent>PDFs que falharam após todas as tentativas</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Carregando histórico...
                        </TableCell>
                      </TableRow>
                    ) : !logs || logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                          Nenhum download realizado ainda
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLogs.map((log, index) => {
                        const globalIndex = (currentPage - 1) * pageSize + index;
                        const progresso = log.progresso ?? 0;
                        const totalEsperado = log.totalEsperado ?? 0;
                        const percent = totalEsperado > 0 ? Math.round((progresso / totalEsperado) * 100) : (log.status === "concluido" ? 100 : 0);
                        const xmlCount = log.totalXml ?? 0;
                        const pdfCount = log.totalPdf ?? 0;
                        const errosCount = log.errosPdf ?? 0;
                        const temNotas = xmlCount > 0 || pdfCount > 0;

                        const isSelectable = log.status === "concluido" && (log.totalXml ?? 0) > 0 && log.clienteId != null;
                        const isSelected = selectedLogIds.has(log.id);

                        return (
                          <TableRow key={log.id} className={`${log.certificadoVencido ? "bg-red-50/50 dark:bg-red-500/5" : ""} ${isSelected ? "bg-purple-50/50 dark:bg-purple-500/5" : ""}`}>
                            <TableCell>
                              {isSelectable ? (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelectLog(log.id)}
                                  aria-label={`Selecionar ${log.clienteNome}`}
                                />
                              ) : (
                                <span className="block w-4" />
                              )}
                            </TableCell>
                            <TableCell className="text-center text-sm font-mono text-muted-foreground">
                              {globalIndex + 1}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {log.iniciadoEm ? new Date(log.iniciadoEm).toLocaleString("pt-BR") : "-"}
                            </TableCell>
                            <TableCell className="font-medium text-sm max-w-[200px] truncate" title={log.clienteNome || ""}>
                              {log.clienteNome || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {log.clienteCnpj || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{log.tipo === "manual" ? "Manual" : "Agendado"}</Badge>
                            </TableCell>

                            {/* XMLs */}
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">
                                <FileCode2 className="h-3.5 w-3.5" />
                                {xmlCount}
                              </span>
                            </TableCell>

                            {/* PDFs */}
                            <TableCell className="text-center">
                              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-300">
                                <FileText className="h-3.5 w-3.5" />
                                {pdfCount}
                              </span>
                            </TableCell>

                            {/* Erros PDF */}
                            <TableCell className="text-center">
                              {errosCount > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
                                      <AlertTriangle className="h-3.5 w-3.5" />
                                      {errosCount}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {errosCount} PDF(s) falharam após todas as tentativas de retry
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-sm text-muted-foreground">0</span>
                              )}
                            </TableCell>

                            <TableCell className="min-w-[150px]">
                              {log.status === "executando" ? (
                                <div className="space-y-1">
                                  <Progress value={percent} className="h-2" />
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">{percent}%</span>
                                    <span className="text-xs text-muted-foreground">{progresso}/{totalEsperado}</span>
                                  </div>
                                  {log.etapa && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 block truncate max-w-[200px]" title={log.etapa}>
                                      {log.etapa}
                                    </span>
                                  )}
                                </div>
                              ) : log.certificadoVencido ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-red-600 font-semibold">Certificado digital vencido</span>
                                  <span className="text-xs text-red-500">Renove o certificado para baixar</span>
                                </div>
                              ) : log.status === "concluido" && totalEsperado === 0 && xmlCount === 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 font-semibold">Nenhuma nota encontrada</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">Sem notas no período selecionado</span>
                                </div>
                              ) : log.status === "concluido" && errosCount > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">100% - XML: {xmlCount} baixados</span>
                                  <span className="text-xs text-amber-600 font-medium">PDF: {pdfCount} OK, {errosCount} com erro</span>
                                  {log.etapa && log.etapa !== "Concluído" && (
                                    <span className="text-xs text-muted-foreground block truncate max-w-[200px]" title={log.etapa}>
                                      {log.etapa}
                                    </span>
                                  )}
                                </div>
                              ) : log.status === "concluido" ? (
                                <div className="flex flex-col">
                                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">100%</span>
                                  {log.etapa && log.etapa !== "Concluído" && (
                                    <span className="text-xs text-muted-foreground block truncate max-w-[200px]" title={log.etapa}>
                                      {log.etapa}
                                    </span>
                                  )}
                                </div>
                              ) : log.status === "erro" ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-red-600 font-semibold">
                                    {limparMensagemErro(log.etapa || log.erro || "")}
                                  </span>
                                  {log.erro && (
                                    <span className="text-xs text-red-400 block truncate max-w-[250px] cursor-help" title={log.erro}>
                                      Passe o mouse para ver detalhes
                                    </span>
                                  )}
                                </div>
                              ) : log.status === "cancelado" ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-orange-600 font-medium">{percent}% - Cancelado pelo usuário</span>
                                </div>
                              ) : log.status === "retomando" ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-purple-600 font-medium">{log.etapa || 'Aguardando retomada...'}</span>
                                </div>
                              ) : log.status === "pendente" ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">{log.etapa || 'Aguardando na fila...'}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.certificadoVencido ? (
                                <Badge variant="destructive" className="gap-1">
                                  <ShieldX className="h-3 w-3" />Cert. Vencido
                                </Badge>
                              ) : log.status === "concluido" && totalEsperado === 0 && xmlCount === 0 ? (
                                <Badge className="bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 hover:bg-gray-100 border border-gray-300 dark:border-gray-600 gap-1">
                                  <FileWarning className="h-3 w-3" />Sem Notas
                                </Badge>
                              ) : log.status === "concluido" ? (
                                <Badge className="bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 dark:text-green-300 hover:bg-green-100 gap-1">
                                  <CheckCircle className="h-3 w-3" />Concluído
                                </Badge>
                              ) : log.status === "cancelado" ? (
                                <Badge className="bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-300 hover:bg-orange-100 gap-1">
                                  <Ban className="h-3 w-3" />Cancelado
                                </Badge>
                              ) : log.status === "erro" ? (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />Erro
                                </Badge>
                              ) : log.status === "executando" ? (
                                <Badge className="bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 dark:text-blue-300 hover:bg-blue-100 gap-1">
                                  <Loader2 className="h-3 w-3 animate-spin" />Executando
                                </Badge>
                              ) : log.status === "retomando" ? (
                                <Badge className="bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 hover:bg-purple-100 gap-1">
                                  <RefreshCw className="h-3 w-3 animate-spin" />Retomando
                                </Badge>
                              ) : log.status === "pendente" ? (
                                <Badge className="bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 hover:bg-sky-100 gap-1">
                                  <Clock className="h-3 w-3" />Na Fila
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <Clock className="h-3 w-3 mr-1" />Desconhecido
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {/* Botão Parar (quando executando) */}
                                {log.status === "executando" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                                    onClick={() => cancelOneMutation.mutate({ logId: log.id, contabilidadeId: contabId! })}
                                    disabled={cancelOneMutation.isPending}
                                  >
                                    <StopCircle className="h-3.5 w-3.5" />
                                    Parar
                                  </Button>
                                )}

                                {/* Botão Retomar (quando erro ou cancelado) */}
                                {(log.status === "cancelado" || log.status === "erro") && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:bg-blue-500/10"
                                      onClick={() => {
                                        setRetryingId(log.id);
                                        retryMutation.mutate(
                                          { logId: log.id, contabilidadeId: contabId! },
                                          { onSettled: () => setRetryingId(null) }
                                        );
                                      }}
                                      disabled={retryMutation.isPending || retryingId === log.id}
                                    >
                                      {retryingId === log.id ? (
                                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Retomando...</>
                                      ) : (
                                        <><RefreshCw className="h-3.5 w-3.5" />Retomar</>
                                      )}
                                    </Button>
                                    {log.erro && (
                                      <span className="text-xs text-red-600 max-w-[150px] truncate block" title={log.erro}>
                                        {limparMensagemErro(log.erro)}
                                      </span>
                                    )}
                                  </>
                                )}

                                {/* Botão ZIP (quando concluído e tem notas) */}
                                {log.status === "concluido" && temNotas && log.clienteId && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-500/10"
                                    onClick={() => handleZipEmpresa(log.clienteId!)}
                                    disabled={zipClienteMutation.isPending && zippingClienteId === log.clienteId}
                                  >
                                    {zipClienteMutation.isPending && zippingClienteId === log.clienteId ? (
                                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Gerando...</>
                                    ) : (
                                      <><Download className="h-3.5 w-3.5" />ZIP</>
                                    )}
                                  </Button>
                                )}

                                {/* Traço quando não há ação */}
                                {log.status !== "executando" && log.status !== "cancelado" && log.status !== "erro" && !(log.status === "concluido" && temNotas && log.clienteId) && (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>

            {/* Controles de Paginação */}
            {sortedLogs.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Exibir</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      if (val === "custom") return;
                      setPageSize(parseInt(val));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[80px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200].map(n => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>por página</span>
                  <span className="mx-1 text-muted-foreground/50">|</span>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    placeholder="Outro"
                    className="w-[70px] h-8 text-center"
                    value={customPageSize}
                    onChange={(e) => setCustomPageSize(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(customPageSize);
                        if (val >= 1 && val <= 1000) {
                          setPageSize(val);
                          setCurrentPage(1);
                          setCustomPageSize("");
                        }
                      }
                    }}
                    onBlur={() => {
                      const val = parseInt(customPageSize);
                      if (val >= 1 && val <= 1000) {
                        setPageSize(val);
                        setCurrentPage(1);
                        setCustomPageSize("");
                      }
                    }}
                  />
                  <span className="ml-2">Total: <strong>{sortedLogs.length}</strong> registro(s)</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm px-3 font-medium">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Progresso do ZIP Todas */}
      <Dialog open={zipTodasDialogOpen} onOpenChange={(open) => {
        // Só permitir fechar se já concluiu ou deu erro
        if (!open && zipTodasStatus && (zipTodasStatus.status === "concluido" || zipTodasStatus.status === "erro")) {
          setZipTodasDialogOpen(false);
          setZipTodasJobId(null);
        }
      }}>
        <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-auto overflow-hidden" onPointerDownOutside={(e) => {
          if (zipTodasStatus?.status === "processando") e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-purple-600" />
              {zipTodasStatus?.status === "concluido" ? "ZIP Gerado com Sucesso!" :
               zipTodasStatus?.status === "erro" ? "Erro ao Gerar ZIP" :
               "Gerando ZIP de Todas as Empresas..."}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Barra de progresso */}
            {zipTodasStatus && (
              <>
                <Progress
                  value={zipTodasStatus.total > 0 ? Math.round((zipTodasStatus.processados / zipTodasStatus.total) * 100) : 0}
                  className="h-3"
                />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {zipTodasStatus.processados} de {zipTodasStatus.total} empresas
                  </span>
                  <span className="font-semibold">
                    {zipTodasStatus.total > 0 ? Math.round((zipTodasStatus.processados / zipTodasStatus.total) * 100) : 0}%
                  </span>
                </div>

                {/* Empresa atual */}
                {zipTodasStatus.status === "processando" && zipTodasStatus.empresaAtual && (
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded-lg px-3 py-2 overflow-hidden max-w-full">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span className="truncate block" style={{ maxWidth: 'calc(100% - 2rem)' }}>Processando: <strong>{zipTodasStatus.empresaAtual}</strong></span>
                  </div>
                )}

                {/* Estatísticas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-green-50 dark:bg-green-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-green-700 dark:text-green-300">{zipTodasStatus.totalEmpresas}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Empresas</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{zipTodasStatus.totalNotas.toLocaleString("pt-BR")}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Notas</div>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{zipTodasStatus.semNotas}</div>
                    <div className="text-xs text-amber-600">Sem Notas</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-red-700 dark:text-red-400">{zipTodasStatus.erros}</div>
                    <div className="text-xs text-red-600">Erros</div>
                  </div>
                </div>

                {/* Botão de download quando concluído */}
                {zipTodasStatus.status === "concluido" && zipTodasStatus.downloadUrl && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">ZIP pronto para download!</span>
                    </div>
                    <a
                      href={zipTodasStatus.downloadUrl}
                      download={zipTodasStatus.fileName || "notas.zip"}
                      className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
                    >
                      <Download className="h-5 w-5" />
                      Baixar ZIP ({zipTodasStatus.totalNotas.toLocaleString("pt-BR")} notas)
                    </a>
                  </div>
                )}

                {/* Concluído sem notas */}
                {zipTodasStatus.status === "concluido" && !zipTodasStatus.downloadUrl && (
                  <div className="flex items-center gap-2 text-amber-600 justify-center pt-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>Nenhuma nota encontrada para gerar o ZIP.</span>
                  </div>
                )}

                {/* Botão cancelar durante processamento */}
                {zipTodasStatus.status === "processando" && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => {
                        if (zipTodasJobId) {
                          cancelarZipTodasMutation.mutate({ jobId: zipTodasJobId });
                        }
                      }}
                      disabled={cancelarZipTodasMutation.isPending}
                    >
                      {cancelarZipTodasMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <StopCircle className="h-4 w-4" />
                      )}
                      Cancelar Geração do ZIP
                    </Button>
                  </div>
                )}

                {/* Cancelado */}
                {zipTodasStatus.status === "cancelado" && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span className="text-sm">Geração do ZIP cancelada. {zipTodasStatus.processados} de {zipTodasStatus.total} empresas foram processadas antes do cancelamento.</span>
                  </div>
                )}

                {/* Erro */}
                {zipTodasStatus.status === "erro" && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                    <XCircle className="h-5 w-5 shrink-0" />
                    <span className="text-sm">{zipTodasStatus.mensagem || "Erro desconhecido ao gerar o ZIP."}</span>
                  </div>
                )}

                {/* Botão fechar */}
                {(zipTodasStatus.status === "concluido" || zipTodasStatus.status === "erro" || zipTodasStatus.status === "cancelado") && (
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setZipTodasDialogOpen(false);
                        setZipTodasJobId(null);
                      }}
                    >
                      Fechar
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Loading inicial */}
            {!zipTodasStatus && (
              <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Iniciando geração do ZIP...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
