import { useAuth } from "@/_core/hooks/useAuth";
import { clearAuthToken } from "@/lib/auth-token";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme, THEME_BASES, BASE_LABELS, THEME_MODES, MODE_LABELS, MODE_ICONS, type ThemeBase, type ThemeMode } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Building2,
  Users,
  FileText,
  Download,
  Clock,
  BarChart3,
  Settings,
  FileKey,
  ShieldAlert,
  CreditCard,
  UserCog,
  FileSearch,
  Palette,
  Check,
  History,
  Globe,
  HelpCircle,
  Truck,
} from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Redirect } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { usePermissoes, ROUTE_PERMISSIONS } from "@/hooks/usePermissoes";

// Menu items for ADMIN (platform owner)
const adminMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard Admin", path: "/dashboard" },
  { icon: Building2, label: "Contabilidades", path: "/contabilidades" },
  { icon: CreditCard, label: "Planos", path: "/planos" },
  { icon: UserCog, label: "Usuários", path: "/usuarios" },
  { icon: Palette, label: "Personalização", path: "/personalizacao" },
  { icon: Globe, label: "Página Inicial", path: "/config-pagina-inicial" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", path: "/ajuda" },
];

// Menu items for CONTABILIDADE (accounting firm)
const contabilidadeMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Meus Clientes", path: "/clientes" },
  { icon: FileKey, label: "Certificados", path: "/certificados" },
  { icon: ShieldAlert, label: "Validade Certificados", path: "/certificados-validade" },
  { icon: FileText, label: "Notas Fiscais", path: "/notas" },
  { icon: Download, label: "Downloads", path: "/downloads" },
  { icon: History, label: "Histórico Downloads", path: "/historico-downloads" },
  { icon: Clock, label: "Agendamentos", path: "/agendamentos" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: FileSearch, label: "Visualizar XML", path: "/visualizar-xml" },
  { type: "separator" } as any,
  { icon: Truck, label: "CT-e Downloads", path: "/cte-downloads" },
  { icon: FileText, label: "CT-e Notas", path: "/cte-notas" },
  { icon: History, label: "CT-e Histórico", path: "/cte-historico" },
  { icon: BarChart3, label: "CT-e Relatórios", path: "/cte-relatorios" },
  { type: "separator" } as any,
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
  { icon: HelpCircle, label: "Ajuda", path: "/ajuda" },
];

// Pegasus logo SVG component
function PegasusLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L8 6H4L2 10L4 14L2 18L4 22H8L12 18L16 22H20L22 18L20 14L22 10L20 6H16L12 2Z" fill="currentColor" opacity="0.15"/>
      <path d="M12 3.5L9 6.5V9L7 11V14L9 16V18.5L12 21.5L15 18.5V16L17 14V11L15 9V6.5L12 3.5Z" fill="currentColor" opacity="0.3"/>
      <path d="M12 5L10 7V10L8.5 11.5V13.5L10 15V17L12 19L14 17V15L15.5 13.5V11.5L14 10V7L12 5Z" fill="currentColor"/>
    </svg>
  );
}

