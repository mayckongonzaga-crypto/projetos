import { useAuth } from "@/_core/hooks/useAuth";
import { useMemo } from "react";

export type Permissoes = {
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
  // Permissões CT-e
  verCteNotas: boolean;
  fazerDownloadsCte: boolean;
  verHistoricoCte: boolean;
  verRelatoriosCte: boolean;
};

const ALL_TRUE: Permissoes = {
  verDashboard: true,
  verClientes: true,
  editarClientes: true,
  apagarClientes: true,
  verCertificados: true,
  gerenciarCertificados: true,
  fazerDownloads: true,
  verHistorico: true,
  gerenciarAgendamentos: true,
  verRelatorios: true,
  gerenciarUsuarios: true,
  gerenciarAuditoria: true,
  verCteNotas: true,
  fazerDownloadsCte: true,
  verHistoricoCte: true,
  verRelatoriosCte: true,
};

const ALL_FALSE: Permissoes = {
  verDashboard: false,
  verClientes: false,
  editarClientes: false,
  apagarClientes: false,
  verCertificados: false,
  gerenciarCertificados: false,
  fazerDownloads: false,
  verHistorico: false,
  gerenciarAgendamentos: false,
  verRelatorios: false,
  gerenciarUsuarios: false,
  gerenciarAuditoria: false,
  verCteNotas: false,
  fazerDownloadsCte: false,
  verHistoricoCte: false,
  verRelatoriosCte: false,
};

/**
 * Hook that returns the current user's permissions.
 * - admin and contabilidade roles get ALL permissions
 * - "usuario" role gets only the permissions stored in user.permissoes JSON
 */
export function usePermissoes(): { permissoes: Permissoes; isFullAccess: boolean } {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return { permissoes: ALL_FALSE, isFullAccess: false };
    }

    // Admin and contabilidade have full access
    if (user.role === "admin" || user.role === "contabilidade") {
      return { permissoes: ALL_TRUE, isFullAccess: true };
    }

    // "usuario" role - parse permissoes from JSON
    if ((user as any).permissoes) {
      try {
        const parsed = typeof (user as any).permissoes === "string"
          ? JSON.parse((user as any).permissoes)
          : (user as any).permissoes;
        return {
          permissoes: { ...ALL_FALSE, ...parsed },
          isFullAccess: false,
        };
      } catch {
        return { permissoes: ALL_FALSE, isFullAccess: false };
      }
    }

    return { permissoes: ALL_FALSE, isFullAccess: false };
  }, [user]);
}

/**
 * Map of sidebar paths to required permissions.
 * Configurações is always visible (Minha Conta tab).
 */
export const ROUTE_PERMISSIONS: Record<string, keyof Permissoes | null> = {
  "/dashboard": "verDashboard",
  "/clientes": "verClientes",
  "/certificados": "verCertificados",
  "/certificados-validade": "verCertificados",
  "/notas": "verClientes", // needs to see clients to see their notas
  "/downloads": "fazerDownloads",
  "/historico-downloads": "verHistorico",
  "/agendamentos": "gerenciarAgendamentos",
  "/relatorios": "verRelatorios",
  "/visualizar-xml": "verClientes",
  "/configuracoes": null, // always visible (Minha Conta tab)
  // CT-e routes
  "/cte-notas": "verCteNotas",
  "/cte-downloads": "fazerDownloadsCte",
  "/cte-historico": "verHistoricoCte",
  "/cte-relatorios": "verRelatoriosCte",
};
