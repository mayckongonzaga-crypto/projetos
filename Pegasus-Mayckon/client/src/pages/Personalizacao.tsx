import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme, THEME_BASES, BASE_LABELS, BASE_DESCRIPTIONS, THEME_MODES, MODE_LABELS, MODE_ICONS, type ThemeBase, type ThemeMode } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { Palette, Check, Sun, Moon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Redirect } from "wouter";

type PreviewColors = { bg: string; sidebar: string; primary: string; card: string };
const THEME_BASE_PREVIEW: Record<ThemeBase, Record<ThemeMode, PreviewColors>> = {
  emerald: {
    light: { bg: "bg-gray-50", sidebar: "bg-gray-800", primary: "bg-emerald-500", card: "bg-white" },
    dim: { bg: "bg-gray-700", sidebar: "bg-gray-800", primary: "bg-emerald-500", card: "bg-gray-600" },
    dark: { bg: "bg-gray-900", sidebar: "bg-gray-950", primary: "bg-emerald-500", card: "bg-gray-800" },
  },
  sunset: {
    light: { bg: "bg-amber-50", sidebar: "bg-stone-800", primary: "bg-orange-500", card: "bg-white" },
    dim: { bg: "bg-stone-700", sidebar: "bg-stone-800", primary: "bg-orange-500", card: "bg-stone-600" },
    dark: { bg: "bg-stone-900", sidebar: "bg-stone-950", primary: "bg-orange-500", card: "bg-stone-800" },
  },
  midnight: {
    light: { bg: "bg-slate-50", sidebar: "bg-slate-900", primary: "bg-blue-600", card: "bg-white" },
    dim: { bg: "bg-slate-700", sidebar: "bg-slate-800", primary: "bg-blue-500", card: "bg-slate-600" },
    dark: { bg: "bg-slate-950", sidebar: "bg-slate-900", primary: "bg-blue-500", card: "bg-slate-800" },
  },
};

export default function Personalizacao() {
  const { user } = useAuth();
  const { theme, themeBase, themeMode, isDark, setThemeBase, setMode, toggleMode } = useTheme();

  const saveMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Tema salvo com sucesso!");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao salvar tema");
    },
  });

  if (user?.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  const handleThemeSelect = (base: ThemeBase) => {
    setThemeBase(base);
    const newTheme = isDark ? `${base}-dark` : base;
    saveMutation.mutate({ chave: "tema", valor: newTheme });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Palette className="h-6 w-6 text-primary" />
            Personalização
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personalize a aparência do sistema Pegasus. O tema selecionado será aplicado em toda a aplicação.
          </p>
        </div>

        {/* Light/Dim/Dark Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Modo de Exibição</CardTitle>
            <CardDescription>Escolha entre claro, penumbra (meio-termo) ou escuro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {THEME_MODES.map((mode) => {
                const isActive = themeMode === mode;
                const IconComp = mode === "light" ? Sun : Moon;
                return (
                  <button
                    key={mode}
                    onClick={() => setMode(mode)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all ${
                      isActive ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                  >
                    <span className="text-base">{MODE_ICONS[mode]}</span>
                    <span className="text-sm font-medium">{MODE_LABELS[mode]}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Theme Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tema do Sistema</CardTitle>
            <CardDescription>Escolha entre os temas profissionais para personalizar a experiência visual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {THEME_BASES.map((base) => {
                const isActive = themeBase === base;
                const preview = THEME_BASE_PREVIEW[base][themeMode];

                return (
                  <button
                    key={base}
                    onClick={() => handleThemeSelect(base)}
                    className={`group relative rounded-xl border-2 p-4 text-left transition-all duration-200 hover:shadow-lg ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}

                    {/* Mini preview */}
                    <div className={`rounded-lg ${preview.bg} p-2 mb-3 border border-border/50 overflow-hidden`}>
                      <div className="flex gap-1.5 h-16">
                        <div className={`w-8 ${preview.sidebar} rounded-md flex flex-col items-center pt-2 gap-1`}>
                          <div className={`w-4 h-4 ${preview.primary} rounded-sm`} />
                          <div className="w-4 h-0.5 bg-white/20 rounded" />
                          <div className="w-4 h-0.5 bg-white/20 rounded" />
                          <div className="w-4 h-0.5 bg-white/20 rounded" />
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <div className={`h-3 ${preview.primary} rounded-sm w-1/2`} />
                          <div className="flex gap-1 flex-1">
                            <div className={`flex-1 ${preview.card} rounded-sm border border-black/5`} />
                            <div className={`flex-1 ${preview.card} rounded-sm border border-black/5`} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold text-sm ${isActive ? "text-primary" : "text-foreground"}`}>
                        {BASE_LABELS[base]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {BASE_DESCRIPTIONS[base]}
                    </p>
                  </button>
                );
              })}
            </div>

            {saveMutation.isPending && (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando preferência de tema...
              </div>
            )}
          </CardContent>
        </Card>

        {/* Branding Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do Sistema</CardTitle>
            <CardDescription>Detalhes sobre a marca e versão do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sistema</p>
                <p className="font-semibold text-lg">Pegasus</p>
              </div>
              <div>
                <p className="text-muted-foreground">Desenvolvido por</p>
                <p className="font-semibold text-lg">Lan7 Tecnologia</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tema Atual</p>
                <p className="font-medium capitalize">{BASE_LABELS[themeBase]} ({isDark ? "Escuro" : "Claro"})</p>
              </div>
              <div>
                <p className="text-muted-foreground">Especialidade</p>
                <p className="font-medium">Soluções para Contabilidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
