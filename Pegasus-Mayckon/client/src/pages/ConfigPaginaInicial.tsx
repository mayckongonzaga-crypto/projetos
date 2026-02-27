import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Upload,
  Image as ImageIcon,
  Type,
  Layout,
  Star,
  FileText,
  Footprints,
  Eye,
  RotateCcw,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";

// Chaves de settings para a landing page
const LANDING_KEYS = {
  // Tema da landing page
  tema: "landing_tema",
  // Logo e branding
  logo_url: "landing_logo_url",
  nome_sistema: "landing_nome_sistema",
  subtitulo: "landing_subtitulo",

  // Hero
  hero_badge: "landing_hero_badge",
  hero_titulo_antes: "landing_hero_titulo_antes",
  hero_titulo_destaque: "landing_hero_titulo_destaque",
  hero_titulo_depois: "landing_hero_titulo_depois",
  hero_descricao: "landing_hero_descricao",
  hero_btn_primario: "landing_hero_btn_primario",
  hero_btn_secundario: "landing_hero_btn_secundario",
  hero_check1: "landing_hero_check1",
  hero_check2: "landing_hero_check2",
  hero_check3: "landing_hero_check3",

  // Funcionalidades
  func_titulo: "landing_func_titulo",
  func_subtitulo: "landing_func_subtitulo",
  func1_titulo: "landing_func1_titulo",
  func1_desc: "landing_func1_desc",
  func2_titulo: "landing_func2_titulo",
  func2_desc: "landing_func2_desc",
  func3_titulo: "landing_func3_titulo",
  func3_desc: "landing_func3_desc",
  func4_titulo: "landing_func4_titulo",
  func4_desc: "landing_func4_desc",
  func5_titulo: "landing_func5_titulo",
  func5_desc: "landing_func5_desc",
  func6_titulo: "landing_func6_titulo",
  func6_desc: "landing_func6_desc",

  // Como funciona
  como_titulo: "landing_como_titulo",
  como_subtitulo: "landing_como_subtitulo",
  passo1_titulo: "landing_passo1_titulo",
  passo1_desc: "landing_passo1_desc",
  passo2_titulo: "landing_passo2_titulo",
  passo2_desc: "landing_passo2_desc",
  passo3_titulo: "landing_passo3_titulo",
  passo3_desc: "landing_passo3_desc",
  passo4_titulo: "landing_passo4_titulo",
  passo4_desc: "landing_passo4_desc",

  // Benefícios
  benef_titulo: "landing_benef_titulo",
  benef1_titulo: "landing_benef1_titulo",
  benef1_desc: "landing_benef1_desc",
  benef2_titulo: "landing_benef2_titulo",
  benef2_desc: "landing_benef2_desc",
  benef3_titulo: "landing_benef3_titulo",
  benef3_desc: "landing_benef3_desc",
  benef4_titulo: "landing_benef4_titulo",
  benef4_desc: "landing_benef4_desc",

  // CTA
  cta_titulo: "landing_cta_titulo",
  cta_descricao: "landing_cta_descricao",
  cta_btn: "landing_cta_btn",

  // Rodapé
  rodape_texto: "landing_rodape_texto",
  rodape_subtexto: "landing_rodape_subtexto",

  // Contato
  contato_telefone: "landing_contato_telefone",
  contato_whatsapp: "landing_contato_whatsapp",
  contato_email: "landing_contato_email",
  contato_instagram: "landing_contato_instagram",
  contato_facebook: "landing_contato_facebook",
  contato_endereco: "landing_contato_endereco",

  // Login
  login_titulo: "landing_login_titulo",
  login_subtitulo: "landing_login_subtitulo",
  login_rodape: "landing_login_rodape",
};

