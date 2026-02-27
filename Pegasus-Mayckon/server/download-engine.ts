/**
 * Download Engine v3 - Worker Pool Simples e Robusto
 * 
 * Abordagem: N workers consumindo de uma fila compartilhada.
 * Cada worker pega a próxima tarefa, executa, e pega a seguinte.
 * Sem delays artificiais, sem semáforo complexo.
 * 
 * Resolve:
 * - Downloads travados "Na Fila" (0 em execução)
 * - Concorrência configurável (1 a 10 workers)
 * - Timeout por empresa
 * - Circuit breaker para 429
 * - Status atualizado em tempo real
 */

import * as db from "./db";

// ─── Circuit Breaker para Rate Limiting (429) ─────────────────────
class CircuitBreaker {
  private pauseUntil = 0;
  private failures = 0;

  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    if (now < this.pauseUntil) {
      const wait = this.pauseUntil - now;
      console.log(`[CircuitBreaker] Aguardando ${Math.round(wait / 1000)}s antes de continuar...`);
      await sleep(wait);
    }
  }

  trigger429(): void {
    this.failures++;
    // Backoff: 5s, 10s, 20s, 30s, 30s...
    const pauseMs = Math.min(5000 * Math.pow(2, this.failures - 1), 30000);
    this.pauseUntil = Date.now() + pauseMs;
    console.log(`[CircuitBreaker] 429 detectado! Pausa de ${pauseMs}ms (falha #${this.failures})`);
  }

  onSuccess(): void {
    if (this.failures > 0) this.failures = Math.max(0, this.failures - 1);
  }
}

const globalCB = new CircuitBreaker();
export function getCircuitBreaker(): CircuitBreaker { return globalCB; }

// ─── Helpers ──────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise
      .then(v => { clearTimeout(timer); resolve(v); })
      .catch(e => { clearTimeout(timer); reject(e); });
  });
}

// ─── Tipos ────────────────────────────────────────────────────────
export interface DownloadTask {
  clienteId: number;
  cnpj: string;
  razaoSocial: string;
  logId: number;
}

export interface DownloadEngineConfig {
  maxConcurrency: number;
  timeoutPerEmpresa: number;
  delayBetweenStarts: number;
  timeoutDinamico: boolean;
  delayEntrePdfs: number;
  delayEntrePaginas: number;
  maxRodadasRetomada: number;
  pularPdfErro: boolean;
}

// ─── Ler configuração ─────────────────────────────────────────────
export async function getDownloadConfig(): Promise<DownloadEngineConfig> {
  // Ler concorrência: prioridade para max_empresas_simultaneas, default 3
  let maxConcurrency = 3;
  const concSetting = await db.getSetting("max_empresas_simultaneas");
  if (concSetting) {
    maxConcurrency = Math.max(1, Math.min(10, parseInt(concSetting) || 3));
  }

  // Timeout por empresa (default 3 min - reduzido para não travar)
  const timeoutSetting = await db.getSetting("timeout_por_empresa");
  const timeoutPerEmpresa = timeoutSetting
    ? Math.max(60000, parseInt(timeoutSetting) * 1000)
    : 180000;

  // Delay entre empresas (intervalo entre starts) - reduzido para 500ms
  const modoSetting = await db.getSetting("modo_download") || "sequencial";
  let delayBetweenStarts = 500;
  if (modoSetting.includes(":")) {
    const parts = modoSetting.split(":");
    const delaySec = parseInt(parts[parts.length - 1]) || 1;
    delayBetweenStarts = Math.max(300, Math.min(10000, delaySec * 1000));
  }

  // Timeout dinâmico (default: true)
  const timeoutDinSetting = await db.getSetting("timeout_dinamico");
  const timeoutDinamico = timeoutDinSetting !== "false";

  // Delay entre PDFs (default: 500ms)
  const delayPdfsSetting = await db.getSetting("delay_entre_pdfs");
  const delayEntrePdfs = delayPdfsSetting
    ? Math.max(0, Math.min(5000, parseInt(delayPdfsSetting) || 500))
    : 500;

  // Delay entre páginas da API (default: 300ms)
  const delayPagsSetting = await db.getSetting("delay_entre_paginas");
  const delayEntrePaginas = delayPagsSetting
    ? Math.max(0, Math.min(5000, parseInt(delayPagsSetting) || 300))
    : 300;

  // Máximo de rodadas da auto-retomada (default: 3)
  const maxRodadasSetting = await db.getSetting("max_rodadas_retomada");
  const maxRodadasRetomada = maxRodadasSetting
    ? Math.max(1, Math.min(10, parseInt(maxRodadasSetting) || 3))
    : 3;

  // Pular PDFs com erro na retomada (default: false)
  const pularPdfSetting = await db.getSetting("pular_pdf_erro_retomada");
  const pularPdfErro = pularPdfSetting === "true";

  return { maxConcurrency, timeoutPerEmpresa, delayBetweenStarts, timeoutDinamico, delayEntrePdfs, delayEntrePaginas, maxRodadasRetomada, pularPdfErro };
}

// ─── Status tracking ──────────────────────────────────────────────
interface EngineStatus {
  total: number;
  concluidas: number;
  erros: number;
  executando: number;
  naFila: number;
  iniciadoEm: number;
  finalizadoEm?: number;
  activeLogIds?: number[];
}

