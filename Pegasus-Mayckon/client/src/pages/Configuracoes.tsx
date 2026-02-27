import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Settings, Database, Trash2, AlertTriangle, Loader2, Users, Shield,
  UserPlus, Pencil, Key, Power, PowerOff, Eye, EyeOff, Building2,
  Clock, FileText, History, Lock, Check, Download, Filter, X, Save, LayoutDashboard, Zap, Sparkles, RotateCcw,
  Truck, FileDown, ClipboardList, FileCheck, Landmark
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { usePermissoes } from "@/hooks/usePermissoes";

const PERMISSOES_CONFIG = [
  { key: "verDashboard", label: "Ver Dashboard", desc: "Acessar o painel principal com estatísticas", icon: LayoutDashboard, group: "geral" },
  { key: "verClientes", label: "Ver Clientes", desc: "Visualizar lista de clientes", icon: Eye, group: "geral" },
  { key: "editarClientes", label: "Editar Clientes", desc: "Criar e editar cadastros de clientes", icon: Pencil, group: "geral" },
  { key: "apagarClientes", label: "Apagar Clientes", desc: "Excluir clientes do sistema", icon: Trash2, group: "geral" },
  { key: "verCertificados", label: "Ver Certificados", desc: "Visualizar certificados digitais", icon: Shield, group: "geral" },
  { key: "gerenciarCertificados", label: "Gerenciar Certificados", desc: "Upload e exclusão de certificados", icon: Key, group: "geral" },
  { key: "fazerDownloads", label: "Fazer Downloads NFSe", desc: "Executar downloads de notas fiscais", icon: Database, group: "nfse" },
  { key: "verHistorico", label: "Ver Histórico NFSe", desc: "Visualizar histórico de downloads NFSe", icon: History, group: "nfse" },
  { key: "gerenciarAgendamentos", label: "Gerenciar Agendamentos", desc: "Criar e editar agendamentos automáticos", icon: Clock, group: "geral" },
  { key: "verRelatorios", label: "Ver Relatórios NFSe", desc: "Acessar relatórios e estatísticas NFSe", icon: FileText, group: "nfse" },
  { key: "verCteNotas", label: "Ver CT-e Notas", desc: "Visualizar notas de CT-e", icon: Truck, group: "cte" },
  { key: "fazerDownloadsCte", label: "Fazer Downloads CT-e", desc: "Executar downloads de CT-e", icon: FileDown, group: "cte" },
  { key: "verHistoricoCte", label: "Ver Histórico CT-e", desc: "Visualizar histórico de downloads CT-e", icon: History, group: "cte" },
  { key: "verRelatoriosCte", label: "Ver Relatórios CT-e", desc: "Acessar relatórios e estatísticas CT-e", icon: ClipboardList, group: "cte" },
  { key: "gerenciarUsuarios", label: "Gerenciar Usuários", desc: "Criar, editar e excluir outros usuários", icon: Users, group: "admin" },
  { key: "gerenciarAuditoria", label: "Gerenciar Auditoria", desc: "Editar e excluir registros de auditoria", icon: History, group: "admin" },
] as const;

type PermissoesType = {
  verDashboard: boolean;
  verClientes: boolean;
  editarClientes: boolean;
  apagarClientes: boolean;
  verCertificados: boolean;
  gerenciarCertificados: boolean;
  fazerDownloads: boolean;
  verHistorico: boolean;
  gerenciarAgendamentos: boolean;
  verRelatorios: boolean;
  gerenciarUsuarios: boolean;
  gerenciarAuditoria: boolean;
  verCteNotas: boolean;
  fazerDownloadsCte: boolean;
  verHistoricoCte: boolean;
  verRelatoriosCte: boolean;
};

const DEFAULT_PERMISSOES: PermissoesType = {
  verDashboard: true,
  verClientes: true,
  editarClientes: false,
  apagarClientes: false,
  verCertificados: true,
  gerenciarCertificados: false,
  fazerDownloads: true,
  verHistorico: true,
  gerenciarAgendamentos: false,
  verRelatorios: true,
  gerenciarUsuarios: false,
  gerenciarAuditoria: false,
  verCteNotas: true,
  fazerDownloadsCte: true,
  verHistoricoCte: true,
  verRelatoriosCte: true,
};

