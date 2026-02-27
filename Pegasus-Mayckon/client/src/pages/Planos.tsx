import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { CreditCard, Plus, Users, FileText, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Planos() {
  const { data: planos, isLoading } = trpc.admin.listPlanos.useQuery();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    nome: "", maxClientes: "10", maxCertificados: "10", maxDownloadsDia: "100", preco: "", ativo: true,
  });

  const createMutation = trpc.admin.createPlano.useMutation({
    onSuccess: () => {
      toast.success("Plano criado com sucesso!");
      utils.admin.listPlanos.invalidate();
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.updatePlano.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado!");
      utils.admin.listPlanos.invalidate();
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deletePlano.useMutation({
    onSuccess: () => {
      toast.success("Plano excluído!");
      utils.admin.listPlanos.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setOpen(false);
    setEditId(null);
    setForm({ nome: "", maxClientes: "10", maxCertificados: "10", maxDownloadsDia: "100", preco: "", ativo: true });
  };

  const handleEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      nome: p.nome,
      maxClientes: String(p.maxClientes),
      maxCertificados: String(p.maxCertificados),
      maxDownloadsDia: String(p.maxDownloadsDia),
      preco: p.preco || "",
      ativo: p.ativo,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.nome) { toast.error("Nome é obrigatório"); return; }
    const data = {
      nome: form.nome,
      maxClientes: Number(form.maxClientes) || 10,
      maxCertificados: Number(form.maxCertificados) || 10,
      maxDownloadsDia: Number(form.maxDownloadsDia) || 100,
      preco: form.preco ? form.preco.replace(',', '.') : undefined,
      ativo: form.ativo,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
            <p className="text-muted-foreground text-sm mt-1">Gerencie os planos disponíveis para contabilidades</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Plano</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Plano" : "Novo Plano"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Nome do Plano *</Label>
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Básico, Profissional, Enterprise" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Máx. Clientes</Label>
                    <Input type="number" value={form.maxClientes} onChange={(e) => setForm({ ...form, maxClientes: e.target.value })} />
                  </div>
                  <div>
                    <Label>Máx. Certificados</Label>
                    <Input type="number" value={form.maxCertificados} onChange={(e) => setForm({ ...form, maxCertificados: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Máx. Downloads/Dia</Label>
                    <Input type="number" value={form.maxDownloadsDia} onChange={(e) => setForm({ ...form, maxDownloadsDia: e.target.value })} />
                  </div>
                  <div>
                    <Label>Preço (R$/mês)</Label>
                    <Input value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} placeholder="99,90" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  <Label>Plano ativo</Label>
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : editId ? "Atualizar Plano" : "Criar Plano"}
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
        ) : planos && planos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planos.map((p: any) => (
              <Card key={p.id} className={`hover:shadow-md transition-shadow ${!p.ativo ? "opacity-60" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{p.nome}</h3>
                        {p.preco && <p className="text-lg font-bold text-primary mt-0.5">R$ {p.preco}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>}
                      </div>
                    </div>
                    <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Clientes</span>
                      <span className="font-medium">até {p.maxClientes}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Certificados</span>
                      <span className="font-medium">até {p.maxCertificados}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" />Downloads/dia</span>
                      <span className="font-medium">até {p.maxDownloadsDia}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(p)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
                      if (confirm("Tem certeza que deseja excluir este plano?")) deleteMutation.mutate({ id: p.id });
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="font-semibold text-lg">Nenhum plano cadastrado</h3>
              <p className="text-muted-foreground text-sm mt-1">Crie planos para definir limites de clientes e certificados por contabilidade.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