// Valores padrão
const DEFAULTS: Record<string, string> = {
  landing_tema: "midnight",
  landing_logo_url: "",
  landing_nome_sistema: "Pegasus",
  landing_subtitulo: "by Lan7 Tecnologia",
  landing_hero_badge: "Automação fiscal para contadores",
  landing_hero_titulo_antes: "Gestão de",
  landing_hero_titulo_destaque: "NFSe",
  landing_hero_titulo_depois: "inteligente",
  landing_hero_descricao: "O Pegasus gerencia certificados digitais, faz download de XMLs e organiza as notas fiscais de serviço dos seus clientes. Conectado diretamente à API Nacional da NFSe.",
  landing_hero_btn_primario: "Acessar o Pegasus",
  landing_hero_btn_secundario: "Conhecer Funcionalidades",
  landing_hero_check1: "API NFSe Nacional",
  landing_hero_check2: "Certificado Digital",
  landing_hero_check3: "Multi-empresa",
  landing_func_titulo: "Tudo que você precisa para gerenciar NFSe",
  landing_func_subtitulo: "Um portal completo para escritórios de contabilidade que precisam baixar e organizar os XMLs de notas fiscais de serviço dos seus clientes.",
  landing_func1_titulo: "Certificados Digitais",
  landing_func1_desc: "Importe os certificados digitais (.pfx) dos seus clientes. O sistema extrai automaticamente o CNPJ e dados do certificado, e monitora a validade.",
  landing_func2_titulo: "Download de XMLs",
  landing_func2_desc: "Baixe os XMLs das NFSe emitidas e recebidas dos seus clientes diretamente da API Nacional. Download individual ou em lote por período.",
  landing_func3_titulo: "Download Automático",
  landing_func3_desc: "Configure agendamentos para baixar automaticamente os XMLs em intervalos regulares. Nunca mais esqueça de baixar as notas.",
  landing_func4_titulo: "Multi-Empresa",
  landing_func4_desc: "Gerencie todos os seus clientes em um único painel. Cada empresa com seus certificados, notas e downloads organizados separadamente.",
  landing_func5_titulo: "Relatórios e Dashboard",
  landing_func5_desc: "Visualize gráficos de notas emitidas/recebidas, valores por período, status dos certificados e muito mais em tempo real.",
  landing_func6_titulo: "Segurança",
  landing_func6_desc: "Certificados armazenados com criptografia AES-256. Conexão mTLS com a API da NFSe. Seus dados estão protegidos.",
  landing_como_titulo: "Simples e direto ao ponto",
  landing_como_subtitulo: "Em poucos passos você já está baixando os XMLs dos seus clientes.",
  landing_passo1_titulo: "Acesse o Portal",
  landing_passo1_desc: "Faça login com as credenciais fornecidas pelo administrador do sistema.",
  landing_passo2_titulo: "Importe Certificados",
  landing_passo2_desc: "Faça upload dos certificados digitais (.pfx) dos seus clientes com a senha.",
  landing_passo3_titulo: "Baixe os XMLs",
  landing_passo3_desc: "Selecione o período e baixe os XMLs das NFSe emitidas e recebidas.",
  landing_passo4_titulo: "Acompanhe",
  landing_passo4_desc: "Use o dashboard para acompanhar notas, valores e validade dos certificados.",
  landing_benef_titulo: "Por que usar o Pegasus?",
  landing_benef1_titulo: "Economia de tempo",
  landing_benef1_desc: "Pare de acessar o portal da NFSe manualmente para cada cliente. Baixe tudo de uma vez.",
  landing_benef2_titulo: "Organização",
  landing_benef2_desc: "Todos os XMLs organizados por empresa e período em um único lugar seguro.",
  landing_benef3_titulo: "Monitoramento de certificados",
  landing_benef3_desc: "Receba alertas quando certificados estiverem próximos do vencimento. Nunca perca um prazo.",
  landing_benef4_titulo: "Conexão direta com a API Nacional",
  landing_benef4_desc: "Os XMLs são baixados diretamente da API oficial da NFSe usando mTLS, garantindo autenticidade.",
  landing_cta_titulo: "Pronto para automatizar?",
  landing_cta_descricao: "Acesse o Pegasus agora e comece a baixar os XMLs das NFSe dos seus clientes de forma rápida e organizada.",
  landing_cta_btn: "Acessar o Pegasus",
  landing_rodape_texto: "Desenvolvido por Lan7 Tecnologia — Soluções para escritórios de contabilidade",
  landing_rodape_subtexto: "Conectado à API Nacional da NFSe",
  landing_contato_telefone: "",
  landing_contato_whatsapp: "",
  landing_contato_email: "",
  landing_contato_instagram: "",
  landing_contato_facebook: "",
  landing_contato_endereco: "",
  landing_login_titulo: "Acesse sua conta",
  landing_login_subtitulo: "Entre com suas credenciais de contabilidade",
  landing_login_rodape: "Acesso exclusivo para escritórios de contabilidade cadastrados. Entre em contato com o administrador para obter suas credenciais.",
};

