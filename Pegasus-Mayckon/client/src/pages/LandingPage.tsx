import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { setAuthToken } from "@/lib/auth-token";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  FileText,
  Shield,
  Download,
  Clock,
  BarChart3,
  Users,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  ArrowRight,
  FileKey,
  Zap,
  Lock,
  Building2,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Instagram,
  Facebook,
} from "lucide-react";

// Valores padrão (mesmos do ConfigPaginaInicial)
const DEFAULTS: Record<string, string> = {
  landing_tema: "midnight",
  landing_logo_url: "",
  landing_nome_sistema: "Pegasus",
  landing_subtitulo: "by Lan7 Tecnologia",
  landing_hero_badge: "Automação fiscal para contadores",
  landing_hero_titulo_antes: "Gestão de",
  landing_hero_titulo_destaque: "NFSe e CT-e",
  landing_hero_titulo_depois: "inteligente",
  landing_hero_descricao: "O Pegasus gerencia certificados digitais, faz download de XMLs de NFSe e CT-e, e organiza os documentos fiscais dos seus clientes. Conectado à API Nacional da NFSe e à SEFAZ para CT-e.",
  landing_hero_btn_primario: "Acessar o Pegasus",
  landing_hero_btn_secundario: "Conhecer Funcionalidades",
  landing_hero_check1: "NFSe + CT-e",
  landing_hero_check2: "Certificado Digital",
  landing_hero_check3: "Multi-empresa",
  landing_func_titulo: "Tudo que você precisa para gerenciar NFSe e CT-e",
  landing_func_subtitulo: "Um portal completo para escritórios de contabilidade que precisam baixar e organizar os XMLs de NFSe e CT-e dos seus clientes.",
  landing_func1_titulo: "Certificados Digitais",
  landing_func1_desc: "Importe os certificados digitais (.pfx) dos seus clientes. O sistema extrai automaticamente o CNPJ e dados do certificado, e monitora a validade.",
  landing_func2_titulo: "Download de XMLs",
  landing_func2_desc: "Baixe os XMLs das NFSe e CT-e emitidos e recebidos dos seus clientes diretamente da API Nacional e SEFAZ. Download individual ou em lote por período.",
  landing_func3_titulo: "Download Automático",
  landing_func3_desc: "Configure agendamentos para baixar automaticamente os XMLs de NFSe e CT-e em intervalos regulares. Nunca mais esqueça de baixar os documentos.",
  landing_func4_titulo: "Multi-Empresa",
  landing_func4_desc: "Gerencie todos os seus clientes em um único painel. Cada empresa com seus certificados, NFSe, CT-e e downloads organizados separadamente.",
  landing_func5_titulo: "Relatórios e Dashboard",
  landing_func5_desc: "Visualize gráficos de NFSe e CT-e emitidos/recebidos, valores por período, ICMS, DACTE, status dos certificados e muito mais em tempo real.",
  landing_func6_titulo: "Segurança",
  landing_func6_desc: "Certificados armazenados com criptografia AES-256. Conexão mTLS com a API da NFSe. Seus dados estão protegidos.",
  landing_como_titulo: "Simples e direto ao ponto",
  landing_como_subtitulo: "Em poucos passos você já está baixando os XMLs de NFSe e CT-e dos seus clientes.",
  landing_passo1_titulo: "Acesse o Portal",
  landing_passo1_desc: "Faça login com as credenciais fornecidas pelo administrador do sistema.",
  landing_passo2_titulo: "Importe Certificados",
  landing_passo2_desc: "Faça upload dos certificados digitais (.pfx) dos seus clientes com a senha.",
  landing_passo3_titulo: "Baixe os XMLs",
  landing_passo3_desc: "Selecione o período e baixe os XMLs das NFSe e CT-e emitidos e recebidos.",
  landing_passo4_titulo: "Acompanhe",
  landing_passo4_desc: "Use o dashboard para acompanhar notas, valores e validade dos certificados.",
  landing_benef_titulo: "Por que usar o Pegasus?",
  landing_benef1_titulo: "Economia de tempo",
  landing_benef1_desc: "Pare de acessar o portal da NFSe manualmente para cada cliente. Baixe tudo de uma vez.",
  landing_benef2_titulo: "Organização",
  landing_benef2_desc: "Todos os XMLs de NFSe e CT-e organizados por empresa e período em um único lugar seguro.",
  landing_benef3_titulo: "Monitoramento de certificados",
  landing_benef3_desc: "Receba alertas quando certificados estiverem próximos do vencimento. Nunca perca um prazo.",
  landing_benef4_titulo: "Conexão direta com APIs oficiais",
  landing_benef4_desc: "Os XMLs são baixados diretamente da API oficial da NFSe e da SEFAZ para CT-e usando mTLS, garantindo autenticidade.",
  landing_cta_titulo: "Pronto para automatizar?",
  landing_cta_descricao: "Acesse o Pegasus agora e comece a baixar os XMLs de NFSe e CT-e dos seus clientes de forma rápida e organizada.",
  landing_cta_btn: "Acessar o Pegasus",
  landing_rodape_texto: "Desenvolvido por Lan7 Tecnologia — Soluções para escritórios de contabilidade",
  landing_rodape_subtexto: "Conectado à API Nacional da NFSe e SEFAZ CT-e",
  landing_login_titulo: "Acesse sua conta",
  landing_login_subtitulo: "Entre com suas credenciais de contabilidade",
  landing_login_rodape: "Acesso exclusivo para escritórios de contabilidade cadastrados. Entre em contato com o administrador para obter suas credenciais.",
  landing_contato_titulo: "Entre em Contato",
  landing_contato_subtitulo: "Estamos prontos para atender você",
  landing_contato_telefone: "(47) 3333-0000",
  landing_contato_whatsapp: "(47) 99999-0000",
  landing_contato_email: "contato@lan7.com.br",
  landing_contato_instagram: "@lan7tecnologia",
  landing_contato_facebook: "lan7tecnologia",
  landing_contato_endereco: "Rua Exemplo, 123 - Centro, Joinville/SC - CEP 89201-000",
};

