import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Mail, Phone, Users, Pencil, Trash2, AlertTriangle, KeyRound, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Contabilidades() {
  const { data: contabilidades, isLoading } = trpc.admin.listContabilidades.useQuery();
  const { data: planosData } = trpc.admin.listPlanos.useQuery();
  const utils = trpc.useUtils();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    nome: "", cnpj: "", email: "", telefone: "", endereco: "",
    planoId: "", nomeResponsavel: "", senhaContabilidade: "",
  });

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: 0, nome: "", cnpj: "", email: "", telefone: "", endereco: "", planoId: "", novaSenha: "", retencaoMeses: "12",
    cteHabilitado: false, cteBaixarPdf: true,
  });

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; nome: string } | null>(null);

  const createMutation = trpc.admin.createContabilidade.useMutation({
    onSuccess: () => {
      toast.success("Contabilidade criada com sucesso! A conta de acesso foi criada automaticamente.");
      utils.admin.listContabilidades.invalidate();
      setCreateOpen(false);
      setCreateForm({ nome: "", cnpj: "", email: "", telefone: "", endereco: "", planoId: "", nomeResponsavel: "", senhaContabilidade: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.updateContabilidade.useMutation({
    onSuccess: () => {
      toast.success("Contabilidade atualizada com sucesso!");
      utils.admin.listContabilidades.invalidate();
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteContabilidade.useMutation({
    onSuccess: () => {
      toast.success("Contabilidade excluída com sucesso!");
      utils.admin.listContabilidades.invalidate();
      setDeleteOpen(false);
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = trpc.admin.toggleContabilidade.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.admin.listContabilidades.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleCreate = () => {
    if (!createForm.nome || !createForm.email || !createForm.senhaContabilidade || !createForm.nomeResponsavel) {
      toast.error("Preencha os campos obrigatórios: Nome, E-mail, Responsável e Senha");
      return;
    }
    createMutation.mutate({
      nome: createForm.nome,
      cnpj: createForm.cnpj || undefined,
      email: createForm.email,
      telefone: createForm.telefone || undefined,
      endereco: createForm.endereco || undefined,
      planoId: createForm.planoId ? Number(createForm.planoId) : undefined,
      nomeResponsavel: createForm.nomeResponsavel,
      senhaContabilidade: createForm.senhaContabilidade,
    });
  };

  const handleEdit = () => {
    updateMutation.mutate({
      id: editForm.id,
      nome: editForm.nome || undefined,
      cnpj: editForm.cnpj || undefined,
      email: editForm.email || undefined,
      telefone: editForm.telefone || undefined,
      endereco: editForm.endereco || undefined,
      planoId: editForm.planoId ? Number(editForm.planoId) : null,
      retencaoMeses: editForm.retencaoMeses ? Number(editForm.retencaoMeses) : undefined,
      cteHabilitado: editForm.cteHabilitado,
      cteBaixarPdf: editForm.cteBaixarPdf,
      novaSenha: editForm.novaSenha || undefined,
    });
  };

  const openEdit = (c: any) => {
    setEditForm({
      id: c.id,
      nome: c.nome || "",
      cnpj: c.cnpj || "",
      email: c.email || "",
      telefone: c.telefone || "",
      endereco: c.endereco || "",
      planoId: c.plano?.id ? String(c.plano.id) : (c.planoId ? String(c.planoId) : ""),
      novaSenha: "",
      retencaoMeses: String(c.retencaoMeses ?? 12),
      cteHabilitado: c.cteHabilitado ?? false,
      cteBaixarPdf: c.cteBaixarPdf ?? true,
    });
    setEditOpen(true);
  };

  const openDelete = (c: any) => {
    setDeleteTarget({ id: c.id, nome: c.nome });
    setDeleteOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão de Contabilidades</h1>
            <p className="text-muted-foreground text-sm mt-1">Crie, edite, exclua e controle os escritórios de contabilidade</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova Contabilidade</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova Contabilidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Dados da Contabilidade</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome do Escritório *</Label>
                      <Input value={createForm.nome} onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })} placeholder="Contabilidade XYZ Ltda" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>CNPJ</Label>
                        <Input value={createForm.cnpj} onChange={(e) => setCreateForm({ ...createForm, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                      </div>
                      <div>
                        <Label>Telefone</Label>
                        <Input value={createForm.telefone} onChange={(e) => setCreateForm({ ...createForm, telefone: e.target.value })} placeholder="(00) 0000-0000" />
                      </div>
                    </div>
                    <div>
                      <Label>Endereço</Label>
                      <Input value={createForm.endereco} onChange={(e) => setCreateForm({ ...createForm, endereco: e.target.value })} placeholder="Rua, número, cidade" />
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground font-medium mb-2">Plano</p>
                  <Select value={createForm.planoId} onValueChange={(v) => setCreateForm({ ...createForm, planoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {planosData?.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome} - até {p.maxClientes} clientes {p.preco ? `(R$ ${p.preco}/mês)` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-900">
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-2">Conta de Acesso da Contabilidade</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome do Responsável *</Label>
                      <Input value={createForm.nomeResponsavel} onChange={(e) => setCreateForm({ ...createForm, nomeResponsavel: e.target.value })} placeholder="João da Silva" />
                    </div>
                    <div>
                      <Label>E-mail de Acesso *</Label>
                      <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="contato@contabilidade.com.br" />
                    </div>
                    <div>
                      <Label>Senha de Acesso *</Label>
                      <Input type="password" value={createForm.senhaContabilidade} onChange={(e) => setCreateForm({ ...createForm, senhaContabilidade: e.target.value })} placeholder="Mínimo 6 caracteres" />
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Contabilidade e Conta de Acesso"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
            ))}
          </div>
        ) : contabilidades && contabilidades.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contabilidades.map((c: any) => (
              <Card key={c.id} className={`hover:shadow-md transition-shadow ${!c.ativo ? "opacity-60 border-destructive/30" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${c.ativo ? "bg-primary/10" : "bg-destructive/10"}`}>
                        <Building2 className={`h-5 w-5 ${c.ativo ? "text-primary" : "text-destructive"}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate text-sm">{c.nome}</h3>
                        {c.cnpj && <p className="text-xs text-muted-foreground">{c.cnpj}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={c.ativo ? "default" : "destructive"} className="text-xs">
                        {c.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {c.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /><span className="truncate">{c.email}</span>
                      </div>
                    )}
                    {c.telefone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />{c.telefone}
                      </div>
                    )}
                  </div>

                    {/* CT-e badge */}
                  <div className="flex items-center gap-2 mt-1">
                    {c.cteHabilitado ? (
                      <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs gap-1">
                        <Truck className="h-3 w-3" /> CT-e Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground gap-1 opacity-50">
                        <Truck className="h-3 w-3" /> CT-e Desativado
                      </Badge>
                    )}
                  </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span>{c.totalClientes || 0} clientes</span>
                      </div>
                      {(c.plano?.nome || c.planoNome) && (
                        <Badge variant="outline" className="text-xs">{c.plano?.nome || c.planoNome}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)} title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:bg-red-500/10" onClick={() => openDelete(c)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: c.id, ativo: checked })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-lg">Nenhuma contabilidade cadastrada</h3>
              <p className="text-muted-foreground text-sm mt-1">Crie a primeira contabilidade para começar.</p>
            </CardContent>
          </Card>
        )}

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Contabilidade</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome do Escritório</Label>
                <Input value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>CNPJ</Label>
                  <Input value={editForm.cnpj} onChange={(e) => setEditForm({ ...editForm, cnpj: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={editForm.telefone} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>E-mail</Label>
                <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={editForm.endereco} onChange={(e) => setEditForm({ ...editForm, endereco: e.target.value })} />
              </div>
              <div>
                <Label>Plano</Label>
                <Select value={editForm.planoId} onValueChange={(v) => setEditForm({ ...editForm, planoId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planosData?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome} - até {p.maxClientes} clientes
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 mt-2">
                <Label className="text-sm font-medium">Retenção de Dados (meses)</Label>
                <p className="text-xs text-muted-foreground mb-2">Por quanto tempo os XMLs e PDFs baixados ficam armazenados no sistema.</p>
                <Select value={editForm.retencaoMeses} onValueChange={(v) => setEditForm({ ...editForm, retencaoMeses: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meses</SelectItem>
                    <SelectItem value="6">6 meses</SelectItem>
                    <SelectItem value="12">12 meses (padrão)</SelectItem>
                    <SelectItem value="24">24 meses</SelectItem>
                    <SelectItem value="36">36 meses</SelectItem>
                    <SelectItem value="48">48 meses</SelectItem>
                    <SelectItem value="60">60 meses (5 anos)</SelectItem>
                    <SelectItem value="120">120 meses (10 anos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="border-t pt-4 mt-2">
                <p className="text-xs text-muted-foreground font-medium mb-3 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  Módulo CT-e (Conhecimento de Transporte)
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <Label className="text-sm font-medium">Habilitar CT-e</Label>
                      <p className="text-xs text-muted-foreground">Permite ao contador acessar download, consulta e relatórios de CT-e</p>
                    </div>
                    <Switch
                      checked={editForm.cteHabilitado}
                      onCheckedChange={(checked) => setEditForm({ ...editForm, cteHabilitado: checked })}
                    />
                  </div>
                  {editForm.cteHabilitado && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <Label className="text-sm font-medium">Baixar PDF (DACTE)</Label>
                        <p className="text-xs text-muted-foreground">Baixar o PDF do DACTE junto com o XML do CT-e</p>
                      </div>
                      <Switch
                        checked={editForm.cteBaixarPdf}
                        onCheckedChange={(checked) => setEditForm({ ...editForm, cteBaixarPdf: checked })}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t pt-4 mt-2">
                <Label className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  Nova Senha (deixe em branco para manter a atual)
                </Label>
                <Input
                  type="password"
                  placeholder="Digite a nova senha..."
                  value={editForm.novaSenha}
                  onChange={(e) => setEditForm({ ...editForm, novaSenha: e.target.value })}
                  autoComplete="new-password"
                />
                {editForm.novaSenha && editForm.novaSenha.length < 4 && (
                  <p className="text-xs text-red-500 mt-1">A senha deve ter no mínimo 4 caracteres</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete AlertDialog */}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Excluir Contabilidade
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a contabilidade <strong>{deleteTarget?.nome}</strong>?
                Esta ação irá remover permanentemente todos os dados associados: clientes, certificados, notas fiscais, agendamentos e usuários vinculados.
                <strong className="block mt-2 text-red-600">Esta ação não pode ser desfeita.</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (deleteTarget) {
                    deleteMutation.mutate({ id: deleteTarget.id });
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Excluindo..." : "Sim, excluir tudo"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
