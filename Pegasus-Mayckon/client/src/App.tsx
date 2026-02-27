import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/Home";
import Contabilidades from "./pages/Contabilidades";
import Clientes from "./pages/Clientes";
import Certificados from "./pages/Certificados";
import Notas from "./pages/Notas";
import Downloads from "./pages/Downloads";
import Agendamentos from "./pages/Agendamentos";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Login from "./pages/Login";
import Registro from "./pages/Registro";
import CertificadosValidade from "./pages/CertificadosValidade";
import Planos from "./pages/Planos";
import Usuarios from "./pages/Usuarios";
import VisualizarXml from "./pages/VisualizarXml";
import Personalizacao from "./pages/Personalizacao";
import ConfigPaginaInicial from "./pages/ConfigPaginaInicial";
import HistoricoDownloads from "./pages/HistoricoDownloads";
import Ajuda from "./pages/Ajuda";
import CteDownloads from "./pages/CteDownloads";
import CteNotas from "./pages/CteNotas";
import CteHistorico from "./pages/CteHistorico";
import CteRelatorios from "./pages/CteRelatorios";

function Router() {
  return (
    <Switch>
      {/* Página pública */}
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={Login} />
      <Route path="/registro" component={Registro} />

      {/* Painel autenticado */}
      <Route path="/dashboard">
        <ProtectedRoute requiredPermission="verDashboard">
          <Home />
        </ProtectedRoute>
      </Route>
      <Route path="/configuracoes" component={Configuracoes} />

      {/* Admin only */}
      <Route path="/contabilidades" component={Contabilidades} />
      <Route path="/planos" component={Planos} />
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/personalizacao" component={Personalizacao} />
      <Route path="/config-pagina-inicial" component={ConfigPaginaInicial} />

      {/* Rotas com verificação de permissão */}
      <Route path="/clientes">
        <ProtectedRoute requiredPermission="verClientes">
          <Clientes />
        </ProtectedRoute>
      </Route>
      <Route path="/certificados">
        <ProtectedRoute requiredPermission="verCertificados">
          <Certificados />
        </ProtectedRoute>
      </Route>
      <Route path="/certificados-validade">
        <ProtectedRoute requiredPermission="verCertificados">
          <CertificadosValidade />
        </ProtectedRoute>
      </Route>
      <Route path="/notas">
        <ProtectedRoute requiredPermission="verClientes">
          <Notas />
        </ProtectedRoute>
      </Route>
      <Route path="/downloads">
        <ProtectedRoute requiredPermission="fazerDownloads">
          <Downloads />
        </ProtectedRoute>
      </Route>
      <Route path="/historico-downloads">
        <ProtectedRoute requiredPermission="verHistorico">
          <HistoricoDownloads />
        </ProtectedRoute>
      </Route>
      <Route path="/agendamentos">
        <ProtectedRoute requiredPermission="gerenciarAgendamentos">
          <Agendamentos />
        </ProtectedRoute>
      </Route>
      <Route path="/relatorios">
        <ProtectedRoute requiredPermission="verRelatorios">
          <Relatorios />
        </ProtectedRoute>
      </Route>
      <Route path="/visualizar-xml">
        <ProtectedRoute requiredPermission="verClientes">
          <VisualizarXml />
        </ProtectedRoute>
      </Route>
      <Route path="/ajuda" component={Ajuda} />

      {/* CT-e */}
      <Route path="/cte-downloads">
        <ProtectedRoute requiredPermission="fazerDownloads">
          <CteDownloads />
        </ProtectedRoute>
      </Route>
      <Route path="/cte-notas">
        <ProtectedRoute requiredPermission="verClientes">
          <CteNotas />
        </ProtectedRoute>
      </Route>
      <Route path="/cte-historico">
        <ProtectedRoute requiredPermission="verHistorico">
          <CteHistorico />
        </ProtectedRoute>
      </Route>
      <Route path="/cte-relatorios">
        <ProtectedRoute requiredPermission="verRelatorios">
          <CteRelatorios />
        </ProtectedRoute>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="midnight">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
