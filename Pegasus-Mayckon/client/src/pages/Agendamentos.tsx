import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Clock, Plus, Trash2, Calendar, Briefcase, ArrowRight, Pencil, CalendarDays, RotateCcw, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Funções de dias úteis ──────────────────────────────────────────
function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getHolidaysBR(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`, `${year}-04-21`, `${year}-05-01`, `${year}-09-07`,
    `${year}-10-12`, `${year}-11-02`, `${year}-11-15`, `${year}-12-25`,
  ];
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);
  const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const carnival = addDays(easter, -47);
  const carnivalMon = addDays(easter, -48);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const mobile = [fmt(carnival), fmt(carnivalMon), fmt(goodFriday), fmt(corpusChristi)];
  return new Set([...fixed, ...mobile]);
}

function getBusinessDaysOfMonth(year: number, month: number): { day: number; date: Date; businessDayNumber: number }[] {
  const holidays = getHolidaysBR(year);
  const result: { day: number; date: Date; businessDayNumber: number }[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  let businessDayCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = date.toISOString().split("T")[0];
    if (isBusinessDay(date) && !holidays.has(dateStr)) {
      businessDayCount++;
      result.push({ day: d, date, businessDayNumber: businessDayCount });
    }
  }
  return result;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const DAY_NAMES_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatDateBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/** Calcula a prévia do período relativo para exibição */
function calcularPreviaRelativo(dias: number): { dataInicio: string; dataFim: string } {
  const hoje = new Date();
  const dataFim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const dataInicioDate = new Date(hoje);
  dataInicioDate.setDate(dataInicioDate.getDate() - dias);
  const dataInicio = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;
  return { dataInicio, dataFim };
}

type FormState = {
  clienteId: string;
  frequencia: "diario" | "semanal" | "mensal" | "dia_util";
  horario: string;
  diaSemana: number;
  diaMes: number;
  diaUtil: number;
  mesAlvo: number;
  dataInicial: string;
  dataFinal: string;
  periodoTipo: "fixo" | "relativo";
  periodoDias: number;
  tipoDocumento: "nfe" | "cte" | "ambos";
};

function getDefaultForm(): FormState {
  const today = new Date();
  const firstDayOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return {
    clienteId: "all",
    frequencia: "diario",
    horario: "02:00",
    diaSemana: 1,
    diaMes: 1,
    diaUtil: 1,
    mesAlvo: today.getMonth() + 1,
    dataInicial: firstDayOfMonth,
    dataFinal: todayStr,
    periodoTipo: "relativo",
    periodoDias: 30,
    tipoDocumento: "nfe",
  };
}

const PERIODOS_RAPIDOS = [7, 10, 15, 20, 30, 60, 90];

// ─── Componente do Formulário (reutilizado para criar e editar) ─────
function AgendamentoForm({
  form,
  setForm,
  clientesList,
  onSubmit,
  isPending,
  submitLabel,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  clientesList: any[] | undefined;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const now = new Date();
  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  // Prévia do período relativo
  const previaRelativo = useMemo(() => {
    if (form.periodoTipo === "relativo" && form.periodoDias > 0) {
      return calcularPreviaRelativo(form.periodoDias);
    }
    return null;
  }, [form.periodoTipo, form.periodoDias]);

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label>Cliente</Label>
        <Select value={form.clienteId} onValueChange={(v) => setForm({ ...form, clienteId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clientesList?.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.razaoSocial}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tipo de Documento */}
      <div>
        <Label>Tipo de Documento</Label>
        <Select value={form.tipoDocumento} onValueChange={(v: any) => setForm({ ...form, tipoDocumento: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nfe">NFSe (Notas Fiscais de Serviço)</SelectItem>
            <SelectItem value="cte">CT-e (Conhecimento de Transporte)</SelectItem>
            <SelectItem value="ambos">Ambos (NFSe + CT-e)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Período das Notas */}
      <div className="border rounded-lg p-4 bg-muted/20">
        <Label className="flex items-center gap-2 mb-3 font-semibold">
          <Calendar className="h-4 w-4 text-primary" />
          Período das Notas
        </Label>

        {/* Toggle: Data Fixa vs Últimos X dias */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
              form.periodoTipo === "fixo"
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40"
            }`}
            onClick={() => setForm({ ...form, periodoTipo: "fixo" })}
          >
            <CalendarDays className="h-4 w-4" />
            Data Fixa
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
              form.periodoTipo === "relativo"
                ? "border-primary bg-primary/10 text-primary"
                : "border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40"
            }`}
            onClick={() => setForm({ ...form, periodoTipo: "relativo" })}
          >
            <RotateCcw className="h-4 w-4" />
            Últimos X dias
          </button>
        </div>

        {form.periodoTipo === "fixo" ? (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Data Inicial</Label>
                <Input
                  type="date"
                  value={form.dataInicial}
                  onChange={(e) => setForm({ ...form, dataInicial: e.target.value })}
                />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mt-5 shrink-0" />
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Input
                  type="date"
                  value={form.dataFinal}
                  onChange={(e) => setForm({ ...form, dataFinal: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Sempre busca notas de{" "}
              <strong>{formatDateBR(form.dataInicial)}</strong> a{" "}
              <strong>{formatDateBR(form.dataFinal)}</strong>. O período não muda entre execuções.
            </p>
          </>
        ) : (
          <>
            {/* Seleção rápida de dias */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Quantidade de dias para trás</Label>
              <div className="flex flex-wrap gap-2">
                {PERIODOS_RAPIDOS.map((dias) => (
                  <button
                    key={dias}
                    type="button"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      form.periodoDias === dias
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                    onClick={() => setForm({ ...form, periodoDias: dias })}
                  >
                    {dias} dias
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Personalizado:</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.periodoDias}
                  onChange={(e) => setForm({ ...form, periodoDias: parseInt(e.target.value) || 30 })}
                  className="w-24 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">dias</span>
              </div>
            </div>

            {/* Prévia visual do período */}
            {previaRelativo && (
              <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800 dark:text-blue-300">
                      Prévia do período (se executado hoje):
                    </p>
                    <p className="text-blue-700 dark:text-blue-400 mt-1">
                      <strong>{formatDateBR(previaRelativo.dataInicio)}</strong>
                      {" "}a{" "}
                      <strong>{formatDateBR(previaRelativo.dataFim)}</strong>
                      {" "}({form.periodoDias} dias)
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400/80 dark:text-blue-500 mt-1">
                      O período é recalculado automaticamente a cada execução do agendamento.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div>
        <Label>Frequência</Label>
        <Select value={form.frequencia} onValueChange={(v: any) => setForm({ ...form, frequencia: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="diario">Diário</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensal">Mensal (dia fixo)</SelectItem>
            <SelectItem value="dia_util">Por Dia Útil do Mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Horário</Label>
        <Input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
      </div>

      {form.frequencia === "semanal" && (
        <div>
          <Label>Dia da Semana</Label>
          <Select value={String(form.diaSemana)} onValueChange={(v) => setForm({ ...form, diaSemana: parseInt(v) })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {diasSemana.map((d, i) => (
                <SelectItem key={i} value={String(i)}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {form.frequencia === "mensal" && (
        <div>
          <Label>Dia do Mês</Label>
          <Input type="number" min={1} max={31} value={form.diaMes} onChange={(e) => setForm({ ...form, diaMes: parseInt(e.target.value) })} />
        </div>
      )}

      {form.frequencia === "dia_util" && (
        <div className="space-y-4">
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Briefcase className="h-4 w-4" />
              Dia Útil do Mês
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Escolha em qual dia útil o download será executado <strong>todo mês</strong>.
            </p>
            <Select value={String(form.diaUtil)} onValueChange={(v) => setForm({ ...form, diaUtil: parseInt(v) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 23 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}º dia útil</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prévia: próximas execuções */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <Label className="flex items-center gap-2 mb-2 text-sm">
              <Calendar className="h-4 w-4 text-primary" />
              Próximas execuções
              <Badge variant="secondary" className="ml-auto text-xs">Automático</Badge>
            </Label>
            <div className="grid grid-cols-1 gap-1">
              {(() => {
                const now = new Date();
                const previews: { mes: string; dia: number | null; date: Date | null }[] = [];
                let m = now.getMonth() + 1;
                let y = now.getFullYear();
                for (let i = 0; i < 4; i++) {
                  const bds = getBusinessDaysOfMonth(y, m);
                  const bd = bds.find(b => b.businessDayNumber === form.diaUtil);
                  const targetDate = bd ? new Date(y, m - 1, bd.day) : null;
                  // Pular mês atual se o dia útil já passou
                  if (i === 0 && targetDate && targetDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
                    m++;
                    if (m > 12) { m = 1; y++; }
                    continue;
                  }
                  previews.push({
                    mes: `${MONTH_NAMES[m - 1]}/${y}`,
                    dia: bd ? bd.day : null,
                    date: targetDate,
                  });
                  m++;
                  if (m > 12) { m = 1; y++; }
                }
                return previews.slice(0, 3).map((p, idx) => {
                  const dayName = p.date ? DAY_NAMES_SHORT[p.date.getDay()] : "";
                  return (
                    <div key={idx} className={`flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                      idx === 0 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {form.diaUtil}º
                        </span>
                        <span>
                          {p.dia ? `${dayName}, dia ${p.dia}` : "Sem dia útil suficiente"}
                        </span>
                      </div>
                      <span className="text-xs">{p.mes}</span>
                    </div>
                  );
                });
              })()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              O download será executado no <strong>{form.diaUtil}º dia útil de cada mês</strong> às {form.horario}.
              Feriados nacionais e finais de semana são excluídos automaticamente.
            </p>
          </div>
        </div>
      )}

      <Button
        className="w-full"
        onClick={onSubmit}
        disabled={isPending}
      >
        {isPending ? "Salvando..." : submitLabel}
      </Button>
    </div>
  );
}

