import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { encrypt, decrypt } from "./crypto";
import { extractPfxCertAndKey } from "./nfse-api";
import { downloadAllCteDocuments, decodeCteXml, parseCteXml, getCodigoUfIbge } from "./cte-api";
import { storagePut } from "./storage";
import { gerarRelatorioCteExcel } from "./cte-excel-report";
import { generateDactePdf } from "./cte-dacte";
import { checkPermissao } from "./routers";
import { sanitizeErrorMessage } from "./error-sanitizer";

// ─── Role-based procedures ──────────────────────────────────────────
const contabilidadeProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "contabilidade" && ctx.user.role !== "usuario")
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito" });
  return next({ ctx });
});

// Helper: get contabilidade ID from user context
async function getContabilidadeId(user: any, inputContabId?: number): Promise<number> {
  if (user.role === "admin") {
    if (inputContabId) return inputContabId;
    const contabs = await db.getContabilidades();
    if (contabs.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma contabilidade cadastrada" });
    return user.contabilidadeId || contabs[0].id;
  }
  if (!user.contabilidadeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não vinculado a uma contabilidade" });
  return user.contabilidadeId;
}

// Helper: check if CT-e is enabled for contabilidade
async function checkCteHabilitado(contabilidadeId: number) {
  const contab = await db.getContabilidadeById(contabilidadeId);
  if (!contab || !contab.cteHabilitado) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O módulo CT-e não está habilitado para esta contabilidade. Solicite ao administrador." });
  }
  return contab;
}

// ═══════════════════════════════════════════════════════════════════
// AUTO-RETOMADA CT-e: Retomar automaticamente downloads com erro
// Mesma lógica da NFe: delay configurável, rodadas, retomada infinita
// ═══════════════════════════════════════════════════════════════════
async function autoRetomarCteDownloadsComErro(contabId: number) {
  try {
    const tempoEspera = await db.getSetting("auto_correcao_tempo_cte") || "00:00:20";
    const partes = tempoEspera.split(":").map(Number);
    const delayMs = ((partes[0] || 0) * 3600 + (partes[1] || 0) * 60 + (partes[2] || 0)) * 1000;

    await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, JSON.stringify({
      fase: "aguardando", tempoEspera, inicioEm: Date.now(), totalErros: 0,
    }));

    if (delayMs > 0) {
      console.log(`[CT-e Auto-Retomada] Aguardando ${tempoEspera} antes de iniciar...`);
      let initDelayRemaining = delayMs;
      while (initDelayRemaining > 0) {
        const chunk = Math.min(initDelayRemaining, 2000);
        await new Promise(r => setTimeout(r, chunk));
        initDelayRemaining -= chunk;
        // Check if all CTE downloads were cancelled
        const allLogs = await db.getCteDownloadLogsByContabilidade(contabId, 500);
        const anyRunning = allLogs.some(l => l.status === "executando" || l.status === "pendente");
        if (anyRunning) continue; // Still processing, keep waiting
      }
    }

    console.log(`[CT-e Auto-Retomada] Iniciando retomada automática para contabilidade ${contabId}`);

    const allLogs = await db.getCteDownloadLogsByContabilidade(contabId, 500);
    const logsComErro = allLogs.filter((l: any) => l.status === "erro" || l.status === "cancelado");

    console.log(`[CT-e Auto-Retomada] Encontrados ${logsComErro.length} download(s) com erro/cancelados`);
    if (logsComErro.length === 0) {
      console.log(`[CT-e Auto-Retomada] Nenhum download para retomar.`);
      await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, "");
      return;
    }

    // Preparar tasks válidas
    type CteRetryTask = { clienteId: number; logId: number; cnpj: string; razaoSocial: string };
    const validTasks: CteRetryTask[] = [];
    for (const log of logsComErro) {
      if (!log.clienteId) {
        await db.updateCteDownloadLog(log.id, { status: "erro", erro: "Sem cliente vinculado", etapa: "Ignorado", finalizadoEm: new Date() });
        continue;
      }
      const cliente = await db.getClienteById(log.clienteId);
      if (!cliente) {
        await db.updateCteDownloadLog(log.id, { status: "erro", erro: "Cliente não encontrado", etapa: "Ignorado", finalizadoEm: new Date() });
        continue;
      }
      validTasks.push({ clienteId: log.clienteId, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId: log.id });
    }

    if (validTasks.length === 0) {
      console.log(`[CT-e Auto-Retomada] Nenhuma task válida para retomar.`);
      await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, "");
      return;
    }

    const retomadaInfinitaSetting = await db.getSetting("retomada_infinita_cte");
    const retomadaInfinita = retomadaInfinitaSetting === "true";
    const MAX_RODADAS = retomadaInfinita ? 999 : 3;
    let pendentes = [...validTasks];
    let totalRetomados = 0;
    let totalFalhas = 0;

    for (let rodada = 1; rodada <= MAX_RODADAS; rodada++) {
      if (pendentes.length === 0) break;

      console.log(`[CT-e Auto-Retomada${retomadaInfinita ? ' INFINITA' : ''}] ===== RODADA ${rodada}: ${pendentes.length} empresa(s) =====`);

      await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, JSON.stringify({
        fase: "retomando", totalErros: logsComErro.length, rodada,
        processados: totalRetomados, retomados: totalRetomados, falhas: totalFalhas,
        pendentes: pendentes.length, retomadaInfinita, maxRodadas: MAX_RODADAS,
      }));

      // Resetar logs dos pendentes
      for (const task of pendentes) {
        await db.updateCteDownloadLog(task.logId, {
          status: "pendente", erro: null, etapa: `Rodada ${rodada}: na fila...`,
          progresso: 0, totalEsperado: 0, totalCtes: 0, ctesNovos: 0,
          certificadoVencido: false, finalizadoEm: null, iniciadoEm: new Date(),
        });
      }

      // Processar com fila concorrente
      const MAX_CONCURRENT = 3;
      let idx = 0;
      const processNext = async (): Promise<void> => {
        if (idx >= pendentes.length) return;
        const i = idx++;
        const task = pendentes[i];
        try {
          const { cert, vencido } = await db.getCertificadoAtivoValido(task.clienteId);
          if (!cert || vencido) {
            await db.updateCteDownloadLog(task.logId, {
              status: "erro", erro: "Certificado inválido ou vencido",
              certificadoVencido: vencido, finalizadoEm: new Date(),
            });
            return processNext();
          }

          await db.updateCteDownloadLog(task.logId, { status: "executando", etapa: "Retomando..." });

          const pfxBase64 = decrypt(cert.certData);
          const senha = decrypt(cert.certSenha);
          const pfxBuffer = Buffer.from(pfxBase64, "base64");
          const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
          const nsuInfo = await db.getCteUltimoNsu(task.clienteId, contabId);
          const cliente = await db.getClienteById(task.clienteId);
          const ufCliente = cliente?.uf || "SP";
          const cUFAutor = getCodigoUfIbge(ufCliente);

          const result = await downloadAllCteDocuments(
            certInfo.cert, certInfo.key, cert.cnpj, nsuInfo.ultimoNsu,
            async (downloaded) => {
              await db.updateCteDownloadLog(task.logId, {
                progresso: downloaded, etapa: `Retomando... ${downloaded} CT-e(s)`,
              });
            },
            { isCancelled: async () => db.isCteDownloadCancelled(task.logId), cUFAutor }
          );

          let ctesNovos = 0;
          const chavesExistentes = await db.getCteChavesExistentes(
            task.clienteId, result.documentos.map(d => d.chaveAcesso).filter(Boolean)
          );
          for (const doc of result.documentos) {
            if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) continue;
            await db.upsertCteNota({
              clienteId: task.clienteId, contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso, nsu: doc.nsu,
              numeroCte: doc.numeroCte, serie: doc.serie, modelo: doc.modelo,
              tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
              direcao: doc.direcao, status: doc.status,
              emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
              emitenteUf: doc.emitenteUf,
              remetenteCnpj: doc.remetenteCnpj, remetenteNome: doc.remetenteNome,
              destinatarioCnpj: doc.destinatarioCnpj, destinatarioNome: doc.destinatarioNome,
              tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
              valorTotal: doc.valorTotal, valorReceber: doc.valorReceber, valorICMS: doc.valorICMS,
              cfop: doc.cfop, natOp: doc.natOp, modal: doc.modal,
              ufInicio: doc.ufInicio, ufFim: doc.ufFim,
              munInicio: doc.munInicio, munFim: doc.munFim,
              produtoPredominante: doc.produtoPredominante, pesoBruto: doc.pesoBruto,
              valorCarga: doc.valorCarga, cstIcms: doc.cstIcms, baseCalcIcms: doc.baseCalcIcms,
              aliqIcms: doc.aliqIcms, rntrc: doc.rntrc, placa: doc.placa,
              protocolo: doc.protocolo, chavesNfe: doc.chavesNfe, observacoes: doc.observacoes,
              remetenteUf: doc.remetenteUf, destinatarioUf: doc.destinatarioUf, tomadorUf: doc.tomadorUf,
              dataEmissao: doc.dataEmissao, xmlOriginal: doc.xmlBase64,
            });
            ctesNovos++;
          }

          await db.upsertCteNsuControl({
            clienteId: task.clienteId, contabilidadeId: contabId,
            cnpj: cert.cnpj, ultimoNsu: result.ultimoNsu,
            maxNsu: result.maxNsu, ultimaConsulta: new Date(),
          });

          await db.updateCteDownloadLog(task.logId, {
            status: "concluido", totalCtes: result.documentos.length, ctesNovos,
            ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
            progresso: result.documentos.length, totalEsperado: result.documentos.length,
            etapa: `Retomado - ${ctesNovos} novo(s)`,
          });
        } catch (error: any) {
          console.error(`[CT-e Auto-Retomada] Erro cliente ${task.clienteId}:`, error);
          await db.updateCteDownloadLog(task.logId, {
            status: "erro", erro: sanitizeErrorMessage(error.message), finalizadoEm: new Date(),
            etapa: "Erro na retomada",
          });
        }
        return processNext();
      };

      const workers = [];
      for (let w = 0; w < Math.min(MAX_CONCURRENT, pendentes.length); w++) {
        workers.push(processNext());
      }
      await Promise.allSettled(workers);

      // Verificar quais concluíram e quais falharam
      const updatedLogs = await db.getCteDownloadLogsByContabilidade(contabId, 500);
      const novosPendentes: CteRetryTask[] = [];
      let rodadaSucesso = 0;

      for (const task of pendentes) {
        const log = updatedLogs.find((l: any) => l.id === task.logId);
        if (log && log.status === "concluido") {
          rodadaSucesso++;
          totalRetomados++;
        } else {
          novosPendentes.push(task);
        }
      }

      totalFalhas = validTasks.length - totalRetomados;
      console.log(`[CT-e Auto-Retomada] Rodada ${rodada}: ${rodadaSucesso} sucesso, ${novosPendentes.length} falharam`);

      if (rodadaSucesso === 0 && novosPendentes.length > 0) {
        if (retomadaInfinita) {
          console.log(`[CT-e Auto-Retomada INFINITA] Rodada ${rodada}: sem melhora, mas continuando...`);
        } else {
          console.log(`[CT-e Auto-Retomada] Nenhuma melhora na rodada ${rodada}. Parando.`);
          for (const task of novosPendentes) {
            const log = updatedLogs.find((l: any) => l.id === task.logId);
            if (log && log.status !== "concluido" && log.status !== "erro") {
              await db.updateCteDownloadLog(task.logId, {
                status: "erro", erro: log?.erro || "Falhou após múltiplas tentativas",
                etapa: `Falhou após ${rodada} rodada(s)`, finalizadoEm: new Date(),
              });
            }
          }
          break;
        }
      }

      pendentes = novosPendentes;

      if (pendentes.length > 0 && rodada < MAX_RODADAS) {
        const delayRodada = retomadaInfinita ? Math.max(delayMs, 15000) : 10000;
        console.log(`[CT-e Auto-Retomada] Aguardando ${delayRodada/1000}s antes da próxima rodada...`);
        let delayRemaining = delayRodada;
        while (delayRemaining > 0) {
          const chunk = Math.min(delayRemaining, 2000);
          await new Promise(r => setTimeout(r, chunk));
          delayRemaining -= chunk;
        }
      }
    }

    // Marcar pendentes finais como erro
    if (pendentes.length > 0) {
      const finalLogs = await db.getCteDownloadLogsByContabilidade(contabId, 500);
      for (const task of pendentes) {
        const log = finalLogs.find((l: any) => l.id === task.logId);
        if (log && log.status !== "concluido" && log.status !== "erro") {
          await db.updateCteDownloadLog(task.logId, {
            status: "erro", erro: log?.erro || "Falhou após todas as rodadas",
            etapa: "Falhou após todas as rodadas", finalizadoEm: new Date(),
          });
        }
      }
    }

    await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, JSON.stringify({
      fase: "concluido", totalErros: logsComErro.length, retomados: totalRetomados,
      falhas: validTasks.length - totalRetomados, finalizadoEm: Date.now(),
    }));

    console.log(`[CT-e Auto-Retomada] CONCLUÍDO: ${totalRetomados} retomado(s), ${validTasks.length - totalRetomados} falha(s)`);

    setTimeout(async () => {
      await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, "");
    }, 30000);
  } catch (error: any) {
    console.error("[CT-e Auto-Retomada] Erro geral:", error.message);
    await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, "");
  }
}

