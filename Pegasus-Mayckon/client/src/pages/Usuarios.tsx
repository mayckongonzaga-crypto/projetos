import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  UserCog, Plus, MoreHorizontal, Pencil, Trash2, KeyRound, Shield,
  ShieldCheck, Building2, User, Eye, EyeOff, Search, UserPlus,
} from "lucide-react";

type UserRole = "admin" | "contabilidade" | "cliente";

const roleColors: Record<string, string> = {
  admin: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
  contabilidade: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  cliente: "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 dark:text-green-300 border-green-200 dark:border-green-800",
  usuario: "bg-gray-100 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  user: "bg-gray-100 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  contabilidade: "Contabilidade",
  cliente: "Cliente",
  usuario: "Usuário",
  user: "Usuário",
};

const roleIcons: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="h-3.5 w-3.5" />,
  contabilidade: <Building2 className="h-3.5 w-3.5" />,
  cliente: <User className="h-3.5 w-3.5" />,
};

export default function Usuarios() {
  const utils = trpc.useUtils();
  const { data: usuarios, isLoading } = trpc.admin.listUsers.useQuery();
  const { data: contabilidades } = trpc.admin.listContabilidades.useQuery();

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: "", email: "", password: "", role: "cliente" as UserRole, contabilidadeId: null as number | null,
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "", email: "", role: "cliente" as UserRole, contabilidadeId: null as number | null, ativo: true,
  });

  // Password form state
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Mutations
  const createUser = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso");
      utils.admin.listUsers.invalidate();
      setShowCreateModal(false);
      setCreateForm({ name: "", email: "", password: "", role: "cliente", contabilidadeId: null });
    },
    onError: (err) => toast.error(err.message),
  });

  const editUser = trpc.admin.editUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso");
      utils.admin.listUsers.invalidate();
      setShowEditModal(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPassword = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso");
      setShowPasswordModal(false);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeUser = trpc.admin.removeUser.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso");
      utils.admin.listUsers.invalidate();
      setShowDeleteDialog(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleUser = trpc.admin.toggleUser.useMutation({
    onSuccess: () => {
      utils.admin.listUsers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  // Handlers
  const handleCreate = () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createUser.mutate({
      name: createForm.name,
      email: createForm.email,
      password: createForm.password,
      role: createForm.role,
      contabilidadeId: createForm.contabilidadeId,
    });
  };

  const handleEdit = () => {
    if (!selectedUser) return;
    editUser.mutate({
      userId: selectedUser.id,
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
      contabilidadeId: editForm.contabilidadeId,
      ativo: editForm.ativo,
    });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    resetPassword.mutate({ userId: selectedUser.id, newPassword });
  };

  const handleDelete = () => {
    if (!selectedUser) return;
    removeUser.mutate({ userId: selectedUser.id });
  };

  const openEditModal = (user: any) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      role: user.role || "cliente",
      contabilidadeId: user.contabilidadeId || null,
      ativo: user.ativo !== false,
    });
    setShowEditModal(true);
  };

  const openPasswordModal = (user: any) => {
    setSelectedUser(user);
    setNewPassword("");
    setShowNewPassword(false);
    setShowPasswordModal(true);
  };

  const openDeleteDialog = (user: any) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // Filter users
  const filteredUsers = usuarios?.filter((u: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term) ||
      (roleLabels[u.role] || "").toLowerCase().includes(term)
    );
  });

  // Stats
  const totalUsers = usuarios?.length || 0;
  const adminCount = usuarios?.filter((u: any) => u.role === "admin").length || 0;
  const contabCount = usuarios?.filter((u: any) => u.role === "contabilidade").length || 0;
  const clienteCount = usuarios?.filter((u: any) => u.role === "cliente" || u.role === "usuario" || u.role === "user").length || 0;
  const inactiveCount = usuarios?.filter((u: any) => !u.ativo).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerenciar todos os usuários do sistema</p>
          </div>
          <Button onClick={() => { setCreateForm({ name: "", email: "", password: "", role: "cliente", contabilidadeId: null }); setShowCreateModal(true); }} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{adminCount}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-800/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{contabCount}</p>
              <p className="text-xs text-muted-foreground">Contabilidades</p>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-800/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{clienteCount}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </CardContent>
          </Card>
          <Card className="bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-800/50">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{inactiveCount}</p>
              <p className="text-xs text-muted-foreground">Inativos</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou papel..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse"><CardContent className="p-4 h-16" /></Card>
            ))}
          </div>
        ) : filteredUsers && filteredUsers.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Nome</th>
                  <th className="text-left p-3 font-medium">E-mail</th>
                  <th className="text-left p-3 font-medium">Papel</th>
                  <th className="text-left p-3 font-medium">Contabilidade</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Último Acesso</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: any) => (
                  <tr key={u.id} className={`border-t hover:bg-muted/30 transition-colors ${!u.ativo ? "opacity-50" : ""}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium ${
                          u.role === "admin" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300" :
                          u.role === "contabilidade" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                          "bg-primary/10 text-primary"
                        }`}>
                          {u.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <span className="font-medium">{u.name || "Sem nome"}</span>
                          {u.loginMethod === "password" && (
                            <span className="ml-2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Local</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{u.email || "-"}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${roleColors[u.role] || roleColors.user}`}>
                        {roleIcons[u.role]}
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{u.contabilidadeNome || "-"}</td>
                    <td className="p-3">
                      <Switch
                        checked={u.ativo !== false}
                        onCheckedChange={(checked) => toggleUser.mutate({ userId: u.id, ativo: checked })}
                        className="scale-75"
                      />
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString("pt-BR") : "-"}
                    </td>
                    <td className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(u)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPasswordModal(u)}>
                            <KeyRound className="h-4 w-4 mr-2" />
                            Trocar Senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDeleteDialog(u)} className="text-red-600 focus:text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <UserCog className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-lg">
                {searchTerm ? "Nenhum usuário encontrado" : "Nenhum usuário registrado"}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {searchTerm ? "Tente buscar com outros termos" : "Clique em 'Novo Usuário' para adicionar"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ CREATE USER MODAL ═══ */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Novo Usuário
            </DialogTitle>
            <DialogDescription>Crie um novo usuário com acesso por e-mail e senha.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Nome completo"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                >
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Papel *</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v as UserRole })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-red-500" /> Administrador</span>
                  </SelectItem>
                  <SelectItem value="contabilidade">
                    <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" /> Contabilidade</span>
                  </SelectItem>
                  <SelectItem value="cliente">
                    <span className="flex items-center gap-2"><User className="h-4 w-4 text-green-500" /> Cliente</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(createForm.role === "contabilidade" || createForm.role === "cliente") && (
              <div className="space-y-2">
                <Label>Contabilidade</Label>
                <Select
                  value={createForm.contabilidadeId?.toString() || "none"}
                  onValueChange={(v) => setCreateForm({ ...createForm, contabilidadeId: v === "none" ? null : parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contabilidades?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createUser.isPending}>
              {createUser.isPending ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT USER MODAL ═══ */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>Editar informações de {selectedUser?.name || "usuário"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Nome completo"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v as UserRole })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-red-500" /> Administrador</span>
                  </SelectItem>
                  <SelectItem value="contabilidade">
                    <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-500" /> Contabilidade</span>
                  </SelectItem>
                  <SelectItem value="cliente">
                    <span className="flex items-center gap-2"><User className="h-4 w-4 text-green-500" /> Cliente</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(editForm.role === "contabilidade" || editForm.role === "cliente") && (
              <div className="space-y-2">
                <Label>Contabilidade</Label>
                <Select
                  value={editForm.contabilidadeId?.toString() || "none"}
                  onValueChange={(v) => setEditForm({ ...editForm, contabilidadeId: v === "none" ? null : parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {contabilidades?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Ativo</Label>
                <p className="text-xs text-muted-foreground">Usuários inativos não conseguem acessar o sistema</p>
              </div>
              <Switch
                checked={editForm.ativo}
                onCheckedChange={(checked) => setEditForm({ ...editForm, ativo: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={editUser.isPending}>
              {editUser.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ CHANGE PASSWORD MODAL ═══ */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Trocar Senha
            </DialogTitle>
            <DialogDescription>Definir nova senha para {selectedUser?.name || "usuário"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancelar</Button>
            <Button onClick={handleResetPassword} disabled={resetPassword.isPending || newPassword.length < 6}>
              {resetPassword.isPending ? "Alterando..." : "Alterar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE CONFIRMATION ═══ */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{selectedUser?.name}</strong> ({selectedUser?.email})?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {removeUser.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
