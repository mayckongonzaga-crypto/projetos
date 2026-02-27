/**
 * Scheduler Server-Side - Executa agendamentos automaticamente em segundo plano.
 * 
 * Roda via setInterval a cada 60 segundos, verificando se há agendamentos
 * que precisam ser executados. Funciona mesmo com o navegador fechado,
 * pois roda no processo do servidor Node.js.
 * 
 * IMPORTANTE: Todos os cálculos de horário usam fuso horário de Brasília (GMT-3)
 * independente do fuso horário do servidor.
 * 
 * Lógica:
 * 1. Busca todos os agendamentos ativos de todas as contabilidades
 * 2. Para cada agendamento, verifica se está na hora de executar (horário de Brasília)
 * 3. Se sim, dispara o download usando processClienteDownload (mesma engine)
 * 4. Atualiza ultimaExecucao e calcula proximaExecucao
 */

import * as db from "./db";
import { agendamentos } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── Fuso horário de Brasília (GMT-3) ───────────────────────────────
const BRASIL_OFFSET_MS = -3 * 60 * 60 * 1000; // -3 horas em milissegundos

/**
 * Retorna a data/hora atual no fuso horário de Brasília (GMT-3).
 * Cria um Date cujos métodos getHours/getMinutes/getDate/getDay/getMonth/getFullYear
 * retornam valores correspondentes ao horário de Brasília.
 */
function agoraBrasilia(): Date {
  const now = new Date();
  // UTC time + offset de Brasília
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + BRASIL_OFFSET_MS);
}

/**
 * Cria uma data no fuso horário de Brasília.
 * Os parâmetros (year, month, day, hh, mm) são interpretados como horário de Brasília.
 * Retorna um Date UTC que corresponde a esse momento em Brasília.
 */
function dateBrasilia(year: number, month: number, day: number, hh: number, mm: number, ss: number = 0): Date {
  // Criar a data como se fosse UTC, depois ajustar pelo offset de Brasília
  const utcDate = new Date(Date.UTC(year, month, day, hh, mm, ss));
  // Subtrair o offset de Brasília para converter de BRT para UTC
  return new Date(utcDate.getTime() - BRASIL_OFFSET_MS);
}

// ─── Funções de dias úteis (server-side) ────────────────────────────
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

function getNthBusinessDay(year: number, month: number, n: number): number | null {
  const holidays = getHolidaysBR(year);
  const daysInMonth = new Date(year, month, 0).getDate();
  let businessDayCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dateStr = date.toISOString().split("T")[0];
    if (isBusinessDay(date) && !holidays.has(dateStr)) {
      businessDayCount++;
      if (businessDayCount === n) return d;
    }
  }
  return null;
}

// ─── Cálculo de próxima execução (sempre em horário de Brasília) ────
export function calcularProximaExecucao(agendamento: {
  frequencia: string;
  horario: string;
  diaSemana?: number | null;
  diaMes?: number | null;
  diaUtil?: number | null;
  mesAlvo?: number | null;
}, agoraParam?: Date): Date {
  // "now" em horário de Brasília para comparações
  const nowBrt = agoraParam || agoraBrasilia();
  const [hh, mm] = agendamento.horario.split(":").map(Number);

  if (agendamento.frequencia === "diario") {
    // Próximo horário: hoje se ainda não passou, senão amanhã (horário de Brasília)
    const hoje = dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth(), nowBrt.getDate(), hh, mm, 0);
    if (hoje > new Date()) return hoje; // comparar com UTC real
    const amanha = dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth(), nowBrt.getDate() + 1, hh, mm, 0);
    return amanha;
  }

  if (agendamento.frequencia === "semanal" && agendamento.diaSemana != null) {
    const currentDay = nowBrt.getDay();
    let daysUntil = agendamento.diaSemana - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    const target = dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth(), nowBrt.getDate() + daysUntil, hh, mm, 0);
    if (daysUntil === 0 && target <= new Date()) {
      return dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth(), nowBrt.getDate() + 7, hh, mm, 0);
    }
    return target;
  }

  if (agendamento.frequencia === "mensal" && agendamento.diaMes) {
    let target = dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth(), agendamento.diaMes, hh, mm, 0);
    if (target <= new Date()) {
      target = dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth() + 1, agendamento.diaMes, hh, mm, 0);
    }
    return target;
  }

  if (agendamento.frequencia === "dia_util" && agendamento.diaUtil) {
    const targetMonth = agendamento.mesAlvo || (nowBrt.getMonth() + 1);
    let year = nowBrt.getFullYear();
    
    const dayOfMonth = getNthBusinessDay(year, targetMonth, agendamento.diaUtil);
    if (dayOfMonth) {
      const target = dateBrasilia(year, targetMonth - 1, dayOfMonth, hh, mm, 0);
      if (target > new Date()) return target;
    }
    
    if (agendamento.mesAlvo) {
      year++;
      const nextDay = getNthBusinessDay(year, targetMonth, agendamento.diaUtil);
      if (nextDay) return dateBrasilia(year, targetMonth - 1, nextDay, hh, mm, 0);
    } else {
      let nextMonth = nowBrt.getMonth() + 2;
      let nextYear = nowBrt.getFullYear();
      if (nextMonth > 12) { nextMonth = 1; nextYear++; }
      const nextDay = getNthBusinessDay(nextYear, nextMonth, agendamento.diaUtil);
      if (nextDay) return dateBrasilia(nextYear, nextMonth - 1, nextDay, hh, mm, 0);
    }
  }

  // Fallback: amanhã no horário configurado (Brasília)
  return dateBrasilia(nowBrt.getFullYear(), nowBrt.getMonth(), nowBrt.getDate() + 1, hh, mm, 0);
}

