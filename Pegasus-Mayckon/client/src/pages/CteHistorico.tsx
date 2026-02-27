import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState } from "react";
import {
  Truck, History, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle,
  Trash2, RefreshCw, ChevronDown, ChevronUp, FileText
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function CteHistorico() {
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const { data: logs, isLoading, refetch } = trpc.cte.downloadStatus.useQuery({}, {
    refetchInterval: 5000,
  });

  const clearHistoryMutation = trpc.cte.clearHistory.useMutation({
    onSuccess: () => {
      toast.success("Histórico CT-e limpo com sucesso");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const cancelMutation = trpc.cte.cancelDownload.useMutation({
    onSuccess: () => {
      toast.success("Download CT-e cancelado");
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const formatDate = (d: any) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("pt-BR");
  };

  const formatDuration = (inicio: any, fim: any) => {
    if (!inicio) return "-";
    const start = new Date(inicio).getTime();
    const end = fim ? new Date(fim).getTime() : Date.now();
    const diff = Math.floor((end - start) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "concluido": return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case "erro": return <XCircle className="h-4 w-4 text-red-400" />;
      case "executando": return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case "pendente": return <Clock className="h-4 w-4 text-amber-400" />;
      case "cancelado": return <AlertTriangle className="h-4 w-4 text-orange-400" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concluido": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">{getStatusIcon(status)} Concluído</Badge>;
      case "erro": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">{getStatusIcon(status)} Erro</Badge>;
      case "executando": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1">{getStatusIcon(status)} Executando</Badge>;
      case "pendente": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">{getStatusIcon(status)} Pendente</Badge>;
      case "cancelado": return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 gap-1">{getStatusIcon(status)} Cancelado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const allLogs = logs || [];
  const activeLogs = allLogs.filter((l: any) => l.status === "executando" || l.status === "pendente");
  const completedLogs = allLogs.filter((l: any) => l.status !== "executando" && l.status !== "pendente");

  // KPI stats
  const totalDownloads = allLogs.length;
  const totalConcluidos = allLogs.filter((l: any) => l.status === "concluido").length;
  const totalErros = allLogs.filter((l: any) => l.status === "erro").length;
  const totalCtes = allLogs.reduce((acc: number, l: any) => acc + (l.ctesNovos || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-6 w-6 text-primary" />
              </div>
              CT-e Histórico
            </h1>
            <p className="text-muted-foreground mt-1">
              Acompanhe o histórico de downloads de CT-e
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 border-white/20">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            {completedLogs.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" /> Limpar Histórico
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="dark:bg-[#0f1729] dark:border-white/10">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar histórico CT-e?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá todos os registros de downloads concluídos e com erro.
                      Downloads em andamento não serão afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearHistoryMutation.mutate({})}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <CardContent className="pt-5 pb-4 relative">
              <p className="text-xs text-muted-foreground">Total Downloads</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{totalDownloads}</p>
            </CardContent>
          </Card>
          <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
            <CardContent className="pt-5 pb-4 relative">
              <p className="text-xs text-muted-foreground">Concluídos</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{totalConcluidos}</p>
            </CardContent>
          </Card>
          <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
            <CardContent className="pt-5 pb-4 relative">
              <p className="text-xs text-muted-foreground">Erros</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{totalErros}</p>
            </CardContent>
          </Card>
          <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
            <CardContent className="pt-5 pb-4 relative">
              <p className="text-xs text-muted-foreground">CT-e Novos</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{totalCtes}</p>
            </CardContent>
          </Card>
        </div>

        {/* Downloads em andamento */}
        {activeLogs.length > 0 && (
          <Card className="futuristic-card border-blue-500/20 dark:bg-blue-500/5 backdrop-blur-sm">
            <CardContent className="pt-5">
              <h3 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloads em Andamento ({activeLogs.length})
              </h3>
              <div className="space-y-2">
                {activeLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                      {getStatusIcon(log.status)}
                      <div className="min-w-0">
                        <p className="font-medium text-sm dark:text-white truncate">{log.clienteNome}</p>
                        <p className="text-xs text-muted-foreground">{log.etapa || "Aguardando..."}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.progresso != null && log.totalEsperado ? (
                        <span className="text-xs text-primary font-mono">{log.progresso}/{log.totalEsperado}</span>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelMutation.mutate({ logId: log.id })}
                        className="text-red-400 hover:bg-red-500/10 h-7"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabela de histórico */}
        <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : completedLogs.length === 0 && activeLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="p-4 rounded-full bg-primary/5 w-fit mx-auto mb-3">
                  <History className="h-12 w-12 opacity-50" />
                </div>
                <p className="font-medium">Nenhum download CT-e registrado</p>
                <p className="text-sm mt-1">Inicie um download na página CT-e Downloads</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>CT-e Novos</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedLogs.map((log: any) => (
                      <>
                        <TableRow
                          key={log.id}
                          className="hover:bg-white/5 border-white/5 cursor-pointer transition-colors"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          <TableCell>
                            {expandedLog === log.id
                              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            }
                          </TableCell>
                          <TableCell className="font-medium dark:text-white">{log.clienteNome || "-"}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{log.clienteCnpj || "-"}</TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>
                            <span className="text-primary font-semibold">{log.ctesNovos || 0}</span>
                          </TableCell>
                          <TableCell>{log.totalCtes || 0}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-white/20">
                              {log.tipo === "manual" ? "Manual" : log.tipo === "agendado" ? "Agendado" : log.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(log.criadoEm || log.createdAt)}</TableCell>
                          <TableCell className="text-xs font-mono">
                            {formatDuration(log.criadoEm || log.createdAt, log.finalizadoEm)}
                          </TableCell>
                        </TableRow>
                        {expandedLog === log.id && (
                          <TableRow key={`${log.id}-detail`} className="bg-white/[0.02]">
                            <TableCell colSpan={9}>
                              <div className="p-4 space-y-2 text-sm">
                                {log.etapa && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Etapa:</span>
                                    <span className="dark:text-white">{log.etapa}</span>
                                  </div>
                                )}
                                {log.ultimoNsu != null && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Último NSU:</span>
                                    <span className="font-mono text-primary">{log.ultimoNsu}</span>
                                  </div>
                                )}
                                {log.erro && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Erro:</span>
                                    <span className="text-red-400">{log.erro}</span>
                                  </div>
                                )}
                                {log.certificadoVencido && (
                                  <div className="flex items-center gap-2 text-amber-400">
                                    <AlertTriangle className="h-4 w-4" />
                                    Certificado digital vencido
                                  </div>
                                )}
                                {log.finalizadoEm && (
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground">Finalizado em:</span>
                                    <span className="dark:text-white">{formatDate(log.finalizadoEm)}</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
