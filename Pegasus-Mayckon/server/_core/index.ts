import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter, recoverOrphanedDownloads, processClienteDownload } from "../routers";
import { startScheduler, registerSchedulerExecutor } from "../scheduler";
import { runDownloadEngine, getDownloadConfig } from "../download-engine";
import * as db from "../db";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { STORAGE_BASE_DIR } from "../storage";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Serve local storage files (100% local, no external dependencies)
  app.use('/storage', express.static(STORAGE_BASE_DIR));
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Seed Admin fixo no banco (roda a cada startup para garantir que existe)
    setTimeout(async () => {
      try {
        const bcrypt = await import("bcryptjs");
        const { nanoid } = await import("nanoid");
        const adminEmail = "pegasus@lan7.com.br";
        const adminPassword = "g08120812";
        const existing = await db.getUserByEmail(adminEmail);
        if (!existing) {
          const passwordHash = await bcrypt.default.hash(adminPassword, 12);
          const openId = `local_admin_${nanoid(16)}`;
          await db.upsertUser({
            openId,
            name: "Administrador",
            email: adminEmail,
            passwordHash,
            loginMethod: "local",
            role: "admin",
            lastSignedIn: new Date(),
          });
          console.log(`[Seed] Admin criado: ${adminEmail}`);
        } else {
          console.log(`[Seed] Admin já existe: ${adminEmail} (role: ${existing.role})`);
        }
      } catch (err: any) {
        console.error(`[Seed] Erro ao criar admin:`, err.message);
      }
    }, 2000);

    // Recuperar downloads órfãos após restart (aguarda 3s para DB estar pronto)
    setTimeout(() => {
      recoverOrphanedDownloads().catch(err => console.error('[Recovery] Falha:', err.message));
    }, 3000);

    // Recuperar downloads CT-e órfãos após restart
    setTimeout(async () => {
      try {
        const orphanedCte = await db.getOrphanedCteDownloads();
        if (orphanedCte.length > 0) {
          console.log(`[CT-e Recovery] Encontrados ${orphanedCte.length} download(s) CT-e órfão(s). Marcando como erro...`);
          for (const log of orphanedCte) {
            await db.updateCteDownloadLog(log.id, {
              status: "erro",
              erro: "Download interrompido - servidor reiniciado",
              finalizadoEm: new Date(),
              etapa: "Interrompido",
            });
          }
          console.log(`[CT-e Recovery] ${orphanedCte.length} download(s) CT-e marcado(s) como erro.`);
        } else {
          console.log("[CT-e Recovery] Nenhum download CT-e órfão encontrado.");
        }
      } catch (err: any) {
        console.error('[CT-e Recovery] Falha:', err.message);
      }
    }, 4000);

    // Registrar executor do scheduler e iniciar
    // IMPORTANTE: O executor usa EXATAMENTE a mesma lógica do download manual (executeForAll)
    // para garantir que os downloads funcionem da mesma forma.
    registerSchedulerExecutor(async (contabId, clienteId, dataInicial, dataFinal, periodoTipo, periodoDias, tipoDocumento) => {
      const tipo = tipoDocumento || "nfe";
      console.log(`[Scheduler] Tipo de documento: ${tipo}`);
      // Se período relativo, calcular datas dinamicamente a partir da data de execução
      let finalDataInicial = dataInicial;
      let finalDataFinal = dataFinal;
      if (periodoTipo === "relativo" && periodoDias && periodoDias > 0) {
        const hoje = new Date();
        const utcMs = hoje.getTime() + hoje.getTimezoneOffset() * 60000 + (-3 * 60 * 60 * 1000);
        const hojeBrt = new Date(utcMs);
        const dataFimStr = `${hojeBrt.getFullYear()}-${String(hojeBrt.getMonth() + 1).padStart(2, '0')}-${String(hojeBrt.getDate()).padStart(2, '0')}`;
        const dataInicioDate = new Date(hojeBrt);
        dataInicioDate.setDate(dataInicioDate.getDate() - periodoDias);
        const dataIniStr = `${dataInicioDate.getFullYear()}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;
        finalDataInicial = dataIniStr;
        finalDataFinal = dataFimStr;
        console.log(`[Scheduler] Período RELATIVO: últimos ${periodoDias} dias → ${dataIniStr} a ${dataFimStr}`);
      }
      // Construir parâmetros EXATAMENTE como o frontend faz no modo "periodo"
      // O frontend envia: modo, competenciaInicio (YYYY-MM), competenciaFim (YYYY-MM), dataInicio (YYYY-MM-DD), dataFim (YYYY-MM-DD)
      const isPeriodo = !!(finalDataInicial && finalDataFinal);
      const input: {
        modo?: string;
        competenciaInicio?: string;
        competenciaFim?: string;
        dataInicio?: string;
        dataFim?: string;
      } = {};

      if (isPeriodo) {
        // Converter datas YYYY-MM-DD para competência YYYY-MM (igual ao frontend)
        input.competenciaInicio = finalDataInicial!.substring(0, 7); // "2026-01-01" -> "2026-01"
        input.competenciaFim = finalDataFinal!.substring(0, 7);       // "2026-02-17" -> "2026-02"
        input.dataInicio = finalDataInicial!;
        input.dataFim = finalDataFinal!;
        console.log(`[Scheduler] Modo período: competência ${input.competenciaInicio} a ${input.competenciaFim}, datas ${input.dataInicio} a ${input.dataFim}`);
      }

      // ─── Executar download de CT-e ───────────────────────────────
      if (tipo === "cte" || tipo === "ambos") {
        try {
          const { executeCteDownloadForScheduler } = await import("../cte-routers");
          await executeCteDownloadForScheduler(contabId, clienteId, finalDataInicial, finalDataFinal);
          console.log(`[Scheduler] Download CT-e concluído para contabilidade ${contabId}`);
        } catch (err: any) {
          console.error(`[Scheduler] Erro no download CT-e:`, err.message);
        }
      }

      // ─── Executar download de NFe ────────────────────────────────
      if (tipo === "nfe" || tipo === "ambos") {
      if (clienteId) {
        // Download de um cliente específico
        const cliente = await db.getClienteById(clienteId);
        if (!cliente) {
          console.error(`[Scheduler] Cliente ${clienteId} não encontrado`);
          return;
        }
        const logId = await db.createDownloadLog({
          clienteId: cliente.id, contabilidadeId: contabId,
          clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
          tipo: "agendado", status: "pendente",
          etapa: "Agendamento automático - aguardando...",
          modo: isPeriodo ? "periodo" : "novas",
          competenciaInicio: input.competenciaInicio || null,
          competenciaFim: input.competenciaFim || null,
          periodoDataInicio: input.dataInicio || null,
          periodoDataFim: input.dataFim || null,
        });
        // No modo "novas" (incremental), remover logs sem notas novas
        const removeLogSeVazio = !isPeriodo;
        await processClienteDownload(
          { id: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial },
          contabId, isPeriodo, input, logId, removeLogSeVazio,
        );
      } else {
        // Download de TODOS os clientes da contabilidade
        // EXATAMENTE a mesma lógica do executeForAll no routers.ts
        const allClientes = await db.getClientesByContabilidade(contabId);
        const clientesList: typeof allClientes = [];
        for (const c of allClientes) {
          const { cert, vencido } = await db.getCertificadoAtivoValido(c.id);
          if (cert && !vencido) clientesList.push(c);
        }

        // Deduplicar por CNPJ
        const cnpjsSeen = new Set<string>();
        const clientesUnicos: typeof clientesList = [];
        for (const c of clientesList) {
          const cnpjNorm = c.cnpj.replace(/\D/g, '');
          if (!cnpjsSeen.has(cnpjNorm)) {
            cnpjsSeen.add(cnpjNorm);
            clientesUnicos.push(c);
          }
        }

        if (clientesUnicos.length === 0) {
          console.log(`[Scheduler] Nenhum cliente com certificado válido na contabilidade ${contabId}`);
          return;
        }

        console.log(`[Scheduler] Iniciando download para ${clientesUnicos.length} empresa(s) da contabilidade ${contabId}`);

        // PASSO 1: Criar TODOS os logs como "pendente" imediatamente (igual executeForAll)
        const logIds: Array<{ clienteId: number; cnpj: string; razaoSocial: string; logId: number }> = [];
        for (const cliente of clientesUnicos) {
          const logId = await db.createDownloadLog({
            clienteId: cliente.id, contabilidadeId: contabId,
            clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
            tipo: "agendado", status: "pendente",
            etapa: "Agendamento automático - aguardando na fila...",
            modo: isPeriodo ? "periodo" : "novas",
            competenciaInicio: input.competenciaInicio || null,
            competenciaFim: input.competenciaFim || null,
            periodoDataInicio: input.dataInicio || null,
            periodoDataFim: input.dataFim || null,
          });
          logIds.push({ clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId });
        }

        // PASSO 2: Processar usando Download Engine v2 (worker pool) - IGUAL executeForAll
        const config = await getDownloadConfig();
        const tasks = logIds.map(item => ({
          clienteId: item.clienteId, cnpj: item.cnpj,
          razaoSocial: item.razaoSocial, logId: item.logId,
        }));

        // No modo "novas" (incremental), remover logs sem notas novas para não poluir histórico
        const removeLogSeVazioAll = !isPeriodo;
        await runDownloadEngine(tasks, contabId, async (task) => {
          const cliente = clientesUnicos.find(c => c.id === task.clienteId)!;
          await processClienteDownload(cliente, contabId, isPeriodo, input, task.logId, removeLogSeVazioAll);
        }, config);

        // Auto-correção após todos terminarem (igual executeForAll)
        const autoCorrecao = await db.getSetting("auto_correcao_pdf");
        if (autoCorrecao === "true") {
          console.log(`[Scheduler] Iniciando auto-correção para contabilidade ${contabId}`);
        }
        console.log(`[Scheduler] Download NFe concluído: ${clientesUnicos.length} empresa(s) processada(s)`);
      }
      } // fim do if (tipo === "nfe" || tipo === "ambos")
    });

    // Iniciar scheduler após 5 segundos
    setTimeout(() => {
      startScheduler();
    }, 5000);
  });
}

startServer().catch(console.error);