// ─── Verificar se agendamento deve executar agora ───────────────────
function deveExecutarAgora(agendamento: any, agoraUtc: Date): boolean {
  if (!agendamento.ativo) return false;

  // Se tem proximaExecucao definida, verificar se já passou (comparação UTC)
  if (agendamento.proximaExecucao) {
    const proxima = new Date(agendamento.proximaExecucao);
    return agoraUtc >= proxima;
  }

  // Se não tem proximaExecucao (agendamento novo), verificar pelo horário de Brasília
  const nowBrt = agoraBrasilia();
  const [hh, mm] = agendamento.horario.split(":").map(Number);
  const horaAgora = nowBrt.getHours();
  const minAgora = nowBrt.getMinutes();

  // Verificar se estamos no minuto certo (margem de 2 minutos)
  const agoraMinutos = horaAgora * 60 + minAgora;
  const alvoMinutos = hh * 60 + mm;
  const diff = agoraMinutos - alvoMinutos;
  if (diff < 0 || diff > 2) return false;

  // Verificar frequência
  if (agendamento.frequencia === "diario") return true;

  if (agendamento.frequencia === "semanal") {
    return nowBrt.getDay() === agendamento.diaSemana;
  }

  if (agendamento.frequencia === "mensal") {
    return nowBrt.getDate() === agendamento.diaMes;
  }

  if (agendamento.frequencia === "dia_util") {
    const targetMonth = agendamento.mesAlvo || (nowBrt.getMonth() + 1);
    if (nowBrt.getMonth() + 1 !== targetMonth) return false;
    const nthDay = getNthBusinessDay(nowBrt.getFullYear(), targetMonth, agendamento.diaUtil);
    return nowBrt.getDate() === nthDay;
  }

  return false;
}

// ─── Executar agendamento ───────────────────────────────────────────
type SchedulerExecutor = (
  contabId: number,
  clienteId: number | null,
  dataInicial?: string | null,
  dataFinal?: string | null,
  periodoTipo?: string | null,
  periodoDias?: number | null,
  tipoDocumento?: string | null,
) => Promise<void>;

let executorFn: SchedulerExecutor | null = null;
let schedulerRunning = false;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

// Track de agendamentos em execução para evitar duplicação
const agendamentosEmExecucao = new Set<number>();
// Lock por contabilidade: impede que dois agendamentos da mesma contabilidade rodem ao mesmo tempo
const contabilidadesEmExecucao = new Set<number>();

export function registerSchedulerExecutor(fn: SchedulerExecutor) {
  executorFn = fn;
}