export default function ConfigPaginaInicial() {
  const { data: allSettings, isLoading } = trpc.settings.getAll.useQuery();
  const utils = trpc.useUtils();

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar form com settings do banco ou defaults
  useEffect(() => {
    if (allSettings) {
      const merged: Record<string, string> = {};
      Object.entries(DEFAULTS).forEach(([key, defaultVal]) => {
        merged[key] = (allSettings as Record<string, string>)[key] ?? defaultVal;
      });
      setForm(merged);
    }
  }, [allSettings]);

  const updateMutation = trpc.settings.updateMultiple.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      utils.settings.getAll.invalidate();
      setSaving(false);
    },
    onError: (err) => {
      toast.error(`Erro ao salvar: ${err.message}`);
      setSaving(false);
    },
  });

  const uploadLogoMutation = trpc.settings.uploadLogo.useMutation({
    onSuccess: (data) => {
      toast.success("Logo enviada com sucesso!");
      setForm(prev => ({ ...prev, landing_logo_url: data.url }));
      utils.settings.getAll.invalidate();
      setUploading(false);
    },
    onError: (err) => {
      toast.error(`Erro ao enviar logo: ${err.message}`);
      setUploading(false);
    },
  });

  const handleSave = () => {
    setSaving(true);
    const settings = Object.entries(form).map(([chave, valor]) => ({ chave, valor }));
    updateMutation.mutate({ settings });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A logo deve ter no máximo 5MB");
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadLogoMutation.mutate({
        base64,
        mimeType: file.type,
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleReset = (key: string) => {
    setForm(prev => ({ ...prev, [key]: DEFAULTS[key] ?? "" }));
  };

  const handleResetAll = () => {
    setForm({ ...DEFAULTS });
    toast.info("Valores restaurados para o padrão. Clique em Salvar para aplicar.");
  };

  const updateField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações da Página Inicial</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Personalize todos os textos, logo e conteúdo da página de entrada do sistema.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={handleResetAll} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Restaurar Padrão
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Tudo
            </Button>
          </div>
        </div>

        {/* Tema da Landing Page */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" />
              Tema da Página Inicial
            </CardTitle>
            <CardDescription>Escolha o tema visual da página inicial. Este tema é fixo e não é afetado pela preferência dos usuários.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Tema da Landing Page</Label>
              <Select value={form.landing_tema || "midnight"} onValueChange={(v) => updateField("landing_tema", v)}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="emerald">Emerald Claro (Verde)</SelectItem>
                  <SelectItem value="emerald-dark">Emerald Escuro (Verde)</SelectItem>
                  <SelectItem value="sunset">Sunset Claro (Terracota)</SelectItem>
                  <SelectItem value="sunset-dark">Sunset Escuro (Terracota)</SelectItem>
                  <SelectItem value="midnight">Midnight Claro (Azul)</SelectItem>
                  <SelectItem value="midnight-dark">Midnight Escuro (Azul)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">O tema escolhido aqui será aplicado apenas à página inicial. O tema do dashboard é controlado individualmente por cada usuário.</p>
            </div>
          </CardContent>
        </Card>

        {/* Logo e Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              Logo e Branding
            </CardTitle>
            <CardDescription>Logo do sistema, nome e subtítulo que aparecem no header e rodapé.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Logo do Sistema</Label>
              <div className="flex items-center gap-4">
                {form.landing_logo_url ? (
                  <div className="h-20 w-20 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center">
                    <img src={form.landing_logo_url} alt="Logo" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="gap-2"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Enviando..." : "Enviar Logo"}
                  </Button>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF ou SVG. Máximo 5MB.</p>
                </div>
              </div>
              {form.landing_logo_url && (
                <div className="flex items-center gap-2">
                  <Input
                    value={form.landing_logo_url}
                    onChange={(e) => updateField("landing_logo_url", e.target.value)}
                    placeholder="URL da logo"
                    className="text-xs"
                  />
                  <Button variant="ghost" size="sm" onClick={() => updateField("landing_logo_url", "")}>
                    Remover
                  </Button>
                </div>
              )}
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Nome do Sistema" value={form.landing_nome_sistema} onChange={(v) => updateField("landing_nome_sistema", v)} onReset={() => handleReset("landing_nome_sistema")} />
              <FieldInput label="Subtítulo" value={form.landing_subtitulo} onChange={(v) => updateField("landing_subtitulo", v)} onReset={() => handleReset("landing_subtitulo")} />
            </div>
          </CardContent>
        </Card>

        {/* Hero Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" />
              Seção Principal (Hero)
            </CardTitle>
            <CardDescription>Título, descrição e botões da área principal da página.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Badge (texto pequeno acima do título)" value={form.landing_hero_badge} onChange={(v) => updateField("landing_hero_badge", v)} onReset={() => handleReset("landing_hero_badge")} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldInput label="Título (antes)" value={form.landing_hero_titulo_antes} onChange={(v) => updateField("landing_hero_titulo_antes", v)} onReset={() => handleReset("landing_hero_titulo_antes")} />
              <FieldInput label="Título (destaque)" value={form.landing_hero_titulo_destaque} onChange={(v) => updateField("landing_hero_titulo_destaque", v)} onReset={() => handleReset("landing_hero_titulo_destaque")} />
              <FieldInput label="Título (depois)" value={form.landing_hero_titulo_depois} onChange={(v) => updateField("landing_hero_titulo_depois", v)} onReset={() => handleReset("landing_hero_titulo_depois")} />
            </div>
            <FieldTextarea label="Descrição" value={form.landing_hero_descricao} onChange={(v) => updateField("landing_hero_descricao", v)} onReset={() => handleReset("landing_hero_descricao")} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Botão Primário" value={form.landing_hero_btn_primario} onChange={(v) => updateField("landing_hero_btn_primario", v)} onReset={() => handleReset("landing_hero_btn_primario")} />
              <FieldInput label="Botão Secundário" value={form.landing_hero_btn_secundario} onChange={(v) => updateField("landing_hero_btn_secundario", v)} onReset={() => handleReset("landing_hero_btn_secundario")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FieldInput label="Check 1" value={form.landing_hero_check1} onChange={(v) => updateField("landing_hero_check1", v)} onReset={() => handleReset("landing_hero_check1")} />
              <FieldInput label="Check 2" value={form.landing_hero_check2} onChange={(v) => updateField("landing_hero_check2", v)} onReset={() => handleReset("landing_hero_check2")} />
              <FieldInput label="Check 3" value={form.landing_hero_check3} onChange={(v) => updateField("landing_hero_check3", v)} onReset={() => handleReset("landing_hero_check3")} />
            </div>
          </CardContent>
        </Card>

        {/* Funcionalidades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Funcionalidades
            </CardTitle>
            <CardDescription>Os 6 cards de funcionalidades exibidos na landing page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Título da Seção" value={form.landing_func_titulo} onChange={(v) => updateField("landing_func_titulo", v)} onReset={() => handleReset("landing_func_titulo")} />
            <FieldTextarea label="Subtítulo da Seção" value={form.landing_func_subtitulo} onChange={(v) => updateField("landing_func_subtitulo", v)} onReset={() => handleReset("landing_func_subtitulo")} />
            <Separator />
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-3 border-b border-border last:border-0">
                <FieldInput label={`Funcionalidade ${i} - Título`} value={form[`landing_func${i}_titulo`]} onChange={(v) => updateField(`landing_func${i}_titulo`, v)} onReset={() => handleReset(`landing_func${i}_titulo`)} />
                <div className="sm:col-span-2">
                  <FieldTextarea label={`Funcionalidade ${i} - Descrição`} value={form[`landing_func${i}_desc`]} onChange={(v) => updateField(`landing_func${i}_desc`, v)} onReset={() => handleReset(`landing_func${i}_desc`)} rows={2} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Como Funciona */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Como Funciona
            </CardTitle>
            <CardDescription>Os 4 passos que explicam o fluxo do sistema.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Título da Seção" value={form.landing_como_titulo} onChange={(v) => updateField("landing_como_titulo", v)} onReset={() => handleReset("landing_como_titulo")} />
            <FieldTextarea label="Subtítulo da Seção" value={form.landing_como_subtitulo} onChange={(v) => updateField("landing_como_subtitulo", v)} onReset={() => handleReset("landing_como_subtitulo")} />
            <Separator />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-3 border-b border-border last:border-0">
                <FieldInput label={`Passo ${i} - Título`} value={form[`landing_passo${i}_titulo`]} onChange={(v) => updateField(`landing_passo${i}_titulo`, v)} onReset={() => handleReset(`landing_passo${i}_titulo`)} />
                <div className="sm:col-span-2">
                  <FieldTextarea label={`Passo ${i} - Descrição`} value={form[`landing_passo${i}_desc`]} onChange={(v) => updateField(`landing_passo${i}_desc`, v)} onReset={() => handleReset(`landing_passo${i}_desc`)} rows={2} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Benefícios */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Benefícios
            </CardTitle>
            <CardDescription>Os 4 benefícios listados na seção de benefícios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Título da Seção" value={form.landing_benef_titulo} onChange={(v) => updateField("landing_benef_titulo", v)} onReset={() => handleReset("landing_benef_titulo")} />
            <Separator />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-3 border-b border-border last:border-0">
                <FieldInput label={`Benefício ${i} - Título`} value={form[`landing_benef${i}_titulo`]} onChange={(v) => updateField(`landing_benef${i}_titulo`, v)} onReset={() => handleReset(`landing_benef${i}_titulo`)} />
                <div className="sm:col-span-2">
                  <FieldTextarea label={`Benefício ${i} - Descrição`} value={form[`landing_benef${i}_desc`]} onChange={(v) => updateField(`landing_benef${i}_desc`, v)} onReset={() => handleReset(`landing_benef${i}_desc`)} rows={2} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CTA */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              Chamada para Ação (CTA)
            </CardTitle>
            <CardDescription>O banner de destaque antes do rodapé.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Título" value={form.landing_cta_titulo} onChange={(v) => updateField("landing_cta_titulo", v)} onReset={() => handleReset("landing_cta_titulo")} />
            <FieldTextarea label="Descrição" value={form.landing_cta_descricao} onChange={(v) => updateField("landing_cta_descricao", v)} onReset={() => handleReset("landing_cta_descricao")} />
            <FieldInput label="Texto do Botão" value={form.landing_cta_btn} onChange={(v) => updateField("landing_cta_btn", v)} onReset={() => handleReset("landing_cta_btn")} />
          </CardContent>
        </Card>

        {/* Rodapé */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Footprints className="h-4 w-4 text-primary" />
              Rodapé
            </CardTitle>
            <CardDescription>Textos do rodapé da página.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Texto Principal" value={form.landing_rodape_texto} onChange={(v) => updateField("landing_rodape_texto", v)} onReset={() => handleReset("landing_rodape_texto")} />
            <FieldInput label="Subtexto" value={form.landing_rodape_subtexto} onChange={(v) => updateField("landing_rodape_subtexto", v)} onReset={() => handleReset("landing_rodape_subtexto")} />
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4 text-primary" />
              Contato
            </CardTitle>
            <CardDescription>Informações de contato exibidas na página inicial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Telefone" value={form.landing_contato_telefone} onChange={(v) => updateField("landing_contato_telefone", v)} onReset={() => handleReset("landing_contato_telefone")} />
            <FieldInput label="WhatsApp" value={form.landing_contato_whatsapp} onChange={(v) => updateField("landing_contato_whatsapp", v)} onReset={() => handleReset("landing_contato_whatsapp")} />
            <FieldInput label="E-mail" value={form.landing_contato_email} onChange={(v) => updateField("landing_contato_email", v)} onReset={() => handleReset("landing_contato_email")} />
            <FieldInput label="Instagram (URL ou @usuário)" value={form.landing_contato_instagram} onChange={(v) => updateField("landing_contato_instagram", v)} onReset={() => handleReset("landing_contato_instagram")} />
            <FieldInput label="Facebook (URL)" value={form.landing_contato_facebook} onChange={(v) => updateField("landing_contato_facebook", v)} onReset={() => handleReset("landing_contato_facebook")} />
            <FieldTextarea label="Endereço" value={form.landing_contato_endereco} onChange={(v) => updateField("landing_contato_endereco", v)} onReset={() => handleReset("landing_contato_endereco")} rows={2} />
          </CardContent>
        </Card>

        {/* Login */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              Formulário de Login
            </CardTitle>
            <CardDescription>Textos do formulário de login na página inicial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Título" value={form.landing_login_titulo} onChange={(v) => updateField("landing_login_titulo", v)} onReset={() => handleReset("landing_login_titulo")} />
            <FieldInput label="Subtítulo" value={form.landing_login_subtitulo} onChange={(v) => updateField("landing_login_subtitulo", v)} onReset={() => handleReset("landing_login_subtitulo")} />
            <FieldTextarea label="Texto do Rodapé do Login" value={form.landing_login_rodape} onChange={(v) => updateField("landing_login_rodape", v)} onReset={() => handleReset("landing_login_rodape")} />
          </CardContent>
        </Card>

        {/* Botão Salvar fixo no final */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={handleResetAll} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Todas as Configurações
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ─── Field Components ─────────────────────────────────────────────── */
function FieldInput({ label, value, onChange, onReset }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <button onClick={onReset} className="text-[10px] text-muted-foreground hover:text-primary transition-colors" title="Restaurar padrão">
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm" />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, onReset, rows = 3 }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <button onClick={onReset} className="text-[10px] text-muted-foreground hover:text-primary transition-colors" title="Restaurar padrão">
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-sm" />
    </div>
  );
}