function useLandingSettings() {
  const { data: allSettings } = trpc.settings.getAll.useQuery();
  const get = (key: string): string => {
    const val = (allSettings as Record<string, string> | undefined)?.[key];
    return val ?? DEFAULTS[key] ?? "";
  };
  return { get, loaded: !!allSettings };
}

export default function LandingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const s = useLandingSettings();

  // Landing page uses a fixed theme defined by admin (default: midnight light)
  // Save user's theme and restore it when they navigate away
  const landingTheme = (s.get("landing_tema") || "midnight") as import("@/contexts/ThemeContext").PegasusTheme;
  const userThemeRef = React.useRef<string | null>(null);

  useEffect(() => {
    // Save user's current theme before overriding
    if (userThemeRef.current === null) {
      userThemeRef.current = localStorage.getItem("pegasus-theme") || "midnight";
    }
    // Apply landing theme
    if (theme !== landingTheme) {
      setTheme(landingTheme);
    }
    return () => {
      // Restore user's theme when leaving landing page
      if (userThemeRef.current) {
        const stored = userThemeRef.current as import("@/contexts/ThemeContext").PegasusTheme;
        // Use setTimeout to avoid state update during unmount
        setTimeout(() => {
          const root = document.documentElement;
          root.setAttribute("data-theme", stored);
          if (stored.endsWith("-dark")) {
            root.classList.add("dark");
          } else {
            root.classList.remove("dark");
          }
          localStorage.setItem("pegasus-theme", stored);
        }, 0);
      }
    };
  }, [landingTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (user) {
    return null;
  }

  const logoUrl = s.get("landing_logo_url");
  const nomeSistema = s.get("landing_nome_sistema");
  const subtitulo = s.get("landing_subtitulo");

  return (
    <div className="min-h-screen bg-background">
      {/* Header / Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt={nomeSistema} className="h-11 w-11 rounded-xl object-contain" />
              ) : (
                <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center">
                  <PegasusIcon className="h-6 w-6 text-primary-foreground" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-extrabold text-2xl text-foreground tracking-tight leading-none">{nomeSistema}</span>
                <span className="text-xs text-muted-foreground leading-none mt-1 font-medium">{subtitulo}</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-primary transition-colors">Funcionalidades</a>
              <a href="#como-funciona" className="text-sm text-muted-foreground hover:text-primary transition-colors">Como Funciona</a>
              <a href="#beneficios" className="text-sm text-muted-foreground hover:text-primary transition-colors">Benefícios</a>
              <a href="#contato" className="text-sm text-muted-foreground hover:text-primary transition-colors">Contato</a>
              <a href="#login" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">Entrar</a>
            </nav>
            <div className="md:hidden">
              <a href="#login">
                <Button size="sm">Entrar</Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 lg:pt-40 lg:pb-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/30" />
        <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Text */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{s.get("landing_hero_badge")}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight tracking-tight">
                {s.get("landing_hero_titulo_antes")}{" "}
                <span className="text-primary">{s.get("landing_hero_titulo_destaque")}</span>{" "}
                {s.get("landing_hero_titulo_depois")}
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                {s.get("landing_hero_descricao")}
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#login">
                  <Button size="lg" className="text-base px-8 h-12 shadow-lg shadow-primary/20">
                    {s.get("landing_hero_btn_primario")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </a>
                <a href="#funcionalidades">
                  <Button variant="outline" size="lg" className="text-base px-8 h-12">
                    {s.get("landing_hero_btn_secundario")}
                  </Button>
                </a>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{s.get("landing_hero_check1")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{s.get("landing_hero_check2")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">{s.get("landing_hero_check3")}</span>
                </div>
              </div>
            </div>

            {/* Right: Login Form */}
            <div id="login" className="scroll-mt-24">
              <LoginForm settings={s} />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="funcionalidades" className="py-20 lg:py-28 bg-muted/50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3">
              {s.get("landing_func_titulo")}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
              {s.get("landing_func_subtitulo")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<FileKey className="h-6 w-6" />}
              title={s.get("landing_func1_titulo")}
              description={s.get("landing_func1_desc")}
            />
            <FeatureCard
              icon={<Download className="h-6 w-6" />}
              title={s.get("landing_func2_titulo")}
              description={s.get("landing_func2_desc")}
            />
            <FeatureCard
              icon={<Clock className="h-6 w-6" />}
              title={s.get("landing_func3_titulo")}
              description={s.get("landing_func3_desc")}
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title={s.get("landing_func4_titulo")}
              description={s.get("landing_func4_desc")}
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title={s.get("landing_func5_titulo")}
              description={s.get("landing_func5_desc")}
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title={s.get("landing_func6_titulo")}
              description={s.get("landing_func6_desc")}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 lg:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Como Funciona</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3">
              {s.get("landing_como_titulo")}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto text-lg">
              {s.get("landing_como_subtitulo")}
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <StepCard number="01" title={s.get("landing_passo1_titulo")} description={s.get("landing_passo1_desc")} />
            <StepCard number="02" title={s.get("landing_passo2_titulo")} description={s.get("landing_passo2_desc")} />
            <StepCard number="03" title={s.get("landing_passo3_titulo")} description={s.get("landing_passo3_desc")} />
            <StepCard number="04" title={s.get("landing_passo4_titulo")} description={s.get("landing_passo4_desc")} />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="py-20 lg:py-28 bg-muted/50 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <span className="text-sm font-semibold text-primary uppercase tracking-wider">Benefícios</span>
                <h2 className="text-3xl sm:text-4xl font-bold text-foreground mt-3">
                  {s.get("landing_benef_titulo")}
                </h2>
              </div>

              <div className="space-y-6">
                <BenefitItem title={s.get("landing_benef1_titulo")} description={s.get("landing_benef1_desc")} />
                <BenefitItem title={s.get("landing_benef2_titulo")} description={s.get("landing_benef2_desc")} />
                <BenefitItem title={s.get("landing_benef3_titulo")} description={s.get("landing_benef3_desc")} />
                <BenefitItem title={s.get("landing_benef4_titulo")} description={s.get("landing_benef4_desc")} />
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-xl">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Escritório de Contabilidade</p>
                    <p className="text-sm text-muted-foreground">Gerencia múltiplos clientes</p>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <ChevronRight className="h-5 w-5 text-muted-foreground rotate-90" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {["Cliente A", "Cliente B", "Cliente C", "Cliente D"].map((name, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{name}</p>
                        <p className="text-xs text-muted-foreground">NFSe + CT-e + XMLs</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  <ChevronRight className="h-5 w-5 text-muted-foreground rotate-90" />
                </div>
                <div className="flex items-center gap-4 p-4 bg-accent rounded-xl">
                  <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">XMLs Organizados</p>
                    <p className="text-sm text-muted-foreground">NFSe e CT-e separados por empresa e período</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-primary rounded-3xl p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white dark:bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white dark:bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
                {s.get("landing_cta_titulo")}
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
                {s.get("landing_cta_descricao")}
              </p>
              <a href="#login">
                <Button size="lg" variant="secondary" className="text-base px-8 h-12">
                  {s.get("landing_cta_btn")}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Contato Section */}
      <section id="contato" className="py-20 lg:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              {s.get("landing_contato_titulo")}
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {s.get("landing_contato_subtitulo")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Telefone */}
            {s.get("landing_contato_telefone") && (
              <a href={`tel:${s.get("landing_contato_telefone").replace(/\D/g, "")}`} className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary group-hover:scale-110 transition-transform">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">Telefone</h3>
                  <p className="text-muted-foreground text-sm">{s.get("landing_contato_telefone")}</p>
                </div>
              </a>
            )}

            {/* WhatsApp */}
            {s.get("landing_contato_whatsapp") && (
              <a href={`https://wa.me/55${s.get("landing_contato_whatsapp").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-500/15 flex items-center justify-center shrink-0 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">WhatsApp</h3>
                  <p className="text-muted-foreground text-sm">{s.get("landing_contato_whatsapp")}</p>
                </div>
              </a>
            )}

            {/* E-mail */}
            {s.get("landing_contato_email") && (
              <a href={`mailto:${s.get("landing_contato_email")}`} className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">E-mail</h3>
                  <p className="text-muted-foreground text-sm">{s.get("landing_contato_email")}</p>
                </div>
              </a>
            )}

            {/* Instagram */}
            {s.get("landing_contato_instagram") && (
              <a href={`https://instagram.com/${s.get("landing_contato_instagram").replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-pink-500/10 flex items-center justify-center shrink-0 text-pink-600 group-hover:scale-110 transition-transform">
                  <Instagram className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">Instagram</h3>
                  <p className="text-muted-foreground text-sm">{s.get("landing_contato_instagram")}</p>
                </div>
              </a>
            )}

            {/* Facebook */}
            {s.get("landing_contato_facebook") && (
              <a href={`https://facebook.com/${s.get("landing_contato_facebook")}`} target="_blank" rel="noopener noreferrer" className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0 text-blue-700 dark:text-blue-300 group-hover:scale-110 transition-transform">
                  <Facebook className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">Facebook</h3>
                  <p className="text-muted-foreground text-sm">{s.get("landing_contato_facebook")}</p>
                </div>
              </a>
            )}

            {/* Endereço */}
            {s.get("landing_contato_endereco") && (
              <div className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center shrink-0 text-orange-600 group-hover:scale-110 transition-transform">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-card-foreground mb-1">Endereço</h3>
                  <p className="text-muted-foreground text-sm">{s.get("landing_contato_endereco")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt={nomeSistema} className="h-8 w-8 rounded-lg object-contain" />
              ) : (
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <PegasusIcon className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-semibold text-foreground leading-none">{nomeSistema}</span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5">{subtitulo}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {s.get("landing_rodape_texto")}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.get("landing_rodape_subtexto")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Pegasus Icon SVG ────────────────────────────────────────────── */
function PegasusIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L8 6H4L2 10L4 14L2 18L4 22H8L12 18L16 22H20L22 18L20 14L22 10L20 6H16L12 2Z" fill="currentColor" opacity="0.15"/>
      <path d="M12 3.5L9 6.5V9L7 11V14L9 16V18.5L12 21.5L15 18.5V16L17 14V11L15 9V6.5L12 3.5Z" fill="currentColor" opacity="0.3"/>
      <path d="M12 5L10 7V10L8.5 11.5V13.5L10 15V17L12 19L14 17V15L15.5 13.5V11.5L14 10V7L12 5Z" fill="currentColor"/>
    </svg>
  );
}

/* ─── Login Form Component ─────────────────────────────────────────── */
function LoginForm({ settings: s }: { settings: { get: (key: string) => string } }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      if (data.token) {
        setAuthToken(data.token);
      }
      toast.success("Login realizado com sucesso!");
      await utils.invalidate();
      setLocation("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao fazer login");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-xl p-8 relative overflow-hidden">

      <div className="relative z-10 text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
          <Lock className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-bold text-card-foreground">{s.get("landing_login_titulo")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{s.get("landing_login_subtitulo")}</p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="landing-email" className="text-sm font-medium text-card-foreground">E-mail</Label>
          <Input
            id="landing-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-11"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="landing-password" className="text-sm font-medium text-card-foreground">Senha</Label>
          <div className="relative">
            <Input
              id="landing-password"
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 text-base"
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <div className="relative z-10 mt-6 pt-6 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          {s.get("landing_login_rodape")}
        </p>
      </div>
    </div>
  );
}

/* ─── Feature Card Component ───────────────────────────────────────── */
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-semibold text-card-foreground text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
}

/* ─── Step Card Component ──────────────────────────────────────────── */
function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

/* ─── Benefit Item Component ───────────────────────────────────────── */
function BenefitItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <CheckCircle className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