// ─── Formatar data para log legível (Brasília) ──────────────────────
function fmtBrt(date: Date): string {
  return date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

let firstTickDone = false;

// ─── Tick do scheduler (chamado a cada 60s) ─────────────────────────
async function schedulerTick() {
  if (schedulerRunning) {
    console.log("[Scheduler] Tick anterior ainda em execução, pulando...");
    return;
  }
  schedulerRunning = true;

  try {
    const dbConn = await db.getDb();
    if (!dbConn) {
      console.log("[Scheduler] DB não disponível, pulando tick");
      return;
    }

    // Buscar TODOS os agendamentos ativos
    const todosAgendamentos = await dbConn.select().from(agendamentos)
      .where(eq(agendamentos.ativo, true));

    if (todosAgendamentos.length === 0) {
      console.log("[Scheduler] Nenhum agendamento ativo encontrado");
      return;
    }

    const agora = new Date(); // UTC real para comparação
    const agoraBrt = agoraBrasilia();
    console.log(`[Scheduler] Tick - Hora BRT: ${fmtBrt(agora)} | ${todosAgendamentos.length} agendamento(s) ativo(s)`);
    let executados = 0;

    // No primeiro tick após iniciar, recalcular TODAS as próximas execuções
    // para corrigir possíveis problemas de fuso horário de versões anteriores
    if (!firstTickDone) {
      console.log("[Scheduler] Primeiro tick - recalculando todas as próximas execuções com fuso BRT...");
      for (const ag of todosAgendamentos) {
        const proxima = calcularProximaExecucao(ag);
        await db.updateAgendamento(ag.id, { proximaExecucao: proxima });
        ag.proximaExecucao = proxima;
        console.log(`[Scheduler] Agendamento #${ag.id} (${ag.horario}): próxima execução = ${fmtBrt(proxima)} (BRT) | UTC: ${proxima.toISOString()}`);
      }
      firstTickDone = true;
    }

    for (const ag of todosAgendamentos) {
      try {
        // Se não tem proximaExecucao, calcular e salvar
        if (!ag.proximaExecucao) {
          const proxima = calcularProximaExecucao(ag);
          await db.updateAgendamento(ag.id, { proximaExecucao: proxima });
          ag.proximaExecucao = proxima;
          console.log(`[Scheduler] Agendamento #${ag.id}: próxima execução calculada = ${fmtBrt(proxima)} (BRT)`);
        }

        if (!deveExecutarAgora(ag, agora)) continue;

        // Proteção contra execução duplicada (por agendamento)
        if (agendamentosEmExecucao.has(ag.id)) {
          console.log(`[Scheduler] ⏳ Agendamento #${ag.id} já está em execução, pulando...`);
          continue;
        }

        // Lock por contabilidade: impede downloads simultâneos da mesma contabilidade
        if (contabilidadesEmExecucao.has(ag.contabilidadeId)) {
          console.log(`[Scheduler] 🔒 Contabilidade ${ag.contabilidadeId} já tem download em andamento, adiando agendamento #${ag.id}`);
          continue;
        }

        console.log(`[Scheduler] ▶ Executando agendamento #${ag.id} (contab=${ag.contabilidadeId}, cliente=${ag.clienteId || "todos"}) - Hora BRT: ${fmtBrt(agora)}`);

        if (!executorFn) {
          console.error("[Scheduler] Executor não registrado! Pule este agendamento.");
          continue;
        }

        // Marcar como em execução (agendamento + contabilidade)
        agendamentosEmExecucao.add(ag.id);
        contabilidadesEmExecucao.add(ag.contabilidadeId);

        // Executar download em background
        executorFn(ag.contabilidadeId, ag.clienteId, ag.dataInicial, ag.dataFinal, ag.periodoTipo, ag.periodoDias, (ag as any).tipoDocumento || "nfe")
          .then(() => {
            console.log(`[Scheduler] ✓ Agendamento #${ag.id} concluído com sucesso`);
          })
          .catch((err) => {
            console.error(`[Scheduler] ✗ Agendamento #${ag.id} falhou:`, err.message);
          })
          .finally(() => {
            agendamentosEmExecucao.delete(ag.id);
            contabilidadesEmExecucao.delete(ag.contabilidadeId);
          });

        // Atualizar ultimaExecucao e calcular próxima
        const proximaExecucao = calcularProximaExecucao(ag);
        await db.updateAgendamento(ag.id, {
          ultimaExecucao: agora,
          proximaExecucao: proximaExecucao,
        });

        executados++;
        console.log(`[Scheduler] Agendamento #${ag.id}: próxima execução = ${fmtBrt(proximaExecucao)} (BRT)`);
      } catch (err: any) {
        console.error(`[Scheduler] Erro ao processar agendamento #${ag.id}:`, err.message);
      }
    }

    if (executados > 0) {
      console.log(`[Scheduler] Tick concluído: ${executados} agendamento(s) disparado(s)`);
    }
  } catch (err: any) {
    console.error("[Scheduler] Erro no tick:", err.message);
  } finally {
    schedulerRunning = false;
  }
}

// ─── Iniciar/Parar scheduler ────────────────────────────────────────
export function startScheduler() {
  if (schedulerInterval) {
    console.log("[Scheduler] Já está rodando");
    return;
  }

  const brt = agoraBrasilia();
  console.log(`[Scheduler] Iniciando scheduler server-side (verificação a cada 60s) - Hora BRT: ${fmtBrt(new Date())}`);

  // Executar primeiro tick após 10 segundos (dar tempo pro DB conectar)
  setTimeout(() => {
    schedulerTick().catch(err => console.error("[Scheduler] Erro no primeiro tick:", err.message));
  }, 10000);

  // Depois, verificar a cada 60 segundos
  schedulerInterval = setInterval(() => {
    schedulerTick().catch(err => console.error("[Scheduler] Erro no tick:", err.message));
  }, 60000);

  console.log("[Scheduler] Scheduler ativo - agendamentos serão executados automaticamente (fuso: Brasília GMT-3)");
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[Scheduler] Scheduler parado");
  }
}

// Exportar para testes
export { schedulerTick, deveExecutarAgora, agoraBrasilia, dateBrasilia };