// Theme color indicators
const THEME_BASE_COLORS: Record<ThemeBase, string> = {
  emerald: "bg-gradient-to-br from-emerald-300 to-green-500 border-emerald-400",
  sunset: "bg-gradient-to-br from-orange-300 to-amber-500 border-orange-400",
  midnight: "bg-gradient-to-br from-blue-400 to-indigo-600 border-blue-500",
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { themeBase, themeMode, setThemeBase, setMode, isDark, toggleMode } = useTheme();

  // Dynamic branding from settings
  const { data: allSettings } = trpc.settings.getAll.useQuery();
  const sLogoUrl = (allSettings as Record<string, string> | undefined)?.["landing_logo_url"] ?? "";
  const sNomeSistema = (allSettings as Record<string, string> | undefined)?.["landing_nome_sistema"] ?? "Pegasus";

  const { permissoes, isFullAccess } = usePermissoes();

  // Buscar dados da contabilidade para saber se CT-e está habilitado
  const { data: contabData } = trpc.contabilidade.list.useQuery(undefined, {
    enabled: user?.role === "contabilidade" || user?.role === "usuario",
  });
  const cteHabilitado = contabData?.[0]?.cteHabilitado ?? false;

  const CTE_PATHS = ["/cte-downloads", "/cte-notas", "/cte-historico", "/cte-relatorios"];

  const menuItems = useMemo(() => {
    if (user?.role === "admin") return adminMenuItems;

    // Filter CT-e items if not enabled
    const filterCte = (items: typeof contabilidadeMenuItems) => {
      if (cteHabilitado) return items;
      return items.filter((item) => {
        if ("path" in item && CTE_PATHS.includes(item.path)) return false;
        return true;
      });
    };

    // For contabilidade, show all menus (except CT-e if disabled)
    if (isFullAccess) return filterCte(contabilidadeMenuItems);
    // For "usuario" role, filter menus based on permissions
    return filterCte(contabilidadeMenuItems).filter((item) => {
      const requiredPerm = ROUTE_PERMISSIONS[item.path];
      // null means always visible (dashboard, configurações)
      if (requiredPerm === null || requiredPerm === undefined) return true;
      return permissoes[requiredPerm];
    });
  }, [user?.role, permissoes, isFullAccess, cteHabilitado]);

  const activeMenuItem = menuItems.find((item) => "path" in item && item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const roleLabel = user?.role === "admin" ? "Administrador" : user?.role === "contabilidade" ? "Contabilidade" : "Cliente";
  const roleBadgeColor = user?.role === "admin" ? "bg-red-500/20 text-red-400 font-semibold" : user?.role === "contabilidade" ? "bg-sidebar-primary/20 text-sidebar-primary font-semibold" : "bg-green-500/20 text-green-400 font-semibold";

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  {sLogoUrl ? (
                    <img src={sLogoUrl} alt={sNomeSistema} className="h-7 w-7 rounded-lg object-contain shrink-0" />
                  ) : (
                    <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <PegasusLogo className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="font-bold tracking-tight truncate text-sidebar-foreground text-sm block">
                      {sNomeSistema}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleBadgeColor} inline-block mt-0.5`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item, idx) => {
                if ("type" in item && (item as any).type === "separator") {
                  return (
                    <div key={`sep-${idx}`} className="my-2 mx-2 border-t border-sidebar-border" />
                  );
                }
                const menuItem = item as { icon: any; label: string; path: string };
                const isActive = location === menuItem.path;
                return (
                  <SidebarMenuItem key={menuItem.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(menuItem.path)}
                      tooltip={menuItem.label}
                      className={`h-10 transition-all font-normal ${isActive ? 'font-medium' : ''}`}
                    >
                      <menuItem.icon className={`h-4 w-4 transition-colors ${isActive ? "text-sidebar-primary drop-shadow-[0_0_6px_var(--sidebar-primary)]" : ""}`} />
                      <span>{menuItem.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          {/* Theme selector in sidebar footer */}
          {!isCollapsed && (
            <div className="px-3 pb-2 space-y-1.5">
              {/* Theme base selector */}
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-sidebar-accent/30">
                {THEME_BASES.map((b) => (
                  <button
                    key={b}
                    onClick={() => setThemeBase(b)}
                    className={`flex-1 h-6 rounded-md border transition-all ${THEME_BASE_COLORS[b]} ${
                      themeBase === b ? "ring-2 ring-sidebar-primary ring-offset-1 ring-offset-sidebar scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    title={BASE_LABELS[b]}
                  >
                    {themeBase === b && (
                      <Check className="h-3 w-3 mx-auto text-white drop-shadow-sm" />
                    )}
                  </button>
                ))}
              </div>
              {/* Light/Dim/Dark mode selector */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-sidebar-accent/30">
                {THEME_MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1 h-6 rounded-md text-[10px] font-medium transition-all ${
                      themeMode === m
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                    }`}
                    title={MODE_LABELS[m]}
                  >
                    <span>{MODE_ICONS[m]}</span>
                    <span>{MODE_LABELS[m]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border border-sidebar-border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary text-primary-foreground">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-sidebar-foreground/60 truncate mt-1.5">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                  {roleLabel}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { clearAuthToken(); logout(); setLocation("/"); }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="tracking-tight text-foreground font-medium">
                {activeMenuItem && "label" in activeMenuItem ? activeMenuItem.label : "Menu"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 min-h-screen">{children}</main>
      </SidebarInset>
    </>
  );
}
