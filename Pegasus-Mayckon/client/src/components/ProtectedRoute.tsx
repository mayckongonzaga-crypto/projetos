import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissoes, ROUTE_PERMISSIONS, type Permissoes } from "@/hooks/usePermissoes";
import { Redirect, useLocation } from "wouter";

type Props = {
  children: React.ReactNode;
  /** Optional: override the permission check with a specific permission key */
  requiredPermission?: keyof Permissoes;
};

/**
 * Wraps a route component and redirects to /dashboard if the user
 * doesn't have the required permission for the current path.
 * Admin and contabilidade roles always have full access.
 */
export default function ProtectedRoute({ children, requiredPermission }: Props) {
  const { user, loading } = useAuth();
  const { permissoes, isFullAccess } = usePermissoes();
  const [location] = useLocation();

  // Still loading auth
  if (loading) return null;

  // Not logged in
  if (!user) return <Redirect to="/" />;

  // Admin and contabilidade have full access
  if (isFullAccess) return <>{children}</>;

  // Determine which permission is needed
  const perm = requiredPermission || ROUTE_PERMISSIONS[location];

  // null means always accessible (dashboard, configurações)
  if (perm === null || perm === undefined) return <>{children}</>;

  // Check permission
  if (!permissoes[perm]) {
    // Find first allowed route to redirect to
    const fallback = permissoes.verDashboard ? "/dashboard" : "/configuracoes";
    return <Redirect to={fallback} />;
  }

  return <>{children}</>;
}
