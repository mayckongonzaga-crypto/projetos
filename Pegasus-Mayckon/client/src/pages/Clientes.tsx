import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  Users, Plus, Search, Trash2, AlertTriangle, Pencil, Eye, Building2, Phone, Mail,
  MapPin, FileText, Globe, UserCircle, Save, X, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

type ClienteData = {
  id: number;
  contabilidadeId: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  contatoPrincipal?: string | null;
  contatoSecundario?: string | null;
  email?: string | null;
  emailSecundario?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  endereco?: string | null;
  tipoCliente?: string | null;
  regimeTributario?: string | null;
  naturezaJuridica?: string | null;
  capitalSocial?: string | null;
  porte?: string | null;
  dataAbertura?: string | null;
  situacaoCadastral?: string | null;
  socios?: string | null;
  cnaePrincipal?: string | null;
  cnaePrincipalDescricao?: string | null;
  cnaesSecundarios?: string | null;
  optanteSimples?: boolean | null;
  optanteMEI?: boolean | null;
  dadosReceitaAtualizadosEm?: string | null;
  ativo: boolean;
  createdAt: string;
};

const emptyForm = {
  cnpj: "", razaoSocial: "", nomeFantasia: "",
  contatoPrincipal: "", contatoSecundario: "",
  email: "", emailSecundario: "",
  telefone: "", telefone2: "",
  logradouro: "", numero: "", complemento: "", bairro: "",
  cidade: "", uf: "", cep: "",
  tipoCliente: "", regimeTributario: "",
  naturezaJuridica: "", capitalSocial: "", porte: "",
  dataAbertura: "", situacaoCadastral: "",
  socios: "", cnaePrincipal: "", cnaePrincipalDescricao: "",
  cnaesSecundarios: "",
  optanteSimples: false, optanteMEI: false,
};