export default function Agendamentos() {
  const { data: contabilidades } = trpc.contabilidade.list.useQuery();
  const [selectedContab, setSelectedContab] = useState<string>("");
  const contabId = selectedContab ? parseInt(selectedContab) : contabilidades?.[0]?.id;

  const { data: clientesList } = trpc.cliente.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const { data: agendamentos, isLoading } = trpc.agendamento.list.useQuery(
    contabId ? { contabilidadeId: contabId } : undefined,
    { enabled: !!contabId }
  );

  const utils = trpc.useUtils();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState<FormState>(getDefaultForm());
  const [editForm, setEditForm] = useState<FormState>(getDefaultForm());

  const createMutation = trpc.agendamento.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      utils.agendamento.list.invalidate();
      setCreateOpen(false);
      setCreateForm(getDefaultForm());
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.agendamento.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado com sucesso!");
      utils.agendamento.list.invalidate();
      setEditOpen(false);
      setEditingId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.agendamento.update.useMutation({
    onSuccess: () => {
      toast.success("Agendamento atualizado!");
      utils.agendamento.list.invalidate();
    },
  });

  const deleteMutation = trpc.agendamento.delete.useMutation({
    onSuccess: () => {
      toast.success("Agendamento removido!");
      utils.agendamento.list.invalidate();
    },
  });

  const freqLabel = (f: string) => {
    switch (f) {
      case "diario": return "Diário";
      case "semanal": return "Semanal";
      case "mensal": return "Mensal";
      case "dia_util": return "Dia Útil";
      default: return f;
    }
  };

  const freqColor = (f: string) => {
    switch (f) {
      case "diario": return "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-500/25";
      case "semanal": return "bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/25";
      case "mensal": return "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-500/25";
      case "dia_util": return "bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25";
      default: return "";
    }
  };

  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  const handleCreate = () => {
    if (!contabId) return;
    createMutation.mutate({
      contabilidadeId: contabId,
      clienteId: createForm.clienteId !== "all" ? parseInt(createForm.clienteId) : null,
      frequencia: createForm.frequencia,
      horario: createForm.horario,
      diaSemana: createForm.frequencia === "semanal" ? createForm.diaSemana : undefined,
      diaMes: createForm.frequencia === "mensal" ? createForm.diaMes : undefined,
      diaUtil: createForm.frequencia === "dia_util" ? createForm.diaUtil : undefined,
      mesAlvo: undefined, // dia_util agora roda todo mês automaticamente
      periodoTipo: createForm.periodoTipo,
      periodoDias: createForm.periodoTipo === "relativo" ? createForm.periodoDias : undefined,
      dataInicial: createForm.periodoTipo === "fixo" ? createForm.dataInicial : undefined,
      dataFinal: createForm.periodoTipo === "fixo" ? createForm.dataFinal : undefined,
      tipoDocumento: createForm.tipoDocumento,
    });
  };

  const handleEdit = (a: any) => {
    setEditingId(a.id);
    setEditForm({
      clienteId: a.clienteId ? String(a.clienteId) : "all",
      frequencia: a.frequencia,
      horario: a.horario || "02:00",
      diaSemana: a.diaSemana ?? 1,
      diaMes: a.diaMes ?? 1,
      diaUtil: a.diaUtil ?? 1,
      mesAlvo: a.mesAlvo ?? new Date().getMonth() + 1,
      dataInicial: a.dataInicial || "",
      dataFinal: a.dataFinal || "",
      periodoTipo: a.periodoTipo || "fixo",
      periodoDias: a.periodoDias || 30,
      tipoDocumento: a.tipoDocumento || "nfe",
    });
    setEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      clienteId: editForm.clienteId !== "all" ? parseInt(editForm.clienteId) : null,
      frequencia: editForm.frequencia,
      horario: editForm.horario,
      diaSemana: editForm.frequencia === "semanal" ? editForm.diaSemana : undefined,
      diaMes: editForm.frequencia === "mensal" ? editForm.diaMes : undefined,
      diaUtil: editForm.frequencia === "dia_util" ? editForm.diaUtil : undefined,
      mesAlvo: undefined, // dia_util agora roda todo mês automaticamente
      periodoTipo: editForm.periodoTipo,
      periodoDias: editForm.periodoTipo === "relativo" ? editForm.periodoDias : undefined,
      dataInicial: editForm.periodoTipo === "fixo" ? editForm.dataInicial : undefined,
      dataFinal: editForm.periodoTipo === "fixo" ? editForm.dataFinal : undefined,
      tipoDocumento: editForm.tipoDocumento,
    });
  };

  const getDetalhe = (a: any) => {
    if (a.frequencia === "semanal" && a.diaSemana != null) return diasSemana[a.diaSemana];
    if (a.frequencia === "mensal" && a.diaMes) return `Dia ${a.diaMes}`;
    if (a.frequencia === "dia_util") {
      return `${a.diaUtil}º dia útil de cada mês`;
    }
    if (a.frequencia === "diario") return "Todo dia";
    return "-";
  };

  const getPeriodo = (a: any) => {
    if (a.periodoTipo === "relativo" && a.periodoDias) {
      // Calcular prévia para exibição
      const previa = calcularPreviaRelativo(a.periodoDias);
      return (
        <span className="flex flex-col">
          <span className="flex items-center gap-1">
            <RotateCcw className="h-3 w-3 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-700 dark:text-blue-400">Últimos {a.periodoDias} dias</span>
          </span>
          <span className="text-xs text-muted-foreground">
            Hoje: {formatDateBR(previa.dataInicio)} a {formatDateBR(previa.dataFim)}
          </span>
        </span>
      );
    }
    if (a.dataInicial && a.dataFinal) {
      return `${formatDateBR(a.dataInicial)} a ${formatDateBR(a.dataFinal)}`;
    }
    if (a.dataInicial) return `A partir de ${formatDateBR(a.dataInicial)}`;
    if (a.dataFinal) return `Até ${formatDateBR(a.dataFinal)}`;
    return "Todas as notas";
  };

  const getSubmitLabel = (form: FormState) => {
    if (form.periodoTipo === "relativo") {
      return `Últimos ${form.periodoDias} dias`;
    }
    return `${formatDateBR(form.dataInicial)} a ${formatDateBR(form.dataFinal)}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agendamentos</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure downloads automáticos programados</p>
          </div>
          <div className="flex gap-2">
            {contabilidades && contabilidades.length > 1 && (
              <Select value={selectedContab || String(contabilidades[0]?.id ?? "")} onValueChange={setSelectedContab}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Contabilidade" />
                </SelectTrigger>
                <SelectContent>
                  {contabilidades.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Dialog Criar */}
            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateForm(getDefaultForm()); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Novo Agendamento</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento de Download</DialogTitle>
                </DialogHeader>
                <AgendamentoForm
                  form={createForm}
                  setForm={setCreateForm}
                  clientesList={clientesList}
                  onSubmit={handleCreate}
                  isPending={createMutation.isPending}
                  submitLabel={`Criar Agendamento — ${getSubmitLabel(createForm)}`}
                />
              </DialogContent>
            </Dialog>

            {/* Dialog Editar */}
            <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditingId(null); }}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Editar Agendamento</DialogTitle>
                </DialogHeader>
                <AgendamentoForm
                  form={editForm}
                  setForm={setEditForm}
                  clientesList={clientesList}
                  onSubmit={handleUpdate}
                  isPending={updateMutation.isPending}
                  submitLabel={`Salvar Alterações — ${getSubmitLabel(editForm)}`}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Agendamentos Configurados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Detalhe</TableHead>
                  <TableHead>Período das Notas</TableHead>
                  <TableHead>Última Execução</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-[90px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : !agendamentos || agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="font-medium">Nenhum agendamento configurado</p>
                      <p className="text-sm text-muted-foreground mt-1">Crie um agendamento para downloads automáticos.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((a) => {
                    const cliente = clientesList?.find((c) => c.id === a.clienteId);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{cliente?.razaoSocial || "Todos os Clientes"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={a.tipoDocumento === "cte" ? "border-orange-500 text-orange-400" : a.tipoDocumento === "ambos" ? "border-purple-500 text-purple-400" : "border-blue-500 text-blue-400"}>
                            {a.tipoDocumento === "cte" ? "CT-e" : a.tipoDocumento === "ambos" ? "NFSe + CT-e" : "NFSe"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={freqColor(a.frequencia)}>
                            {freqLabel(a.frequencia)}
                          </Badge>
                        </TableCell>
                        <TableCell>{a.horario}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getDetalhe(a)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getPeriodo(a)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.ultimaExecucao ? new Date(a.ultimaExecucao).toLocaleString("pt-BR") : "Nunca"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={a.ativo}
                            onCheckedChange={(checked) => toggleMutation.mutate({ id: a.id, ativo: checked })}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                              title="Editar agendamento"
                              onClick={() => handleEdit(a)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              title="Excluir agendamento"
                              onClick={() => deleteMutation.mutate({ id: a.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
