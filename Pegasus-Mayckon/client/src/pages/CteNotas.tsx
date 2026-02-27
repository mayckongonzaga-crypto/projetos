import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import {
  Truck, FileText, Search, Download, ChevronLeft, ChevronRight,
  Loader2, Eye, X, Code2, FileOutput, Building2, Copy, ExternalLink, FileKey, FileSearch
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CteNotas() {
  const [busca, setBusca] = useState("");
  const [clienteFilter, setClienteFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [direcaoFilter, setDirecaoFilter] = useState("todos");
  const [modalFilter, setModalFilter] = useState("todos");

  // Branding settings for watermark
  const { data: allSettings } = trpc.settings.getAll.useQuery();
  const logoUrl = (allSettings as Record<string, string> | undefined)?.["landing_logo_url"] ?? "";

  // Lista de clientes para o seletor
  const { data: clientesList } = trpc.cliente.list.useQuery(undefined, {});
  const [page, setPage] = useState(0);
  const [selectedNota, setSelectedNota] = useState<any>(null);
  const [showXml, setShowXml] = useState(false);
  const [showNfeModal, setShowNfeModal] = useState(false);
  const [nfeChaves, setNfeChaves] = useState<string[]>([]);
  const limit = 20;
  const [generatingDacte, setGeneratingDacte] = useState<number | null>(null);

  const generateDacteMut = trpc.cte.generateDacte.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success(data.cached ? "DACTE aberto" : "DACTE gerado com sucesso!");
      setGeneratingDacte(null);
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao gerar DACTE");
      setGeneratingDacte(null);
    },
  });

  const handleGenerateDacte = (nota: any) => {
    if (generatingDacte) return;
    setGeneratingDacte(nota.id);
    generateDacteMut.mutate({ cteNotaId: nota.id });
  };

  const { data, isLoading } = trpc.cte.notas.useQuery({
    busca: busca || undefined,
    clienteId: clienteFilter !== "todos" ? parseInt(clienteFilter) : undefined,
    status: (statusFilter !== "todos" ? statusFilter : undefined) as any,
    direcao: (direcaoFilter !== "todos" ? direcaoFilter : undefined) as any,
    modal: (modalFilter !== "todos" ? modalFilter : undefined) as any,
    limit,
    offset: page * limit,
  });

  const notas = data?.notas || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Lookup NF-e query - only enabled when modal is open
  const stableNfeChaves = useMemo(() => nfeChaves, [nfeChaves.join(",")]);
  const { data: nfeData, isLoading: nfeLoading } = trpc.cte.lookupNfe.useQuery(
    { chavesNfe: stableNfeChaves },
    { enabled: showNfeModal && stableNfeChaves.length > 0 }
  );

  const formatCurrency = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "-";
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (d: any) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("pt-BR");
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "autorizado": return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Autorizado</Badge>;
      case "cancelado": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Cancelado</Badge>;
      case "denegado": return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Denegado</Badge>;
      default: return <Badge variant="outline">{s || "-"}</Badge>;
    }
  };

  const getDirecaoBadge = (d: string) => {
    switch (d) {
      case "emitido": return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Emitido</Badge>;
      case "tomado": return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Tomado</Badge>;
      case "terceiro": return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Terceiro</Badge>;
      default: return <Badge variant="outline">{d || "-"}</Badge>;
    }
  };

  const getModalLabel = (m: string) => {
    const modais: Record<string, string> = {
      rodoviario: "Rodoviário",
      aereo: "Aéreo",
      aquaviario: "Aquaviário",
      ferroviario: "Ferroviário",
      dutoviario: "Dutoviário",
      multimodal: "Multimodal",
    };
    return modais[m] || m || "-";
  };

  const parseChavesNfe = (chavesNfe: string | null | undefined): string[] => {
    if (!chavesNfe) return [];
    try {
      const parsed = JSON.parse(chavesNfe);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const clearFilters = () => {
    setBusca("");
    setClienteFilter("todos");
    setStatusFilter("todos");
    setDirecaoFilter("todos");
    setModalFilter("todos");
    setPage(0);
  };

  const handleViewXml = (nota: any) => {
    setSelectedNota(nota);
    setShowXml(true);
  };

  const handleOpenNfeModal = (chaves: string[]) => {
    setNfeChaves(chaves);
    setShowNfeModal(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
            <div className="p-2 rounded-lg bg-primary/10">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            CT-e Notas
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize todos os Conhecimentos de Transporte Eletrônico baixados
          </p>
        </div>

        {/* Filtros */}
        <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-muted-foreground mb-1 block">Busca</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, CNPJ, chave..."
                    value={busca}
                    onChange={e => { setBusca(e.target.value); setPage(0); }}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="w-[220px] max-w-[220px] shrink-0">
                <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
                <Select value={clienteFilter} onValueChange={v => { setClienteFilter(v); setPage(0); }}>
                  <SelectTrigger className="w-full truncate"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent className="max-w-[400px]">
                    <SelectItem value="todos">Todos os Clientes</SelectItem>
                    {clientesList?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
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
                <label className="text-xs text-muted-foreground mb-1 block">Direção</label>
                <Select value={direcaoFilter} onValueChange={v => { setDirecaoFilter(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="emitido">Emitido</SelectItem>
                    <SelectItem value="tomado">Tomado</SelectItem>
                    <SelectItem value="terceiro">Terceiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Modal</label>
                <Select value={modalFilter} onValueChange={v => { setModalFilter(v); setPage(0); }}>
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
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contagem */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{total}</span> CT-e(s) encontrado(s)
          </p>
        </div>

        {/* Tabela */}
        <Card className="futuristic-card border-white/10 dark:bg-white/5 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Emitente</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Modal</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Direção</TableHead>
                    <TableHead>NF-e</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground mt-2">Carregando CT-e...</p>
                      </TableCell>
                    </TableRow>
                  ) : notas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                        <div className="p-4 rounded-full bg-primary/5 w-fit mx-auto mb-3">
                          <FileText className="h-12 w-12 opacity-50" />
                        </div>
                        <p className="font-medium">Nenhum CT-e encontrado</p>
                        <p className="text-sm mt-1">Faça um download na página CT-e Downloads</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    notas.map((nota: any) => (
                      <TableRow key={nota.id} className="hover:bg-white/5 border-white/5 transition-colors">
                        <TableCell className="font-mono text-sm text-primary">{nota.numeroCte || "-"}</TableCell>
                        <TableCell className="max-w-[160px] truncate" title={`${nota.clienteRazaoSocial || "-"} (${nota.clienteCnpj || ""})`}>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate text-sm font-medium">{nota.clienteRazaoSocial || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(nota.dataEmissao)}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={nota.emitenteNome}>
                          {nota.emitenteNome || "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={nota.remetenteNome}>
                          {nota.remetenteNome || "-"}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={nota.destinatarioNome}>
                          {nota.destinatarioNome || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs border-white/20">
                            {getModalLabel(nota.modal)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(nota.valorTotal)}</TableCell>
                        <TableCell>{getStatusBadge(nota.status)}</TableCell>
                        <TableCell>{getDirecaoBadge(nota.direcao)}</TableCell>
                        <TableCell>
                          {(() => {
                            const chaves = parseChavesNfe(nota.chavesNfe);
                            if (chaves.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
                            return (
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="outline"
                                  className="text-xs border-emerald-500/30 text-emerald-400 cursor-pointer hover:bg-emerald-500/10"
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleOpenNfeModal(chaves);
                                  }}
                                >
                                  <FileSearch className="h-3 w-3 mr-1" />
                                  {chaves.length} NF-e
                                </Badge>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setSelectedNota(nota); setShowXml(false); }}
                              title="Ver detalhes"
                              className="hover:bg-primary/10"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewXml(nota)}
                              title="Ver XML"
                              className="hover:bg-primary/10"
                            >
                              <Code2 className="h-4 w-4" />
                            </Button>
                            {nota.tipoDocumento !== "EVENTO" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleGenerateDacte(nota)}
                                title="Ver DACTE"
                                className="hover:bg-amber-500/10 text-amber-400"
                                disabled={generatingDacte === nota.id}
                              >
                                {generatingDacte === nota.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileOutput className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {nota.chaveAcesso && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const url = `https://meudanfe.com.br/#${nota.chaveAcesso}`;
                                  window.open(url, "_blank");
                                  toast.success("Abrindo MeuDanfe...");
                                }}
                                title="Ver no MeuDanfe"
                                className="hover:bg-green-500/10 text-green-400"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="border-white/20"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Página <span className="text-primary font-medium">{page + 1}</span> de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="border-white/20"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Modal de detalhes */}
        <Dialog open={!!selectedNota && !showXml} onOpenChange={() => setSelectedNota(null)}>
          <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto dark:bg-[#0f1729] dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span>CT-e Nº {selectedNota?.numeroCte || "-"}</span>
                  {selectedNota?.serie && <span className="text-xs text-muted-foreground ml-2">Série {selectedNota.serie}</span>}
                </div>
                {selectedNota?.status && (
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                    selectedNota.status === "autorizado" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                    selectedNota.status === "cancelado" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                    "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                  }`}>{selectedNota.status.charAt(0).toUpperCase() + selectedNota.status.slice(1)}</span>
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedNota && (
              <div className="space-y-4 relative">
                {/* Marca d'água Pegasus */}
                {logoUrl && (
                  <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.06] pointer-events-none z-0">
                    <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                  </div>
                )}
                {/* Linha 1: Chave + Protocolo + Cliente */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Chave de Acesso</p>
                    <p className="font-mono text-xs break-all text-primary">{selectedNota.chaveAcesso}</p>
                  </div>
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Protocolo</p>
                    <p className="font-mono text-xs dark:text-white">{selectedNota.protocolo || "-"}</p>
                    <p className="text-xs text-muted-foreground mt-1">CFOP: {selectedNota.cfop || "-"} | Nat. Operação: {selectedNota.natOp || "-"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Cliente (Empresa)</p>
                    <p className="font-semibold dark:text-white text-sm">{selectedNota.clienteRazaoSocial || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedNota.clienteCnpj || "-"}</p>
                  </div>
                </div>

                {/* Participantes - 4 colunas */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground">Emitente</p>
                    <p className="font-medium text-sm dark:text-white break-words">{selectedNota.emitenteNome || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedNota.emitenteCnpj || "-"} {selectedNota.emitenteUf ? `(${selectedNota.emitenteUf})` : ""}</p>
                  </div>
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground">Remetente</p>
                    <p className="font-medium text-sm dark:text-white break-words">{selectedNota.remetenteNome || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedNota.remetenteCnpj || "-"} {selectedNota.remetenteUf ? `(${selectedNota.remetenteUf})` : ""}</p>
                  </div>
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground">Destinatário</p>
                    <p className="font-medium text-sm dark:text-white break-words">{selectedNota.destinatarioNome || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedNota.destinatarioCnpj || "-"} {selectedNota.destinatarioUf ? `(${selectedNota.destinatarioUf})` : ""}</p>
                  </div>
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground">Tomador</p>
                    <p className="font-medium text-sm dark:text-white break-words">{selectedNota.tomadorNome || "-"}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedNota.tomadorCnpj || "-"} {selectedNota.tomadorUf ? `(${selectedNota.tomadorUf})` : ""}</p>
                  </div>
                </div>

                {/* Valores + ICMS lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Valores do Serviço */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Valores do Serviço</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">Valor Total</p>
                        <p className="font-bold text-lg text-primary">{formatCurrency(selectedNota.valorTotal)}</p>
                      </div>
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">Valor a Receber</p>
                        <p className="font-bold text-lg text-emerald-500">{formatCurrency(selectedNota.valorReceber)}</p>
                      </div>
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">Valor da Carga</p>
                        <p className="font-semibold dark:text-white">{formatCurrency(selectedNota.valorCarga)}</p>
                      </div>
                    </div>
                  </div>

                  {/* ICMS Detalhado */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">ICMS Detalhado</p>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">Valor ICMS</p>
                        <p className="font-semibold text-amber-500">{formatCurrency(selectedNota.valorICMS)}</p>
                      </div>
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">Base Cálculo</p>
                        <p className="font-semibold dark:text-white">{formatCurrency(selectedNota.baseCalcIcms)}</p>
                      </div>
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">Alíquota</p>
                        <p className="font-semibold dark:text-white">{selectedNota.aliqIcms ? `${Number(selectedNota.aliqIcms).toFixed(2)}%` : "-"}</p>
                      </div>
                      <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10 text-center">
                        <p className="text-xs text-muted-foreground">CST ICMS</p>
                        <p className="font-semibold dark:text-white">{selectedNota.cstIcms || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transporte e Carga - 2 linhas de 4 colunas */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Transporte e Carga</p>
                  <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Modal</p>
                      <p className="text-sm font-medium dark:text-white">{getModalLabel(selectedNota.modal)}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Origem</p>
                      <p className="text-sm dark:text-white">{selectedNota.munInicio ? `${selectedNota.munInicio} - ${selectedNota.ufInicio}` : selectedNota.ufInicio || "-"}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Destino</p>
                      <p className="text-sm dark:text-white">{selectedNota.munFim ? `${selectedNota.munFim} - ${selectedNota.ufFim}` : selectedNota.ufFim || "-"}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Data Emissão</p>
                      <p className="text-sm dark:text-white">{formatDate(selectedNota.dataEmissao)}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Produto</p>
                      <p className="text-sm dark:text-white break-words">{selectedNota.produtoPredominante || "-"}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Peso Bruto (kg)</p>
                      <p className="text-sm dark:text-white">{selectedNota.pesoBruto ? Number(selectedNota.pesoBruto).toLocaleString("pt-BR") : "-"}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">RNTRC</p>
                      <p className="text-sm dark:text-white">{selectedNota.rntrc || "-"}</p>
                    </div>
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground">Placa</p>
                      <p className="text-sm dark:text-white">{selectedNota.placa || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                {selectedNota.observacoes && (
                  <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                    <p className="text-xs text-muted-foreground mb-1">Observações</p>
                    <p className="text-sm dark:text-white whitespace-pre-wrap">{selectedNota.observacoes}</p>
                  </div>
                )}

                {/* Chaves NF-e (DANFe) vinculadas */}
                {(() => {
                  const chaves = parseChavesNfe(selectedNota.chavesNfe);
                  if (chaves.length === 0) return null;
                  return (
                    <div className="p-3 rounded-lg dark:bg-white/5 border dark:border-white/10">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                        <FileKey className="h-3.5 w-3.5" />
                        Chaves NF-e (DANFe) vinculadas ({chaves.length})
                      </p>
                      <div className="space-y-2">
                        {chaves.map((chave, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 rounded bg-black/10 dark:bg-black/20 border dark:border-white/5">
                            <p className="font-mono text-xs break-all text-primary flex-1">{chave}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Copiar chave"
                                onClick={() => {
                                  navigator.clipboard.writeText(chave);
                                  toast.success("Chave copiada!");
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>

                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Ações */}
                <div className="flex items-center gap-2 pt-2 border-t dark:border-white/10">
                  <Button size="sm" onClick={() => { setShowXml(true); }} className="gap-2">
                    <Code2 className="h-4 w-4" /> Ver XML
                  </Button>
                  {selectedNota?.tipoDocumento !== "EVENTO" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateDacte(selectedNota)}
                      disabled={generatingDacte === selectedNota?.id}
                      className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      {generatingDacte === selectedNota?.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileOutput className="h-4 w-4" />
                      )}
                      Ver DACTE
                    </Button>
                  )}
                  {selectedNota?.dactePdfUrl && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(selectedNota.dactePdfUrl, "_blank")}
                      className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <FileOutput className="h-4 w-4" />
                      PDF Salvo
                    </Button>
                  )}
                  {selectedNota?.chaveAcesso && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `https://meudanfe.com.br/#${selectedNota.chaveAcesso}`;
                        window.open(url, "_blank");
                        toast.success("Abrindo MeuDanfe...");
                      }}
                      className="gap-2 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver no MeuDanfe
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal XML */}
        <Dialog open={showXml && !!selectedNota} onOpenChange={() => { setShowXml(false); setSelectedNota(null); }}>
          <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto dark:bg-[#0f1729] dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                XML CT-e Nº {selectedNota?.numeroCte || "-"}
              </DialogTitle>
            </DialogHeader>
            <XmlViewer chaveAcesso={selectedNota?.chaveAcesso} />
          </DialogContent>
        </Dialog>

        {/* Modal NF-e Vinculadas */}
        <Dialog open={showNfeModal} onOpenChange={() => setShowNfeModal(false)}>
          <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto dark:bg-[#0f1729] dark:border-white/10">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                  <FileKey className="h-5 w-5 text-emerald-400" />
                </div>
                NF-e Vinculadas ({nfeChaves.length})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {nfeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Verificando NF-e no sistema...</span>
                </div>
              ) : (
                nfeChaves.map((chave, idx) => {
                  const nfeFound = nfeData?.find(n => n.chaveAcesso === chave);
                  return (
                    <div key={idx} className={`p-3 rounded-lg border ${nfeFound ? "dark:bg-emerald-500/5 border-emerald-500/20" : "dark:bg-white/5 dark:border-white/10"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {nfeFound ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                Baixada no sistema
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                                Não baixada
                              </Badge>
                            )}
                            {nfeFound && (
                              <span className="text-xs text-muted-foreground">
                                NF Nº {nfeFound.numeroNota || "-"}
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-xs break-all text-primary/80">{chave}</p>
                          {nfeFound && (
                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div>
                                <span className="text-muted-foreground">Emitente: </span>
                                <span className="dark:text-white">{nfeFound.emitenteNome || "-"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Tomador: </span>
                                <span className="dark:text-white">{nfeFound.tomadorNome || "-"}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Valor: </span>
                                <span className="dark:text-white font-medium">{formatCurrency(nfeFound.valorServico)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Emissão: </span>
                                <span className="dark:text-white">{formatDate(nfeFound.dataEmissao)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Status: </span>
                                <span className="dark:text-white">{nfeFound.status === "valida" ? "Válida" : nfeFound.status === "cancelada" ? "Cancelada" : nfeFound.status}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Direção: </span>
                                <span className="dark:text-white">{nfeFound.direcao === "emitida" ? "Emitida" : "Recebida"}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Copiar chave"
                            onClick={() => {
                              navigator.clipboard.writeText(chave);
                              toast.success("Chave NF-e copiada!");
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {nfeFound?.danfsePdfUrl ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-emerald-500 hover:text-emerald-400"
                              title="Ver DANFSe (PDF)"
                              onClick={() => {
                                window.open(nfeFound.danfsePdfUrl!, "_blank");
                                toast.success("Abrindo DANFSe...");
                              }}
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-amber-500 hover:text-amber-400"
                              title="Ver no MeuDanfe (NF-e não baixada no sistema)"
                              onClick={() => {
                                window.open(`https://meudanfe.com.br/`, "_blank");
                                navigator.clipboard.writeText(chave);
                                toast.success("Chave copiada! Cole no campo de busca do MeuDanfe.");
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <p className="text-xs text-muted-foreground text-center pt-2">
                NF-e marcadas como "Baixada no sistema" já estão disponíveis na tela de Notas Fiscais.
                As demais podem ser consultadas no MeuDanfe.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function XmlViewer({ chaveAcesso }: { chaveAcesso: string }) {
  const { data, isLoading } = trpc.cte.notaDetalhe.useQuery(
    { chaveAcesso },
    { enabled: !!chaveAcesso }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.xmlDecodificado) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        XML não disponível para este CT-e
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const blob = new Blob([data.xmlDecodificado], { type: "application/xml" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `CTe_${chaveAcesso}.xml`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success("XML baixado com sucesso!");
        }}
        className="gap-2"
      >
        <Download className="h-4 w-4" /> Baixar XML
      </Button>
      <pre className="p-4 rounded-lg dark:bg-black/40 bg-gray-100 border dark:border-white/10 text-xs font-mono overflow-x-auto max-h-[60vh] whitespace-pre-wrap break-all text-muted-foreground">
        {data.xmlDecodificado}
      </pre>
    </div>
  );
}