export const cteRouter = router({
  // ═══════════════════════════════════════════════════════════════════
  // VERIFICAR SE CT-e ESTÁ HABILITADO
  // ═══════════════════════════════════════════════════════════════════
  isHabilitado: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      const contab = await db.getContabilidadeById(contabId);
      return { habilitado: !!contab?.cteHabilitado, baixarPdf: !!contab?.cteBaixarPdf };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // CLIENTES COM STATUS DE CERTIFICADO (para tela de downloads CT-e)
  // ═══════════════════════════════════════════════════════════════════
  clientesComStatus: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      await checkCteHabilitado(contabId);
      return db.getClientesComStatusCertificado(contabId);
    }),

  // ═══════════════════════════════════════════════════════════════════
  // DOWNLOAD CT-e POR CLIENTE
  // ═══════════════════════════════════════════════════════════════════
  executeForCliente: contabilidadeProcedure
    .input(z.object({
      clienteId: z.number(),
      contabilidadeId: z.number().optional(),
      modo: z.enum(["novas", "periodo"]).default("novas"),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      const contab = await checkCteHabilitado(contabId);
      const cliente = await db.getClienteById(input.clienteId);
      const { cert, vencido } = await db.getCertificadoAtivoValido(input.clienteId);

      if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum certificado ativo encontrado" });
      if (vencido) {
        await db.createCteDownloadLog({
          clienteId: input.clienteId, contabilidadeId: contabId,
          clienteNome: cliente?.razaoSocial ?? "", clienteCnpj: cliente?.cnpj ?? "",
          tipo: "manual", status: "erro", certificadoVencido: true,
          erro: "Certificado digital vencido - download não realizado",
          finalizadoEm: new Date(),
        });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Certificado digital vencido." });
      }

      const pfxBase64 = decrypt(cert.certData);
      const senha = decrypt(cert.certSenha);
      const pfxBuffer = Buffer.from(pfxBase64, "base64");
      const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);

      // Buscar último NSU do CT-e
      const nsuInfo = await db.getCteUltimoNsu(input.clienteId, contabId);
      const startNsu = input.modo === "novas" ? nsuInfo.ultimoNsu : 0;

      const logId = await db.createCteDownloadLog({
        clienteId: input.clienteId, contabilidadeId: contabId,
        clienteNome: cliente?.razaoSocial ?? "", clienteCnpj: cliente?.cnpj ?? "",
        tipo: "manual", status: "executando", ultimoNsu: startNsu,
      });

      // Registrar auditoria
      await db.createAuditLog({
        contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
        acao: "download_cte", entidade: "cte", entidadeId: input.clienteId,
        detalhes: JSON.stringify({ cliente: cliente?.razaoSocial, cnpj: cliente?.cnpj, modo: input.modo }),
      });

      // Executar download em background (não bloquear a mutation)
      (async () => {
        try {
          await db.updateCteDownloadLog(logId, { etapa: "Consultando CT-e na SEFAZ..." });

          const isPeriodo = input.modo === "periodo" && input.dataInicio;
          // Obter código UF IBGE do cliente para o cUFAutor
          const ufCliente = cliente?.uf || "SP";
          const cUFAutor = getCodigoUfIbge(ufCliente);
          console.log(`[CT-e] Empresa: ${cliente?.razaoSocial}, UF: ${ufCliente}, cUFAutor: ${cUFAutor}`);
          const result = await downloadAllCteDocuments(
            certInfo.cert, certInfo.key, cert.cnpj, startNsu,
            async (downloaded) => {
              await db.updateCteDownloadLog(logId, {
                progresso: downloaded,
                etapa: `Consultando SEFAZ... ${downloaded} CT-e(s) encontrado(s)`,
              });
            },
            {
              dataInicio: isPeriodo ? input.dataInicio : undefined,
              dataFim: isPeriodo ? input.dataFim : undefined,
              isCancelled: async () => db.isCteDownloadCancelled(logId),
              cUFAutor,
            }
          );

          if (result.documentos.length === 0) {
            await db.updateCteDownloadLog(logId, {
              status: "concluido", totalCtes: 0, ctesNovos: 0,
              ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
              progresso: 0, totalEsperado: 0,
              etapa: "Nenhum CT-e encontrado",
            });
            return;
          }

          const totalDocs = result.documentos.length;
          await db.updateCteDownloadLog(logId, {
            totalEsperado: totalDocs, progresso: 0,
            etapa: `Salvando 0/${totalDocs} CT-e(s)...`,
          });

          let ctesNovos = 0;
          const baixarPdf = !!contab.cteBaixarPdf;

          // Verificar quais chaves já existem no banco
          const chavesNovas = result.documentos.map(d => d.chaveAcesso).filter(Boolean);
          const chavesExistentes = await db.getCteChavesExistentes(input.clienteId, chavesNovas);

          for (let i = 0; i < result.documentos.length; i++) {
            const doc = result.documentos[i];
            const wasCancelled = await db.isCteDownloadCancelled(logId);
            if (wasCancelled) break;

            // Pular se já existe
            if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) {
              await db.updateCteDownloadLog(logId, {
                progresso: i + 1,
                etapa: `Processando ${i + 1}/${totalDocs} (já existente)...`,
              });
              continue;
            }

            // Salvar XML do CT-e no S3
            let xmlUrl: string | undefined;
            if (doc.xmlOriginal) {
              try {
                // Decodificar o XML base64+gzip para salvar o XML puro
                const xmlPuro = decodeCteXml(doc.xmlBase64);
                const xmlKey = `cte/${contabId}/${input.clienteId}/${doc.chaveAcesso || `nsu_${doc.nsu}`}.xml`;
                const xmlResult = await storagePut(xmlKey, Buffer.from(xmlPuro, "utf-8"), "application/xml");
                xmlUrl = xmlResult.url;
              } catch (e) {
                console.error(`[CT-e] Erro ao salvar XML no S3:`, e);
              }
            }

            // Salvar nota no banco
            await db.upsertCteNota({
              clienteId: input.clienteId,
              contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso,
              nsu: doc.nsu,
              numeroCte: doc.numeroCte,
              serie: doc.serie,
              modelo: doc.modelo,
              tipoDocumento: doc.tipoDocumento,
              tipoEvento: doc.tipoEvento,
              direcao: doc.direcao,
              status: doc.status,
              emitenteCnpj: doc.emitenteCnpj,
              emitenteNome: doc.emitenteNome,
              emitenteUf: doc.emitenteUf,
              remetenteCnpj: doc.remetenteCnpj,
              remetenteNome: doc.remetenteNome,
              destinatarioCnpj: doc.destinatarioCnpj,
              destinatarioNome: doc.destinatarioNome,
              tomadorCnpj: doc.tomadorCnpj,
              tomadorNome: doc.tomadorNome,
              valorTotal: doc.valorTotal,
              valorReceber: doc.valorReceber,
              valorICMS: doc.valorICMS,
              cfop: doc.cfop,
              natOp: doc.natOp,
              modal: doc.modal,
              ufInicio: doc.ufInicio,
              ufFim: doc.ufFim,
              munInicio: doc.munInicio,
              munFim: doc.munFim,
              produtoPredominante: doc.produtoPredominante,
              pesoBruto: doc.pesoBruto,
              valorCarga: doc.valorCarga,
              cstIcms: doc.cstIcms,
              baseCalcIcms: doc.baseCalcIcms,
              aliqIcms: doc.aliqIcms,
              rntrc: doc.rntrc,
              placa: doc.placa,
              protocolo: doc.protocolo,
              chavesNfe: doc.chavesNfe,
              observacoes: doc.observacoes,
              remetenteUf: doc.remetenteUf,
              destinatarioUf: doc.destinatarioUf,
              tomadorUf: doc.tomadorUf,
              dataEmissao: doc.dataEmissao,
              xmlOriginal: doc.xmlBase64, // Guardar base64 compactado
            });

            ctesNovos++;
            await db.updateCteDownloadLog(logId, {
              progresso: i + 1,
              ctesNovos,
              etapa: `Processando ${i + 1}/${totalDocs} CT-e(s)...`,
            });
          }

          // Atualizar controle de NSU
          await db.upsertCteNsuControl({
            clienteId: input.clienteId,
            contabilidadeId: contabId,
            cnpj: cert.cnpj,
            ultimoNsu: result.ultimoNsu,
            maxNsu: result.maxNsu,
            ultimaConsulta: new Date(),
          });

          await db.updateCteDownloadLog(logId, {
            status: "concluido",
            totalCtes: totalDocs,
            ctesNovos,
            ultimoNsu: result.ultimoNsu,
            finalizadoEm: new Date(),
            progresso: totalDocs,
            totalEsperado: totalDocs,
            etapa: `Concluído - ${ctesNovos} novo(s)`,
          });
        } catch (error: any) {
          console.error(`[CT-e] Erro no download para cliente ${input.clienteId}:`, error);
          await db.updateCteDownloadLog(logId, {
            status: "erro",
            erro: sanitizeErrorMessage(error.message),
            finalizadoEm: new Date(),
            etapa: "Erro no download",
          });
        }
      })();

      return { success: true, logId };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // DOWNLOAD CT-e PARA TODOS OS CLIENTES
  // ═══════════════════════════════════════════════════════════════════
  executeForAll: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      clienteIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await checkCteHabilitado(contabId);

      // Buscar clientes com certificado válido
      const clientes = await db.getClientesComStatusCertificado(contabId);
      const clientesParaBaixar = input.clienteIds
        ? clientes.filter(c => input.clienteIds!.includes(c.id) && c.certStatus === "valido")
        : clientes.filter(c => c.certStatus === "valido");

      if (clientesParaBaixar.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum cliente com certificado válido encontrado" });
      }

      const logIds: number[] = [];
      for (const cliente of clientesParaBaixar) {
        const logId = await db.createCteDownloadLog({
          clienteId: cliente.id, contabilidadeId: contabId,
          clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
          tipo: "manual", status: "pendente",
        });
        logIds.push(logId);
      }

      // Registrar auditoria
      await db.createAuditLog({
        contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
        acao: "download_cte_todos", entidade: "cte",
        detalhes: JSON.stringify({ totalClientes: clientesParaBaixar.length }),
      });

      // Iniciar downloads com fila robusta
      const MAX_CONCURRENT = 3;
      let index = 0;

      const processNext = async (): Promise<void> => {
        if (index >= clientesParaBaixar.length) return;
        const i = index++;
        const cliente = clientesParaBaixar[i];
        const logId = logIds[i];

        try {
          const { cert, vencido } = await db.getCertificadoAtivoValido(cliente.id);
          if (!cert || vencido) {
            await db.updateCteDownloadLog(logId, {
              status: "erro", erro: "Certificado inválido ou vencido",
              certificadoVencido: vencido, finalizadoEm: new Date(),
            });
            // Continuar com o próximo imediatamente
            return processNext();
          }

          await db.updateCteDownloadLog(logId, { status: "executando", etapa: "Iniciando..." });

          const pfxBase64 = decrypt(cert.certData);
          const senha = decrypt(cert.certSenha);
          const pfxBuffer = Buffer.from(pfxBase64, "base64");
          const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
          const nsuInfo = await db.getCteUltimoNsu(cliente.id, contabId);

          const ufCliente = cliente.uf || "SP";
          const cUFAutor = getCodigoUfIbge(ufCliente);
          console.log(`[CT-e] Empresa: ${cliente.razaoSocial}, UF: ${ufCliente}, cUFAutor: ${cUFAutor}`);
          const result = await downloadAllCteDocuments(
            certInfo.cert, certInfo.key, cert.cnpj, nsuInfo.ultimoNsu,
            async (downloaded) => {
              await db.updateCteDownloadLog(logId, {
                progresso: downloaded,
                etapa: `Consultando SEFAZ... ${downloaded} CT-e(s)`,
              });
            },
            { isCancelled: async () => db.isCteDownloadCancelled(logId), cUFAutor }
          );

          let ctesNovos = 0;
          const chavesExistentes = await db.getCteChavesExistentes(
            cliente.id, result.documentos.map(d => d.chaveAcesso).filter(Boolean)
          );

          for (const doc of result.documentos) {
            if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) continue;

            await db.upsertCteNota({
              clienteId: cliente.id, contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso, nsu: doc.nsu,
              numeroCte: doc.numeroCte, serie: doc.serie, modelo: doc.modelo,
              tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
              direcao: doc.direcao, status: doc.status,
              emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
              emitenteUf: doc.emitenteUf,
              remetenteCnpj: doc.remetenteCnpj, remetenteNome: doc.remetenteNome,
              destinatarioCnpj: doc.destinatarioCnpj, destinatarioNome: doc.destinatarioNome,
              tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
              valorTotal: doc.valorTotal, valorReceber: doc.valorReceber, valorICMS: doc.valorICMS,
              cfop: doc.cfop, natOp: doc.natOp, modal: doc.modal,
              ufInicio: doc.ufInicio, ufFim: doc.ufFim,
              munInicio: doc.munInicio, munFim: doc.munFim,
              produtoPredominante: doc.produtoPredominante, pesoBruto: doc.pesoBruto,
              valorCarga: doc.valorCarga, cstIcms: doc.cstIcms, baseCalcIcms: doc.baseCalcIcms,
              aliqIcms: doc.aliqIcms, rntrc: doc.rntrc, placa: doc.placa,
              protocolo: doc.protocolo, chavesNfe: doc.chavesNfe, observacoes: doc.observacoes,
              remetenteUf: doc.remetenteUf, destinatarioUf: doc.destinatarioUf, tomadorUf: doc.tomadorUf,
              dataEmissao: doc.dataEmissao, xmlOriginal: doc.xmlBase64,
            });
            ctesNovos++;
          }

          await db.upsertCteNsuControl({
            clienteId: cliente.id, contabilidadeId: contabId,
            cnpj: cert.cnpj, ultimoNsu: result.ultimoNsu,
            maxNsu: result.maxNsu, ultimaConsulta: new Date(),
          });

          await db.updateCteDownloadLog(logId, {
            status: "concluido", totalCtes: result.documentos.length, ctesNovos,
            ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
            progresso: result.documentos.length, totalEsperado: result.documentos.length,
            etapa: `Concluído - ${ctesNovos} novo(s)`,
          });
        } catch (error: any) {
          console.error(`[CT-e] Erro download cliente ${cliente.id}:`, error);
          await db.updateCteDownloadLog(logId, {
            status: "erro", erro: sanitizeErrorMessage(error.message), finalizadoEm: new Date(),
            etapa: "Erro na retomada",
          });
        }
        // Sempre processar o próximo após terminar (sucesso ou erro)
        return processNext();
      };


      // Iniciar workers concorrentes - cada um processa a fila sequencialmente
      const workers = [];
      for (let i = 0; i < Math.min(MAX_CONCURRENT, clientesParaBaixar.length); i++) {
        workers.push(processNext());
      }
      // Não bloquear - os workers rodam em background
      Promise.allSettled(workers).then(async () => {
        console.log(`[CT-e] Todos os ${clientesParaBaixar.length} downloads finalizados`);
        // Auto-retomada CT-e
        const autoCorrecaoCte = await db.getSetting("auto_correcao_cte");
        if (autoCorrecaoCte === "true") {
          autoRetomarCteDownloadsComErro(contabId);
        }
      });

      return { success: true, totalClientes: clientesParaBaixar.length, logIds };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // STATUS DOS DOWNLOADS EM ANDAMENTO
  // ═══════════════════════════════════════════════════════════════════
  downloadStatus: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verHistoricoCte");
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      return db.getCteDownloadLogsByContabilidade(contabId, 500);
    }),

  // ═══════════════════════════════════════════════════════════════════
  // ATUALIZAR CT-e (BAIXAR APENAS NOVOS - SEM DUPLICIDADE)
  // Usa o último NSU salvo de cada cliente para baixar apenas novos
  // ═══════════════════════════════════════════════════════════════════
  updateAll: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      clienteIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      const contab = await checkCteHabilitado(contabId);

      const clientes = await db.getClientesComStatusCertificado(contabId);
      const clientesParaBaixar = input.clienteIds
        ? clientes.filter(c => input.clienteIds!.includes(c.id) && c.certStatus === "valido")
        : clientes.filter(c => c.certStatus === "valido");

      if (clientesParaBaixar.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum cliente com certificado válido encontrado" });
      }

      // Filtrar clientes que já têm NSU salvo OU que já possuem CT-e no banco
      const clientesComNsu: typeof clientesParaBaixar = [];
      for (const cliente of clientesParaBaixar) {
        const nsuInfo = await db.getCteUltimoNsu(cliente.id, contabId);
        if (nsuInfo.ultimoNsu > 0) {
          clientesComNsu.push(cliente);
        } else {
          // Verificar se tem CT-e no banco (pode ter NSU 0 mas ter notas)
          const count = await db.countCteNotasByCliente(cliente.id, contabId);
          if (count > 0) {
            clientesComNsu.push(cliente);
          }
        }
      }

      if (clientesComNsu.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum cliente possui CT-e baixados anteriormente. Use 'Baixar Todos CT-e' primeiro." });
      }

      const logIds: number[] = [];
      for (const cliente of clientesComNsu) {
        const logId = await db.createCteDownloadLog({
          clienteId: cliente.id, contabilidadeId: contabId,
          clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
          tipo: "manual", status: "pendente",
        });
        logIds.push(logId);
      }

      // Iniciar downloads com fila robusta
      const MAX_CONCURRENT = 3;
      let index = 0;

      const processNext = async (): Promise<void> => {
        if (index >= clientesComNsu.length) return;
        const i = index++;
        const cliente = clientesComNsu[i];
        const logId = logIds[i];

        try {
          const { cert, vencido } = await db.getCertificadoAtivoValido(cliente.id);
          if (!cert || vencido) {
            await db.updateCteDownloadLog(logId, {
              status: "erro", erro: "Certificado inválido ou vencido",
              certificadoVencido: vencido, finalizadoEm: new Date(),
            });
            return processNext();
          }

          await db.updateCteDownloadLog(logId, { status: "executando", etapa: "Atualizando CT-e..." });

          const pfxBase64 = decrypt(cert.certData);
          const senha = decrypt(cert.certSenha);
          const pfxBuffer = Buffer.from(pfxBase64, "base64");
          const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
          const nsuInfo = await db.getCteUltimoNsu(cliente.id, contabId);

          const ufCliente = cliente.uf || "SP";
          const cUFAutor = getCodigoUfIbge(ufCliente);
          console.log(`[CT-e Update] Empresa: ${cliente.razaoSocial}, UF: ${ufCliente}, NSU inicial: ${nsuInfo.ultimoNsu}`);

          const result = await downloadAllCteDocuments(
            certInfo.cert, certInfo.key, cert.cnpj, nsuInfo.ultimoNsu,
            async (downloaded) => {
              await db.updateCteDownloadLog(logId, {
                progresso: downloaded,
                etapa: `Atualizando... ${downloaded} CT-e(s) encontrado(s)`,
              });
            },
            { isCancelled: async () => db.isCteDownloadCancelled(logId), cUFAutor }
          );

          let ctesNovos = 0;
          const chavesExistentes = await db.getCteChavesExistentes(
            cliente.id, result.documentos.map(d => d.chaveAcesso).filter(Boolean)
          );

          for (const doc of result.documentos) {
            if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) continue;

            await db.upsertCteNota({
              clienteId: cliente.id, contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso, nsu: doc.nsu,
              numeroCte: doc.numeroCte, serie: doc.serie, modelo: doc.modelo,
              tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
              direcao: doc.direcao, status: doc.status,
              emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
              emitenteUf: doc.emitenteUf,
              remetenteCnpj: doc.remetenteCnpj, remetenteNome: doc.remetenteNome,
              destinatarioCnpj: doc.destinatarioCnpj, destinatarioNome: doc.destinatarioNome,
              tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
              valorTotal: doc.valorTotal, valorReceber: doc.valorReceber, valorICMS: doc.valorICMS,
              cfop: doc.cfop, natOp: doc.natOp, modal: doc.modal,
              ufInicio: doc.ufInicio, ufFim: doc.ufFim,
              munInicio: doc.munInicio, munFim: doc.munFim,
              produtoPredominante: doc.produtoPredominante, pesoBruto: doc.pesoBruto,
              valorCarga: doc.valorCarga, cstIcms: doc.cstIcms, baseCalcIcms: doc.baseCalcIcms,
              aliqIcms: doc.aliqIcms, rntrc: doc.rntrc, placa: doc.placa,
              protocolo: doc.protocolo, chavesNfe: doc.chavesNfe, observacoes: doc.observacoes,
              remetenteUf: doc.remetenteUf, destinatarioUf: doc.destinatarioUf, tomadorUf: doc.tomadorUf,
              dataEmissao: doc.dataEmissao, xmlOriginal: doc.xmlBase64,
            });
            ctesNovos++;
          }

          await db.upsertCteNsuControl({
            clienteId: cliente.id, contabilidadeId: contabId,
            cnpj: cert.cnpj, ultimoNsu: result.ultimoNsu,
            maxNsu: result.maxNsu, ultimaConsulta: new Date(),
          });

          await db.updateCteDownloadLog(logId, {
            status: "concluido", totalCtes: result.documentos.length, ctesNovos,
            ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
            progresso: result.documentos.length, totalEsperado: result.documentos.length,
            etapa: ctesNovos > 0 ? `Atualizado - ${ctesNovos} novo(s)` : "Sem novos CT-e",
          });
        } catch (error: any) {
          console.error(`[CT-e Update] Erro cliente ${cliente.id}:`, error);
          await db.updateCteDownloadLog(logId, {
            status: "erro", erro: sanitizeErrorMessage(error.message), finalizadoEm: new Date(),
            etapa: "Erro na atualização",
          });
        }
        return processNext();
      };

      const workers = [];
      for (let i = 0; i < Math.min(MAX_CONCURRENT, clientesComNsu.length); i++) {
        workers.push(processNext());
      }
      Promise.allSettled(workers).then(async () => {
        console.log(`[CT-e Update] Todas as ${clientesComNsu.length} atualizações finalizadas`);
        // Auto-retomada CT-e
        const autoCorrecaoCte = await db.getSetting("auto_correcao_cte");
        if (autoCorrecaoCte === "true") {
          autoRetomarCteDownloadsComErro(contabId);
        }
      });

      return { success: true, totalClientes: clientesComNsu.length, logIds };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // CANCELAR DOWNLOAD CT-e
  // ═══════════════════════════════════════════════════════════════════
  cancelDownload: contabilidadeProcedure
    .input(z.object({ logId: z.number(), contabilidadeId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await db.cancelCteDownloadById(input.logId, contabId);
      return { success: true };
    }),

  cancelAllDownloads: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      await db.cancelCteDownloadsEmAndamento(contabId);
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // LIMPAR HISTÓRICO
  // ═══════════════════════════════════════════════════════════════════
  clearHistory: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verHistoricoCte");
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      await db.clearCteDownloadHistory(contabId);
      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // LISTAR NOTAS CT-e
  // ═══════════════════════════════════════════════════════════════════
  notas: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      clienteId: z.number().optional(),
      direcao: z.enum(["emitido", "tomado", "terceiro"]).optional(),
      status: z.enum(["autorizado", "cancelado", "denegado"]).optional(),
      tipoDocumento: z.enum(["CTE", "CTE_OS", "GTVE", "CTE_SIMP", "EVENTO"]).optional(),
      modal: z.enum(["rodoviario", "aereo", "aquaviario", "ferroviario", "dutoviario", "multimodal"]).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
      busca: z.string().optional(),
      limit: z.number().default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verCteNotas");
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      await checkCteHabilitado(contabId);
      return db.getCteNotasByContabilidade(contabId, {
        clienteId: input?.clienteId,
        direcao: input?.direcao,
        status: input?.status,
        tipoDocumento: input?.tipoDocumento,
        modal: input?.modal,
        dataInicio: input?.dataInicio,
        dataFim: input?.dataFim,
        busca: input?.busca,
        limit: input?.limit,
        offset: input?.offset,
      });
    }),

  // ═══════════════════════════════════════════════════════════════════
  // DETALHES DE UMA NOTA CT-e (XML)
  // ═══════════════════════════════════════════════════════════════════
  notaDetalhe: contabilidadeProcedure
    .input(z.object({ chaveAcesso: z.string() }))
    .query(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verCteNotas");
      const nota = await db.getCteNotaByChaveAcesso(input.chaveAcesso);
      if (!nota) throw new TRPCError({ code: "NOT_FOUND", message: "CT-e não encontrado" });

      // Decodificar XML para exibição
      let xmlDecodificado = "";
      if (nota.xmlOriginal) {
        try {
          xmlDecodificado = decodeCteXml(nota.xmlOriginal);
        } catch {
          xmlDecodificado = nota.xmlOriginal;
        }
      }

      return { ...nota, xmlDecodificado };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD / STATS CT-e
  // ═══════════════════════════════════════════════════════════════════
  stats: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      return db.getCteStats(contabId);
    }),

  // ═══════════════════════════════════════════════════════════════════
  // RELATÓRIO CT-e
  // ═══════════════════════════════════════════════════════════════════
  relatorio: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      clienteId: z.number().optional(),
      direcao: z.enum(["emitido", "tomado", "terceiro"]).optional(),
      status: z.enum(["autorizado", "cancelado", "denegado"]).optional(),
      tipoDocumento: z.enum(["CTE", "CTE_OS", "GTVE", "CTE_SIMP", "EVENTO"]).optional(),
      modal: z.enum(["rodoviario", "aereo", "aquaviario", "ferroviario", "dutoviario", "multimodal"]).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verRelatoriosCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await checkCteHabilitado(contabId);
      const notas = await db.getCteNotasForRelatorio(contabId, {
        clienteId: input.clienteId,
        direcao: input.direcao,
        status: input.status,
        tipoDocumento: input.tipoDocumento,
        modal: input.modal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
      });

      // Calcular totais
      let totalValor = 0;
      let totalICMS = 0;
      let totalReceber = 0;
      const porModal: Record<string, { count: number; valor: number }> = {};
      const porUf: Record<string, { count: number; valor: number }> = {};
      const porCliente: Record<string, { nome: string; clienteNome: string; count: number; valor: number; icms: number; receber: number }> = {};

      // Buscar nomes dos clientes (empresas cadastradas) para vincular ao relatório
      const clientesMap = new Map<number, string>();
      const clientesList = await db.getClientesByContabilidade(contabId);
      for (const c of clientesList) {
        clientesMap.set(c.id, c.razaoSocial || c.nomeFantasia || "N/I");
      }
      const porMes: Record<string, { count: number; valor: number }> = {};

      for (const nota of notas) {
        const valor = parseFloat(nota.valorTotal || "0");
        const icms = parseFloat(nota.valorICMS || "0");
        const receber = parseFloat(nota.valorReceber || "0");
        totalValor += valor;
        totalICMS += icms;
        totalReceber += receber;

        // Por modal
        const modalKey = nota.modal || "N/I";
        if (!porModal[modalKey]) porModal[modalKey] = { count: 0, valor: 0 };
        porModal[modalKey].count++;
        porModal[modalKey].valor += valor;

        // Por UF destino
        const ufKey = nota.ufFim || "N/I";
        if (!porUf[ufKey]) porUf[ufKey] = { count: 0, valor: 0 };
        porUf[ufKey].count++;
        porUf[ufKey].valor += valor;

        // Por cliente (emitente)
        const clienteKey = nota.emitenteCnpj || "N/I";
        const clienteNome = clientesMap.get(nota.clienteId) || "N/I";
        if (!porCliente[clienteKey]) porCliente[clienteKey] = { nome: nota.emitenteNome || "N/I", clienteNome, count: 0, valor: 0, icms: 0, receber: 0 };
        porCliente[clienteKey].count++;
        porCliente[clienteKey].valor += valor;
        porCliente[clienteKey].icms += icms;
        porCliente[clienteKey].receber += receber;

        // Por mês
        if (nota.dataEmissao) {
          const d = new Date(nota.dataEmissao);
          const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!porMes[mesKey]) porMes[mesKey] = { count: 0, valor: 0 };
          porMes[mesKey].count++;
          porMes[mesKey].valor += valor;
        }
      }

      return {
        totalCtes: notas.length,
        totalValor,
        totalICMS,
        totalReceber,
        porModal: Object.entries(porModal).map(([modal, data]) => ({ modal, ...data })),
        porUf: Object.entries(porUf).map(([uf, data]) => ({ uf, ...data })).sort((a, b) => b.valor - a.valor),
        porCliente: Object.entries(porCliente).map(([cnpj, data]) => ({ cnpj, ...data })).sort((a, b) => b.valor - a.valor),
        porMes: Object.entries(porMes).map(([mes, data]) => ({ mes, ...data })).sort((a, b) => a.mes.localeCompare(b.mes)),
        notas: notas.slice(0, 500), // Limitar para não sobrecarregar
      };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // DOWNLOAD XML DE UMA NOTA CT-e
  // ═══════════════════════════════════════════════════════════════════
  downloadXml: contabilidadeProcedure
    .input(z.object({ chaveAcesso: z.string() }))
    .query(async ({ ctx, input }) => {
      const nota = await db.getCteNotaByChaveAcesso(input.chaveAcesso);
      if (!nota) throw new TRPCError({ code: "NOT_FOUND", message: "CT-e não encontrado" });

      let xml = "";
      if (nota.xmlOriginal) {
        try {
          xml = decodeCteXml(nota.xmlOriginal);
        } catch {
          xml = nota.xmlOriginal;
        }
      }

      return { xml, chaveAcesso: nota.chaveAcesso, numeroCte: nota.numeroCte };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // CONTAGEM DE CT-e
  // ═══════════════════════════════════════════════════════════════════
  count: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      return db.countCteNotasByContabilidade(contabId);
    }),

  // ═══════════════════════════════════════════════════════════════════
  // GERAR DACTE (PDF) A PARTIR DO XML
  // ═══════════════════════════════════════════════════════════════════
  generateDacte: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      cteNotaId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      // Buscar a nota CT-e
      const nota = await db.getCteNotaById(input.cteNotaId, contabId);
      if (!nota) throw new TRPCError({ code: "NOT_FOUND", message: "CT-e não encontrado" });
      if (!nota.xmlOriginal) throw new TRPCError({ code: "BAD_REQUEST", message: "XML original não disponível para este CT-e" });

      // Se já tem DACTE PDF, retornar URL existente
      if (nota.dactePdfUrl) {
        return { url: nota.dactePdfUrl, cached: true };
      }

      // Decodificar XML (pode estar em base64+gzip)
      let xmlPuro = nota.xmlOriginal;
      try {
        xmlPuro = decodeCteXml(nota.xmlOriginal);
      } catch {
        // Se falhar, usar o XML como está (pode já ser texto puro)
      }

      // Gerar DACTE PDF
      const pdfBuffer = await generateDactePdf(xmlPuro);

      // Upload para S3
      const suffix = Math.random().toString(36).substring(2, 8);
      const fileKey = `dacte/${contabId}/${nota.chaveAcesso}-${suffix}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuffer, "application/pdf");

      // Salvar URL no banco
      await db.updateCteNotaDacteUrl(input.cteNotaId, url, fileKey);

      return { url, cached: false };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTAR RELATÓRIO EXCEL CT-e (com filtros)
  // ═══════════════════════════════════════════════════════════════════
  exportExcel: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      clienteId: z.number().optional(),
      direcao: z.enum(["emitido", "tomado", "terceiro"]).optional(),
      status: z.enum(["autorizado", "cancelado", "denegado"]).optional(),
      tipoDocumento: z.enum(["CTE", "CTE_OS", "GTVE", "CTE_SIMP", "EVENTO"]).optional(),
      modal: z.enum(["rodoviario", "aereo", "aquaviario", "ferroviario", "dutoviario", "multimodal"]).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verRelatoriosCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await checkCteHabilitado(contabId);

      const notas = await db.getCteNotasForRelatorio(contabId, {
        clienteId: input.clienteId,
        direcao: input.direcao,
        status: input.status,
        tipoDocumento: input.tipoDocumento,
        modal: input.modal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
      });

      if (notas.length === 0) return { base64: "", fileName: "", totalNotas: 0, semNotas: true };

      const tipo = input.status ? (input.status === "autorizado" ? "Autorizadas" : input.status === "cancelado" ? "Canceladas" : "Denegadas") : "Todos";
      const xlsx = await gerarRelatorioCteExcel(notas as any, tipo);
      const base64 = Buffer.from(xlsx).toString("base64");
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
      const parts = ["Relatorio_CTe", tipo];
      if (input.clienteId) {
        const clientes = await db.getClientesByContabilidade(contabId);
        const cl = clientes.find((c: any) => c.id === input.clienteId);
        if (cl?.razaoSocial) parts.push(cl.razaoSocial.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "_"));
      }
      if (input.direcao) parts.push(input.direcao);
      parts.push(dateStr);
      return { base64, fileName: `${parts.join("_")}.xlsx`, totalNotas: notas.length };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // EXPORTAR RELATÓRIO PDF CT-e (com filtros)
  // ═══════════════════════════════════════════════════════════════════
  exportPdf: contabilidadeProcedure
    .input(z.object({
      contabilidadeId: z.number().optional(),
      clienteId: z.number().optional(),
      direcao: z.enum(["emitido", "tomado", "terceiro"]).optional(),
      status: z.enum(["autorizado", "cancelado", "denegado"]).optional(),
      tipoDocumento: z.enum(["CTE", "CTE_OS", "GTVE", "CTE_SIMP", "EVENTO"]).optional(),
      modal: z.enum(["rodoviario", "aereo", "aquaviario", "ferroviario", "dutoviario", "multimodal"]).optional(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "verRelatoriosCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await checkCteHabilitado(contabId);

      const notas = await db.getCteNotasForRelatorio(contabId, {
        clienteId: input.clienteId,
        direcao: input.direcao,
        status: input.status,
        tipoDocumento: input.tipoDocumento,
        modal: input.modal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
      });

      if (notas.length === 0) return { base64: "", fileName: "", totalNotas: 0, semNotas: true };

      const { gerarRelatorioCtesPdf } = await import("./cte-pdf-report");
      const tipo = input.status ? (input.status === "autorizado" ? "Autorizadas" : input.status === "cancelado" ? "Canceladas" : "Denegadas") : "Consolidado";

      // Resolve client name for PDF filter display
      let clienteNome: string | undefined;
      if (input.clienteId) {
        const clientes = await db.getClientesByContabilidade(contabId);
        const cl = clientes.find((c: any) => c.id === input.clienteId);
        clienteNome = cl?.razaoSocial || cl?.nomeFantasia || undefined;
      }

      const pdfBuffer = await gerarRelatorioCtesPdf(notas as any, tipo, {
        clienteNome,
        direcao: input.direcao,
        status: input.status,
        modal: input.modal,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
      });
      const base64 = pdfBuffer.toString("base64");
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
      const parts = ["Relatorio_CTe", tipo];
      if (clienteNome) parts.push(clienteNome.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "_"));
      if (input.direcao) parts.push(input.direcao);
      parts.push(dateStr);
      return { base64, fileName: `${parts.join("_")}.pdf`, totalNotas: notas.length };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // RETOMAR DOWNLOAD CT-e INDIVIDUAL (que deu erro)
  // ═══════════════════════════════════════════════════════════════════
  retryOne: contabilidadeProcedure
    .input(z.object({ logId: z.number(), contabilidadeId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      const contab = await checkCteHabilitado(contabId);

      // Buscar o log original para pegar clienteId
      const logs = await db.getCteDownloadLogsByContabilidade(contabId, 500);
      const log = logs.find(l => l.id === input.logId);
      if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Log não encontrado" });
      if (log.status !== "erro") throw new TRPCError({ code: "BAD_REQUEST", message: "Apenas downloads com erro podem ser retomados" });

      const cliente = await db.getClienteById(log.clienteId);
      const { cert, vencido } = await db.getCertificadoAtivoValido(log.clienteId);
      if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum certificado ativo" });
      if (vencido) throw new TRPCError({ code: "BAD_REQUEST", message: "Certificado vencido" });

      // Atualizar o log existente para executando
      await db.updateCteDownloadLog(input.logId, {
        status: "executando", erro: null, finalizadoEm: null,
        etapa: "Retomando download...", progresso: 0,
      });

      // Executar em background
      (async () => {
        try {
          const pfxBase64 = decrypt(cert.certData);
          const senha = decrypt(cert.certSenha);
          const pfxBuffer = Buffer.from(pfxBase64, "base64");
          const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
          const nsuInfo = await db.getCteUltimoNsu(log.clienteId, contabId);

          const ufCliente = cliente?.uf || "SP";
          const cUFAutor = getCodigoUfIbge(ufCliente);
          const result = await downloadAllCteDocuments(
            certInfo.cert, certInfo.key, cert.cnpj, nsuInfo.ultimoNsu,
            async (downloaded) => {
              await db.updateCteDownloadLog(input.logId, {
                progresso: downloaded,
                etapa: `Retomando... ${downloaded} CT-e(s)`,
              });
            },
            { isCancelled: async () => db.isCteDownloadCancelled(input.logId), cUFAutor }
          );

          let ctesNovos = 0;
          const chavesExistentes = await db.getCteChavesExistentes(
            log.clienteId, result.documentos.map(d => d.chaveAcesso).filter(Boolean)
          );

          for (const doc of result.documentos) {
            if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) continue;
            await db.upsertCteNota({
              clienteId: log.clienteId, contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso, nsu: doc.nsu,
              numeroCte: doc.numeroCte, serie: doc.serie, modelo: doc.modelo,
              tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
              direcao: doc.direcao, status: doc.status,
              emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
              emitenteUf: doc.emitenteUf,
              remetenteCnpj: doc.remetenteCnpj, remetenteNome: doc.remetenteNome,
              destinatarioCnpj: doc.destinatarioCnpj, destinatarioNome: doc.destinatarioNome,
              tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
              valorTotal: doc.valorTotal, valorReceber: doc.valorReceber, valorICMS: doc.valorICMS,
              cfop: doc.cfop, natOp: doc.natOp, modal: doc.modal,
              ufInicio: doc.ufInicio, ufFim: doc.ufFim,
              munInicio: doc.munInicio, munFim: doc.munFim,
              produtoPredominante: doc.produtoPredominante, pesoBruto: doc.pesoBruto,
              valorCarga: doc.valorCarga, cstIcms: doc.cstIcms, baseCalcIcms: doc.baseCalcIcms,
              aliqIcms: doc.aliqIcms, rntrc: doc.rntrc, placa: doc.placa,
              protocolo: doc.protocolo, chavesNfe: doc.chavesNfe, observacoes: doc.observacoes,
              remetenteUf: doc.remetenteUf, destinatarioUf: doc.destinatarioUf, tomadorUf: doc.tomadorUf,
              dataEmissao: doc.dataEmissao, xmlOriginal: doc.xmlBase64,
            });
            ctesNovos++;
          }

          await db.upsertCteNsuControl({
            clienteId: log.clienteId, contabilidadeId: contabId,
            cnpj: cert.cnpj, ultimoNsu: result.ultimoNsu,
            maxNsu: result.maxNsu, ultimaConsulta: new Date(),
          });

          await db.updateCteDownloadLog(input.logId, {
            status: "concluido", totalCtes: result.documentos.length, ctesNovos,
            ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
            progresso: result.documentos.length, totalEsperado: result.documentos.length,
            etapa: `Retomado - ${ctesNovos} novo(s)`,
          });
        } catch (error: any) {
          console.error(`[CT-e Retry] Erro:`, error);
          await db.updateCteDownloadLog(input.logId, {
            status: "erro", erro: sanitizeErrorMessage(error.message), finalizadoEm: new Date(),
            etapa: "Erro na retomada",
          });
        }
      })();

      return { success: true };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // RETOMAR TODOS OS DOWNLOADS CT-e COM ERRO
  // ═══════════════════════════════════════════════════════════════════
  retryAll: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
      const contab = await checkCteHabilitado(contabId);

      const logs = await db.getCteDownloadLogsByContabilidade(contabId, 500);
      const erroLogs = logs.filter(l => l.status === "erro");

      if (erroLogs.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum download com erro para retomar" });
      }

      // Marcar todos como pendente
      for (const log of erroLogs) {
        await db.updateCteDownloadLog(log.id, {
          status: "pendente", erro: null, finalizadoEm: null,
          etapa: "Aguardando retomada...", progresso: 0,
        });
      }

      // Fila de processamento
      const MAX_CONCURRENT = 3;
      let index = 0;

      const processNext = async (): Promise<void> => {
        if (index >= erroLogs.length) return;
        const i = index++;
        const log = erroLogs[i];

        try {
          const cliente = await db.getClienteById(log.clienteId);
          const { cert, vencido } = await db.getCertificadoAtivoValido(log.clienteId);
          if (!cert || vencido) {
            await db.updateCteDownloadLog(log.id, {
              status: "erro", erro: "Certificado inválido ou vencido",
              certificadoVencido: vencido, finalizadoEm: new Date(),
            });
            return processNext();
          }

          await db.updateCteDownloadLog(log.id, { status: "executando", etapa: "Retomando..." });

          const pfxBase64 = decrypt(cert.certData);
          const senha = decrypt(cert.certSenha);
          const pfxBuffer = Buffer.from(pfxBase64, "base64");
          const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
          const nsuInfo = await db.getCteUltimoNsu(log.clienteId, contabId);

          const ufCliente = cliente?.uf || "SP";
          const cUFAutor = getCodigoUfIbge(ufCliente);
          const result = await downloadAllCteDocuments(
            certInfo.cert, certInfo.key, cert.cnpj, nsuInfo.ultimoNsu,
            async (downloaded) => {
              await db.updateCteDownloadLog(log.id, {
                progresso: downloaded,
                etapa: `Retomando... ${downloaded} CT-e(s)`,
              });
            },
            { isCancelled: async () => db.isCteDownloadCancelled(log.id), cUFAutor }
          );

          let ctesNovos = 0;
          const chavesExistentes = await db.getCteChavesExistentes(
            log.clienteId, result.documentos.map(d => d.chaveAcesso).filter(Boolean)
          );

          for (const doc of result.documentos) {
            if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) continue;
            await db.upsertCteNota({
              clienteId: log.clienteId, contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso, nsu: doc.nsu,
              numeroCte: doc.numeroCte, serie: doc.serie, modelo: doc.modelo,
              tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
              direcao: doc.direcao, status: doc.status,
              emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
              emitenteUf: doc.emitenteUf,
              remetenteCnpj: doc.remetenteCnpj, remetenteNome: doc.remetenteNome,
              destinatarioCnpj: doc.destinatarioCnpj, destinatarioNome: doc.destinatarioNome,
              tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
              valorTotal: doc.valorTotal, valorReceber: doc.valorReceber, valorICMS: doc.valorICMS,
              cfop: doc.cfop, natOp: doc.natOp, modal: doc.modal,
              ufInicio: doc.ufInicio, ufFim: doc.ufFim,
              munInicio: doc.munInicio, munFim: doc.munFim,
              produtoPredominante: doc.produtoPredominante, pesoBruto: doc.pesoBruto,
              valorCarga: doc.valorCarga, cstIcms: doc.cstIcms, baseCalcIcms: doc.baseCalcIcms,
              aliqIcms: doc.aliqIcms, rntrc: doc.rntrc, placa: doc.placa,
              protocolo: doc.protocolo, chavesNfe: doc.chavesNfe, observacoes: doc.observacoes,
              remetenteUf: doc.remetenteUf, destinatarioUf: doc.destinatarioUf, tomadorUf: doc.tomadorUf,
              dataEmissao: doc.dataEmissao, xmlOriginal: doc.xmlBase64,
            });
            ctesNovos++;
          }

          await db.upsertCteNsuControl({
            clienteId: log.clienteId, contabilidadeId: contabId,
            cnpj: cert.cnpj, ultimoNsu: result.ultimoNsu,
            maxNsu: result.maxNsu, ultimaConsulta: new Date(),
          });

          await db.updateCteDownloadLog(log.id, {
            status: "concluido", totalCtes: result.documentos.length, ctesNovos,
            ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
            progresso: result.documentos.length, totalEsperado: result.documentos.length,
            etapa: `Retomado - ${ctesNovos} novo(s)`,
          });
        } catch (error: any) {
          console.error(`[CT-e RetryAll] Erro cliente ${log.clienteId}:`, error);
          await db.updateCteDownloadLog(log.id, {
            status: "erro", erro: sanitizeErrorMessage(error.message), finalizadoEm: new Date(),
            etapa: "Erro na retomada",
          });
        }
        return processNext();
      };

      const workers = [];
      for (let i = 0; i < Math.min(MAX_CONCURRENT, erroLogs.length); i++) {
        workers.push(processNext());
      }
      Promise.allSettled(workers).then(async () => {
        console.log(`[CT-e RetryAll] Todas as ${erroLogs.length} retomadas finalizadas`);
        // Auto-retomada CT-e
        const autoCorrecaoCte = await db.getSetting("auto_correcao_cte");
        if (autoCorrecaoCte === "true") {
          autoRetomarCteDownloadsComErro(contabId);
        }
      });

      return { success: true, totalRetomados: erroLogs.length };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // GERAR ZIP COM XMLs ORGANIZADOS EM PASTAS POR STATUS + RELATÓRIOS (POR CLIENTE)
  // Pastas: CTe Autorizadas / CTe Canceladas / CTe Denegadas
  // ═══════════════════════════════════════════════════════════════════
  gerarZipCliente: contabilidadeProcedure
    .input(z.object({
      clienteId: z.number(),
      contabilidadeId: z.number().optional(),
      periodoInicio: z.string().optional(),
      periodoFim: z.string().optional(),
      incluirPdf: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await checkCteHabilitado(contabId);

      const cliente = await db.getClienteById(input.clienteId);
      if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });

      const allNotas = await db.getCteNotasForRelatorio(contabId, {
        clienteId: input.clienteId,
        dataInicio: input.periodoInicio,
        dataFim: input.periodoFim,
      });

      if (allNotas.length === 0) return { base64: "", fileName: "", totalNotas: 0, semNotas: true };

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const clienteCnpj = cliente.cnpj?.replace(/\D/g, "") || "";

      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
      const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const nomeEmpresa = cliente.razaoSocial.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
      const pastaRaiz = `CTE_${nomeEmpresa}_${dateStr}_${timeStr}`;

      // Separar notas por STATUS (Autorizadas / Canceladas / Denegadas)
      const autorizadas = allNotas.filter(n => n.status === "autorizado");
      const canceladas = allNotas.filter(n => n.status === "cancelado");
      const denegadas = allNotas.filter(n => n.status === "denegado");

      // Função para adicionar notas a uma pasta
      const usedNames = new Map<string, number>();
      const getUniqueFileName = (base: string, pasta: string): string => {
        const key = `${pasta}/${base}`;
        const count = usedNames.get(key) || 0;
        usedNames.set(key, count + 1);
        return count > 0 ? `${base}_${count}` : base;
      };

      const addNotasToPasta = async (notasList: typeof allNotas, pastaName: string) => {
        for (const nota of notasList) {
          const baseNome = `CTE${nota.numeroCte || "sem-numero"}_${nota.chaveAcesso}`;
          const nomeArquivo = getUniqueFileName(baseNome, pastaName);
          let xmlDecoded = "";
          if (nota.xmlOriginal) {
            try {
              xmlDecoded = decodeCteXml(nota.xmlOriginal);
              zip.file(`${pastaRaiz}/${pastaName}/${nomeArquivo}.xml`, xmlDecoded);
            } catch {
              zip.file(`${pastaRaiz}/${pastaName}/${nomeArquivo}.xml`, nota.xmlOriginal);
            }
          }
          // Incluir DACTE PDF (baixar existente ou gerar on-the-fly) - somente se incluirPdf=true
          if (input.incluirPdf && nota.tipoDocumento !== "EVENTO") {
            try {
              if ((nota as any).dactePdfUrl) {
                const resp = await fetch((nota as any).dactePdfUrl);
                if (resp.ok) {
                  const pdfBuffer = Buffer.from(await resp.arrayBuffer());
                  if (pdfBuffer.length > 4 && pdfBuffer.toString("utf-8", 0, 4) === "%PDF") {
                    zip.file(`${pastaRaiz}/${pastaName}/DACTE/${nomeArquivo}.pdf`, pdfBuffer);
                  }
                }
              } else if (xmlDecoded || nota.xmlOriginal) {
                // Gerar DACTE on-the-fly
                const pdfBuffer = await generateDactePdf(xmlDecoded || nota.xmlOriginal || "");
                if (pdfBuffer.length > 0) {
                  zip.file(`${pastaRaiz}/${pastaName}/DACTE/${nomeArquivo}.pdf`, pdfBuffer);
                }
              }
            } catch (e) {
              console.error(`Erro ao gerar/baixar DACTE para CT-e ${nota.numeroCte}:`, e);
            }
          }
        }
      };

      // Adicionar notas nas pastas por STATUS
      if (autorizadas.length > 0) await addNotasToPasta(autorizadas, "CTe Autorizadas");
      if (canceladas.length > 0) await addNotasToPasta(canceladas, "CTe Canceladas");
      if (denegadas.length > 0) await addNotasToPasta(denegadas, "CTe Denegadas");

      // Gerar relatórios Excel por status
      if (autorizadas.length > 0) {
        const xlsx = await gerarRelatorioCteExcel(autorizadas as any, "Autorizadas", clienteCnpj);
        zip.file(`${pastaRaiz}/Relatorio_CTe_Autorizadas.xlsx`, xlsx);
      }
      if (canceladas.length > 0) {
        const xlsx = await gerarRelatorioCteExcel(canceladas as any, "Canceladas", clienteCnpj);
        zip.file(`${pastaRaiz}/Relatorio_CTe_Canceladas.xlsx`, xlsx);
      }
      if (denegadas.length > 0) {
        const xlsx = await gerarRelatorioCteExcel(denegadas as any, "Denegadas", clienteCnpj);
        zip.file(`${pastaRaiz}/Relatorio_CTe_Denegadas.xlsx`, xlsx);
      }
      // Relatório consolidado
      if (allNotas.length > 0) {
        const xlsx = await gerarRelatorioCteExcel(allNotas as any, "Consolidado", clienteCnpj);
        zip.file(`${pastaRaiz}/Relatorio_CTe_Consolidado.xlsx`, xlsx);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const base64 = zipBuffer.toString("base64");

      return {
        base64,
        fileName: `${pastaRaiz}.zip`,
        totalNotas: allNotas.length,
        autorizadas: autorizadas.length,
        canceladas: canceladas.length,
        denegadas: denegadas.length,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // GERAR ZIP CONSOLIDADO PARA MÚLTIPLOS CLIENTES
  // ═══════════════════════════════════════════════════════════════════
  gerarZipMultiplos: contabilidadeProcedure
    .input(z.object({
      clienteIds: z.array(z.number()),
      contabilidadeId: z.number().optional(),
      periodoInicio: z.string().optional(),
      periodoFim: z.string().optional(),
      incluirPdf: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "fazerDownloadsCte");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      await checkCteHabilitado(contabId);

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
      const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
      const pastaRaiz = `CTE_Consolidado_${dateStr}_${timeStr}`;

      let totalGeral = 0;

      for (const clienteId of input.clienteIds) {
        const cliente = await db.getClienteById(clienteId);
        if (!cliente) continue;

        const allNotas = await db.getCteNotasForRelatorio(contabId, {
          clienteId,
          dataInicio: input.periodoInicio,
          dataFim: input.periodoFim,
        });
        if (allNotas.length === 0) continue;

        totalGeral += allNotas.length;
        const clienteCnpj = cliente.cnpj?.replace(/\D/g, "") || "";
        const nomeEmpresa = cliente.razaoSocial.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
        const pastaEmpresa = `${pastaRaiz}/${nomeEmpresa}`;

        // Separar notas por STATUS (Autorizadas / Canceladas / Denegadas)
        const autorizadas = allNotas.filter(n => n.status === "autorizado");
        const canceladas = allNotas.filter(n => n.status === "cancelado");
        const denegadas = allNotas.filter(n => n.status === "denegado");

        const usedNames = new Map<string, number>();
        const getUniqueFileName = (base: string, pasta: string): string => {
          const key = `${pasta}/${base}`;
          const count = usedNames.get(key) || 0;
          usedNames.set(key, count + 1);
          return count > 0 ? `${base}_${count}` : base;
        };

        const addNotas = async (notasList: typeof allNotas, pastaName: string) => {
          for (const nota of notasList) {
            const baseNome = `CTE${nota.numeroCte || "sem-numero"}_${nota.chaveAcesso}`;
            const nomeArquivo = getUniqueFileName(baseNome, pastaName);
            let xmlDecoded = "";
            if (nota.xmlOriginal) {
              try {
                xmlDecoded = decodeCteXml(nota.xmlOriginal);
                zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.xml`, xmlDecoded);
              } catch {
                zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.xml`, nota.xmlOriginal);
              }
            }
            // Incluir DACTE PDF (baixar existente ou gerar on-the-fly) - somente se incluirPdf=true
            if (input.incluirPdf && nota.tipoDocumento !== "EVENTO") {
              try {
                if (nota.dactePdfUrl) {
                  const resp = await fetch(nota.dactePdfUrl);
                  if (resp.ok) {
                    const pdfBuffer = Buffer.from(await resp.arrayBuffer());
                    if (pdfBuffer.length > 4 && pdfBuffer.toString("utf-8", 0, 4) === "%PDF") {
                      zip.file(`${pastaEmpresa}/${pastaName}/DACTE/${nomeArquivo}.pdf`, pdfBuffer);
                    }
                  }
                } else if (xmlDecoded || nota.xmlOriginal) {
                  const pdfBuffer = await generateDactePdf(xmlDecoded || nota.xmlOriginal || "");
                  if (pdfBuffer.length > 0) {
                    zip.file(`${pastaEmpresa}/${pastaName}/DACTE/${nomeArquivo}.pdf`, pdfBuffer);
                  }
                }
              } catch (e) {
                console.error(`Erro ao gerar/baixar DACTE:`, e);
              }
            }
          }
        };

        if (autorizadas.length > 0) await addNotas(autorizadas, "CTe Autorizadas");
        if (canceladas.length > 0) await addNotas(canceladas, "CTe Canceladas");
        if (denegadas.length > 0) await addNotas(denegadas, "CTe Denegadas");

        // Relatórios por empresa (por status)
        try {
          if (autorizadas.length > 0) {
            const xlsx = await gerarRelatorioCteExcel(autorizadas as any, "Autorizadas", clienteCnpj);
            zip.file(`${pastaEmpresa}/Relatorio_CTe_Autorizadas.xlsx`, xlsx);
          }
          if (canceladas.length > 0) {
            const xlsx = await gerarRelatorioCteExcel(canceladas as any, "Canceladas", clienteCnpj);
            zip.file(`${pastaEmpresa}/Relatorio_CTe_Canceladas.xlsx`, xlsx);
          }
          if (denegadas.length > 0) {
            const xlsx = await gerarRelatorioCteExcel(denegadas as any, "Denegadas", clienteCnpj);
            zip.file(`${pastaEmpresa}/Relatorio_CTe_Denegadas.xlsx`, xlsx);
          }
          if (allNotas.length > 0) {
            const xlsx = await gerarRelatorioCteExcel(allNotas as any, "Consolidado", clienteCnpj);
            zip.file(`${pastaEmpresa}/Relatorio_CTe_Consolidado.xlsx`, xlsx);
          }
        } catch (e) {
          console.error(`Erro ao gerar relatório Excel CT-e para ${nomeEmpresa}:`, e);
        }
      }

      if (totalGeral === 0) return { base64: "", fileName: "", totalNotas: 0, semNotas: true };

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const base64 = zipBuffer.toString("base64");

      return {
        base64,
        fileName: `${pastaRaiz}.zip`,
        totalNotas: totalGeral,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // APAGAR TODOS OS CT-e (sem afetar NFe)
  // ═══════════════════════════════════════════════════════════════════
  deleteAllCte: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "apagarClientes");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      console.log(`[DeleteAllCte] Usuário ${ctx.user.name} solicitou exclusão de todos os CT-e da contabilidade ${contabId}`);
      const result = await db.deleteAllCteByContabilidade(contabId);
      const total = result.cteNotas + result.cteDownloadLogs + result.cteNsuControl;
      await db.createAuditLog({
        contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
        acao: "apagar_todos_cte", entidade: "cte",
        detalhes: JSON.stringify({ cteNotas: result.cteNotas, downloadLogs: result.cteDownloadLogs, nsuControl: result.cteNsuControl }),
      });
      return {
        success: true,
        ...result,
        total,
        message: `${result.cteNotas} CT-e(s), ${result.cteDownloadLogs} log(s) de download e ${result.cteNsuControl} controle(s) NSU apagados.`,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // APAGAR TODOS OS NFe (sem afetar CT-e)
  // ═══════════════════════════════════════════════════════════════════
  deleteAllNfe: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "apagarClientes");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      console.log(`[DeleteAllNfe] Usuário ${ctx.user.name} solicitou exclusão de todas as NFe da contabilidade ${contabId}`);
      const result = await db.deleteAllNfeByContabilidade(contabId);
      const total = result.notas + result.downloadLogs;
      await db.createAuditLog({
        contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
        acao: "apagar_todas_nfe", entidade: "nfe",
        detalhes: JSON.stringify({ notas: result.notas, downloadLogs: result.downloadLogs }),
      });
      return {
        success: true,
        ...result,
        total,
        message: `${result.notas} nota(s) fiscal(is) e ${result.downloadLogs} log(s) de download apagados.`,
      };
    }),

  repopularChavesNfe: contabilidadeProcedure
    .input(z.object({ contabilidadeId: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      checkPermissao(ctx.user, "apagarClientes");
      const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
      console.log(`[RepopularChavesNfe] Usuário ${ctx.user.name} solicitou repopulação de chavesNfe da contabilidade ${contabId}`);
      const result = await db.repopularChavesNfeCte(contabId);
      await db.createAuditLog({
        contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
        acao: "repopular_chaves_nfe", entidade: "cte",
        detalhes: JSON.stringify(result),
      });
      return {
        success: true,
        ...result,
        message: `${result.updated} de ${result.total} CT-e(s) atualizados com chaves NF-e.`,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════
  // BUSCAR NF-e VINCULADAS AO CT-e (verificar se já foram baixadas)
  // ═══════════════════════════════════════════════════════════════════
  lookupNfe: contabilidadeProcedure
    .input(z.object({
      chavesNfe: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      const result = await db.getNotasByChavesAcesso(input.chavesNfe);
      return result.map(n => ({
        id: n.id,
        chaveAcesso: n.chaveAcesso,
        numeroNota: n.numeroNota,
        emitenteNome: n.emitenteNome,
        emitenteCnpj: n.emitenteCnpj,
        tomadorNome: n.tomadorNome,
        tomadorCnpj: n.tomadorCnpj,
        valorServico: n.valorServico,
        dataEmissao: n.dataEmissao,
        status: n.status,
        direcao: n.direcao,
        danfsePdfUrl: n.danfsePdfUrl,
      }));
    }),
});

// ═══════════════════════════════════════════════════════════════════════
// FUNÇÃO EXPORTADA PARA O SCHEDULER
// Permite que o scheduler execute downloads CT-e sem passar pelo tRPC
// ═══════════════════════════════════════════════════════════════════════
export async function executeCteDownloadForScheduler(
  contabId: number,
  clienteId: number | null,
  dataInicial?: string | null,
  dataFinal?: string | null,
) {
  const contab = await db.getContabilidadeById(contabId);
  if (!contab || !contab.cteHabilitado) {
    console.log(`[CT-e Scheduler] CT-e não habilitado para contabilidade ${contabId}`);
    return;
  }

  const clientes = await db.getClientesComStatusCertificado(contabId);
  const clientesParaBaixar = clienteId
    ? clientes.filter(c => c.id === clienteId && c.certStatus === "valido")
    : clientes.filter(c => c.certStatus === "valido");

  if (clientesParaBaixar.length === 0) {
    console.log(`[CT-e Scheduler] Nenhum cliente com certificado válido para contabilidade ${contabId}`);
    return;
  }

  console.log(`[CT-e Scheduler] Iniciando download para ${clientesParaBaixar.length} empresa(s)`);

  const logIds: number[] = [];
  for (const cliente of clientesParaBaixar) {
    const logId = await db.createCteDownloadLog({
      clienteId: cliente.id, contabilidadeId: contabId,
      clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
      tipo: "agendado", status: "pendente",
    });
    logIds.push(logId);
  }

  const MAX_CONCURRENT = 3;
  let index = 0;

  const processNext = async (): Promise<void> => {
    if (index >= clientesParaBaixar.length) return;
    const i = index++;
    const cliente = clientesParaBaixar[i];
    const logId = logIds[i];

    try {
      const { cert, vencido } = await db.getCertificadoAtivoValido(cliente.id);
      if (!cert || vencido) {
        await db.updateCteDownloadLog(logId, {
          status: "erro", erro: "Certificado inválido ou vencido",
          certificadoVencido: vencido, finalizadoEm: new Date(),
        });
        return processNext();
      }

      await db.updateCteDownloadLog(logId, { status: "executando", etapa: "Iniciando..." });

      const pfxBase64 = decrypt(cert.certData);
      const senha = decrypt(cert.certSenha);
      const pfxBuffer = Buffer.from(pfxBase64, "base64");
      const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
      const nsuInfo = await db.getCteUltimoNsu(cliente.id, contabId);

      const ufCliente = cliente.uf || "SP";
      const cUFAutor = getCodigoUfIbge(ufCliente);

      const result = await downloadAllCteDocuments(
        certInfo.cert, certInfo.key, cert.cnpj, nsuInfo.ultimoNsu,
        async (downloaded) => {
          await db.updateCteDownloadLog(logId, {
            progresso: downloaded,
            etapa: `Consultando SEFAZ... ${downloaded} CT-e(s)`,
          });
        },
        {
          dataInicio: dataInicial || undefined,
          dataFim: dataFinal || undefined,
          isCancelled: async () => db.isCteDownloadCancelled(logId),
          cUFAutor,
        }
      );

      let ctesNovos = 0;
      const chavesExistentes = await db.getCteChavesExistentes(
        cliente.id, result.documentos.map(d => d.chaveAcesso).filter(Boolean)
      );

      for (const doc of result.documentos) {
        if (doc.chaveAcesso && chavesExistentes.has(doc.chaveAcesso)) continue;

        await db.upsertCteNota({
          clienteId: cliente.id, contabilidadeId: contabId,
          chaveAcesso: doc.chaveAcesso, nsu: doc.nsu,
          numeroCte: doc.numeroCte, serie: doc.serie, modelo: doc.modelo,
          tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
          direcao: doc.direcao, status: doc.status,
          emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
          emitenteUf: doc.emitenteUf,
          remetenteCnpj: doc.remetenteCnpj, remetenteNome: doc.remetenteNome,
          destinatarioCnpj: doc.destinatarioCnpj, destinatarioNome: doc.destinatarioNome,
          tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
          valorTotal: doc.valorTotal, valorReceber: doc.valorReceber, valorICMS: doc.valorICMS,
          cfop: doc.cfop, natOp: doc.natOp, modal: doc.modal,
          ufInicio: doc.ufInicio, ufFim: doc.ufFim,
          munInicio: doc.munInicio, munFim: doc.munFim,
          produtoPredominante: doc.produtoPredominante, pesoBruto: doc.pesoBruto,
          valorCarga: doc.valorCarga, cstIcms: doc.cstIcms, baseCalcIcms: doc.baseCalcIcms,
          aliqIcms: doc.aliqIcms, rntrc: doc.rntrc, placa: doc.placa,
          protocolo: doc.protocolo, chavesNfe: doc.chavesNfe, observacoes: doc.observacoes,
          remetenteUf: doc.remetenteUf, destinatarioUf: doc.destinatarioUf, tomadorUf: doc.tomadorUf,
          dataEmissao: doc.dataEmissao, xmlOriginal: doc.xmlBase64,
        });
        ctesNovos++;
      }

      await db.upsertCteNsuControl({
        clienteId: cliente.id, contabilidadeId: contabId,
        cnpj: cert.cnpj, ultimoNsu: result.ultimoNsu,
        maxNsu: result.maxNsu, ultimaConsulta: new Date(),
      });

      await db.updateCteDownloadLog(logId, {
        status: "concluido", totalCtes: result.documentos.length, ctesNovos,
        ultimoNsu: result.ultimoNsu, finalizadoEm: new Date(),
        progresso: result.documentos.length, totalEsperado: result.documentos.length,
        etapa: `Concluído - ${ctesNovos} novo(s)`,
      });
    } catch (error: any) {
      console.error(`[CT-e Scheduler] Erro download cliente ${cliente.id}:`, error);
      await db.updateCteDownloadLog(logId, {
            status: "erro", erro: sanitizeErrorMessage(error.message), finalizadoEm: new Date(),
            etapa: "Erro",
      });
    }
    return processNext();
  };

  const workers = [];
  for (let i = 0; i < Math.min(MAX_CONCURRENT, clientesParaBaixar.length); i++) {
    workers.push(processNext());
  }
  await Promise.allSettled(workers);
  console.log(`[CT-e Scheduler] Todos os ${clientesParaBaixar.length} downloads finalizados`);

  // Auto-retomada CT-e após scheduler
  const autoCorrecaoCte = await db.getSetting("auto_correcao_cte");
  if (autoCorrecaoCte === "true") {
    autoRetomarCteDownloadsComErro(contabId);
  }
}