function parseSocios(json: string | null | undefined): { nome: string; qualificacao?: string }[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}
function parseCnaes(json: string | null | undefined): { codigo: string; descricao: string }[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

export default function Clientes() {
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: clientesList, isLoading } = trpc.cliente.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  // Dialog states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Selected client
  const [selectedCliente, setSelectedCliente] = useState<ClienteData | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<{ id: number; razaoSocial: string } | null>(null);

  // Form state
  const [form, setForm] = useState(emptyForm);

  // Mutations
  const createMutation = trpc.cliente.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente criado com sucesso!");
      utils.cliente.list.invalidate();
      setCreateOpen(false);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.cliente.update.useMutation({
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      utils.cliente.list.invalidate();
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.cliente.delete.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Cliente e todos os dados vinculados excluídos com sucesso!");
      // Invalidar TODAS as queries relacionadas ao cliente excluído
      utils.cliente.list.invalidate();
      utils.certificado.list.invalidate();
      utils.nota.list.invalidate();
      utils.download.logs.invalidate();
      utils.download.clientesComStatus.invalidate();
      utils.dashboard.stats.invalidate();
      setDeleteDialogOpen(false);
      setClienteToDelete(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const consultarReceitaMutation = trpc.cliente.consultarReceita.useMutation({
    onSuccess: () => {
      toast.success("Dados da Receita Federal atualizados!");
      utils.cliente.list.invalidate();
      // Atualizar o form se o modal de edição estiver aberto
      if (editOpen && selectedCliente) {
        utils.cliente.list.invalidate().then(() => {
          setEditOpen(false);
          toast.info("Reabra o cliente para ver os dados atualizados.");
        });
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const consultarReceitaEmLoteMutation = trpc.cliente.consultarReceitaEmLote.useMutation({
    onSuccess: (result) => {
      toast.success(`Consulta em lote concluída: ${result.sucesso} sucesso, ${result.erros} erro(s)`);
      utils.cliente.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleAtivoMutation = trpc.cliente.toggleAtivo.useMutation({
    onMutate: async (input) => {
      await utils.cliente.list.cancel();
      const prev = utils.cliente.list.getData(contabId ? { contabilidadeId: contabId } : undefined);
      if (prev) {
        utils.cliente.list.setData(
          contabId ? { contabilidadeId: contabId } : undefined,
          prev.map(c => c.id === input.id ? { ...c, ativo: input.ativo } : c)
        );
      }
      return { prev };
    },
    onError: (err, _input, context) => {
      toast.error(err.message);
      if (context?.prev) {
        utils.cliente.list.setData(
          contabId ? { contabilidadeId: contabId } : undefined,
          context.prev
        );
      }
    },
    onSettled: () => utils.cliente.list.invalidate(),
  });

  const filtered = useMemo(() => {
    if (!clientesList) return [];
    if (!search) return clientesList;
    const s = search.toLowerCase();
    return clientesList.filter(
      (c) =>
        c.razaoSocial.toLowerCase().includes(s) ||
        c.cnpj.includes(s) ||
        c.nomeFantasia?.toLowerCase().includes(s) ||
        c.cidade?.toLowerCase().includes(s) ||
        c.contatoPrincipal?.toLowerCase().includes(s)
    );
  }, [clientesList, search]);

  const openEdit = (c: ClienteData) => {
    setSelectedCliente(c);
    setForm({
      cnpj: c.cnpj || "",
      razaoSocial: c.razaoSocial || "",
      nomeFantasia: c.nomeFantasia || "",
      contatoPrincipal: c.contatoPrincipal || "",
      contatoSecundario: c.contatoSecundario || "",
      email: c.email || "",
      emailSecundario: c.emailSecundario || "",
      telefone: c.telefone || "",
      telefone2: c.telefone2 || "",
      logradouro: c.logradouro || "",
      numero: c.numero || "",
      complemento: c.complemento || "",
      bairro: c.bairro || "",
      cidade: c.cidade || "",
      uf: c.uf || "",
      cep: c.cep || "",
      tipoCliente: c.tipoCliente || "",
      regimeTributario: c.regimeTributario || "",
      naturezaJuridica: c.naturezaJuridica || "",
      capitalSocial: c.capitalSocial || "",
      porte: c.porte || "",
      dataAbertura: c.dataAbertura || "",
      situacaoCadastral: c.situacaoCadastral || "",
      socios: c.socios || "",
      cnaePrincipal: c.cnaePrincipal || "",
      cnaePrincipalDescricao: c.cnaePrincipalDescricao || "",
      cnaesSecundarios: c.cnaesSecundarios || "",
      optanteSimples: c.optanteSimples ?? false,
      optanteMEI: c.optanteMEI ?? false,
    });
    setEditOpen(true);
  };

  const openView = (c: ClienteData) => {
    setSelectedCliente(c);
    setViewOpen(true);
  };

  const openDelete = (c: { id: number; razaoSocial: string }) => {
    setClienteToDelete(c);
    setDeleteDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedCliente) return;
    updateMutation.mutate({
      id: selectedCliente.id,
      razaoSocial: form.razaoSocial || undefined,
      nomeFantasia: form.nomeFantasia || undefined,
      contatoPrincipal: form.contatoPrincipal || undefined,
      contatoSecundario: form.contatoSecundario || undefined,
      email: form.email || undefined,
      emailSecundario: form.emailSecundario || undefined,
      telefone: form.telefone || undefined,
      telefone2: form.telefone2 || undefined,
      logradouro: form.logradouro || undefined,
      numero: form.numero || undefined,
      complemento: form.complemento || undefined,
      bairro: form.bairro || undefined,
      cidade: form.cidade || undefined,
      uf: form.uf || undefined,
      cep: form.cep || undefined,
      tipoCliente: form.tipoCliente || undefined,
      regimeTributario: form.regimeTributario || undefined,
      naturezaJuridica: form.naturezaJuridica || undefined,
      capitalSocial: form.capitalSocial || undefined,
      porte: form.porte || undefined,
      dataAbertura: form.dataAbertura || undefined,
      situacaoCadastral: form.situacaoCadastral || undefined,
      socios: form.socios || undefined,
      cnaePrincipal: form.cnaePrincipal || undefined,
      cnaePrincipalDescricao: form.cnaePrincipalDescricao || undefined,
      cnaesSecundarios: form.cnaesSecundarios || undefined,
      optanteSimples: form.optanteSimples || null,
      optanteMEI: form.optanteMEI || null,
    });
  };

  // Stats
  const totalClientes = clientesList?.length || 0;
  const ativos = clientesList?.filter(c => c.ativo).length || 0;
  const comContato = clientesList?.filter(c => c.email || c.telefone).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Clientes
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {totalClientes} empresa{totalClientes !== 1 ? "s" : ""} cadastrada{totalClientes !== 1 ? "s" : ""}
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
            <Button onClick={() => { setForm(emptyForm); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />Novo Cliente
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalClientes}</p>
                <p className="text-xs text-muted-foreground">Total de Clientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{ativos}</p>
                <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Mail className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{comContato}</p>
                <p className="text-xs text-muted-foreground">Com Contato</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Preencher Todos + View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nome, CNPJ, cidade ou contato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="shrink-0 gap-2"
                    onClick={() => {
                      if (confirm(`Preencher dados da Receita Federal para TODOS os ${totalClientes} clientes?\n\nIsso pode levar alguns minutos (1.5s por cliente).`)) {
                        contabId && consultarReceitaEmLoteMutation.mutate({ contabilidadeId: contabId });
                      }
                    }}
                    disabled={consultarReceitaEmLoteMutation.isPending || !contabId}
                  >
                    <RefreshCw className={`h-4 w-4 ${consultarReceitaEmLoteMutation.isPending ? "animate-spin" : ""}`} />
                    {consultarReceitaEmLoteMutation.isPending ? "Consultando..." : "Preencher Todos via Receita"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Consulta a Receita Federal para todos os clientes (BrasilAPI)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex gap-1 border rounded-md p-0.5">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("cards")}
            >
              Cards
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setViewMode("list")}
            >
              Lista
            </Button>
          </div>
        </div>

        {/* Client Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 space-y-3">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="font-medium text-lg">Nenhum cliente encontrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search ? "Tente outro termo de busca." : "Cadastre clientes ou faça upload de certificados."}
              </p>
            </CardContent>
          </Card>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <Card key={c.id} className="group hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
                {/* Status indicator */}
                <div className={`absolute top-0 left-0 w-1 h-full ${c.ativo ? "bg-green-50 dark:bg-green-500/15" : "bg-gray-300"}`} />

                <CardContent className="p-5 pl-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-semibold text-sm leading-tight truncate" title={c.razaoSocial}>
                        {c.razaoSocial}
                      </h3>
                      {c.nomeFantasia && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5" title={c.nomeFantasia}>
                          {c.nomeFantasia}
                        </p>
                      )}
                    </div>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer transition-colors shrink-0 ${
                              c.ativo
                                ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 dark:text-green-300 hover:bg-green-200"
                                : "bg-gray-100 text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAtivoMutation.mutate({ id: c.id, ativo: !c.ativo });
                            }}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${c.ativo ? "bg-green-50 dark:bg-green-500/15" : "bg-gray-400"}`} />
                            {c.ativo ? "Ativo" : "Inativo"}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{c.ativo ? "Clique para desativar" : "Clique para ativar"}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="font-mono">{c.cnpj}</span>
                    </div>
                    {(c.cidade || c.uf) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{c.cidade ? `${c.cidade}/${c.uf}` : c.uf}</span>
                      </div>
                    )}
                    {c.contatoPrincipal && (
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.contatoPrincipal}</span>
                      </div>
                    )}
                    {c.telefone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span>{c.telefone}</span>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.regimeTributario && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.regimeTributario}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 border-t pt-3">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => openView(c as any)}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Ver
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Visualizar detalhes</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => openEdit(c as any)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Editar
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar cadastro</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:bg-red-500/10"
                            onClick={() => openDelete({ id: c.id, razaoSocial: c.razaoSocial })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir cliente</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filtered.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${c.ativo ? "bg-green-50 dark:bg-green-500/15" : "bg-gray-300"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{c.razaoSocial}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.cnpj}</p>
                      </div>
                      <div className="hidden md:block text-xs text-muted-foreground w-32">
                        {c.cidade ? `${c.cidade}/${c.uf}` : "-"}
                      </div>
                      <div className="hidden lg:block text-xs text-muted-foreground w-40 truncate">
                        {c.contatoPrincipal || c.email || "-"}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-4 shrink-0">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openView(c as any)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c as any)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:bg-red-500/10"
                        onClick={() => openDelete({ id: c.id, razaoSocial: c.razaoSocial })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ CREATE DIALOG ═══ */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Novo Cliente
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CNPJ *</Label>
                  <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} placeholder="SC" maxLength={2} />
                </div>
              </div>
              <div>
                <Label>Razão Social *</Label>
                <Input value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} />
              </div>
              <div>
                <Label>Nome Fantasia</Label>
                <Input value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
              </div>
              <Button
                className="w-full"
                onClick={() => contabId && createMutation.mutate({ ...form, contabilidadeId: contabId })}
                disabled={!form.cnpj || !form.razaoSocial || !contabId || createMutation.isPending}
              >
                {createMutation.isPending ? "Criando..." : "Criar Cliente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ VIEW DIALOG ═══ */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Detalhes do Cliente
              </DialogTitle>
            </DialogHeader>
            {selectedCliente && (
              <ScrollArea className="max-h-[65vh] pr-4">
                <div className="space-y-6">
                  {/* Dados Principais */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Dados Principais
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Razão Social:</span><p className="font-medium">{selectedCliente.razaoSocial}</p></div>
                      <div><span className="text-muted-foreground">Nome Fantasia:</span><p className="font-medium">{selectedCliente.nomeFantasia || "-"}</p></div>
                      <div><span className="text-muted-foreground">CNPJ:</span><p className="font-medium font-mono">{selectedCliente.cnpj}</p></div>
                      <div><span className="text-muted-foreground">Status:</span><p><Badge variant={selectedCliente.ativo ? "default" : "secondary"}>{selectedCliente.ativo ? "Ativo" : "Inativo"}</Badge></p></div>
                      {selectedCliente.situacaoCadastral && <div><span className="text-muted-foreground">Situação Cadastral:</span><p className="font-medium">{selectedCliente.situacaoCadastral}</p></div>}
                      {selectedCliente.dataAbertura && <div><span className="text-muted-foreground">Data de Abertura:</span><p className="font-medium">{selectedCliente.dataAbertura}</p></div>}
                      {selectedCliente.naturezaJuridica && <div className="col-span-2"><span className="text-muted-foreground">Natureza Jurídica:</span><p className="font-medium">{selectedCliente.naturezaJuridica}</p></div>}
                    </div>
                  </div>

                  <Separator />

                  {/* Contatos */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Contatos
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Contato Principal:</span><p className="font-medium">{selectedCliente.contatoPrincipal || "-"}</p></div>
                      <div><span className="text-muted-foreground">Contato Secundário:</span><p className="font-medium">{selectedCliente.contatoSecundario || "-"}</p></div>
                      <div><span className="text-muted-foreground">E-mail:</span><p className="font-medium">{selectedCliente.email || "-"}</p></div>
                      <div><span className="text-muted-foreground">E-mail Secundário:</span><p className="font-medium">{selectedCliente.emailSecundario || "-"}</p></div>
                      <div><span className="text-muted-foreground">Telefone:</span><p className="font-medium">{selectedCliente.telefone || "-"}</p></div>
                      <div><span className="text-muted-foreground">Telefone 2:</span><p className="font-medium">{selectedCliente.telefone2 || "-"}</p></div>
                    </div>
                  </div>

                  <Separator />

                  {/* Endereço */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Endereço
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Logradouro:</span><p className="font-medium">{selectedCliente.logradouro || "-"}</p></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted-foreground">Nº:</span><p className="font-medium">{selectedCliente.numero || "-"}</p></div>
                        <div><span className="text-muted-foreground">Compl.:</span><p className="font-medium">{selectedCliente.complemento || "-"}</p></div>
                      </div>
                      <div><span className="text-muted-foreground">Bairro:</span><p className="font-medium">{selectedCliente.bairro || "-"}</p></div>
                      <div><span className="text-muted-foreground">Cidade/UF:</span><p className="font-medium">{selectedCliente.cidade ? `${selectedCliente.cidade}/${selectedCliente.uf}` : "-"}</p></div>
                      <div><span className="text-muted-foreground">CEP:</span><p className="font-medium">{selectedCliente.cep || "-"}</p></div>
                    </div>
                  </div>

                  <Separator />

                  {/* Dados Fiscais */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Dados Fiscais
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-muted-foreground">Tipo de Cliente:</span><p className="font-medium">{selectedCliente.tipoCliente || "-"}</p></div>
                      <div><span className="text-muted-foreground">Regime Tributário:</span><p className="font-medium">{selectedCliente.regimeTributario || "-"}</p></div>
                      <div><span className="text-muted-foreground">Porte:</span><p className="font-medium">{selectedCliente.porte || "-"}</p></div>
                      <div><span className="text-muted-foreground">Capital Social:</span><p className="font-medium">{selectedCliente.capitalSocial || "-"}</p></div>
                      <div><span className="text-muted-foreground">Optante Simples:</span><p className="font-medium">{selectedCliente.optanteSimples === true ? "Sim" : selectedCliente.optanteSimples === false ? "Não" : "-"}</p></div>
                      <div><span className="text-muted-foreground">Optante MEI:</span><p className="font-medium">{selectedCliente.optanteMEI === true ? "Sim" : selectedCliente.optanteMEI === false ? "Não" : "-"}</p></div>
                    </div>
                  </div>

                  {/* CNAE */}
                  {selectedCliente.cnaePrincipal && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                          <FileText className="h-4 w-4" /> CNAEs
                        </h3>
                        <div className="text-sm space-y-2">
                          <div className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">CNAE Principal</p>
                            <p className="font-medium">{selectedCliente.cnaePrincipal} - {selectedCliente.cnaePrincipalDescricao || ""}</p>
                          </div>
                          {parseCnaes(selectedCliente.cnaesSecundarios).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">CNAEs Secundários</p>
                              {parseCnaes(selectedCliente.cnaesSecundarios).map((cn, i) => (
                                <p key={i} className="text-xs bg-muted/30 rounded px-2 py-1">{cn.codigo} - {cn.descricao}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Sócios */}
                  {parseSocios(selectedCliente.socios).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                          <UserCircle className="h-4 w-4" /> Sócios
                        </h3>
                        <div className="space-y-2">
                          {parseSocios(selectedCliente.socios).map((s, i) => (
                            <div key={i} className="bg-muted/50 rounded-lg p-3 text-sm">
                              <p className="font-medium">{s.nome}</p>
                              {s.qualificacao && <p className="text-xs text-muted-foreground">{s.qualificacao}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {selectedCliente.dadosReceitaAtualizadosEm && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Dados da Receita atualizados em: {new Date(selectedCliente.dadosReceitaAtualizadosEm).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => { setViewOpen(false); if (selectedCliente) openEdit(selectedCliente); }}>
                <Pencil className="h-4 w-4 mr-2" />Editar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => selectedCliente && consultarReceitaMutation.mutate({ clienteId: selectedCliente.id })}
                disabled={consultarReceitaMutation.isPending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${consultarReceitaMutation.isPending ? "animate-spin" : ""}`} />
                {consultarReceitaMutation.isPending ? "Consultando..." : "Consultar Receita"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ EDIT DIALOG ═══ */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                Editar Cliente
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <Tabs defaultValue="dados" className="w-full">
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="dados">Dados</TabsTrigger>
                  <TabsTrigger value="contatos">Contatos</TabsTrigger>
                  <TabsTrigger value="endereco">Endereço</TabsTrigger>
                  <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
                </TabsList>

                {/* Tab: Dados Principais */}
                <TabsContent value="dados" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>CNPJ</Label>
                      <Input value={form.cnpj} disabled className="bg-muted" />
                    </div>
                    <div>
                      <Label>Situação Cadastral</Label>
                      <Input value={form.situacaoCadastral} onChange={(e) => setForm({ ...form, situacaoCadastral: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Razão Social *</Label>
                    <Input value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} />
                  </div>
                  <div>
                    <Label>Nome Fantasia</Label>
                    <Input value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Data de Abertura</Label>
                      <Input value={form.dataAbertura} onChange={(e) => setForm({ ...form, dataAbertura: e.target.value })} placeholder="dd/mm/aaaa" />
                    </div>
                    <div>
                      <Label>Natureza Jurídica</Label>
                      <Input value={form.naturezaJuridica} onChange={(e) => setForm({ ...form, naturezaJuridica: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Capital Social</Label>
                      <Input value={form.capitalSocial} onChange={(e) => setForm({ ...form, capitalSocial: e.target.value })} />
                    </div>
                    <div>
                      <Label>Porte</Label>
                      <Input value={form.porte} onChange={(e) => setForm({ ...form, porte: e.target.value })} />
                    </div>
                  </div>

                  {/* Botão Preencher via Receita - na aba Dados */}
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => selectedCliente && consultarReceitaMutation.mutate({ clienteId: selectedCliente.id })}
                      disabled={consultarReceitaMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 ${consultarReceitaMutation.isPending ? "animate-spin" : ""}`} />
                      {consultarReceitaMutation.isPending ? "Consultando Receita Federal..." : "Preencher via Receita Federal"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Preenche automaticamente todos os dados (sócios, CNAEs, endereço, regime tributário, etc.)
                    </p>
                  </div>
                </TabsContent>

                {/* Tab: Contatos */}
                <TabsContent value="contatos" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Contato Principal</Label>
                      <Input value={form.contatoPrincipal} onChange={(e) => setForm({ ...form, contatoPrincipal: e.target.value })} placeholder="Nome do contato" />
                    </div>
                    <div>
                      <Label>Contato Secundário</Label>
                      <Input value={form.contatoSecundario} onChange={(e) => setForm({ ...form, contatoSecundario: e.target.value })} placeholder="Nome do contato" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>E-mail Principal</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div>
                      <Label>E-mail Secundário</Label>
                      <Input type="email" value={form.emailSecundario} onChange={(e) => setForm({ ...form, emailSecundario: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Telefone Principal</Label>
                      <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <Label>Telefone Secundário</Label>
                      <Input value={form.telefone2} onChange={(e) => setForm({ ...form, telefone2: e.target.value })} placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Endereço */}
                <TabsContent value="endereco" className="space-y-4 mt-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <Label>Logradouro</Label>
                      <Input value={form.logradouro} onChange={(e) => setForm({ ...form, logradouro: e.target.value })} />
                    </div>
                    <div>
                      <Label>Número</Label>
                      <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Complemento</Label>
                      <Input value={form.complemento} onChange={(e) => setForm({ ...form, complemento: e.target.value })} />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Cidade</Label>
                      <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                    </div>
                    <div>
                      <Label>UF</Label>
                      <Input value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} maxLength={2} />
                    </div>
                    <div>
                      <Label>CEP</Label>
                      <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" />
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Fiscal */}
                <TabsContent value="fiscal" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo de Cliente</Label>
                      <Select value={form.tipoCliente || "none"} onValueChange={(v) => setForm({ ...form, tipoCliente: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não definido</SelectItem>
                          <SelectItem value="MEI">MEI</SelectItem>
                          <SelectItem value="ME">ME</SelectItem>
                          <SelectItem value="EPP">EPP</SelectItem>
                          <SelectItem value="Demais">Demais</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Regime Tributário</Label>
                      <Select value={form.regimeTributario || "none"} onValueChange={(v) => setForm({ ...form, regimeTributario: v === "none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não definido</SelectItem>
                          <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                          <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                          <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                          <SelectItem value="Imune/Isento">Imune/Isento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>CNAE Principal</Label>
                      <Input value={form.cnaePrincipal} onChange={(e) => setForm({ ...form, cnaePrincipal: e.target.value })} placeholder="Código" />
                    </div>
                    <div>
                      <Label>Descrição CNAE Principal</Label>
                      <Input value={form.cnaePrincipalDescricao} onChange={(e) => setForm({ ...form, cnaePrincipalDescricao: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.optanteSimples} onCheckedChange={(v) => setForm({ ...form, optanteSimples: v })} />
                      <Label>Optante Simples Nacional</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.optanteMEI} onCheckedChange={(v) => setForm({ ...form, optanteMEI: v })} />
                      <Label>Optante MEI</Label>
                    </div>
                  </div>


                </TabsContent>
              </Tabs>
            </ScrollArea>
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>
                <X className="h-4 w-4 mr-2" />Cancelar
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={updateMutation.isPending || !form.razaoSocial}>
                <Save className="h-4 w-4 mr-2" />
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ DELETE DIALOG ═══ */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Excluir Cliente
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Tem certeza que deseja excluir o cliente <strong>{clienteToDelete?.razaoSocial}</strong>?
                  </p>
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
                    <p className="font-semibold mb-1">Esta ação é irreversível e irá excluir TUDO vinculado ao cliente:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Todas as <strong>notas fiscais</strong> (XMLs e PDFs)</li>
                      <li>Todos os <strong>certificados digitais</strong></li>
                      <li>Todo o <strong>histórico de downloads</strong></li>
                      <li>Todos os <strong>agendamentos de download</strong></li>
                      <li>Todos os <strong>registros de auditoria</strong> do cliente</li>
                      <li>Downloads <strong>em andamento</strong> serão cancelados</li>
                      <li>O <strong>cadastro completo</strong> do cliente</li>
                    </ul>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (clienteToDelete) {
                    deleteMutation.mutate({ id: clienteToDelete.id, contabilidadeId: contabId });
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
