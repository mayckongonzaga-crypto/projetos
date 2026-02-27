import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  FileDown,
  Loader2,
  Search,
  Filter,
  Eye,
  Building2,
  User,
  Receipt,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  DollarSign,
  Percent,
  MapPin,
  Info,
  ChevronDown,
  ChevronUp,
  Landmark,
  Scale,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import { toast } from "sonner";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y?.slice(2)}`;
}

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

type NotaRelatorio = {
  id: number;
  clienteId: number;
  numeroNota: string | null;
  dataEmissao: Date | null;
  dataCompetencia: Date | null;
  emitenteCnpj: string | null;
  emitenteNome: string | null;
  tomadorCnpj: string | null;
  tomadorNome: string | null;
  valorServico: string | null;
  valorLiquido: string | null;
  direcao: string;
  status: string;
  codigoServico: string | null;
  descricaoServico: string | null;
  municipioPrestacao: string | null;
  chaveAcesso: string | null;
  xml: {
    chaveAcesso: string;
    numeroNfse: string;
    competencia: string;
    dataEmissao: string;
    emitenteCnpj: string;
    emitenteNome: string;
    emitenteEmail: string;
    emitenteTelefone: string;
    emitenteEndereco: string;
    emitenteMunicipio: string;
    emitenteUf: string;
    emitenteCep: string;
    emitenteInscMunicipal: string;
    emitenteSimplesNacional: string;
    emitenteRegimeApuracao: string;
    tomadorCnpj: string;
    tomadorNome: string;
    tomadorEmail: string;
    tomadorTelefone: string;
    tomadorEndereco: string;
    tomadorMunicipio: string;
    tomadorUf: string;
    tomadorCep: string;
    tomadorInscMunicipal: string;
    codigoTribNacional: string;
    codigoTribMunicipal: string;
    descricaoServico: string;
    localPrestacao: string;
    tributacaoIssqn: string;
    municipioIncidenciaIssqn: string;
    regimeEspecialTributacao: string;
    valorServico: string;
    bcIssqn: string;
    aliquotaAplicada: string;
    retencaoIssqn: string;
    issqnApurado: string;
    irrf: string;
    cp: string;
    csll: string;
    pis: string;
    cofins: string;
    totalTributacaoFederal: string;
    valorLiquido: string;
    descontoIncondicionado: string;
    descontoCondicionado: string;
    issqnRetido: string;
    irrfCpCsllRetidos: string;
    pisCofinsRetidos: string;
    tributosFederais: string;
    tributosEstaduais: string;
    tributosMunicipais: string;
    informacoesComplementares: string;
    temRetencaoIssqn: boolean;
    temRetencaoFederal: boolean;
    temRetencao: boolean;
    [key: string]: any;
  } | null;
};

// ── Componente de Detalhe da Nota ──
function NotaDetailModal({ nota, open, onClose }: { nota: NotaRelatorio | null; open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState("geral");
  if (!nota) return null;
  const x = nota.xml;
  const statusMap: Record<string, string> = { valida: "Ativa", cancelada: "Cancelada", substituida: "Substituída" };

  const InfoRow = ({ label, value, highlight }: { label: string; value: string | undefined | null; highlight?: boolean }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-red-600" : ""}`}>{value || "-"}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[85vw] w-[85vw] max-h-[85vh] h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-primary" />
            <span>NFSe {nota.numeroNota || "S/N"}</span>
            <Badge variant={nota.direcao === "emitida" ? "default" : "secondary"} className={nota.direcao === "emitida" ? "bg-blue-600" : "bg-amber-50 dark:bg-amber-500/15"}>
              {nota.direcao === "emitida" ? "Emitente" : "Tomador"}
            </Badge>
            <Badge variant={nota.status === "valida" ? "default" : "destructive"} className={nota.status === "valida" ? "bg-green-600" : ""}>
              {statusMap[nota.status] || nota.status}
            </Badge>
            {x?.temRetencao && (
              <Badge variant="destructive" className="bg-red-600 gap-1">
                <AlertTriangle className="h-3 w-3" />Retenção
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs de navegação */}
        <div className="flex gap-1 border-b border-border pb-0">
          {[
            { id: "geral", label: "Geral", icon: Info },
            { id: "emitente", label: "Emitente", icon: Building2 },
            { id: "tomador", label: "Tomador", icon: User },
            { id: "servico", label: "Serviço", icon: FileText },
            { id: "tributacao", label: "Tributação", icon: Calculator },
            { id: "valores", label: "Valores", icon: DollarSign },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-md transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />{tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo das tabs */}
        <div className="mt-2">
          {activeTab === "geral" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Dados da Nota</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="Número NFSe" value={x?.numeroNfse || nota.numeroNota} />
                  <InfoRow label="Chave de Acesso" value={x?.chaveAcesso || nota.chaveAcesso} />
                  <InfoRow label="Data Emissão" value={x?.dataEmissao ? new Date(x.dataEmissao).toLocaleString("pt-BR") : nota.dataEmissao ? new Date(nota.dataEmissao).toLocaleDateString("pt-BR") : ""} />
                  <InfoRow label="Competência" value={x?.competencia || (nota.dataCompetencia ? new Date(nota.dataCompetencia).toLocaleDateString("pt-BR") : "")} />
                  <InfoRow label="Status" value={statusMap[nota.status] || nota.status} />
                  <InfoRow label="Direção" value={nota.direcao === "emitida" ? "Emitente" : "Tomador"} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Resumo Financeiro</CardTitle></CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="Valor do Serviço" value={x?.valorServico || formatCurrency(Number(nota.valorServico || 0))} />
                  <InfoRow label="Desconto Incondicionado" value={x?.descontoIncondicionado} />
                  <InfoRow label="Desconto Condicionado" value={x?.descontoCondicionado} />
                  <InfoRow label="ISSQN Retido" value={x?.issqnRetido} highlight={x?.temRetencaoIssqn} />
                  <InfoRow label="Retenções Federais" value={x?.irrfCpCsllRetidos} highlight={x?.temRetencaoFederal} />
                  <InfoRow label="Valor Líquido" value={x?.valorLiquido || formatCurrency(Number(nota.valorLiquido || 0))} />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "emitente" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />Dados do Emitente</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <InfoRow label="CNPJ" value={x?.emitenteCnpj || nota.emitenteCnpj} />
                <InfoRow label="Razão Social" value={x?.emitenteNome || nota.emitenteNome} />
                <InfoRow label="Inscrição Municipal" value={x?.emitenteInscMunicipal} />
                <InfoRow label="Telefone" value={x?.emitenteTelefone} />
                <InfoRow label="E-mail" value={x?.emitenteEmail} />
                <InfoRow label="Endereço" value={x?.emitenteEndereco} />
                <InfoRow label="Município" value={x?.emitenteMunicipio} />
                <InfoRow label="CEP" value={x?.emitenteCep} />
                <InfoRow label="Simples Nacional" value={x?.emitenteSimplesNacional} />
                <InfoRow label="Regime de Apuração" value={x?.emitenteRegimeApuracao} />
              </CardContent>
            </Card>
          )}

          {activeTab === "tomador" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4 text-amber-600" />Dados do Tomador</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <InfoRow label="CNPJ/CPF" value={x?.tomadorCnpj || nota.tomadorCnpj} />
                <InfoRow label="Razão Social" value={x?.tomadorNome || nota.tomadorNome} />
                <InfoRow label="Inscrição Municipal" value={x?.tomadorInscMunicipal} />
                <InfoRow label="Telefone" value={x?.tomadorTelefone} />
                <InfoRow label="E-mail" value={x?.tomadorEmail} />
                <InfoRow label="Endereço" value={x?.tomadorEndereco} />
                <InfoRow label="Município" value={x?.tomadorMunicipio} />
                <InfoRow label="CEP" value={x?.tomadorCep} />
              </CardContent>
            </Card>
          )}

          {activeTab === "servico" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-purple-600" />Serviço Prestado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Código Tributação Nacional" value={x?.codigoTribNacional || nota.codigoServico} />
                <InfoRow label="Código Tributação Municipal" value={x?.codigoTribMunicipal} />
                <InfoRow label="Local de Prestação" value={x?.localPrestacao || nota.municipioPrestacao} />
                <div className="py-2 border-b border-border/50">
                  <span className="text-xs text-muted-foreground block mb-1">Descrição do Serviço</span>
                  <p className="text-sm">{x?.descricaoServico || nota.descricaoServico || "-"}</p>
                </div>
                {x?.informacoesComplementares && (
                  <div className="py-2">
                    <span className="text-xs text-muted-foreground block mb-1">Informações Complementares</span>
                    <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded">{x.informacoesComplementares}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "tributacao" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600 dark:text-green-400" />Tributação Municipal (ISSQN)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="Tributação ISSQN" value={x?.tributacaoIssqn} />
                  <InfoRow label="Município Incidência" value={x?.municipioIncidenciaIssqn} />
                  <InfoRow label="Regime Especial" value={x?.regimeEspecialTributacao} />
                  <InfoRow label="Base de Cálculo" value={x?.bcIssqn} />
                  <InfoRow label="Alíquota" value={x?.aliquotaAplicada} />
                  <InfoRow label="ISSQN Apurado" value={x?.issqnApurado} />
                  <InfoRow label="Retenção ISSQN" value={x?.retencaoIssqn} highlight={x?.temRetencaoIssqn} />
                  <InfoRow label="ISSQN Retido (R$)" value={x?.issqnRetido} highlight={x?.temRetencaoIssqn} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-red-600" />Tributação Federal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoRow label="IRRF" value={x?.irrf} highlight={parseFloat(x?.irrf?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0") > 0} />
                  <InfoRow label="Contribuição Previdenciária" value={x?.cp} />
                  <InfoRow label="CSLL" value={x?.csll} highlight={parseFloat(x?.csll?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0") > 0} />
                  <InfoRow label="PIS" value={x?.pis} highlight={parseFloat(x?.pis?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0") > 0} />
                  <InfoRow label="COFINS" value={x?.cofins} highlight={parseFloat(x?.cofins?.replace(/[^\d,.-]/g, '').replace(',', '.') || "0") > 0} />
                  <InfoRow label="PIS/COFINS Retidos" value={x?.pisCofinsRetidos} />
                  <InfoRow label="Total Tributação Federal" value={x?.totalTributacaoFederal} />
                  <Separator className="my-2" />
                  <InfoRow label="Tributos Federais Aprox." value={x?.tributosFederais} />
                  <InfoRow label="Tributos Estaduais Aprox." value={x?.tributosEstaduais} />
                  <InfoRow label="Tributos Municipais Aprox." value={x?.tributosMunicipais} />
                </CardContent>
              </Card>

              {/* Card IBS/CBS - Reforma Tributária */}
              <Card className="md:col-span-2 border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Reforma Tributária — IBS / CBS
                    {(x?.ibsCbsPresente || (nota as any).temIbsCbs) ? (
                      <Badge className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] ml-2">Presente</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] ml-2 text-muted-foreground">Aguardando vigência</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  {(x?.ibsCbsPresente || (nota as any).temIbsCbs) ? (
                    <>
                      <InfoRow label="CST IBS/CBS" value={x?.cstIbsCbs || (nota as any).cstIbsCbs} />
                      <InfoRow label="Base de Cálculo IBS/CBS" value={x?.ibsCbsBaseCalculo || ((nota as any).vBcIbsCbs ? formatCurrency(Number((nota as any).vBcIbsCbs)) : null)} />
                      <Separator className="my-2" />
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 py-1">IBS — Imposto sobre Bens e Serviços</div>
                      <InfoRow label="Alíquota IBS UF (Estadual)" value={x?.ibsCbsAliqIbsUf || ((nota as any).aliqIbsUf ? `${Number((nota as any).aliqIbsUf).toFixed(4)}%` : null)} />
                      <InfoRow label="Valor IBS UF" value={x?.ibsCbsVIbsUf || ((nota as any).vIbsUf ? formatCurrency(Number((nota as any).vIbsUf)) : null)} highlight={Number((nota as any).vIbsUf || 0) > 0} />
                      <InfoRow label="Alíquota IBS Municipal" value={x?.ibsCbsAliqIbsMun || ((nota as any).aliqIbsMun ? `${Number((nota as any).aliqIbsMun).toFixed(4)}%` : null)} />
                      <InfoRow label="Valor IBS Municipal" value={x?.ibsCbsVIbsMun || ((nota as any).vIbsMun ? formatCurrency(Number((nota as any).vIbsMun)) : null)} highlight={Number((nota as any).vIbsMun || 0) > 0} />
                      <Separator className="my-2" />
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 py-1">CBS — Contribuição sobre Bens e Serviços</div>
                      <InfoRow label="Alíquota CBS (Federal)" value={x?.ibsCbsAliqCbs || ((nota as any).aliqCbs ? `${Number((nota as any).aliqCbs).toFixed(4)}%` : null)} />
                      <InfoRow label="Valor CBS" value={x?.ibsCbsVCbs || ((nota as any).vCbs ? formatCurrency(Number((nota as any).vCbs)) : null)} highlight={Number((nota as any).vCbs || 0) > 0} />
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center py-2 px-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Total IBS + CBS</span>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{x?.ibsCbsVTotalIbsCbs || ((nota as any).vTotTribIbsCbs ? formatCurrency(Number((nota as any).vTotTribIbsCbs)) : "-")}</span>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center">
                      <Scale className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Dados IBS/CBS não disponíveis nesta nota.</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Os campos serão preenchidos automaticamente quando a API Nacional passar a enviar os dados da Reforma Tributária (IBS/CBS).</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "valores" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />Valores Completos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  <InfoRow label="Valor do Serviço" value={x?.valorServico || formatCurrency(Number(nota.valorServico || 0))} />
                  <InfoRow label="Desconto Incondicionado" value={x?.descontoIncondicionado} />
                  <InfoRow label="Desconto Condicionado" value={x?.descontoCondicionado} />
                  <InfoRow label="Total Deduções" value={x?.totalDeducoes} />
                  <InfoRow label="Base de Cálculo" value={x?.bcIssqn} />
                  <InfoRow label="ISSQN Retido" value={x?.issqnRetido} highlight={x?.temRetencaoIssqn} />
                  <InfoRow label="IRRF/CP/CSLL Retidos" value={x?.irrfCpCsllRetidos} highlight={x?.temRetencaoFederal} />
                  <InfoRow label="PIS/COFINS Retidos" value={x?.pisCofinsRetidos} />
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
                  <span className="text-sm font-semibold">Valor Líquido</span>
                  <span className="text-lg font-bold text-primary">{x?.valorLiquido || formatCurrency(Number(nota.valorLiquido || 0))}</span>
                </div>
                {x?.temRetencao && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-900">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-semibold">Esta nota possui retenção de impostos</span>
                    </div>
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400/80">
                      {x?.temRetencaoIssqn && <span className="block">ISSQN: {x.retencaoIssqn} - Valor: {x.issqnRetido}</span>}
                      {x?.temRetencaoFederal && <span className="block">Federal (IRRF/CSLL/PIS/COFINS): {x.irrfCpCsllRetidos}</span>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Relatorios() {
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: clientesList } = trpc.cliente.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const [selectedCliente, setSelectedCliente] = useState<string>("all");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [tipoRelatorio, setTipoRelatorio] = useState<string>("todas");
  const [selectedNota, setSelectedNota] = useState<NotaRelatorio | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [gerado, setGerado] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    contabId?: number;
    clienteId?: number;
    tipoRelatorio: string;
    dataInicio: string;
    dataFim: string;
  } | null>(null);

  const { data: stats } = trpc.dashboard.stats.useQuery(
    { contabilidadeId: activeFilters?.contabId, clienteId: activeFilters?.clienteId },
    { enabled: gerado && !!activeFilters?.contabId }
  );

  const reportFilters = useMemo(() => {
    if (!activeFilters) return null;
    return {
      contabilidadeId: activeFilters.contabId,
      clienteId: activeFilters.clienteId,
      direcao: activeFilters.tipoRelatorio === "emitidas" ? "emitida" as const : activeFilters.tipoRelatorio === "recebidas" ? "recebida" as const : undefined,
      status: activeFilters.tipoRelatorio === "canceladas" ? "cancelada" : undefined,
      dataInicio: activeFilters.dataInicio ? new Date(activeFilters.dataInicio) : undefined,
      dataFim: activeFilters.dataFim ? new Date(activeFilters.dataFim + "T23:59:59") : undefined,
    };
  }, [activeFilters]);

  const { data: reportData, isLoading: loadingReport } = trpc.relatorio.getData.useQuery(
    reportFilters!,
    { enabled: gerado && !!reportFilters && !!activeFilters?.contabId }
  );

  const { data: allNotasData } = trpc.nota.list.useQuery(
    {
      contabilidadeId: activeFilters?.contabId,
      clienteId: activeFilters?.clienteId,
      dataInicio: activeFilters?.dataInicio ? new Date(activeFilters.dataInicio) : undefined,
      dataFim: activeFilters?.dataFim ? new Date(activeFilters.dataFim + "T23:59:59") : undefined,
      limit: 2000,
    },
    { enabled: gerado && !!activeFilters?.contabId }
  );

  const handleGerar = () => {
    if (!contabId) { toast.error("Selecione uma contabilidade"); return; }
    setActiveFilters({
      contabId,
      clienteId: selectedCliente !== "all" ? parseInt(selectedCliente) : undefined,
      tipoRelatorio,
      dataInicio,
      dataFim,
    });
    setGerado(true);
  };

  const handleLimpar = () => { setGerado(false); setActiveFilters(null); };

  const exportExcel = trpc.relatorio.exportExcel.useMutation({
    onSuccess: (data) => {
      const byteCharacters = atob(data.base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = data.filename; a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório Excel exportado com sucesso!");
    },
    onError: (err) => toast.error("Erro ao exportar: " + err.message),
  });

  const handleExportExcel = () => {
    if (!activeFilters) return;
    exportExcel.mutate({
      contabilidadeId: activeFilters.contabId,
      clienteId: activeFilters.clienteId,
      direcao: activeFilters.tipoRelatorio === "emitidas" ? "emitida" : activeFilters.tipoRelatorio === "recebidas" ? "recebida" : undefined,
      status: activeFilters.tipoRelatorio === "canceladas" ? "cancelada" : undefined,
      dataInicio: activeFilters.dataInicio ? new Date(activeFilters.dataInicio) : undefined,
      dataFim: activeFilters.dataFim ? new Date(activeFilters.dataFim + "T23:59:59") : undefined,
    });
  };

  const handleExportPDF = () => {
    const printContent = document.getElementById("relatorio-tabela");
    if (!printContent) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Permita pop-ups para exportar PDF"); return; }
    const tipoLabel = activeFilters?.tipoRelatorio === "emitidas" ? "Emitidas" : activeFilters?.tipoRelatorio === "recebidas" ? "Recebidas" : activeFilters?.tipoRelatorio === "canceladas" ? "Canceladas" : "Todas";
    const clienteNome = activeFilters?.clienteId ? clientesList?.find(c => c.id === activeFilters.clienteId)?.razaoSocial || "" : "Todos os Clientes";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Relatório NFSe - ${tipoLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 16px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #166534; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        tr:nth-child(even) { background: #f9fafb; }
        .total-row { font-weight: bold; background: #f0fdf4 !important; border-top: 2px solid #166534; }
        .text-right { text-align: right; }
        .header-info { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .header-info span { font-size: 11px; color: #374151; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <h1>Relatório de Notas Fiscais - ${tipoLabel}</h1>
      <div class="subtitle">${clienteNome} | Período: ${activeFilters?.dataInicio || "Início"} a ${activeFilters?.dataFim || "Atual"}</div>
      <div class="header-info"><span>Total de notas: ${reportData?.length ?? 0}</span><span>Gerado em: ${new Date().toLocaleString("pt-BR")}</span></div>
      ${printContent.innerHTML}
      </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleExportCSV = () => {
    if (!reportData?.length) return;
    const statusMap: Record<string, string> = { valida: "Ativa", cancelada: "Cancelada", substituida: "Substituída" };
    const headers = ["Número NF", "Data Emissão", "Competência", "CNPJ Emitente", "Nome Emitente", "CNPJ Tomador", "Nome Tomador", "Serviço", "Valor Bruto", "Valor Líquido", "ISSQN", "Alíquota", "Retenção ISSQN", "IRRF", "CSLL", "PIS", "COFINS", "Tem Retenção", "Status"];
    const rows = reportData.map((n) => [
      n.numeroNota || "",
      n.dataEmissao ? new Date(n.dataEmissao).toLocaleDateString("pt-BR") : "",
      n.dataCompetencia ? new Date(n.dataCompetencia).toLocaleDateString("pt-BR") : "",
      n.emitenteCnpj || "",
      n.emitenteNome || "",
      n.tomadorCnpj || "",
      n.tomadorNome || "",
      n.xml?.descricaoServico || n.descricaoServico || "",
      n.valorServico || "0",
      n.valorLiquido || "0",
      n.xml?.issqnApurado || "",
      n.xml?.aliquotaAplicada || "",
      n.xml?.retencaoIssqn || "",
      n.xml?.irrf || "",
      n.xml?.csll || "",
      n.xml?.pis || "",
      n.xml?.cofins || "",
      n.xml?.temRetencao ? "Sim" : "Não",
      statusMap[n.status] || n.status,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_${activeFilters?.tipoRelatorio || "todas"}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const monthlyData = useMemo(() => {
    if (!stats?.notasPorMes) return [];
    return stats.notasPorMes.map((m: any) => ({
      mes: formatMonth(m.mes),
      emitidas: Number(m.emitidas),
      recebidas: Number(m.recebidas),
      total: Number(m.total),
      valor: parseFloat(m.valor),
    }));
  }, [stats]);

  const clienteComparison = useMemo(() => {
    if (!allNotasData?.notas || !clientesList) return [];
    const map = new Map<number, { nome: string; total: number; valor: number; emitidas: number; recebidas: number }>();
    for (const n of allNotasData.notas) {
      const existing = map.get(n.clienteId) || { nome: "", total: 0, valor: 0, emitidas: 0, recebidas: 0 };
      const cliente = clientesList.find((c) => c.id === n.clienteId);
      existing.nome = cliente?.razaoSocial || `Cliente ${n.clienteId}`;
      existing.total++;
      existing.valor += parseFloat(String(n.valorServico || "0"));
      if (n.direcao === "emitida") existing.emitidas++;
      else existing.recebidas++;
      map.set(n.clienteId, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [allNotasData, clientesList]);

  // ── Resumo de tributação ──
  const tributacaoResumo = useMemo(() => {
    if (!reportData) return null;
    let totalBruto = 0, totalLiquido = 0, totalIssqn = 0, totalIrrf = 0, totalCsll = 0, totalPis = 0, totalCofins = 0, totalCp = 0;
    let comRetencao = 0, semRetencao = 0, comRetIssqn = 0, comRetFed = 0;
    for (const n of reportData) {
      totalBruto += parseFloat(n.valorServico ?? "0");
      totalLiquido += parseFloat(n.valorLiquido ?? "0");
      if (n.xml) {
        const toNum = (s: string) => { const v = parseFloat(s.replace(/[R$\s.]/g, '').replace(',', '.')); return isNaN(v) ? 0 : v; };
        totalIssqn += toNum(n.xml.issqnApurado || "0");
        totalIrrf += toNum(n.xml.irrf || "0");
        totalCsll += toNum(n.xml.csll || "0");
        totalPis += toNum(n.xml.pis || "0");
        totalCofins += toNum(n.xml.cofins || "0");
        totalCp += toNum(n.xml.cp || "0");
        if (n.xml.temRetencao) comRetencao++; else semRetencao++;
        if (n.xml.temRetencaoIssqn) comRetIssqn++;
        if (n.xml.temRetencaoFederal) comRetFed++;
      }
    }
    return { totalBruto, totalLiquido, totalIssqn, totalIrrf, totalCsll, totalPis, totalCofins, totalCp, comRetencao, semRetencao, comRetIssqn, comRetFed, count: reportData.length };
  }, [reportData]);

  const retencaoPieData = useMemo(() => {
    if (!tributacaoResumo) return [];
    return [
      { name: "Com Retenção", value: tributacaoResumo.comRetencao },
      { name: "Sem Retenção", value: tributacaoResumo.semRetencao },
    ].filter(d => d.value > 0);
  }, [tributacaoResumo]);

  const tribDistData = useMemo(() => {
    if (!tributacaoResumo) return [];
    return [
      { name: "ISSQN", value: tributacaoResumo.totalIssqn },
      { name: "IRRF", value: tributacaoResumo.totalIrrf },
      { name: "CSLL", value: tributacaoResumo.totalCsll },
      { name: "PIS", value: tributacaoResumo.totalPis },
      { name: "COFINS", value: tributacaoResumo.totalCofins },
      { name: "CP", value: tributacaoResumo.totalCp },
    ].filter(d => d.value > 0);
  }, [tributacaoResumo]);

  const statusMap: Record<string, string> = { valida: "Ativa", cancelada: "Cancelada", substituida: "Substituída" };
  const tipoLabel = activeFilters?.tipoRelatorio === "emitidas" ? "Emitidas" : activeFilters?.tipoRelatorio === "recebidas" ? "Recebidas" : activeFilters?.tipoRelatorio === "canceladas" ? "Canceladas" : "Todas";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
            <p className="text-muted-foreground text-sm mt-1">Análises completas com tributação, retenções e gráficos</p>
          </div>
          {gerado && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!reportData?.length}>
                <FileText className="h-4 w-4 mr-1.5" />CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!reportData?.length || exportExcel.isPending}>
                {exportExcel.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1.5" />}
                Excel Completo
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!reportData?.length}>
                <FileDown className="h-4 w-4 mr-1.5" />PDF
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {contabilidades && contabilidades.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Contabilidade</label>
                  <Select value={selectedContab || String(contabilidades[0]?.id ?? "")} onValueChange={(v) => { setSelectedContab(v); setGerado(false); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Contabilidade" /></SelectTrigger>
                    <SelectContent>
                      {contabilidades.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Empresa</label>
                  <Select value={selectedCliente} onValueChange={(v) => { setSelectedCliente(v); setGerado(false); }}>
                    <SelectTrigger className="h-9 text-sm w-full"><SelectValue placeholder="Cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Clientes</SelectItem>
                      {clientesList?.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.razaoSocial}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={tipoRelatorio} onValueChange={(v) => { setTipoRelatorio(v); setGerado(false); }}>
                    <SelectTrigger className="h-9 text-sm w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas</SelectItem>
                      <SelectItem value="emitidas">Emitidas</SelectItem>
                      <SelectItem value="recebidas">Recebidas</SelectItem>
                      <SelectItem value="canceladas">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Início</label>
                  <Input type="date" className="h-9 text-sm w-full" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); setGerado(false); }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Fim</label>
                  <Input type="date" className="h-9 text-sm w-full" value={dataFim} onChange={(e) => { setDataFim(e.target.value); setGerado(false); }} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleGerar} className="gap-2"><Search className="h-4 w-4" />Gerar Relatório</Button>
                {gerado && (<Button variant="outline" onClick={handleLimpar} className="gap-2"><Filter className="h-4 w-4" />Limpar</Button>)}
                {gerado && (
                  <span className="text-sm text-muted-foreground">
                    Filtros: <strong>{tipoLabel}</strong>
                    {activeFilters?.clienteId ? ` | ${clientesList?.find(c => c.id === activeFilters.clienteId)?.razaoSocial}` : " | Todos"}
                    {activeFilters?.dataInicio ? ` | De: ${activeFilters.dataInicio}` : ""}
                    {activeFilters?.dataFim ? ` | Até: ${activeFilters.dataFim}` : ""}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estado inicial */}
        {!gerado && (
          <Card>
            <CardContent className="py-16">
              <div className="text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Selecione os filtros e gere o relatório</h3>
                  <p className="text-muted-foreground text-sm mt-1 max-w-md mx-auto">
                    Escolha a empresa, tipo de nota e período desejado nos filtros acima, depois clique em <strong>"Gerar Relatório"</strong> para visualizar os dados completos com tributação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Conteúdo do relatório */}
        {gerado && (
          <Tabs defaultValue="relatorio" className="space-y-6">
            <TabsList>
              <TabsTrigger value="relatorio" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Relatório</TabsTrigger>
              <TabsTrigger value="tributacao" className="gap-1.5"><Calculator className="h-3.5 w-3.5" />Tributação</TabsTrigger>
              <TabsTrigger value="graficos" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Gráficos</TabsTrigger>
              <TabsTrigger value="multi-empresa" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Multi-Empresa</TabsTrigger>
            </TabsList>

            {/* ── Tab Relatório ── */}
            <TabsContent value="relatorio">
              {/* Cards de resumo */}
              {tributacaoResumo && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Total Notas</p>
                      <p className="text-xl font-bold">{tributacaoResumo.count}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Valor Bruto</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(tributacaoResumo.totalBruto)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Valor Líquido</p>
                      <p className="text-lg font-bold text-emerald-700">{formatCurrency(tributacaoResumo.totalLiquido)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">ISSQN Total</p>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{formatCurrency(tributacaoResumo.totalIssqn)}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Com Retenção</p>
                      <p className="text-xl font-bold text-red-700 dark:text-red-400">{tributacaoResumo.comRetencao}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">Sem Retenção</p>
                      <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{tributacaoResumo.semRetencao}</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">
                    Relatório de Notas {tipoLabel} ({tributacaoResumo?.count || 0} notas)
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">Clique em uma nota para ver detalhes completos</span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto" id="relatorio-tabela">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">Tipo</TableHead>
                          <TableHead className="whitespace-nowrap">Nº NF</TableHead>
                          <TableHead className="whitespace-nowrap">Emissão</TableHead>
                          <TableHead className="whitespace-nowrap">Emitente</TableHead>
                          <TableHead className="whitespace-nowrap">Tomador</TableHead>
                          <TableHead className="whitespace-nowrap max-w-[200px]">Serviço</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Valor Bruto</TableHead>
                          <TableHead className="text-right whitespace-nowrap">ISSQN</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Alíq.</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Valor Líquido</TableHead>
                          <TableHead className="whitespace-nowrap text-center">Retenção</TableHead>
                          <TableHead className="whitespace-nowrap">Status</TableHead>
                          <TableHead className="whitespace-nowrap w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingReport ? (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8">
                              <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                              <p className="text-xs text-muted-foreground mt-2">Carregando e processando XMLs...</p>
                            </TableCell>
                          </TableRow>
                        ) : reportData && reportData.length > 0 ? (
                          <>
                            {reportData.map((n) => (
                              <TableRow
                                key={n.id}
                                className={`cursor-pointer hover:bg-accent/50 transition-colors ${n.direcao === "emitida" ? "border-l-4 border-l-blue-400" : "border-l-4 border-l-amber-400"}`}
                                onClick={() => { setSelectedNota(n as any); setDetailOpen(true); }}
                              >
                                <TableCell>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    n.direcao === "emitida" ? "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30" : "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
                                  }`}>
                                    {n.direcao === "emitida" ? "Emit." : "Tom."}
                                  </span>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{n.numeroNota || "-"}</TableCell>
                                <TableCell className="text-xs whitespace-nowrap">{n.dataEmissao ? new Date(n.dataEmissao).toLocaleDateString("pt-BR") : "-"}</TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" title={n.emitenteNome || ""}>{n.emitenteNome || "-"}</TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate" title={n.tomadorNome || ""}>{n.tomadorNome || "-"}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate" title={n.xml?.descricaoServico || n.descricaoServico || ""}>{n.xml?.descricaoServico || n.descricaoServico || "-"}</TableCell>
                                <TableCell className="text-right font-medium text-sm">{formatCurrency(Number(n.valorServico || 0))}</TableCell>
                                <TableCell className="text-right text-xs">{n.xml?.issqnApurado || "-"}</TableCell>
                                <TableCell className="text-right text-xs">{n.xml?.aliquotaAplicada || "-"}</TableCell>
                                <TableCell className="text-right font-medium text-sm">{formatCurrency(Number(n.valorLiquido || 0))}</TableCell>
                                <TableCell className="text-center">
                                  {n.xml?.temRetencao ? (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300">
                                      <AlertTriangle className="h-3 w-3" />Sim
                                    </span>
                                  ) : n.xml ? (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 dark:text-green-300">
                                      <CheckCircle2 className="h-3 w-3" />Não
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    n.status === "valida" ? "bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 dark:text-green-300" :
                                    n.status === "cancelada" ? "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300" :
                                    "bg-amber-500/20 text-amber-700 dark:bg-amber-500/30 dark:text-amber-200"
                                  }`}>
                                    {statusMap[n.status] || n.status}
                                  </span>
                                </TableCell>
                                <TableCell className="w-[40px] px-2">
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            ))}
                            {tributacaoResumo && (
                              <TableRow className="bg-green-50 dark:bg-green-500/10 font-bold border-t-2 border-green-700 dark:border-green-500/40">
                                <TableCell className="font-bold">TOTAL</TableCell>
                                <TableCell colSpan={5}></TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(tributacaoResumo.totalBruto)}</TableCell>
                                <TableCell className="text-right font-bold text-purple-700 dark:text-purple-400">{formatCurrency(tributacaoResumo.totalIssqn)}</TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(tributacaoResumo.totalLiquido)}</TableCell>
                                <TableCell className="text-center font-bold text-red-700 dark:text-red-400">{tributacaoResumo.comRetencao}</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                              </TableRow>
                            )}
                          </>
                        ) : (
                          <TableRow>
                            <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Nenhuma nota encontrada para os filtros selecionados</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Tab Tributação ── */}
            <TabsContent value="tributacao">
              {tributacaoResumo && (
                <div className="space-y-6">
                  {/* Cards de totais de tributos */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-purple-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">ISSQN Total</span>
                        </div>
                        <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{formatCurrency(tributacaoResumo.totalIssqn)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{tributacaoResumo.comRetIssqn} notas com retenção ISSQN</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                            <Calculator className="h-4 w-4 text-red-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">IRRF Total</span>
                        </div>
                        <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(tributacaoResumo.totalIrrf)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                            <Percent className="h-4 w-4 text-orange-600" />
                          </div>
                          <span className="text-xs text-muted-foreground">PIS + COFINS</span>
                        </div>
                        <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{formatCurrency(tributacaoResumo.totalPis + tributacaoResumo.totalCofins)}</p>
                        <p className="text-xs text-muted-foreground mt-1">PIS: {formatCurrency(tributacaoResumo.totalPis)} | COFINS: {formatCurrency(tributacaoResumo.totalCofins)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <span className="text-xs text-muted-foreground">CSLL + CP</span>
                        </div>
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(tributacaoResumo.totalCsll + tributacaoResumo.totalCp)}</p>
                        <p className="text-xs text-muted-foreground mt-1">CSLL: {formatCurrency(tributacaoResumo.totalCsll)} | CP: {formatCurrency(tributacaoResumo.totalCp)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gráficos de tributação */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Distribuição de Tributos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {tribDistData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <defs><filter id="rPieGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
                              <Pie data={tribDistData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none" filter="url(#rPieGlow)">
                                {tribDistData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                              </Pie>
                              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de tributação</div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Retenção de Impostos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {retencaoPieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <defs><filter id="rPieGlow2"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
                              <Pie data={retencaoPieData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none" filter="url(#rPieGlow2)" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                <Cell fill="#ef4444" />
                                <Cell fill="#22c55e" />
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tabela resumo de tributação */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Resumo Consolidado de Tributação</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tributo</TableHead>
                            <TableHead className="text-right">Valor Total</TableHead>
                            <TableHead className="text-right">% do Valor Bruto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            { nome: "ISSQN", valor: tributacaoResumo.totalIssqn, cor: "text-purple-700" },
                            { nome: "IRRF", valor: tributacaoResumo.totalIrrf, cor: "text-red-700" },
                            { nome: "CSLL", valor: tributacaoResumo.totalCsll, cor: "text-blue-700 dark:text-blue-300" },
                            { nome: "PIS", valor: tributacaoResumo.totalPis, cor: "text-orange-700" },
                            { nome: "COFINS", valor: tributacaoResumo.totalCofins, cor: "text-amber-700 dark:text-amber-300" },
                            { nome: "Contribuição Previdenciária", valor: tributacaoResumo.totalCp, cor: "text-cyan-700" },
                          ].map((t, i) => (
                            <TableRow key={i}>
                              <TableCell className={`font-medium ${t.cor}`}>{t.nome}</TableCell>
                              <TableCell className={`text-right font-medium ${t.cor}`}>{formatCurrency(t.valor)}</TableCell>
                              <TableCell className="text-right text-sm">
                                {tributacaoResumo.totalBruto > 0 ? `${((t.valor / tributacaoResumo.totalBruto) * 100).toFixed(2)}%` : "0%"}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold border-t-2">
                            <TableCell className="font-bold">Total Tributos</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(tributacaoResumo.totalIssqn + tributacaoResumo.totalIrrf + tributacaoResumo.totalCsll + tributacaoResumo.totalPis + tributacaoResumo.totalCofins + tributacaoResumo.totalCp)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {tributacaoResumo.totalBruto > 0 ? `${(((tributacaoResumo.totalIssqn + tributacaoResumo.totalIrrf + tributacaoResumo.totalCsll + tributacaoResumo.totalPis + tributacaoResumo.totalCofins + tributacaoResumo.totalCp) / tributacaoResumo.totalBruto) * 100).toFixed(2)}%` : "0%"}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* ── Tab Gráficos ── */}
            <TabsContent value="graficos">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Notas por Mês (Emitidas vs Recebidas)</CardTitle></CardHeader>
                  <CardContent>
                    {monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyData}>
                          <defs>
                            <linearGradient id="rBarBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60a5fa" stopOpacity={1} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} /></linearGradient>
                            <linearGradient id="rBarAmber" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24" stopOpacity={1} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.7} /></linearGradient>
                            <filter id="rBarGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                          <Legend />
                          <Bar dataKey="emitidas" name="Emitidas" fill="url(#rBarBlue)" radius={[6, 6, 0, 0]} filter="url(#rBarGlow)" />
                          <Bar dataKey="recebidas" name="Recebidas" fill="url(#rBarAmber)" radius={[6, 6, 0, 0]} filter="url(#rBarGlow)" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>)}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Evolução de Valores (R$)</CardTitle></CardHeader>
                  <CardContent>
                    {monthlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={monthlyData}>
                          <defs>
                            <linearGradient id="rAreaGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ade80" stopOpacity={0.4} /><stop offset="50%" stopColor="#22c55e" stopOpacity={0.15} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} /></linearGradient>
                            <filter id="rLineGlow"><feGaussianBlur stdDeviation="2" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                          <Area type="monotone" dataKey="valor" name="Valor" stroke="#4ade80" fill="url(#rAreaGreen)" strokeWidth={2.5} filter="url(#rLineGlow)" dot={{ fill: '#4ade80', strokeWidth: 0, r: 3 }} activeDot={{ r: 6, fill: '#4ade80', stroke: '#0f1623', strokeWidth: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (<div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>)}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Resumo por Mês</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mês</TableHead>
                          <TableHead className="text-right">Emitidas</TableHead>
                          <TableHead className="text-right">Recebidas</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyData.map((m: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{m.mes}</TableCell>
                            <TableCell className="text-right">{m.emitidas}</TableCell>
                            <TableCell className="text-right">{m.recebidas}</TableCell>
                            <TableCell className="text-right font-medium">{m.total}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(m.valor)}</TableCell>
                          </TableRow>
                        ))}
                        {monthlyData.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Tab Multi-Empresa ── */}
            <TabsContent value="multi-empresa">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Valor por Empresa</CardTitle></CardHeader>
                  <CardContent>
                    {clienteComparison.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={clienteComparison} layout="vertical">
                          <defs>
                            <linearGradient id="rBarGreen" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.7} /><stop offset="100%" stopColor="#4ade80" stopOpacity={1} /></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                          <Bar dataKey="valor" name="Valor Total" fill="url(#rBarGreen)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (<div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>)}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Distribuição de Notas por Empresa</CardTitle></CardHeader>
                  <CardContent>
                    {clienteComparison.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <defs><filter id="rPieGlow3"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
                          <Pie data={clienteComparison.map((c) => ({ name: c.nome, value: c.total }))} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={4} dataKey="value" stroke="none" filter="url(#rPieGlow3)">
                            {clienteComparison.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (<div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>)}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2"><CardTitle className="text-base">Comparativo por Empresa</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead className="text-right">Total Notas</TableHead>
                          <TableHead className="text-right">Emitidas</TableHead>
                          <TableHead className="text-right">Recebidas</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {clienteComparison.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell className="text-right">{c.total}</TableCell>
                            <TableCell className="text-right">{c.emitidas}</TableCell>
                            <TableCell className="text-right">{c.recebidas}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(c.valor)}</TableCell>
                          </TableRow>
                        ))}
                        {clienteComparison.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sem dados</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Modal de detalhes da nota */}
      <NotaDetailModal nota={selectedNota} open={detailOpen} onClose={() => setDetailOpen(false)} />
    </DashboardLayout>
  );
}