export default function Configuracoes() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";
  const isContabilidade = user?.role === "contabilidade" || user?.role === "usuario";
  const isContador = user?.role === "contabilidade";
  const { permissoes } = usePermissoes();

  // Change password state
  const [changePwCurrent, setChangePwCurrent] = useState("");
  const [changePwNew, setChangePwNew] = useState("");
  const [changePwConfirm, setChangePwConfirm] = useState("");
  const [showChangePwCurrent, setShowChangePwCurrent] = useState(false);
  const [showChangePwNew, setShowChangePwNew] = useState(false);
  const [showChangePwConfirm, setShowChangePwConfirm] = useState(false);

  // Audit state
  const [auditFilterUser, setAuditFilterUser] = useState<string>("all");
  const [editAuditId, setEditAuditId] = useState<number | null>(null);
  const [editAuditDetalhes, setEditAuditDetalhes] = useState("");
  const [deleteAuditId, setDeleteAuditId] = useState<number | null>(null);
  const [deleteAllAuditOpen, setDeleteAllAuditOpen] = useState(false);
  const [pdfFilterUser, setPdfFilterUser] = useState<string>("all");
  const [retencaoDias, setRetencaoDias] = useState<string>("90");

  // Admin tools state
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [maxTentativasPdf, setMaxTentativasPdf] = useState("3");
  const [modoDownload, setModoDownload] = useState<"sequencial" | "paralelo">("sequencial");
  const [delayEntreEmpresas, setDelayEntreEmpresas] = useState("3");
  const [maxEmpresasSimultaneas, setMaxEmpresasSimultaneas] = useState("3");
  const [baixarPdf, setBaixarPdf] = useState(true);
  const [autoCorrecaoPdf, setAutoCorrecaoPdf] = useState(false);
  const [autoCorrecaoTempo, setAutoCorrecaoTempo] = useState("00:00:30");
  const [timeoutPorEmpresa, setTimeoutPorEmpresa] = useState("180");
  const [timeoutDinamico, setTimeoutDinamico] = useState(true);
  const [maxRodadasRetomada, setMaxRodadasRetomada] = useState("3");
  const [delayEntrePdfs, setDelayEntrePdfs] = useState("500");
  const [delayEntrePaginas, setDelayEntrePaginas] = useState("300");
  const [pularPdfErro, setPularPdfErro] = useState(false);
  const [retomadaInfinita, setRetomadaInfinita] = useState(false);
  const [modoPersonalizado, setModoPersonalizado] = useState(false);

  // Auto-Retomada PDFs state
  const [retryPdfsAuto, setRetryPdfsAuto] = useState(false);
  const [retryPdfsMaxTentativas, setRetryPdfsMaxTentativas] = useState("3");
  const [retryPdfsTempoEspera, setRetryPdfsTempoEspera] = useState("00:05:00");

  // IBS/CBS Reforma Tributária state
  const [ibsCbsAtivo, setIbsCbsAtivo] = useState(true);
  const [ibsCbsRelatorios, setIbsCbsRelatorios] = useState(true);

  // CT-e Auto-Retomada state
  const [autoCorrecaoCte, setAutoCorrecaoCte] = useState(false);
  const [autoCorrecaoTempoCte, setAutoCorrecaoTempoCte] = useState("00:00:20");
  const [retomadaInfinitaCte, setRetomadaInfinitaCte] = useState(false);

  // User management state
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [editPermOpen, setEditPermOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [deleteUserOpen, setDeleteUserOpen] = useState(false);
  const [deleteAllClientesOpen, setDeleteAllClientesOpen] = useState(false);
  const [deleteAllCteOpen, setDeleteAllCteOpen] = useState(false);
  const [deleteAllNfeOpen, setDeleteAllNfeOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Create user form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPermissoes, setNewPermissoes] = useState<PermissoesType>({ ...DEFAULT_PERMISSOES });

  // Edit permissoes
  const [editPermissoes, setEditPermissoes] = useState<PermissoesType>({ ...DEFAULT_PERMISSOES });

  // Reset password
  const [resetPassword, setResetPassword] = useState("");

  // Queries
  const { data: usuarios, isLoading: loadingUsers } = trpc.usuario.list.useQuery(undefined, {
    enabled: isContabilidade && permissoes.gerenciarUsuarios,
  });

  const { data: auditLogs, isLoading: loadingAudit } = trpc.usuario.auditLogs.useQuery(
    { limit: 500, userName: auditFilterUser !== "all" ? auditFilterUser : undefined },
    { enabled: isContabilidade && (permissoes.gerenciarUsuarios || permissoes.gerenciarAuditoria) }
  );

  const { data: auditUsers } = trpc.usuario.auditLogUsers.useQuery(undefined, {
    enabled: isContabilidade && (permissoes.gerenciarUsuarios || permissoes.gerenciarAuditoria),
  });

  const { data: contabilidades } = trpc.contabilidade.list.useQuery(undefined, {
    enabled: isContador,
  });

  // Audit mutations
  const updateAuditMutation = trpc.usuario.auditLogUpdate.useMutation({
    onSuccess: () => {
      toast.success("Registro de auditoria atualizado!");
      utils.usuario.auditLogs.invalidate();
      setEditAuditId(null);
      setEditAuditDetalhes("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAuditMutation = trpc.usuario.auditLogDelete.useMutation({
    onSuccess: () => {
      toast.success("Registro de auditoria excluído!");
      utils.usuario.auditLogs.invalidate();
      utils.usuario.auditLogUsers.invalidate();
      setDeleteAuditId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAllAuditMutation = trpc.usuario.auditLogDeleteAll.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deleted} registro(s) de auditoria excluído(s)!`);
      utils.usuario.auditLogs.invalidate();
      utils.usuario.auditLogUsers.invalidate();
      setDeleteAllAuditOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: retencaoData } = trpc.usuario.auditRetencaoGet.useQuery(undefined, {
    enabled: isContabilidade && (permissoes.gerenciarUsuarios || permissoes.gerenciarAuditoria),
  });
  useEffect(() => {
    if (retencaoData?.dias) setRetencaoDias(String(retencaoData.dias));
  }, [retencaoData]);
  const retencaoMutation = trpc.usuario.auditRetencaoUpdate.useMutation({
    onSuccess: (data) => {
      toast.success(`Retenção atualizada! ${data.removidos > 0 ? `${data.removidos} registro(s) antigo(s) removido(s).` : ""}`);
      utils.usuario.auditLogs.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const pdfReportMutation = trpc.usuario.auditLogReportPdf.useMutation({
    onSuccess: (data) => {
      // Download the PDF
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
    onError: (err) => toast.error(err.message),
  });

  // Change password mutation
  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso!");
      setChangePwCurrent("");
      setChangePwNew("");
      setChangePwConfirm("");
      setShowChangePwCurrent(false);
      setShowChangePwNew(false);
      setShowChangePwConfirm(false);
    },
    onError: (err) => toast.error(err.message),
  });

  // Admin mutations
  const seedMutation = trpc.seed.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Dados de teste gerados: ${data.clientesCreated} clientes, ${data.notasCreated} notas`);
      utils.invalidate();
      setSeeding(false);
    },
    onError: (err) => { toast.error(err.message); setSeeding(false); },
  });

  const clearMutation = trpc.seed.clear.useMutation({
    onSuccess: () => {
      toast.success("Todos os dados foram removidos");
      utils.invalidate();
      setClearing(false);
    },
    onError: (err) => { toast.error(err.message); setClearing(false); },
  });

  // User management mutations
  const createUserMutation = trpc.usuario.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.usuario.list.invalidate();
      utils.usuario.auditLogs.invalidate();
      setCreateUserOpen(false);
      resetCreateForm();
    },
    onError: (err) => toast.error(err.message),
  });

  const updatePermMutation = trpc.usuario.updatePermissoes.useMutation({
    onSuccess: () => {
      toast.success("Permissões atualizadas!");
      utils.usuario.list.invalidate();
      setEditPermOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.usuario.toggle.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.ativo ? "Usuário ativado" : "Usuário desativado");
      utils.usuario.list.invalidate();
      utils.usuario.auditLogs.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteUserMutation = trpc.usuario.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído!");
      utils.usuario.list.invalidate();
      utils.usuario.auditLogs.invalidate();
      setDeleteUserOpen(false);
      setSelectedUser(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPwMutation = trpc.usuario.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso!");
      setResetPwOpen(false);
      setResetPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  // Configuração de tentativas de PDF
  const maxTentativasQuery = trpc.settings.getMaxTentativasPdf.useQuery(undefined, {
    enabled: isContador,
  });
  useEffect(() => {
    if (maxTentativasQuery.data) setMaxTentativasPdf(maxTentativasQuery.data.valor);
  }, [maxTentativasQuery.data]);
  const saveMaxTentativas = trpc.settings.setMaxTentativasPdf.useMutation({
    onSuccess: () => { toast.success("Configuração salva com sucesso!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar configuração"); },
  });

  // Configuração de modo de download
  const modoDownloadQuery = trpc.settings.getModoDownload.useQuery(undefined, {
    enabled: isContador,
  });
  useEffect(() => {
    if (modoDownloadQuery.data) {
      const val = modoDownloadQuery.data.valor || "sequencial";
      if (val.startsWith("sequencial:")) {
        setModoDownload("sequencial");
        setDelayEntreEmpresas(val.split(":")[1] || "3");
      } else {
        setModoDownload(val as "sequencial" | "paralelo");
      }
    }
  }, [modoDownloadQuery.data]);
  const saveModoDownload = trpc.settings.setModoDownload.useMutation({
    onSuccess: () => { toast.success("Modo de download salvo com sucesso!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar configuração"); },
  });

  // Configuração de download de PDF (DANFSe)
  const baixarPdfQuery = trpc.settings.getBaixarPdf.useQuery(undefined, {
    enabled: isContador,
  });
  useEffect(() => {
    if (baixarPdfQuery.data) setBaixarPdf(baixarPdfQuery.data.valor);
  }, [baixarPdfQuery.data]);
  const saveBaixarPdf = trpc.settings.setBaixarPdf.useMutation({
    onSuccess: () => { toast.success("Configuração de download de PDF salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar configuração"); },
  });

  // Configuração de auto-correção de PDF
  const autoCorrecaoQuery = trpc.settings.getAutoCorrecaoPdf.useQuery(undefined, {
    enabled: isContador,
  });
  useEffect(() => {
    if (autoCorrecaoQuery.data) setAutoCorrecaoPdf(autoCorrecaoQuery.data.valor);
  }, [autoCorrecaoQuery.data]);
  const saveAutoCorrecao = trpc.settings.setAutoCorrecaoPdf.useMutation({
    onSuccess: () => { toast.success("Configuração de auto-correção salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar configuração"); },
  });

  // Configuração de tempo de espera da auto-correção
  const autoCorrecaoTempoQuery = trpc.settings.getAutoCorrecaoTempo.useQuery(undefined, {
    enabled: isContador,
  });
  useEffect(() => {
    if (autoCorrecaoTempoQuery.data) setAutoCorrecaoTempo(autoCorrecaoTempoQuery.data.valor);
  }, [autoCorrecaoTempoQuery.data]);
  const saveAutoCorrecaoTempo = trpc.settings.setAutoCorrecaoTempo.useMutation({
    onSuccess: () => { toast.success("Tempo de espera da auto-correção salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar configuração"); },
  });

  // Configuração de empresas simultâneas (Engine v2)
  const maxEmpresasQuery = trpc.settings.getMaxEmpresasSimultaneas.useQuery(undefined, {
    enabled: isContador,
  });
  useEffect(() => {
    if (maxEmpresasQuery.data) setMaxEmpresasSimultaneas(maxEmpresasQuery.data.valor);
  }, [maxEmpresasQuery.data]);
  const saveMaxEmpresasSimultaneas = trpc.settings.setMaxEmpresasSimultaneas.useMutation({
    onSuccess: () => { toast.success("Configuração de empresas simultâneas salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar configuração"); },
  });

  // Configurações avançadas de download
  const timeoutQuery = trpc.settings.getTimeoutPorEmpresa.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (timeoutQuery.data) setTimeoutPorEmpresa(timeoutQuery.data.valor); }, [timeoutQuery.data]);
  const saveTimeout = trpc.settings.setTimeoutPorEmpresa.useMutation({
    onSuccess: () => { toast.success("Timeout por empresa salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const timeoutDinQuery = trpc.settings.getTimeoutDinamico.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (timeoutDinQuery.data !== undefined) setTimeoutDinamico(timeoutDinQuery.data.valor); }, [timeoutDinQuery.data]);
  const saveTimeoutDin = trpc.settings.setTimeoutDinamico.useMutation({
    onSuccess: () => { toast.success("Timeout dinâmico salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const maxRodadasQuery = trpc.settings.getMaxRodadasRetomada.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (maxRodadasQuery.data) setMaxRodadasRetomada(maxRodadasQuery.data.valor); }, [maxRodadasQuery.data]);
  const saveMaxRodadas = trpc.settings.setMaxRodadasRetomada.useMutation({
    onSuccess: () => { toast.success("Máximo de rodadas salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const delayPdfsQuery = trpc.settings.getDelayEntrePdfs.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (delayPdfsQuery.data) setDelayEntrePdfs(delayPdfsQuery.data.valor); }, [delayPdfsQuery.data]);
  const saveDelayPdfs = trpc.settings.setDelayEntrePdfs.useMutation({
    onSuccess: () => { toast.success("Delay entre PDFs salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const delayPaginasQuery = trpc.settings.getDelayEntrePaginas.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (delayPaginasQuery.data) setDelayEntrePaginas(delayPaginasQuery.data.valor); }, [delayPaginasQuery.data]);
  const saveDelayPaginas = trpc.settings.setDelayEntrePaginas.useMutation({
    onSuccess: () => { toast.success("Delay entre páginas salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const pularPdfQuery = trpc.settings.getPularPdfErro.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (pularPdfQuery.data !== undefined) setPularPdfErro(pularPdfQuery.data.valor); }, [pularPdfQuery.data]);
  const savePularPdf = trpc.settings.setPularPdfErro.useMutation({
    onSuccess: () => { toast.success("Configuração de pular PDF salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  // Retomada Infinita
  const retomadaInfinitaQuery = trpc.settings.getRetomadaInfinita.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (retomadaInfinitaQuery.data !== undefined) setRetomadaInfinita(retomadaInfinitaQuery.data.valor); }, [retomadaInfinitaQuery.data]);
  const saveRetomadaInfinita = trpc.settings.setRetomadaInfinita.useMutation({
    onSuccess: () => { toast.success("Configuração de retomada infinita salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  // Auto-Retomada PDFs queries/mutations
  const retryPdfsConfigQuery = trpc.settings.getRetryPdfsConfig.useQuery(undefined, { enabled: isContador });
  useEffect(() => {
    if (retryPdfsConfigQuery.data) {
      setRetryPdfsAuto(retryPdfsConfigQuery.data.autoRetomada);
      setRetryPdfsMaxTentativas(retryPdfsConfigQuery.data.maxTentativas);
      setRetryPdfsTempoEspera(retryPdfsConfigQuery.data.tempoEspera);
    }
  }, [retryPdfsConfigQuery.data]);
  const saveRetryPdfsConfig = trpc.settings.setRetryPdfsConfig.useMutation({
    onSuccess: () => { toast.success("Configuração de retomada de PDFs salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  // IBS/CBS Config queries/mutations
  const ibsCbsConfigQuery = trpc.settings.get.useQuery({ chave: "ibscbs_ativo" }, { enabled: isContador });
  const ibsCbsRelatoriosQuery = trpc.settings.get.useQuery({ chave: "ibscbs_relatorios" }, { enabled: isContador });
  useEffect(() => {
    if (ibsCbsConfigQuery.data?.valor !== undefined) setIbsCbsAtivo(ibsCbsConfigQuery.data.valor === "true");
  }, [ibsCbsConfigQuery.data]);
  useEffect(() => {
    if (ibsCbsRelatoriosQuery.data?.valor !== undefined) setIbsCbsRelatorios(ibsCbsRelatoriosQuery.data.valor === "true");
  }, [ibsCbsRelatoriosQuery.data]);
  const saveIbsCbsConfig = trpc.settings.updateMultiple.useMutation({
    onSuccess: () => { toast.success("Configura\u00e7\u00e3o IBS/CBS salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });
  // Wrapper para simplificar chamada
  const saveIbsCbsConfigWrapped = {
    mutate: (data: { ativo: boolean; exibirRelatorios: boolean }) => {
      saveIbsCbsConfig.mutate({
        settings: [
          { chave: "ibscbs_ativo", valor: String(data.ativo) },
          { chave: "ibscbs_relatorios", valor: String(data.exibirRelatorios) },
        ],
      });
    },
  };

  // CT-e Auto-Retomada queries/mutations
  const autoCorrecaoCteQuery = trpc.settings.getAutoCorrecaoCte.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (autoCorrecaoCteQuery.data !== undefined) setAutoCorrecaoCte(autoCorrecaoCteQuery.data.valor); }, [autoCorrecaoCteQuery.data]);
  const saveAutoCorrecaoCte = trpc.settings.setAutoCorrecaoCte.useMutation({
    onSuccess: () => { toast.success("Auto-retomada CT-e salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const autoCorrecaoTempoCteQuery = trpc.settings.getAutoCorrecaoTempoCte.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (autoCorrecaoTempoCteQuery.data) setAutoCorrecaoTempoCte(autoCorrecaoTempoCteQuery.data.valor); }, [autoCorrecaoTempoCteQuery.data]);
  const saveAutoCorrecaoTempoCte = trpc.settings.setAutoCorrecaoTempoCte.useMutation({
    onSuccess: () => { toast.success("Tempo de espera CT-e salvo!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const retomadaInfinitaCteQuery = trpc.settings.getRetomadaInfinitaCte.useQuery(undefined, { enabled: isContador });
  useEffect(() => { if (retomadaInfinitaCteQuery.data !== undefined) setRetomadaInfinitaCte(retomadaInfinitaCteQuery.data.valor); }, [retomadaInfinitaCteQuery.data]);
  const saveRetomadaInfinitaCte = trpc.settings.setRetomadaInfinitaCte.useMutation({
    onSuccess: () => { toast.success("Retomada infinita CT-e salva!"); },
    onError: (err: any) => { toast.error(err.message || "Erro ao salvar"); },
  });

  const deleteAllClientesMutation = trpc.cliente.deleteAll.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || `${data.deleted} cliente(s) e todos os dados associados foram apagados!`);
      utils.cliente.list.invalidate();
      utils.download.clientesComStatus.invalidate();
      utils.dashboard.stats.invalidate();
      utils.usuario.auditLogs.invalidate();
      utils.certificado.list.invalidate();
      utils.agendamento.list.invalidate();
      utils.download.logs.invalidate();
      setDeleteAllClientesOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAllCteMutation = trpc.cte.deleteAllCte.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Todos os CT-e foram apagados!");
      utils.cte.notas.invalidate();
      utils.cte.stats.invalidate().catch(() => {});
      utils.dashboard.stats.invalidate();
      setDeleteAllCteOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAllNfeMutation = trpc.cte.deleteAllNfe.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Todas as NFe foram apagadas!");
      utils.nota.list.invalidate();
      utils.download.logs.invalidate();
      utils.dashboard.stats.invalidate();
      setDeleteAllNfeOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const repopularChavesMutation = trpc.cte.repopularChavesNfe.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || "Chaves NF-e repopuladas!");
      utils.cte.notas.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const contabId = contabilidades?.[0]?.id;

  const resetCreateForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewPermissoes({ ...DEFAULT_PERMISSOES });
    setShowPassword(false);
  };

  const openEditPerm = (u: any) => {
    setSelectedUser(u);
    setEditPermissoes(u.permissoes || { ...DEFAULT_PERMISSOES });
    setEditPermOpen(true);
  };

  const openResetPw = (u: any) => {
    setSelectedUser(u);
    setResetPassword("");
    setResetPwOpen(true);
  };

  const openDeleteUser = (u: any) => {
    setSelectedUser(u);
    setDeleteUserOpen(true);
  };

  // Permissões checkbox component
  const PERM_GROUPS = [
    { id: "geral", label: "Geral", icon: LayoutDashboard },
    { id: "nfse", label: "NFSe", icon: FileText },
    { id: "cte", label: "CT-e", icon: Truck },
    { id: "admin", label: "Administração", icon: Shield },
  ];

  const PermissoesGrid = ({
    permissoes,
    onChange,
  }: {
    permissoes: PermissoesType;
    onChange: (p: PermissoesType) => void;
  }) => (
    <div className="space-y-4">
      {PERM_GROUPS.map(group => {
        const items = PERMISSOES_CONFIG.filter(p => p.group === group.id);
        if (items.length === 0) return null;
        const GroupIcon = group.icon;
        return (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-2">
              <GroupIcon className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
              <Separator className="flex-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {items.map(({ key, label, desc, icon: Icon }) => (
                <div
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    permissoes[key as keyof PermissoesType]
                      ? "bg-primary/5 border-primary/30"
                      : "bg-muted/30 border-border hover:bg-muted/50"
                  }`}
                  onClick={() =>
                    onChange({ ...permissoes, [key]: !permissoes[key as keyof PermissoesType] })
                  }
                >
                  <Checkbox
                    checked={permissoes[key as keyof PermissoesType]}
                    onCheckedChange={(v) => onChange({ ...permissoes, [key]: !!v })}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            Configurações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configurações do sistema, gerenciamento de usuários e ferramentas
          </p>
        </div>

        <Tabs defaultValue={isContador ? "usuarios" : "info"} className="w-full">
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="info">Minha Conta</TabsTrigger>
            {isContabilidade && permissoes.gerenciarUsuarios && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
            {isContabilidade && (permissoes.gerenciarUsuarios || permissoes.gerenciarAuditoria) && <TabsTrigger value="auditoria">Auditoria</TabsTrigger>}
            {(isAdmin || isContador) && <TabsTrigger value="ferramentas">Ferramentas</TabsTrigger>}
          </TabsList>

          {/* ═══ TAB: MINHA CONTA ═══ */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Informações do Usuário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nome</p>
                    <p className="font-medium">{user?.name || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">E-mail</p>
                    <p className="font-medium">{user?.email || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Perfil</p>
                    <p className="font-medium capitalize">{user?.role || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Último Acesso</p>
                    <p className="font-medium">
                      {user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("pt-BR") : "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Alterar Senha ─── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>Altere sua senha de acesso ao sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-pw">Senha Atual</Label>
                    <div className="relative">
                      <Input
                        id="current-pw"
                        type={showChangePwCurrent ? "text" : "password"}
                        value={changePwCurrent}
                        onChange={(e) => setChangePwCurrent(e.target.value)}
                        placeholder="Digite sua senha atual"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowChangePwCurrent(!showChangePwCurrent)}
                      >
                        {showChangePwCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-pw">Nova Senha</Label>
                    <div className="relative">
                      <Input
                        id="new-pw"
                        type={showChangePwNew ? "text" : "password"}
                        value={changePwNew}
                        onChange={(e) => setChangePwNew(e.target.value)}
                        placeholder="Digite a nova senha (mín. 6 caracteres)"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowChangePwNew(!showChangePwNew)}
                      >
                        {showChangePwNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {changePwNew && changePwNew.length < 6 && (
                      <p className="text-xs text-destructive">A senha deve ter no mínimo 6 caracteres</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-pw">Confirmar Nova Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirm-pw"
                        type={showChangePwConfirm ? "text" : "password"}
                        value={changePwConfirm}
                        onChange={(e) => setChangePwConfirm(e.target.value)}
                        placeholder="Confirme a nova senha"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowChangePwConfirm(!showChangePwConfirm)}
                      >
                        {showChangePwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {changePwConfirm && changePwNew !== changePwConfirm && (
                      <p className="text-xs text-destructive">As senhas não coincidem</p>
                    )}
                  </div>

                  <Separator />

                  <Button
                    onClick={() => {
                      if (!changePwCurrent) { toast.error("Informe a senha atual"); return; }
                      if (changePwNew.length < 6) { toast.error("A nova senha deve ter no mínimo 6 caracteres"); return; }
                      if (changePwNew !== changePwConfirm) { toast.error("As senhas não coincidem"); return; }
                      changePasswordMutation.mutate({ currentPassword: changePwCurrent, newPassword: changePwNew });
                    }}
                    disabled={changePasswordMutation.isPending || !changePwCurrent || changePwNew.length < 6 || changePwNew !== changePwConfirm}
                    className="w-full sm:w-auto"
                  >
                    {changePasswordMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Alterando...</>
                    ) : (
                      <><Key className="h-4 w-4 mr-2" />Alterar Senha</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: GERENCIAMENTO DE USUÁRIOS ═══ */}
          {isContabilidade && permissoes.gerenciarUsuarios && (
            <TabsContent value="usuarios" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Usuários do Sistema</h2>
                  <p className="text-sm text-muted-foreground">
                    Crie e gerencie os usuários que podem acessar sua contabilidade
                  </p>
                </div>
                <Button onClick={() => { resetCreateForm(); setCreateUserOpen(true); }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Novo Usuário
                </Button>
              </div>

              {loadingUsers ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
                  ))}
                </div>
              ) : !usuarios || usuarios.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                    <p className="font-medium text-lg">Nenhum usuário criado</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Crie usuários para que outras pessoas acessem o sistema com permissões específicas
                    </p>
                    <Button className="mt-4" onClick={() => { resetCreateForm(); setCreateUserOpen(true); }}>
                      <UserPlus className="h-4 w-4 mr-2" />Criar Primeiro Usuário
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {usuarios.map((u: any) => (
                    <Card key={u.id} className={`transition-all ${!u.ativo ? "opacity-60" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                              u.ativo ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {u.name?.charAt(0).toUpperCase() || "?"}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{u.name}</span>
                                <Badge variant={u.ativo ? "default" : "secondary"} className="text-[10px]">
                                  {u.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openEditPerm(u)}
                            >
                              <Shield className="h-3.5 w-3.5 mr-1" />Permissões
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => openResetPw(u)}
                            >
                              <Key className="h-3.5 w-3.5 mr-1" />Senha
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => toggleMutation.mutate({ userId: u.id, ativo: !u.ativo })}
                              disabled={toggleMutation.isPending}
                              title={u.ativo ? "Desativar" : "Ativar"}
                            >
                              {u.ativo ? (
                                <PowerOff className="h-3.5 w-3.5 text-orange-500" />
                              ) : (
                                <Power className="h-3.5 w-3.5 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                              onClick={() => openDeleteUser(u)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Permissões badges */}
                        {u.permissoes && (
                          <div className="flex flex-wrap gap-1.5 mt-3 pl-13">
                            {PERMISSOES_CONFIG.filter(p => u.permissoes[p.key]).map(p => (
                              <Badge key={p.key} variant="outline" className="text-[10px] font-normal">
                                {p.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )}

          {/* ═══ TAB: AUDITORIA ═══ */}
          {isContabilidade && (permissoes.gerenciarUsuarios || permissoes.gerenciarAuditoria) && (
            <TabsContent value="auditoria" className="space-y-4 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Log de Auditoria</h2>
                  <p className="text-sm text-muted-foreground">
                    Registro de ações realizadas no sistema
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteAllAuditOpen(true)}
                    disabled={!auditLogs || auditLogs.length === 0 || deleteAllAuditMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />Apagar Todos
                  </Button>
                </div>
              </div>

              {/* Retenção de Auditoria */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs mb-1 block">Tempo de Armazenamento (dias)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={7}
                          max={365}
                          value={retencaoDias}
                          onChange={(e) => setRetencaoDias(e.target.value)}
                          className="h-9 w-24"
                        />
                        <span className="text-xs text-muted-foreground">dias</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Recomendado: 90 dias. Registros mais antigos serão removidos automaticamente.</p>
                    </div>
                    <Button
                      size="sm"
                      className="h-9"
                      onClick={() => retencaoMutation.mutate({ dias: parseInt(retencaoDias) || 90 })}
                      disabled={retencaoMutation.isPending}
                    >
                      {retencaoMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Salvando...</>
                      ) : (
                        <><Save className="h-3.5 w-3.5 mr-1" />Salvar Retenção</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Filtro e Relatório PDF */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs mb-1 block">Filtrar por Usuário</Label>
                      <Select value={auditFilterUser} onValueChange={setAuditFilterUser}>
                        <SelectTrigger className="h-9">
                          <Filter className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <SelectValue placeholder="Todos os usuários" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Usuários</SelectItem>
                          {auditUsers?.map((u: string) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs mb-1 block">Relatório PDF por Usuário</Label>
                      <Select value={pdfFilterUser} onValueChange={setPdfFilterUser}>
                        <SelectTrigger className="h-9">
                          <FileText className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                          <SelectValue placeholder="Todos os usuários" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os Usuários</SelectItem>
                          {auditUsers?.map((u: string) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      className="h-9"
                      onClick={() => pdfReportMutation.mutate({
                        userName: pdfFilterUser !== "all" ? pdfFilterUser : undefined,
                      })}
                      disabled={pdfReportMutation.isPending || (!auditLogs || auditLogs.length === 0)}
                    >
                      {pdfReportMutation.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Gerando...</>
                      ) : (
                        <><Download className="h-3.5 w-3.5 mr-1" />Gerar PDF</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de registros */}
              {loadingAudit ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mt-2">Carregando registros...</p>
                  </CardContent>
                </Card>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <History className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                    <p className="font-medium">Nenhum registro de auditoria</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {auditFilterUser !== "all" ? "Nenhum registro encontrado para este usuário" : "As ações realizadas no sistema serão registradas aqui"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {auditLogs.length} registro(s) encontrado(s)
                        {auditFilterUser !== "all" && ` para ${auditFilterUser}`}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      <div className="divide-y">
                        {auditLogs.map((log: any) => (
                          <div key={log.id} className="p-3 hover:bg-muted/30 transition-colors group">
                            {editAuditId === log.id ? (
                              /* Modo edição */
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <div className={`h-2 w-2 rounded-full ${
                                    log.acao.includes("excluir") || log.acao.includes("apagar") ? "bg-red-50 dark:bg-red-500/15" :
                                    log.acao.includes("criar") ? "bg-green-50 dark:bg-green-500/15" :
                                    log.acao.includes("ativar") ? "bg-blue-50 dark:bg-blue-500/15" :
                                    log.acao.includes("desativar") ? "bg-orange-50 dark:bg-orange-500/15" :
                                    "bg-gray-400"
                                  }`} />
                                  <span className="text-sm font-medium">{log.userName}</span>
                                  <Badge variant="outline" className="text-[10px]">{log.acao}</Badge>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {new Date(log.createdAt).toLocaleString("pt-BR")}
                                  </span>
                                </div>
                                <Textarea
                                  value={editAuditDetalhes}
                                  onChange={(e) => setEditAuditDetalhes(e.target.value)}
                                  placeholder="Detalhes / Observações"
                                  rows={3}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => updateAuditMutation.mutate({ id: log.id, detalhes: editAuditDetalhes })}
                                    disabled={updateAuditMutation.isPending}
                                  >
                                    {updateAuditMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3 mr-1" />
                                    )}
                                    Salvar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => { setEditAuditId(null); setEditAuditDetalhes(""); }}
                                  >
                                    <X className="h-3 w-3 mr-1" />Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              /* Modo visualização */
                              <div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${
                                      log.acao.includes("excluir") || log.acao.includes("apagar") ? "bg-red-50 dark:bg-red-500/15" :
                                      log.acao.includes("criar") ? "bg-green-50 dark:bg-green-500/15" :
                                      log.acao.includes("ativar") ? "bg-blue-50 dark:bg-blue-500/15" :
                                      log.acao.includes("desativar") ? "bg-orange-50 dark:bg-orange-500/15" :
                                      "bg-gray-400"
                                    }`} />
                                    <span className="text-sm font-medium">{log.userName}</span>
                                    <Badge variant="outline" className="text-[10px]">{log.acao}</Badge>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-muted-foreground mr-2">
                                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Editar detalhes"
                                      onClick={() => {
                                        setEditAuditId(log.id);
                                        setEditAuditDetalhes(log.detalhes || "");
                                      }}
                                    >
                                      <Pencil className="h-3 w-3 text-muted-foreground" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Excluir registro"
                                      onClick={() => setDeleteAuditId(log.id)}
                                    >
                                      <Trash2 className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </div>
                                </div>
                                {log.detalhes && (
                                  <p className="text-xs text-muted-foreground mt-1 ml-4">
                                    {(() => {
                                      try {
                                        const d = JSON.parse(log.detalhes);
                                        return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(" | ");
                                      } catch { return log.detalhes; }
                                    })()}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ═══ TAB: FERRAMENTAS ═══ */}
          {(isAdmin || isContador) && (
            <TabsContent value="ferramentas" className="space-y-4 mt-4">

              {/* ═══ GRID 3 COLUNAS: Configurações Básicas de Download ═══ */}
              {isContador && contabId && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

                  {/* Card 1: Tentativas de Download de PDF */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Download className="h-4 w-4 text-primary" />
                        Tentativas de PDF
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Quantas vezes tentar baixar o PDF de cada nota em caso de falha.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="maxTentativas" className="text-sm whitespace-nowrap">Tentativas:</Label>
                          <Input
                            id="maxTentativas"
                            type="number"
                            min={1}
                            max={10}
                            className="w-20"
                            value={maxTentativasPdf}
                            onChange={(e) => setMaxTentativasPdf(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => saveMaxTentativas.mutate({ valor: maxTentativasPdf })}
                          disabled={saveMaxTentativas.isPending}
                        >
                          {saveMaxTentativas.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">1 a 10. Padrão: 3</p>
                    </CardContent>
                  </Card>

                  {/* Card 2: Download de PDFs (DANFSe) */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-500" />
                        Download de PDFs
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Baixar PDFs (DANFSe) junto com os XMLs. Desativar torna o download mais rápido.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {baixarPdf ? "Ativado" : "Desativado"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {baixarPdf ? "XML + PDF" : "Apenas XMLs"}
                          </p>
                        </div>
                        <Switch
                          checked={baixarPdf}
                          onCheckedChange={(checked) => {
                            setBaixarPdf(checked);
                            saveBaixarPdf.mutate({ valor: checked });
                          }}
                        />
                      </div>
                      {!baixarPdf && (
                        <div className="mt-2 p-2 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200">
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Coluna PDFs no histórico mostrará 0.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 3: Velocidade de Download */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        Velocidade de Download
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Empresas simultâneas e intervalo entre cada uma.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Simultâneas:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={maxEmpresasSimultaneas}
                            onChange={(e) => setMaxEmpresasSimultaneas(e.target.value)}
                            className="w-20"
                          />
                          <span className="text-[10px] text-muted-foreground">empresa(s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs whitespace-nowrap">Intervalo:</Label>
                          <Input
                            type="number"
                            min="1"
                            max="60"
                            value={delayEntreEmpresas}
                            onChange={(e) => setDelayEntreEmpresas(e.target.value)}
                            className="w-20"
                          />
                          <span className="text-[10px] text-muted-foreground">seg</span>
                        </div>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            const valConc = parseInt(maxEmpresasSimultaneas) || 3;
                            const clampedConc = Math.max(1, Math.min(10, valConc));
                            setMaxEmpresasSimultaneas(String(clampedConc));
                            saveMaxEmpresasSimultaneas.mutate({ valor: String(clampedConc) });

                            const valDelay = parseInt(delayEntreEmpresas) || 3;
                            const clampedDelay = Math.max(1, Math.min(60, valDelay));
                            setDelayEntreEmpresas(String(clampedDelay));
                            saveModoDownload.mutate({ valor: `sequencial:${clampedDelay}` });
                          }}
                          disabled={saveModoDownload.isPending || saveMaxEmpresasSimultaneas.isPending}
                        >
                          {(saveModoDownload.isPending || saveMaxEmpresasSimultaneas.isPending) ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                          ) : (
                            <><Save className="h-4 w-4 mr-2" />Salvar</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 4: Auto-Retomada de Downloads */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4 text-purple-500" />
                        Auto-Retomada
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Retomar automaticamente downloads de empresas com erro.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {autoCorrecaoPdf ? "Ativado" : "Desativado"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {autoCorrecaoPdf ? "Retomada automática ativa" : "Sem retomada"}
                          </p>
                        </div>
                        <Switch
                          checked={autoCorrecaoPdf}
                          onCheckedChange={(checked) => {
                            setAutoCorrecaoPdf(checked);
                            saveAutoCorrecao.mutate({ valor: checked });
                          }}
                        />
                      </div>
                      {autoCorrecaoPdf && (
                        <div className="pt-3 border-t">
                          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            Espera antes da retomada
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={autoCorrecaoTempo}
                              onChange={(e) => setAutoCorrecaoTempo(e.target.value)}
                              placeholder="00:05:00"
                              className="w-28 font-mono text-center text-sm"
                              maxLength={8}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const regex = /^\d{2}:\d{2}:\d{2}$/;
                                if (!regex.test(autoCorrecaoTempo)) {
                                  toast.error("Formato inválido. Use HH:MM:SS");
                                  return;
                                }
                                saveAutoCorrecaoTempo.mutate({ valor: autoCorrecaoTempo });
                              }}
                              disabled={saveAutoCorrecaoTempo.isPending}
                            >
                              {saveAutoCorrecaoTempo.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">HH:MM:SS (ex: 00:05:00)</p>
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium flex items-center gap-1.5">
                                  <RotateCcw className="h-3 w-3 text-orange-500" />
                                  Retomada Infinita
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {retomadaInfinita
                                    ? "Repete até 0 erros (sem limite)"
                                    : "Limitado ao nº de rodadas"}
                                </p>
                              </div>
                              <Switch
                                checked={retomadaInfinita}
                                onCheckedChange={(checked) => {
                                  setRetomadaInfinita(checked);
                                  saveRetomadaInfinita.mutate({ valor: checked });
                                }}
                              />
                            </div>
                            {retomadaInfinita && (
                              <div className="mt-2 p-2 rounded-md bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800">
                                <p className="text-[10px] text-orange-700 dark:text-orange-300">
                                  O sistema continuará retomando automaticamente até que todas as empresas estejam sem erros. O delay entre rodadas será de no mínimo 15 segundos.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 5: Auto-Retomada CT-e */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Truck className="h-4 w-4 text-emerald-500" />
                        Auto-Retomada CT-e
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Retomar automaticamente downloads CT-e de empresas com erro.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {autoCorrecaoCte ? "Ativado" : "Desativado"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {autoCorrecaoCte ? "Retomada automática CT-e ativa" : "Sem retomada CT-e"}
                          </p>
                        </div>
                        <Switch
                          checked={autoCorrecaoCte}
                          onCheckedChange={(checked) => {
                            setAutoCorrecaoCte(checked);
                            saveAutoCorrecaoCte.mutate({ valor: checked });
                          }}
                        />
                      </div>
                      {autoCorrecaoCte && (
                        <div className="pt-3 border-t">
                          <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            Espera antes da retomada
                          </Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="text"
                              value={autoCorrecaoTempoCte}
                              onChange={(e) => setAutoCorrecaoTempoCte(e.target.value)}
                              placeholder="00:00:20"
                              className="w-28 font-mono text-center text-sm"
                              maxLength={8}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const regex = /^\d{2}:\d{2}:\d{2}$/;
                                if (!regex.test(autoCorrecaoTempoCte)) {
                                  toast.error("Formato inválido. Use HH:MM:SS");
                                  return;
                                }
                                saveAutoCorrecaoTempoCte.mutate({ valor: autoCorrecaoTempoCte });
                              }}
                              disabled={saveAutoCorrecaoTempoCte.isPending}
                            >
                              {saveAutoCorrecaoTempoCte.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">HH:MM:SS (ex: 00:00:20)</p>
                          <div className="mt-3 pt-3 border-t">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium flex items-center gap-1.5">
                                  <RotateCcw className="h-3 w-3 text-emerald-500" />
                                  Retomada Infinita CT-e
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {retomadaInfinitaCte
                                    ? "Repete até 0 erros (sem limite)"
                                    : "Limitado ao nº de rodadas"}
                                </p>
                              </div>
                              <Switch
                                checked={retomadaInfinitaCte}
                                onCheckedChange={(checked) => {
                                  setRetomadaInfinitaCte(checked);
                                  saveRetomadaInfinitaCte.mutate({ valor: checked });
                                }}
                              />
                            </div>
                            {retomadaInfinitaCte && (
                              <div className="mt-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800">
                                <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                                  O sistema continuará retomando CT-e automaticamente até que todas as empresas estejam sem erros. Delay mínimo de 15s entre rodadas.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Card 6: Auto-Retomada PDFs */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-orange-500" />
                        Auto-Retomada PDFs
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Retomar automaticamente o download de PDFs (DANFSe) que falharam.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {retryPdfsAuto ? "Ativado" : "Desativado"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {retryPdfsAuto ? "Retomada automática de PDFs ativa" : "Sem retomada de PDFs"}
                          </p>
                        </div>
                        <Switch
                          checked={retryPdfsAuto}
                          onCheckedChange={(checked) => {
                            setRetryPdfsAuto(checked);
                            saveRetryPdfsConfig.mutate({
                              maxTentativas: retryPdfsMaxTentativas,
                              autoRetomada: checked,
                              tempoEspera: retryPdfsTempoEspera,
                            });
                          }}
                        />
                      </div>
                      {/* Configuração de tentativas - sempre visível */}
                      <div className="pt-3 border-t">
                        <Label className="text-xs flex items-center gap-1.5 mb-1.5">
                          <RotateCcw className="h-3 w-3 text-muted-foreground" />
                          Tentativas por PDF
                        </Label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={retryPdfsMaxTentativas}
                            onValueChange={(val) => setRetryPdfsMaxTentativas(val)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1 tentativa</SelectItem>
                              <SelectItem value="3">3 tentativas</SelectItem>
                              <SelectItem value="5">5 tentativas</SelectItem>
                              <SelectItem value="10">10 tentativas</SelectItem>
                              <SelectItem value="20">20 tentativas</SelectItem>
                              <SelectItem value="infinito">Infinito</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => saveRetryPdfsConfig.mutate({
                              maxTentativas: retryPdfsMaxTentativas,
                              autoRetomada: retryPdfsAuto,
                              tempoEspera: retryPdfsTempoEspera,
                            })}
                            disabled={saveRetryPdfsConfig.isPending}
                          >
                            {saveRetryPdfsConfig.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {retryPdfsMaxTentativas === "infinito"
                            ? "Tentará até conseguir baixar todos os PDFs"
                            : `Tentará ${retryPdfsMaxTentativas}x cada PDF com falha`}
                        </p>
                        {retryPdfsMaxTentativas === "infinito" && (
                          <div className="mt-2 p-2 rounded-md bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800">
                            <p className="text-[10px] text-orange-700 dark:text-orange-300">
                              O sistema continuará tentando baixar os PDFs indefinidamente até que todos sejam obtidos com sucesso.
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 7: IBS/CBS - Reforma Tributária */}
                  <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Landmark className="h-4 w-4 text-emerald-500" />
                        IBS/CBS - Reforma Tributária
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Exibir campos IBS e CBS nos relatórios e telas quando disponíveis nas notas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {ibsCbsAtivo ? "Ativado" : "Desativado"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {ibsCbsAtivo ? "Campos IBS/CBS visíveis nos relatórios" : "Campos IBS/CBS ocultos nos relatórios"}
                          </p>
                        </div>
                        <Switch
                          checked={ibsCbsAtivo}
                          onCheckedChange={(checked) => {
                            setIbsCbsAtivo(checked);
                            saveIbsCbsConfigWrapped.mutate({ ativo: checked, exibirRelatorios: ibsCbsRelatorios });
                          }}
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium">Incluir nos Relatórios Excel/PDF</p>
                            <p className="text-[10px] text-muted-foreground">
                              Adiciona colunas IBS UF, IBS Mun, CBS e Total nos relatórios exportados.
                            </p>
                          </div>
                          <Switch
                            checked={ibsCbsRelatorios}
                            onCheckedChange={(checked) => {
                              setIbsCbsRelatorios(checked);
                              saveIbsCbsConfigWrapped.mutate({ ativo: ibsCbsAtivo, exibirRelatorios: checked });
                            }}
                          />
                        </div>
                        <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            <strong>Reforma Tributária 2026:</strong> O sistema detecta automaticamente notas com IBS/CBS no XML. Quando a API Nacional começar a enviar notas nesse formato, os campos serão preenchidos automaticamente.
                          </p>
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground space-y-1">
                          <p><strong>IBS UF</strong> — Substitui ICMS (estadual)</p>
                          <p><strong>IBS Mun</strong> — Substitui ISS (municipal)</p>
                          <p><strong>CBS</strong> — Substitui PIS/COFINS (federal)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                </div>
              )}

              {/* Configurações Avançadas de Download */}
              {isContador && contabId && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Settings className="h-4 w-4 text-orange-500" />
                          Configurações Avançadas de Download
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Ajuste fino de performance baseado na API Nacional NFSe.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {!modoPersonalizado ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setModoPersonalizado(true)}
                            className="text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Personalizar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Aplicar melhores práticas
                              setTimeoutPorEmpresa("180");
                              setTimeoutDinamico(true);
                              setMaxRodadasRetomada("2");
                              setDelayEntrePdfs("500");
                              setDelayEntrePaginas("300");
                              setPularPdfErro(true);
                              // Salvar tudo
                              saveTimeout.mutate({ valor: "180" });
                              saveTimeoutDin.mutate({ valor: true });
                              saveMaxRodadas.mutate({ valor: "2" });
                              saveDelayPdfs.mutate({ valor: "500" });
                              saveDelayPaginas.mutate({ valor: "300" });
                              savePularPdf.mutate({ valor: true });
                              setModoPersonalizado(false);
                              toast.success("Melhores práticas aplicadas!");
                            }}
                            className="text-xs border-green-300 text-green-700 dark:text-green-300 hover:bg-green-50 dark:bg-green-500/10"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                            Usar Melhores Práticas
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">

                      {/* Resumo rápido quando NÃO está personalizado */}
                      {!modoPersonalizado && (
                        <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                            <span className="font-medium text-green-800 dark:text-green-300 text-sm">Valores Atuais</span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="text-center p-2 rounded bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5 border">
                              <p className="text-lg font-bold text-foreground">{timeoutPorEmpresa}s</p>
                              <p className="text-[10px] text-muted-foreground">Timeout/Empresa</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5 border">
                              <p className="text-lg font-bold text-foreground">{timeoutDinamico ? "Sim" : "Não"}</p>
                              <p className="text-[10px] text-muted-foreground">Timeout Dinâmico</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5 border">
                              <p className="text-lg font-bold text-foreground">{delayEntrePdfs}ms</p>
                              <p className="text-[10px] text-muted-foreground">Delay PDFs</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5 border">
                              <p className="text-lg font-bold text-foreground">{delayEntrePaginas}ms</p>
                              <p className="text-[10px] text-muted-foreground">Delay Páginas</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5 border">
                              <p className="text-lg font-bold text-foreground">{maxRodadasRetomada}</p>
                              <p className="text-[10px] text-muted-foreground">Rodadas Retomada</p>
                            </div>
                            <div className="text-center p-2 rounded bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5 border">
                              <p className="text-lg font-bold text-foreground">{pularPdfErro ? "Sim" : "Não"}</p>
                              <p className="text-[10px] text-muted-foreground">Pular PDFs c/ Erro</p>
                            </div>
                            <div className={`text-center p-2 rounded border ${retomadaInfinita ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300' : 'bg-white dark:bg-white/5/80 dark:bg-white dark:bg-white/5'}`}>
                              <p className={`text-lg font-bold ${retomadaInfinita ? 'text-orange-600' : 'text-foreground'}`}>{retomadaInfinita ? "∞" : "Não"}</p>
                              <p className="text-[10px] text-muted-foreground">Retomada Infinita</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Grid 2 colunas quando está personalizado */}
                      {modoPersonalizado && (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Timeout por empresa */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-orange-500" />
                                <span className="font-medium text-sm">Timeout por Empresa</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                Tempo máximo para processar cada empresa.
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="60"
                                  max="900"
                                  value={timeoutPorEmpresa}
                                  onChange={(e) => setTimeoutPorEmpresa(e.target.value)}
                                  className="w-24"
                                />
                                <span className="text-xs text-muted-foreground">seg</span>
                              </div>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">Recomendado: 180s</p>
                            </div>

                            {/* Timeout dinâmico */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-4 w-4 text-yellow-500" />
                                  <span className="font-medium text-sm">Timeout Dinâmico</span>
                                </div>
                                <Switch
                                  checked={timeoutDinamico}
                                  onCheckedChange={(checked) => {
                                    setTimeoutDinamico(checked);
                                    saveTimeoutDin.mutate({ valor: checked });
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {timeoutDinamico
                                  ? "Ajusta timeout com base no nº de notas"
                                  : "Usa timeout fixo para todas as empresas"}
                              </p>
                              {timeoutDinamico && (
                                <p className="text-[10px] text-green-600 dark:text-green-400 mt-2">50 notas: base | 200: 5min | 500+: 15min</p>
                              )}
                            </div>

                            {/* Delay entre PDFs */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-2 mb-2">
                                <FileText className="h-4 w-4 text-red-500" />
                                <span className="font-medium text-sm">Delay entre PDFs</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                Intervalo entre requisições de PDF à API.
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="5000"
                                  value={delayEntrePdfs}
                                  onChange={(e) => setDelayEntrePdfs(e.target.value)}
                                  className="w-24"
                                />
                                <span className="text-xs text-muted-foreground">ms</span>
                              </div>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">Recomendado: 500ms</p>
                            </div>

                            {/* Delay entre páginas da API */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-2 mb-2">
                                <Database className="h-4 w-4 text-primary" />
                                <span className="font-medium text-sm">Delay entre Páginas</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                Intervalo entre páginas de consulta (100 notas/pág).
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="5000"
                                  value={delayEntrePaginas}
                                  onChange={(e) => setDelayEntrePaginas(e.target.value)}
                                  className="w-24"
                                />
                                <span className="text-xs text-muted-foreground">ms</span>
                              </div>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">Recomendado: 300ms</p>
                            </div>

                            {/* Máximo de rodadas */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                              <div className="flex items-center gap-2 mb-2">
                                <History className="h-4 w-4 text-purple-500" />
                                <span className="font-medium text-sm">Rodadas Auto-Retomada</span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-3">
                                Tentativas de retomar empresas com erro.
                              </p>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={maxRodadasRetomada}
                                  onChange={(e) => setMaxRodadasRetomada(e.target.value)}
                                  className="w-24"
                                />
                                <span className="text-xs text-muted-foreground">rodada(s)</span>
                              </div>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">Recomendado: 2 rodadas</p>
                            </div>

                            {/* Pular PDFs com erro */}
                            <div className="p-4 rounded-lg border bg-muted/30">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  <span className="font-medium text-sm">Pular PDFs c/ Erro</span>
                                </div>
                                <Switch
                                  checked={pularPdfErro}
                                  onCheckedChange={(checked) => {
                                    setPularPdfErro(checked);
                                    savePularPdf.mutate({ valor: checked });
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {pularPdfErro
                                  ? "PDFs que falharam 2x são pulados na retomada"
                                  : "Todos os PDFs são tentados novamente"}
                              </p>
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">Recomendado: Ativado</p>
                            </div>

                            {/* Retomada Infinita */}
                            <div className={`p-4 rounded-lg border ${retomadaInfinita ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300' : 'bg-muted/30'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <RotateCcw className={`h-4 w-4 ${retomadaInfinita ? 'text-orange-500 animate-spin' : 'text-orange-500'}`} style={retomadaInfinita ? { animationDuration: '3s' } : {}} />
                                  <span className="font-medium text-sm">Retomada Infinita</span>
                                </div>
                                <Switch
                                  checked={retomadaInfinita}
                                  onCheckedChange={(checked) => {
                                    setRetomadaInfinita(checked);
                                    saveRetomadaInfinita.mutate({ valor: checked });
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {retomadaInfinita
                                  ? "Repete até todas as empresas estarem sem erros"
                                  : "Limitado ao número de rodadas configurado"}
                              </p>
                              {retomadaInfinita && (
                                <div className="mt-2 p-2 rounded bg-orange-100/50 dark:bg-orange-900/20">
                                  <p className="text-[10px] text-orange-700 dark:text-orange-300">
                                    Ignora o limite de rodadas. Delay mínimo de 15s entre rodadas. Para apenas quando 0 erros.
                                  </p>
                                </div>
                              )}
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-2">Recomendado: Desativado (usar rodadas limitadas)</p>
                            </div>
                          </div>

                          {/* Botões de ação */}
                          <div className="flex items-center gap-3 pt-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                const timeout = Math.max(60, Math.min(900, parseInt(timeoutPorEmpresa) || 180));
                                setTimeoutPorEmpresa(String(timeout));
                                saveTimeout.mutate({ valor: String(timeout) });

                                const rodadas = Math.max(1, Math.min(10, parseInt(maxRodadasRetomada) || 3));
                                setMaxRodadasRetomada(String(rodadas));
                                saveMaxRodadas.mutate({ valor: String(rodadas) });

                                const dPdfs = Math.max(0, Math.min(5000, parseInt(delayEntrePdfs) || 500));
                                setDelayEntrePdfs(String(dPdfs));
                                saveDelayPdfs.mutate({ valor: String(dPdfs) });

                                const dPags = Math.max(0, Math.min(5000, parseInt(delayEntrePaginas) || 300));
                                setDelayEntrePaginas(String(dPags));
                                saveDelayPaginas.mutate({ valor: String(dPags) });

                                toast.success("Configurações salvas!");
                                setModoPersonalizado(false);
                              }}
                              disabled={saveTimeout.isPending || saveMaxRodadas.isPending || saveDelayPdfs.isPending || saveDelayPaginas.isPending}
                            >
                              {(saveTimeout.isPending || saveMaxRodadas.isPending) ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                              ) : (
                                <><Save className="h-4 w-4 mr-2" />Salvar Configurações</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setModoPersonalizado(false)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </>
                      )}

                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Apagar Todos os CT-e */}
              {isContador && contabId && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <Trash2 className="h-4 w-4" />
                      Apagar Todos os CT-e
                    </CardTitle>
                    <CardDescription>
                      Remove <strong>TODOS</strong> os CT-e da sua contabilidade: notas CT-e, logs de download CT-e e controle NSU. <strong>Não afeta</strong> as NFe, clientes ou certificados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                      onClick={() => setDeleteAllCteOpen(true)}
                      disabled={deleteAllCteMutation.isPending}
                    >
                      {deleteAllCteMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                      ) : (
                        <><Trash2 className="h-4 w-4 mr-2" />Apagar Todos os CT-e</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Repopular Chaves NF-e dos CT-e */}
              {isContador && contabId && (
                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
                      <RotateCcw className="h-4 w-4" />
                      Repopular Chaves NF-e
                    </CardTitle>
                    <CardDescription>
                      Re-extrai as chaves NF-e dos XMLs de CT-e já baixados. Use se a coluna NF-e estiver vazia na tabela de CT-e Notas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="border-blue-500/50 text-blue-600 hover:bg-blue-500/10"
                      onClick={() => repopularChavesMutation.mutate({ contabilidadeId: contabId })}
                      disabled={repopularChavesMutation.isPending}
                    >
                      {repopularChavesMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processando...</>
                      ) : (
                        <><RotateCcw className="h-4 w-4 mr-2" />Repopular Chaves NF-e</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Apagar Todos os NFe */}
              {isContador && contabId && (
                <Card className="border-orange-200 dark:border-orange-800">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <Trash2 className="h-4 w-4" />
                      Apagar Todas as NFe
                    </CardTitle>
                    <CardDescription>
                      Remove <strong>TODAS</strong> as notas fiscais eletrônicas (NFe) e logs de download NFe da sua contabilidade. <strong>Não afeta</strong> os CT-e, clientes ou certificados.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="border-orange-500/50 text-orange-600 hover:bg-orange-500/10"
                      onClick={() => setDeleteAllNfeOpen(true)}
                      disabled={deleteAllNfeMutation.isPending}
                    >
                      {deleteAllNfeMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                      ) : (
                        <><Trash2 className="h-4 w-4 mr-2" />Apagar Todas as NFe</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Apagar Todos os Clientes - para contabilidade */}
              {isContador && contabId && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      Apagar Todos os Clientes
                    </CardTitle>
                    <CardDescription>
                      Remove <strong>TODOS</strong> os dados da sua contabilidade: clientes, notas fiscais, certificados, downloads, agendamentos e histórico de auditoria. Limpeza total.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteAllClientesOpen(true)}
                      disabled={deleteAllClientesMutation.isPending}
                    >
                      {deleteAllClientesMutation.isPending ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                      ) : (
                        <><Trash2 className="h-4 w-4 mr-2" />Apagar Todos os Clientes</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Admin Tools */}
              {isAdmin && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        Ferramentas de Administração
                      </CardTitle>
                      <CardDescription>Disponível apenas para administradores</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-primary" />
                            <h4 className="font-medium">Gerar Dados de Teste</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Cria uma contabilidade com 4 clientes e centenas de notas fiscais para demonstração
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => { setSeeding(true); seedMutation.mutate(); }}
                          disabled={seeding}
                        >
                          {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                          {seeding ? "Gerando..." : "Gerar Dados"}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <h4 className="font-medium text-red-800 dark:text-red-300">Limpar Todos os Dados</h4>
                          </div>
                          <p className="text-sm text-red-600 mt-1">
                            Remove todos os dados do sistema (contabilidades, clientes, notas, certificados)
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja remover TODOS os dados? Esta ação não pode ser desfeita.")) {
                              setClearing(true);
                              clearMutation.mutate();
                            }
                          }}
                          disabled={clearing}
                        >
                          {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                          {clearing ? "Limpando..." : "Limpar Dados"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>

        {/* ═══ DIALOGS ═══ */}

        {/* Create User Dialog */}
         <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                Novo Usuário
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <Label>Nome Completo *</Label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do usuário" />
                  </div>
                  <div>
                    <Label>E-mail *</Label>
                    <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div>
                    <Label>Senha *</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold mb-3">Permissões de Acesso</h3>
                  <PermissoesGrid permissoes={newPermissoes} onChange={setNewPermissoes} />
                </div>
              </div>
            </ScrollArea>
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setCreateUserOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => createUserMutation.mutate({
                  name: newName,
                  email: newEmail,
                  password: newPassword,
                  permissoes: newPermissoes,
                })}
                disabled={!newName || !newEmail || newPassword.length < 6 || createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</>
                ) : (
                  <><UserPlus className="h-4 w-4 mr-2" />Criar Usuário</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Permissions Dialog */}
        <Dialog open={editPermOpen} onOpenChange={setEditPermOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Permissões de {selectedUser?.name}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[65vh] pr-4">
              <PermissoesGrid permissoes={editPermissoes} onChange={setEditPermissoes} />
            </ScrollArea>
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" className="flex-1" onClick={() => setEditPermOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={() => selectedUser && updatePermMutation.mutate({
                  userId: selectedUser.id,
                  permissoes: editPermissoes,
                })}
                disabled={updatePermMutation.isPending}
              >
                {updatePermMutation.isPending ? "Salvando..." : "Salvar Permissões"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog open={resetPwOpen} onOpenChange={setResetPwOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                Redefinir Senha
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Definir nova senha para <strong>{selectedUser?.name}</strong>
              </p>
              <div>
                <Label>Nova Senha</Label>
                <Input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setResetPwOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => selectedUser && resetPwMutation.mutate({
                    userId: selectedUser.id,
                    newPassword: resetPassword,
                  })}
                  disabled={resetPassword.length < 6 || resetPwMutation.isPending}
                >
                  {resetPwMutation.isPending ? "Salvando..." : "Redefinir"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <AlertDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Excluir Usuário
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o usuário <strong>{selectedUser?.name}</strong> ({selectedUser?.email})?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => selectedUser && deleteUserMutation.mutate({ userId: selectedUser.id })}
                disabled={deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending ? "Excluindo..." : "Sim, excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All CT-e Dialog */}
        <AlertDialog open={deleteAllCteOpen} onOpenChange={setDeleteAllCteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Apagar Todos os CT-e
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Tem certeza que deseja excluir <strong>TODOS</strong> os CT-e da sua contabilidade?
                  </p>
                  <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm text-orange-800 dark:text-orange-300">
                    <p className="font-semibold mb-1">Serão excluídos:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Todas as <strong>notas CT-e</strong> (emitidos, tomados, terceiros)</li>
                      <li>Todo o <strong>histórico de downloads CT-e</strong></li>
                      <li>Todo o <strong>controle NSU</strong> do CT-e</li>
                    </ul>
                    <p className="mt-2 font-semibold text-green-700 dark:text-green-400">Não serão afetados: NFe, clientes, certificados, agendamentos.</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold text-orange-600">
                    Esta ação é irreversível.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAllCteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => contabId && deleteAllCteMutation.mutate({ contabilidadeId: contabId })}
                disabled={deleteAllCteMutation.isPending}
              >
                {deleteAllCteMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                ) : (
                  "Sim, apagar todos os CT-e"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All NFe Dialog */}
        <AlertDialog open={deleteAllNfeOpen} onOpenChange={setDeleteAllNfeOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Apagar Todas as NFe
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Tem certeza que deseja excluir <strong>TODAS</strong> as NFe da sua contabilidade?
                  </p>
                  <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800 rounded-lg p-3 text-sm text-orange-800 dark:text-orange-300">
                    <p className="font-semibold mb-1">Serão excluídos:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Todas as <strong>notas fiscais eletrônicas</strong> (emitidas e recebidas)</li>
                      <li>Todo o <strong>histórico de downloads NFe</strong></li>
                    </ul>
                    <p className="mt-2 font-semibold text-green-700 dark:text-green-400">Não serão afetados: CT-e, clientes, certificados, agendamentos.</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold text-orange-600">
                    Esta ação é irreversível.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAllNfeMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-orange-600 hover:bg-orange-700"
                onClick={() => contabId && deleteAllNfeMutation.mutate({ contabilidadeId: contabId })}
                disabled={deleteAllNfeMutation.isPending}
              >
                {deleteAllNfeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                ) : (
                  "Sim, apagar todas as NFe"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All Clientes Dialog */}
        <AlertDialog open={deleteAllClientesOpen} onOpenChange={setDeleteAllClientesOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Apagar Todos os Clientes
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Tem certeza que deseja excluir <strong>TODOS</strong> os clientes da sua contabilidade?
                  </p>
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
                    <p className="font-semibold mb-1">Esta ação é irreversível e irá excluir TUDO:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Todos os <strong>clientes</strong> e seus cadastros</li>
                      <li>Todas as <strong>notas fiscais</strong> (emitidas, recebidas, canceladas)</li>
                      <li>Todos os <strong>CT-e</strong> (notas, logs de download, controle NSU)</li>
                      <li>Todos os <strong>certificados digitais</strong></li>
                      <li>Todo o <strong>histórico de downloads</strong> (NFe e CT-e)</li>
                      <li>Todos os <strong>agendamentos</strong> de download</li>
                      <li>Todo o <strong>histórico de auditoria</strong></li>
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground font-semibold text-red-600">
                    Todos os dados serão permanentemente removidos. Não há como recuperar.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAllClientesMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => contabId && deleteAllClientesMutation.mutate({ contabilidadeId: contabId })}
                disabled={deleteAllClientesMutation.isPending}
              >
                {deleteAllClientesMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                ) : (
                  "Sim, apagar todos"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Audit Log Dialog */}
        <AlertDialog open={deleteAuditId !== null} onOpenChange={(open) => !open && setDeleteAuditId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Excluir Registro de Auditoria
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este registro de auditoria? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAuditMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteAuditId && deleteAuditMutation.mutate({ id: deleteAuditId })}
                disabled={deleteAuditMutation.isPending}
              >
                {deleteAuditMutation.isPending ? "Excluindo..." : "Sim, excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete All Audit Logs Dialog */}
        <AlertDialog open={deleteAllAuditOpen} onOpenChange={setDeleteAllAuditOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Apagar Todos os Registros de Auditoria
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir <strong>TODOS</strong> os registros de auditoria da sua contabilidade?
                Esta ação é irreversível.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteAllAuditMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => deleteAllAuditMutation.mutate()}
                disabled={deleteAllAuditMutation.isPending}
              >
                {deleteAllAuditMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Excluindo...</>
                ) : (
                  "Sim, apagar todos"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