// ─── Download Engine: Worker Pool ─────────────────────────────────
export async function runDownloadEngine(
  tasks: DownloadTask[],
  contabId: number,
  workerFn: (task: DownloadTask) => Promise<void>,
  config: DownloadEngineConfig,
  onTaskComplete?: (task: DownloadTask, success: boolean, stats: { concluidas: number; erros: number; total: number }) => void | Promise<void>,
): Promise<void> {
  if (tasks.length === 0) return;

  const queue = [...tasks]; // cópia da fila
  let nextIndex = 0; // próximo índice a ser processado
  let concluidas = 0;
  let erros = 0;
  let executando = 0;
  const activeLogIds: Set<number> = new Set(); // IDs dos logs ativos
  const startTime = Date.now();

  const statusKey = `download_engine_status_${contabId}`;

  const saveStatus = async () => {
    const status: EngineStatus = {
      total: tasks.length,
      concluidas,
      erros,
      executando,
      naFila: Math.max(0, tasks.length - nextIndex - executando),
      iniciadoEm: startTime,
      activeLogIds: Array.from(activeLogIds),
    };
    await db.upsertSetting(statusKey, JSON.stringify(status)).catch(() => {});
  };

  console.log(`[DownloadEngine] ▶ Iniciando: ${tasks.length} empresa(s), ${config.maxConcurrency} worker(s), timeout=${Math.round(config.timeoutPerEmpresa / 1000)}s`);
  await saveStatus();

  // Worker: pega próxima tarefa da fila e executa
  const worker = async (workerId: number): Promise<void> => {
    while (true) {
      // Pegar próxima tarefa da fila
      const idx = nextIndex;
      if (idx >= queue.length) break; // fila vazia
      nextIndex++;

      const task = queue[idx];

      // Verificar cancelamento individual
      try {
        const cancelled = await db.isDownloadCancelled(task.logId);
        if (cancelled) {
          console.log(`[Worker ${workerId}] ${task.razaoSocial} - cancelado, pulando`);
          continue;
        }
      } catch (_) {}
      // Verificar flag global de cancelamento
      try {
        const globalCancel = await db.getSetting(`cancel_all_flag_${contabId}`);
        if (globalCancel === "true") {
          console.log(`[Worker ${workerId}] Cancelamento global detectado, parando worker`);
          break;
        }
      } catch (_) {}

      // Aguardar circuit breaker
      await globalCB.waitIfNeeded();

      // Marcar como executando
      executando++;
      activeLogIds.add(task.logId);
      await saveStatus();

      // Atualizar log para "executando" antes de chamar workerFn
      try {
        await db.updateDownloadLog(task.logId, {
          status: "executando",
          etapa: `Iniciando download... (worker ${workerId})`,
        });
      } catch (_) {}

      const taskNum = idx + 1;
      console.log(`[Worker ${workerId}] ▶ #${taskNum}/${tasks.length} ${task.razaoSocial} (${task.cnpj})`);

      try {
        await withTimeout(
          workerFn(task),
          config.timeoutPerEmpresa,
          `Timeout: download de ${task.razaoSocial} excedeu ${Math.round(config.timeoutPerEmpresa / 1000)}s`
        );

        globalCB.onSuccess();
        concluidas++;
        console.log(`[Worker ${workerId}] ✓ #${taskNum} ${task.razaoSocial} concluído [${concluidas}/${tasks.length}]`);
        if (onTaskComplete) try { await onTaskComplete(task, true, { concluidas, erros, total: tasks.length }); } catch (_) {}
      } catch (error: any) {
        erros++;
        const errMsg = error.message || String(error);

        if (errMsg.includes("429") || errMsg.includes("Too Many Requests")) {
          globalCB.trigger429();
        }

        console.error(`[Worker ${workerId}] ✗ #${taskNum} ${task.razaoSocial}: ${errMsg}`);
        if (onTaskComplete) try { await onTaskComplete(task, false, { concluidas, erros, total: tasks.length }); } catch (_) {}

        // Atualizar log com erro se workerFn não fez isso
        try {
          const logs = await db.getDownloadLogsByContabilidade(contabId, 500);
          const currentLog = logs.find((l: any) => l.id === task.logId);
          if (currentLog && currentLog.status !== "erro" && currentLog.status !== "concluido") {
            await db.updateDownloadLog(task.logId, {
              status: "erro",
              erro: errMsg.length > 200 ? errMsg.substring(0, 197) + "..." : errMsg,
              etapa: "Erro no processamento",
              finalizadoEm: new Date(),
            });
          }
        } catch (_) {}
      } finally {
        executando--;
        activeLogIds.delete(task.logId);
        await saveStatus();
      }

      // Pequeno delay entre tarefas para não sobrecarregar a API
      if (nextIndex < queue.length) {
        await sleep(Math.min(config.delayBetweenStarts, 1000));
      }
    }
  };

  // Criar N workers em paralelo
  const numWorkers = Math.min(config.maxConcurrency, tasks.length);
  console.log(`[DownloadEngine] Criando ${numWorkers} worker(s)...`);

  const workers: Promise<void>[] = [];
  for (let i = 1; i <= numWorkers; i++) {
    // Delay escalonado entre workers para não bater tudo junto na API
    if (i > 1) {
      await sleep(500); // 500ms entre cada worker iniciar
    }
    workers.push(worker(i));
  }

  // Aguardar todos os workers terminarem
  await Promise.allSettled(workers);

  // Status final
  const finalStatus: EngineStatus = {
    total: tasks.length,
    concluidas,
    erros,
    executando: 0,
    naFila: 0,
    iniciadoEm: startTime,
    finalizadoEm: Date.now(),
  };
  await db.upsertSetting(statusKey, JSON.stringify(finalStatus)).catch(() => {});

  console.log(`[DownloadEngine] ■ Finalizado: ${concluidas} ok, ${erros} erros de ${tasks.length} total`);
}
