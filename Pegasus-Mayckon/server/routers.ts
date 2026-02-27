import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { encrypt, decrypt } from "./crypto";
import { parseNfseXmlCompleto, parseNfseXmlCompletoRaw, type NfseCompleta, type NfseCompletaRaw } from "./nfse-xml-parser";
import { gerarRelatorioExcelCompleto } from "./excel-report";
import { extractPfxCertAndKey, downloadAllDocuments, decodeXml, getDanfseUrl, fetchDanfsePdf } from "./nfse-api";
import { storagePut } from "./storage";
import { runDownloadEngine, getDownloadConfig, getCircuitBreaker, type DownloadTask } from "./download-engine";
import { cteRouter } from "./cte-routers";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { hashPassword, verifyPassword } from "./password";
import { notas, certificados, clientes, contabilidades, downloadLogs, agendamentos, planos } from "../drizzle/schema";

// ─── Role-based procedures ──────────────────────────────────────────
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito a administradores" });
  return next({ ctx });
});

const contabilidadeProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "contabilidade" && ctx.user.role !== "usuario")
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito" });
  return next({ ctx });
});

// ─── Permissões granulares ──────────────────────────────────────────
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

const DEFAULT_PERMISSOES: Permissoes = {
  verDashboard: true,
  verClientes: true,
  editarClientes: false,
  apagarClientes: false,
  verCertificados: true,
  gerenciarCertificados: false,
  fazerDownloads: true,
  verHistorico: true,
  gerenciarAgendamentos: false,
  verRelatorios: true,
  gerenciarUsuarios: false,
  gerenciarAuditoria: false,
  // CT-e
  verCteNotas: true,
  fazerDownloadsCte: true,
  verHistoricoCte: true,
  verRelatoriosCte: true,
};

function getUserPermissoes(user: any): Permissoes {
  // Admin e contabilidade têm todas as permissões
  if (user.role === "admin" || user.role === "contabilidade") {
    return {
      verDashboard: true, verClientes: true, editarClientes: true, apagarClientes: true,
      verCertificados: true, gerenciarCertificados: true, fazerDownloads: true,
      verHistorico: true, gerenciarAgendamentos: true, verRelatorios: true,
      gerenciarUsuarios: true, gerenciarAuditoria: true,
      verCteNotas: true, fazerDownloadsCte: true, verHistoricoCte: true, verRelatoriosCte: true,
    };
  }
  // Usuário com permissões granulares
  if (user.permissoes) {
    try {
      return { ...DEFAULT_PERMISSOES, ...JSON.parse(user.permissoes) };
    } catch { return DEFAULT_PERMISSOES; }
  }
  return DEFAULT_PERMISSOES;
}

export function checkPermissao(user: any, permissao: keyof Permissoes) {
  const perms = getUserPermissoes(user);
  if (!perms[permissao]) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Você não tem permissão para: ${permissao}` });
  }
}

// Helper: get contabilidade ID from user context (enforces isolation)
async function getContabilidadeId(user: any, inputContabId?: number): Promise<number> {
  if (user.role === "admin") {
    if (inputContabId) return inputContabId;
    const contabs = await db.getContabilidades();
    if (contabs.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhuma contabilidade cadastrada" });
    return user.contabilidadeId || contabs[0].id;
  }
  // Contabilidade/usuario: ALWAYS use their own contabilidadeId
  if (!user.contabilidadeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário não vinculado a uma contabilidade" });
  return user.contabilidadeId;
}

// Função auxiliar: extrai parâmetros de período salvos no log de download (para retomadas respeitarem o filtro original)
function extractPeriodoFromLog(log: any): { isPeriodo: boolean; input: { competenciaInicio?: string; competenciaFim?: string; dataInicio?: string; dataFim?: string } } {
  const modo = log.modo || "novas";
  const isPeriodo = modo === "periodo" && !!(log.competenciaInicio || log.periodoDataInicio);
  return {
    isPeriodo,
    input: {
      competenciaInicio: log.competenciaInicio || undefined,
      competenciaFim: log.competenciaFim || undefined,
      dataInicio: log.periodoDataInicio || undefined,
      dataFim: log.periodoDataFim || undefined,
    },
  };
}

// Função auxiliar: processa download de uma empresa individual (usada por executeForAll, executeForSelected e scheduler)
// Se preCreatedLogId for fornecido, usa esse log (já criado como "pendente") em vez de criar um novo
// Se removeLogSeVazio for true, remove o log do histórico quando não há notas novas (modo batch incremental)
export async function processClienteDownload(
  cliente: { id: number; cnpj: string; razaoSocial: string },
  contabId: number,
  isPeriodo: boolean | string | undefined | null,
  input: { competenciaInicio?: string; competenciaFim?: string; dataInicio?: string; dataFim?: string },
  preCreatedLogId?: number | null,
  removeLogSeVazio?: boolean,
): Promise<{ clienteId: number; cnpj: string; razaoSocial: string; success: boolean; total?: number; error?: string; vencido?: boolean; removedLog?: boolean }> {
  let logId: number | null = preCreatedLogId || null;
  try {
    const { cert, vencido } = await db.getCertificadoAtivoValido(cliente.id);
    if (!cert) {
      if (logId) {
        await db.updateDownloadLog(logId, {
          status: "concluido", totalNotas: 0, notasNovas: 0, totalXml: 0, totalPdf: 0, errosPdf: 0,
          progresso: 0, totalEsperado: 0,
          etapa: "Sem certificado ativo - download não realizado",
          finalizadoEm: new Date(),
        });
      } else {
        await db.createDownloadLog({
          clienteId: cliente.id, contabilidadeId: contabId,
          clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
          tipo: "manual", status: "concluido",
          totalNotas: 0, notasNovas: 0, totalXml: 0, totalPdf: 0, errosPdf: 0,
          progresso: 0, totalEsperado: 0,
          etapa: "Sem certificado ativo - download não realizado",
          finalizadoEm: new Date(),
        });
      }
      return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: false, error: "Sem certificado ativo" };
    }
    if (vencido) {
      if (logId) {
        await db.updateDownloadLog(logId, {
          status: "erro", certificadoVencido: true,
          erro: "Certificado digital vencido - download pulado",
          etapa: "Certificado vencido",
          finalizadoEm: new Date(),
        });
      } else {
        await db.createDownloadLog({
          clienteId: cliente.id, contabilidadeId: contabId,
          clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
          tipo: "manual", status: "erro", certificadoVencido: true,
          erro: "Certificado digital vencido - download pulado",
          etapa: "Certificado vencido",
          finalizadoEm: new Date(),
        });
      }
      return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: false, error: "Certificado vencido", vencido: true };
    }
    const pfxBase64 = decrypt(cert.certData);
    const senha = decrypt(cert.certSenha);
    const pfxBuffer = Buffer.from(pfxBase64, "base64");
    const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
    const lastNsu = await db.getUltimoNsu(cliente.id);
    if (logId) {
      // Atualizar log pré-criado (pendente/retomando) para "executando"
      await db.updateDownloadLog(logId, { status: "executando", ultimoNsu: lastNsu, etapa: "Consultando notas na API Nacional...", erro: null });
    } else {
      logId = await db.createDownloadLog({
        clienteId: cliente.id, contabilidadeId: contabId,
        clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
        tipo: "manual", status: "executando", ultimoNsu: lastNsu,
        modo: isPeriodo ? "periodo" : "novas",
        competenciaInicio: input.competenciaInicio || null,
        competenciaFim: input.competenciaFim || null,
        periodoDataInicio: input.dataInicio || null,
        periodoDataFim: input.dataFim || null,
      });
      await db.updateDownloadLog(logId!, { etapa: "Consultando notas na API Nacional..." });
    }
    // Para busca por período, calcular NSU inteligente para pular direto ao período
    let smartStartNsu = 0;
    if (isPeriodo) {
      if (input.dataInicio) {
        smartStartNsu = await db.getNsuMinimoPorData(cliente.id, input.dataInicio, input.dataFim);
      } else if (input.competenciaInicio) {
        smartStartNsu = await db.getNsuMinimoPorCompetencia(cliente.id, input.competenciaInicio, input.competenciaFim || input.competenciaInicio);
      }
      if (smartStartNsu > 0) {
        // Subtrair 1 para garantir que pegamos a nota exata
        smartStartNsu = Math.max(1, smartStartNsu - 1);
        console.log(`[Download] ${cliente.razaoSocial}: NSU inteligente = ${smartStartNsu} (período: ${input.competenciaInicio || input.dataInicio})`);
        await db.updateDownloadLog(logId!, { etapa: `Pulando para NSU ${smartStartNsu} (período otimizado)...` });
      } else {
        console.log(`[Download] ${cliente.razaoSocial}: Sem NSU salvo para o período, usando último NSU (${lastNsu})`);
      }
    }
    const docs = await downloadAllDocuments(certInfo.cert, certInfo.key, cert.cnpj, lastNsu + 1,
      async (downloaded) => {
        await db.updateDownloadLog(logId!, { progresso: downloaded, etapa: `Consultando API... ${downloaded} nota(s) encontrada(s)` });
      },
      isPeriodo ? {
        competenciaInicio: input.competenciaInicio,
        competenciaFim: input.competenciaFim || input.competenciaInicio,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
        smartStartNsu: smartStartNsu > 0 ? smartStartNsu : undefined,
        isCancelled: async () => db.isDownloadCancelled(logId!),
      } : undefined
    );
    const totalDocs = docs.length;

    // Se não há notas no período, concluir imediatamente com mensagem clara
    if (totalDocs === 0) {
      // No modo batch incremental, remover o log para não poluir o histórico
      if (removeLogSeVazio && logId) {
        await db.deleteDownloadLog(logId);
        console.log(`[Download] ${cliente.razaoSocial}: Sem notas novas - log removido do histórico`);
        return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: true, total: 0, removedLog: true };
      }
      await db.updateDownloadLog(logId!, {
        status: "concluido", totalNotas: 0, notasNovas: 0,
        totalXml: 0, totalPdf: 0, errosPdf: 0,
        ultimoNsu: lastNsu, finalizadoEm: new Date(),
        progresso: 0, totalEsperado: 0,
        etapa: isPeriodo ? "Nenhuma nota encontrada no período" : "Sem notas novas na API Nacional",
      });
      return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: true, total: 0 };
    }

    const maxTent = parseInt(await db.getSetting("max_tentativas_pdf") || "3", 10);
    const baixarPdfConfig = await db.getSetting("baixar_pdf");
    const baixarPdf = baixarPdfConfig !== "false"; // padrão: true (baixar PDFs)
    let contXml = 0, contPdf = 0, contErrosPdf = 0;

    // ─── SKIP de notas já baixadas ────────────────────────────────────
    // Verificar quais notas já existem no banco para evitar rebaixar na retomada
    await db.updateDownloadLog(logId!, { etapa: `Verificando notas já baixadas...` });
    const todasChaves = docs.map(d => d.chaveAcesso);
    const chavesExistentes = await db.getChavesExistentes(cliente.id, todasChaves);
    const chavesSemPdf = baixarPdf ? await db.getChavesSemPdf(cliente.id, todasChaves) : new Set<string>();
    const jaExistem = chavesExistentes.size;
    
    // Filtrar: manter apenas notas que NÃO existem no banco + notas que existem mas estão sem PDF
    const docsParaBaixar = docs.filter(d => !chavesExistentes.has(d.chaveAcesso));
    const docsParaPdfOnly = baixarPdf ? docs.filter(d => chavesSemPdf.has(d.chaveAcesso)) : [];
    
    const totalNovos = docsParaBaixar.length;
    const totalPdfPendentes = docsParaPdfOnly.length;
    const totalReal = totalNovos + totalPdfPendentes; // total de operações a fazer
    
    if (jaExistem > 0) {
      console.log(`[Download] ${cliente.razaoSocial}: ${jaExistem} nota(s) já baixada(s), ${totalNovos} nova(s) para baixar${totalPdfPendentes > 0 ? `, ${totalPdfPendentes} PDF(s) pendente(s)` : ""}`);
      await db.updateDownloadLog(logId!, { 
        etapa: `${jaExistem} nota(s) já baixada(s), processando ${totalNovos} nova(s)${totalPdfPendentes > 0 ? ` + ${totalPdfPendentes} PDF(s)` : ""}...` 
      });
    }
    
    // Se todas as notas já existem e não há PDFs pendentes, concluir
    if (totalNovos === 0 && totalPdfPendentes === 0) {
      // No modo batch incremental, remover o log para não poluir o histórico
      if (removeLogSeVazio && logId) {
        await db.deleteDownloadLog(logId);
        console.log(`[Download] ${cliente.razaoSocial}: Todas as ${jaExistem} nota(s) já baixadas - log removido do histórico`);
        return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: true, total: totalDocs, removedLog: true };
      }
      await db.updateDownloadLog(logId!, {
        status: "concluido", totalNotas: totalDocs, notasNovas: 0,
        totalXml: jaExistem, totalPdf: jaExistem, errosPdf: 0,
        ultimoNsu: totalDocs > 0 ? Math.max(...docs.map(d => d.nsu)) : lastNsu,
        finalizadoEm: new Date(),
        progresso: totalDocs, totalEsperado: totalDocs,
        etapa: `Concluído - todas as ${jaExistem} nota(s) já estavam baixadas`,
      });
      return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: true, total: totalDocs };
    }
    // ─── FIM SKIP ─────────────────────────────────────────────────────

    await db.updateDownloadLog(logId!, { totalEsperado: totalDocs, progresso: jaExistem, etapa: `Salvando ${jaExistem}/${totalDocs} nota(s)...` });
    let notasNovas = jaExistem; // Começar contando as já existentes no progresso
    const pdfPend: Array<{ doc: typeof docs[0]; index: number }> = [];

    // PASSO 1: Baixar PDFs de notas que já existem mas estão sem PDF
    if (docsParaPdfOnly.length > 0) {
      console.log(`[Download] ${cliente.razaoSocial}: baixando ${docsParaPdfOnly.length} PDF(s) de notas já existentes sem PDF`);
      for (let i = 0; i < docsParaPdfOnly.length; i++) {
        const doc = docsParaPdfOnly[i];
        const wasCancelled = await db.isDownloadCancelled(logId!);
        if (wasCancelled) break;
        if (doc.tipoDocumento === "NFSE" && doc.chaveAcesso) {
          await db.updateDownloadLog(logId!, { etapa: `Baixando PDF pendente ${i + 1}/${docsParaPdfOnly.length}...` });
          try {
            const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, doc.chaveAcesso);
            if (pdfBuffer) {
              const pdfKey = `danfse/${contabId}/${cliente.id}/${doc.chaveAcesso}.pdf`;
              const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
              await db.updateNotaByChave(doc.chaveAcesso, cliente.id, { danfsePdfUrl: result.url, danfsePdfKey: result.key });
              contPdf++;
            }
          } catch (e) {
            console.error(`PDF pendente falhou para ${doc.chaveAcesso}:`, e);
          }
        }
      }
    }

    // PASSO 2: Processar notas NOVAS (que não existem no banco)
    for (let i = 0; i < docsParaBaixar.length; i++) {
      const doc = docsParaBaixar[i];
      const wasCancelled = await db.isDownloadCancelled(logId!);
      if (wasCancelled) break;
      let danfsePdfUrl: string | undefined;
      let danfsePdfKey: string | undefined;
      if (baixarPdf && doc.tipoDocumento === "NFSE" && doc.chaveAcesso) {
        await db.updateDownloadLog(logId!, { etapa: `Baixando PDF ${jaExistem + i + 1}/${totalDocs}...` });
        try {
          const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, doc.chaveAcesso);
          if (pdfBuffer) {
            const pdfKey = `danfse/${contabId}/${cliente.id}/${doc.chaveAcesso}.pdf`;
            const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
            danfsePdfUrl = result.url;
            danfsePdfKey = result.key;
            contPdf++;
          } else {
            pdfPend.push({ doc, index: i });
          }
        } catch (e) {
          console.error(`PDF falhou para ${doc.chaveAcesso}, pulando:`, e);
          pdfPend.push({ doc, index: i });
        }
      }
      await db.updateDownloadLog(logId!, { etapa: `Salvando nota ${jaExistem + i + 1}/${totalDocs}...` });
      try {
        await db.upsertNota({
          clienteId: cliente.id, contabilidadeId: contabId,
          chaveAcesso: doc.chaveAcesso, nsu: doc.nsu, numeroNota: doc.numeroNota || "", serie: doc.serie || "",
          tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento || null,
          direcao: doc.direcao || "emitida", status: doc.status || "valida",
          emitenteCnpj: doc.emitenteCnpj || "", emitenteNome: doc.emitenteNome || "",
          tomadorCnpj: doc.tomadorCnpj || "", tomadorNome: doc.tomadorNome || "",
          valorServico: doc.valorServico || "0", valorLiquido: doc.valorLiquido || "0", valorRetencao: doc.valorRetencao || "0",
          codigoServico: doc.codigoServico || "", descricaoServico: doc.descricaoServico || "",
          dataEmissao: doc.dataEmissao || new Date(), dataCompetencia: doc.dataCompetencia || new Date(),
          municipioPrestacao: doc.municipioPrestacao || "", ufPrestacao: doc.ufPrestacao || "",
          xmlOriginal: doc.xmlOriginal || "",
          ...(danfsePdfUrl ? { danfsePdfUrl, danfsePdfKey } : {}),
        });
        contXml++;
        notasNovas++;
        await db.updateDownloadLog(logId!, { progresso: notasNovas, totalXml: contXml + jaExistem, totalPdf: contPdf, etapa: `Processando ${notasNovas}/${totalDocs} nota(s)...` });
      } catch (e: any) {
        console.error(`[Erro ao Salvar] Nota ${doc.chaveAcesso}: ${e.message}`);
        console.error(`[Erro ao Salvar] Dados da nota:`, JSON.stringify(doc, null, 2));
        throw new Error(`Falha ao salvar nota ${doc.chaveAcesso}: ${e.message}`);
      }
    }
    if (baixarPdf && pdfPend.length > 0) {
      for (let tent = 1; tent <= maxTent; tent++) {
        if (pdfPend.length === 0) break;
        const wasCancelled = await db.isDownloadCancelled(logId!);
        if (wasCancelled) break;
        await db.updateDownloadLog(logId!, { etapa: `Retry ${tent}/${maxTent}: ${pdfPend.length} PDF(s) pendente(s)...` });
        await new Promise(r => setTimeout(r, 1000));
        const ainda: typeof pdfPend = [];
        for (const item of pdfPend) {
          const wasCancelled2 = await db.isDownloadCancelled(logId!);
          if (wasCancelled2) break;
          try {
            await db.updateDownloadLog(logId!, { etapa: `Retry ${tent}/${maxTent}: PDF nota ${item.index + 1}/${totalDocs}...` });
            const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, item.doc.chaveAcesso);
            if (pdfBuffer) {
              const pdfKey = `danfse/${contabId}/${cliente.id}/${item.doc.chaveAcesso}.pdf`;
              const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
              await db.updateNotaByChave(item.doc.chaveAcesso, cliente.id, { danfsePdfUrl: result.url, danfsePdfKey: result.key });
              contPdf++;
            } else {
              ainda.push(item);
            }
          } catch (e) {
            console.error(`Retry ${tent} falhou para ${item.doc.chaveAcesso}:`, e);
            ainda.push(item);
          }
        }
        pdfPend.length = 0;
        pdfPend.push(...ainda);
      }
    }
    contErrosPdf = baixarPdf ? pdfPend.length : 0;
    
    // VALIDAÇÃO CRÍTICA: Garantir que XMLs e PDFs estão em quantidade igual
    const totalXmlFinal = contXml + jaExistem;
    const totalPdfFinal = contPdf;
    const divergencia = baixarPdf ? Math.abs(totalXmlFinal - totalPdfFinal) : 0;
    
    if (baixarPdf && divergencia > 0) {
      console.warn(`[Validação] ${cliente.razaoSocial}: DIVERGÊNCIA DETECTADA - ${totalXmlFinal} XMLs vs ${totalPdfFinal} PDFs (diferença: ${divergencia})`);
      console.warn(`[Validação] Tentando novamente os ${pdfPend.length} PDFs faltantes com retry agressivo...`);
      
      // Retry agressivo final: até 3 tentativas adicionais com delay maior
      for (let finalRetry = 1; finalRetry <= 3 && pdfPend.length > 0; finalRetry++) {
        await db.updateDownloadLog(logId!, { etapa: `Retry final ${finalRetry}/3: ${pdfPend.length} PDF(s) faltando...` });
        await new Promise(r => setTimeout(r, 3000 * finalRetry)); // 3s, 6s, 9s
        
        const ainda: typeof pdfPend = [];
        for (const item of pdfPend) {
          try {
            const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, item.doc.chaveAcesso, 0, 5);
            if (pdfBuffer) {
              const pdfKey = `danfse/${contabId}/${cliente.id}/${item.doc.chaveAcesso}.pdf`;
              const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
              await db.updateNotaByChave(item.doc.chaveAcesso, cliente.id, { danfsePdfUrl: result.url, danfsePdfKey: result.key });
              contPdf++;
              console.log(`[Validação] ${cliente.razaoSocial}: PDF recuperado na tentativa ${finalRetry} - ${item.doc.chaveAcesso}`);
            } else {
              ainda.push(item);
            }
          } catch (e) {
            console.error(`[Validação] Retry final ${finalRetry} falhou para ${item.doc.chaveAcesso}:`, e);
            ainda.push(item);
          }
        }
        pdfPend.length = 0;
        pdfPend.push(...ainda);
      }
      
      contErrosPdf = pdfPend.length;
      const divergenciaFinal = Math.abs(totalXmlFinal - contPdf);
      if (divergenciaFinal > 0) {
        console.error(`[Validação] ${cliente.razaoSocial}: DIVERGÊNCIA FINAL - ${totalXmlFinal} XMLs vs ${contPdf} PDFs (${divergenciaFinal} PDFs ainda faltando)`);
      }
    }
    
    const skipMsg = jaExistem > 0 ? ` (${jaExistem} já existiam)` : "";
    const etapaFinal = baixarPdf && pdfPend.length > 0 
      ? `Concluído (${pdfPend.length} PDF(s) não baixado(s))${skipMsg}` 
      : `Concluído${skipMsg}`;
    // Usar contagem REAL do banco para garantir que mostradores estejam corretos
    const contagemReal = await db.getContagemReaisCliente(cliente.id, contabId);
    const errosPdfReal = contagemReal.totalXml - contagemReal.totalPdf;
    await db.updateDownloadLog(logId!, {
      status: "concluido", totalNotas: totalDocs, notasNovas: notasNovas - jaExistem,
      totalXml: contagemReal.totalXml, totalPdf: contagemReal.totalPdf, errosPdf: errosPdfReal > 0 ? errosPdfReal : 0,
      ultimoNsu: totalDocs > 0 ? Math.max(...docs.map(d => d.nsu)) : lastNsu,
      finalizadoEm: new Date(), progresso: totalDocs, totalEsperado: totalDocs,
      etapa: etapaFinal,
    });
    return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: true, total: totalDocs };
  } catch (error: any) {
    // Identificar tipo de erro e gerar mensagem específica
    const errMsg = error.message || String(error);
    let erroClaro = errMsg;
    if (errMsg.includes("PKCS12") || errMsg.includes("pkcs12") || errMsg.includes("MAC verify")) {
      erroClaro = "Certificado digital inválido ou senha incorreta";
    } else if (errMsg.includes("certificate") || errMsg.includes("SSL") || errMsg.includes("TLS")) {
      erroClaro = "Erro de conexão SSL/TLS com a API Nacional";
    } else if (errMsg.includes("ECONNREFUSED") || errMsg.includes("ENOTFOUND")) {
      erroClaro = "API Nacional indisponível - sem conexão";
    } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
      erroClaro = "Timeout na comunicação com a API Nacional";
    } else if (errMsg.includes("socket disconnected") || errMsg.includes("ECONNRESET")) {
      erroClaro = "Conexão interrompida com a API Nacional";
    } else if (errMsg.includes("401") || errMsg.includes("403")) {
      erroClaro = "Certificado não autorizado na API Nacional";
    } else if (errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503")) {
      erroClaro = "API Nacional retornou erro interno (tente novamente)";
    } else if (errMsg.includes("decrypt") || errMsg.includes("Decrypt")) {
      erroClaro = "Erro ao descriptografar certificado digital";
    }
    // Atualizar o log existente com o erro, em vez de deixar em "executando"
    if (logId) {
      try {
        await db.updateDownloadLog(logId!, {
          status: "erro", erro: erroClaro, etapa: erroClaro,
          finalizadoEm: new Date(),
        });
      } catch (_) { /* ignora erro ao atualizar log */ }
    } else {
      // Se o log não foi criado ainda, criar com status de erro
      try {
        await db.createDownloadLog({
          clienteId: cliente.id, contabilidadeId: contabId,
          clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
          tipo: "manual", status: "erro", erro: erroClaro,
          etapa: erroClaro, finalizadoEm: new Date(),
        });
      } catch (_) { /* ignora erro ao criar log */ }
    }
    return { clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: false, error: erroClaro };
  }
}

// Função de auto-retomada: após todos os downloads terminarem, retoma automaticamente
// as empresas que deram erro usando o Download Engine (workers paralelos).
// LÓGICA: Roda em RODADAS. Cada rodada usa o engine paralelo.
// Empresas que falharem vão pro fim da fila na próxima rodada.
// Repete até zerar ou até nenhuma empresa melhorar (evita loop infinito).
// NUNCA TRAVA: timeout = erro, vai pra próxima.
async function autoRetomarDownloadsComErro(contabId: number) {
  try {
    const tempoEspera = await db.getSetting("auto_correcao_tempo") || "00:00:20";
    const partes = tempoEspera.split(":").map(Number);
    const delayMs = ((partes[0] || 0) * 3600 + (partes[1] || 0) * 60 + (partes[2] || 0)) * 1000;

    await db.upsertSetting(`auto_retomada_status_${contabId}`, JSON.stringify({
      fase: "aguardando", tempoEspera, inicioEm: Date.now(), totalErros: 0,
    }));

    if (delayMs > 0) {
      console.log(`[Auto-Retomada] Aguardando ${tempoEspera} antes de iniciar...`);
      // Delay interruptível: verificar cancelamento a cada 2 segundos
      let initDelayRemaining = delayMs;
      while (initDelayRemaining > 0) {
        const chunk = Math.min(initDelayRemaining, 2000);
        await new Promise(r => setTimeout(r, chunk));
        initDelayRemaining -= chunk;
        const cancelCheck = await db.getSetting(`cancel_all_flag_${contabId}`);
        if (cancelCheck === "true") {
          console.log(`[Auto-Retomada] Cancelamento detectado durante espera inicial!`);
          await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
          return;
        }
      }
    }

    console.log(`[Auto-Retomada] Iniciando retomada automática para contabilidade ${contabId}`);

    const allLogs = await db.getDownloadLogsByContabilidade(contabId, 1000);
    const logsComErro = allLogs.filter((l: any) => l.status === "erro" || l.status === "cancelado");

    console.log(`[Auto-Retomada] Encontrados ${logsComErro.length} download(s) com erro/cancelados`);
    if (logsComErro.length === 0) {
      console.log(`[Auto-Retomada] Nenhum download para retomar.`);
      await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
      return;
    }

    // Preparar tasks válidas
    const validTasks: DownloadTask[] = [];
    for (const log of logsComErro) {
      if (!log.clienteId) {
        await db.updateDownloadLog(log.id, { status: "erro", erro: "Sem cliente vinculado", etapa: "Ignorado", finalizadoEm: new Date() });
        continue;
      }
      const cliente = await db.getClienteById(log.clienteId);
      if (!cliente) {
        await db.updateDownloadLog(log.id, { status: "erro", erro: "Cliente não encontrado", etapa: "Ignorado", finalizadoEm: new Date() });
        continue;
      }
      validTasks.push({ clienteId: log.clienteId, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId: log.id });
    }

    if (validTasks.length === 0) {
      console.log(`[Auto-Retomada] Nenhuma task válida para retomar.`);
      await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
      return;
    }

    // Verificar se retomada infinita está ativada
    const retomadaInfinitaSetting = await db.getSetting("retomada_infinita");
    const retomadaInfinita = retomadaInfinitaSetting === "true";
    const maxRodadasSetting = await db.getSetting("max_rodadas_retomada");
    const MAX_RODADAS = retomadaInfinita ? 999 : Math.max(1, Math.min(10, parseInt(maxRodadasSetting || "3") || 3));
    let pendentes = [...validTasks];
    let totalRetomados = 0;
    let totalFalhas = 0;

    for (let rodada = 1; rodada <= MAX_RODADAS; rodada++) {
      if (pendentes.length === 0) break;
      // Verificar flag de cancelamento global antes de cada rodada
      const cancelFlag = await db.getSetting(`cancel_all_flag_${contabId}`);
      if (cancelFlag === "true") {
        console.log(`[Auto-Retomada] Cancelamento global detectado! Parando auto-retomada.`);
        await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
        return;
      }

      console.log(`[Auto-Retomada${retomadaInfinita ? ' INFINITA' : ''}] ===== RODADA ${rodada}${retomadaInfinita ? ' (infinito)' : '/' + MAX_RODADAS}: ${pendentes.length} empresa(s) =====`);

      await db.upsertSetting(`auto_retomada_status_${contabId}`, JSON.stringify({
        fase: "retomando", totalErros: logsComErro.length, rodada,
        processados: totalRetomados, retomados: totalRetomados, falhas: totalFalhas,
        pendentes: pendentes.length, retomadaInfinita, maxRodadas: MAX_RODADAS,
      }));

      // Resetar logs dos pendentes para "pendente" (na fila)
      // O engine mudará para "executando" quando realmente começar a processar
      for (const task of pendentes) {
        await db.updateDownloadLog(task.logId, {
          status: "pendente", erro: null, etapa: `Rodada ${rodada}: na fila...`,
          progresso: 0, totalEsperado: 0, totalNotas: 0, notasNovas: 0,
          totalXml: 0, totalPdf: 0, errosPdf: 0, certificadoVencido: false,
          finalizadoEm: null, iniciadoEm: new Date(),
        });
      }

      // Rodar Download Engine paralelo com atualização em tempo real
      const config = await getDownloadConfig();
      let rodadaConcluidas = 0;
      let rodadaFalhas = 0;
      await runDownloadEngine(pendentes, contabId, async (task) => {
        const cliente = { id: task.clienteId, cnpj: task.cnpj, razaoSocial: task.razaoSocial };
        // IMPORTANTE: Ler o período salvo no log para respeitar o filtro original
        const taskLog = logsComErro.find((l: any) => l.id === task.logId);
        const { isPeriodo: taskIsPeriodo, input: taskPeriodoInput } = taskLog ? extractPeriodoFromLog(taskLog) : { isPeriodo: false, input: {} };
        if (taskIsPeriodo) {
          console.log(`[Auto-Retomada] ${cliente.razaoSocial}: retomando com período ${taskPeriodoInput.competenciaInicio || taskPeriodoInput.dataInicio} a ${taskPeriodoInput.competenciaFim || taskPeriodoInput.dataFim}`);
        }
        await processClienteDownload(cliente, contabId, taskIsPeriodo, taskPeriodoInput, task.logId);
      }, config, async (_task, success, _stats) => {
        // Callback em tempo real: atualizar status a cada empresa processada
        if (success) rodadaConcluidas++;
        else rodadaFalhas++;
        await db.upsertSetting(`auto_retomada_status_${contabId}`, JSON.stringify({
          fase: "retomando", totalErros: logsComErro.length, rodada,
          processados: totalRetomados + rodadaConcluidas,
          retomados: totalRetomados + rodadaConcluidas,
          falhas: totalFalhas + rodadaFalhas,
          pendentes: pendentes.length - rodadaConcluidas - rodadaFalhas,
          retomadaInfinita, maxRodadas: MAX_RODADAS,
        }));
      });

      // Verificar quais concluíram e quais falharam
      const updatedLogs = await db.getDownloadLogsByContabilidade(contabId, 1000);
      const novosPendentes: DownloadTask[] = [];
      let rodadaSucesso = 0;

      for (const task of pendentes) {
        const log = updatedLogs.find((l: any) => l.id === task.logId);
        if (log && log.status === "concluido") {
          rodadaSucesso++;
          totalRetomados++;
        } else {
          // Falhou: vai pro fim da fila na próxima rodada
          novosPendentes.push(task);
        }
      }

      totalFalhas = validTasks.length - totalRetomados;
      console.log(`[Auto-Retomada] Rodada ${rodada}: ${rodadaSucesso} sucesso, ${novosPendentes.length} falharam`);

      // Se nenhuma empresa melhorou nesta rodada
      if (rodadaSucesso === 0 && novosPendentes.length > 0) {
        if (retomadaInfinita) {
          // Em modo infinito, continua tentando mesmo sem melhora
          console.log(`[Auto-Retomada INFINITA] Rodada ${rodada}: sem melhora, mas continuando (modo infinito ativo)...`);
        } else {
          console.log(`[Auto-Retomada] Nenhuma melhora na rodada ${rodada}. Parando para não ficar em loop.`);
          // Marcar pendentes como erro final
          for (const task of novosPendentes) {
            const log = updatedLogs.find((l: any) => l.id === task.logId);
            if (log && log.status !== "concluido" && log.status !== "erro") {
              await db.updateDownloadLog(task.logId, {
                status: "erro", erro: log?.erro || "Falhou após múltiplas tentativas",
                etapa: `Falhou após ${rodada} rodada(s)`, finalizadoEm: new Date(),
              });
            }
          }
          break;
        }
      }

      pendentes = novosPendentes;

      // Delay entre rodadas
      if (pendentes.length > 0 && rodada < MAX_RODADAS) {
        const delayRodada = retomadaInfinita ? Math.max(delayMs, 15000) : 10000;
        console.log(`[Auto-Retomada${retomadaInfinita ? ' INFINITA' : ''}] Aguardando ${delayRodada/1000}s antes da próxima rodada...`);
        // Delay interruptível: verificar cancelamento a cada 2 segundos
        let delayRemaining = delayRodada;
        while (delayRemaining > 0) {
          const chunk = Math.min(delayRemaining, 2000);
          await new Promise(r => setTimeout(r, chunk));
          delayRemaining -= chunk;
          const cancelCheck = await db.getSetting(`cancel_all_flag_${contabId}`);
          if (cancelCheck === "true") {
            console.log(`[Auto-Retomada] Cancelamento detectado durante delay entre rodadas!`);
            await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
            return;
          }
        }
      }
    }

    // Marcar pendentes finais como erro se ainda restarem
    if (pendentes.length > 0) {
      const finalLogs = await db.getDownloadLogsByContabilidade(contabId, 1000);
      for (const task of pendentes) {
        const log = finalLogs.find((l: any) => l.id === task.logId);
        if (log && log.status !== "concluido" && log.status !== "erro") {
          await db.updateDownloadLog(task.logId, {
            status: "erro", erro: log?.erro || "Falhou após todas as rodadas",
            etapa: "Falhou após todas as rodadas", finalizadoEm: new Date(),
          });
        }
      }
    }

    await db.upsertSetting(`auto_retomada_status_${contabId}`, JSON.stringify({
      fase: "concluido", totalErros: logsComErro.length, retomados: totalRetomados,
      falhas: validTasks.length - totalRetomados, finalizadoEm: Date.now(),
    }));

    console.log(`[Auto-Retomada] CONCLUÍDO: ${totalRetomados} retomado(s), ${validTasks.length - totalRetomados} falha(s)`);

    setTimeout(async () => {
      await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
    }, 30000);
  } catch (error: any) {
    console.error("[Auto-Retomada] Erro geral:", error.message);
    await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
  }
}

export const appRouter = router({
  system: systemRouter,
  cte: cteRouter,

  // ═══════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      const { passwordHash, ...safeUser } = opts.ctx.user as any;
      return safeUser;
    }),

    register: publicProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });
        const passwordHash = await hashPassword(input.password);
        const openId = `local_${nanoid(24)}`;
        const allUsers = await db.getAllUsers();
        const isFirstUser = allUsers.length === 0;
        await db.upsertUser({
          openId, name: input.name, email: input.email, passwordHash,
          loginMethod: "local", role: isFirstUser ? "admin" : "cliente",
          lastSignedIn: new Date(),
        });
        const user = await db.getUserByOpenId(openId);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, token: sessionToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, contabilidadeId: user.contabilidadeId } };
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        console.log('[LOGIN] Tentativa de login:', input.email);
        const user = await db.getUserByEmail(input.email);
        console.log('[LOGIN] Usuário encontrado:', user ? `ID ${user.id}, email ${user.email}, hash: ${user.passwordHash?.substring(0, 20)}...` : 'NÃO ENCONTRADO');
        if (!user || !user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
        if (!user.ativo) throw new TRPCError({ code: "FORBIDDEN", message: "Conta desativada. Entre em contato com o administrador." });
        console.log('[LOGIN] Verificando senha. Input:', input.password, 'Hash:', user.passwordHash);
        const { valid, needsRehash } = await verifyPassword(input.password, user.passwordHash);
        console.log('[LOGIN] Resultado verificação:', { valid, needsRehash });
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha incorretos" });
        if (needsRehash) {
          const upgradedHash = await hashPassword(input.password);
          await db.updateUserPassword(user.id, upgradedHash);
        }
        // If contabilidade user, check if contabilidade is active
        if (user.role === "contabilidade" && user.contabilidadeId) {
          const contab = await db.getContabilidadeById(user.contabilidadeId);
          if (contab && !contab.ativo) throw new TRPCError({ code: "FORBIDDEN", message: "Sua contabilidade está desativada. Entre em contato com o administrador." });
        }
        const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "", expiresInMs: ONE_YEAR_MS });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        return { success: true, token: sessionToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, contabilidadeId: user.contabilidadeId } };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    changePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByOpenId(ctx.user.openId);
        if (!user || !user.passwordHash) throw new TRPCError({ code: "BAD_REQUEST" });
        const { valid } = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta" });
        const newHash = await hashPassword(input.newPassword);
        await db.updateUserPassword(user.id, newHash);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════
  // ADMIN PANEL - Gestão de Planos, Contabilidades, Usuários
  // ═══════════════════════════════════════════════════════════════════
  admin: router({
    // ─── Dashboard Admin ─────────────────────────────────────────
    dashboardStats: adminProcedure.query(async () => {
      return db.getAdminDashboardStats();
    }),

    // ─── Planos ──────────────────────────────────────────────────
    listPlanos: adminProcedure.query(async () => {
      return db.getPlanos();
    }),
    createPlano: adminProcedure
      .input(z.object({
        nome: z.string().min(1),
        descricao: z.string().optional(),
        maxClientes: z.number().min(1).default(10),
        maxCertificados: z.number().min(1).default(10),
        maxDownloadsDia: z.number().min(1).default(100),
        permiteAgendamento: z.boolean().default(true),
        preco: z.string().optional(),
        ativo: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createPlano(input);
        return { id };
      }),
    updatePlano: adminProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().optional(),
        descricao: z.string().optional(),
        maxClientes: z.number().optional(),
        maxCertificados: z.number().optional(),
        maxDownloadsDia: z.number().optional(),
        permiteAgendamento: z.boolean().optional(),
        preco: z.string().optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updatePlano(id, data);
        return { success: true };
      }),
    deletePlano: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deletePlano(input.id);
        return { success: true };
      }),

    // ─── Gestão de Contabilidades ────────────────────────────────
    listContabilidades: adminProcedure.query(async () => {
      return db.getContabilidadesComStats();
    }),
    createContabilidade: adminProcedure
      .input(z.object({
        nome: z.string().min(1),
        cnpj: z.string().optional(),
        email: z.string().email(),
        telefone: z.string().optional(),
        endereco: z.string().optional(),
        planoId: z.number().optional(),
        // Criar conta de acesso para a contabilidade
        senhaContabilidade: z.string().min(6),
        nomeResponsavel: z.string().min(2),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if email already used
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado" });

        // Create contabilidade
        const contabId = await db.createContabilidade({
          nome: input.nome,
          cnpj: input.cnpj,
          email: input.email,
          telefone: input.telefone,
          endereco: input.endereco,
          planoId: input.planoId,
          ownerId: ctx.user.id,
        });

        // Create user account for contabilidade
        const passwordHash = await hashPassword(input.senhaContabilidade);
        const openId = `local_${nanoid(24)}`;
        await db.upsertUser({
          openId,
          name: input.nomeResponsavel,
          email: input.email,
          passwordHash,
          loginMethod: "local",
          role: "contabilidade",
          contabilidadeId: contabId,
          lastSignedIn: new Date(),
        });

        return { id: contabId };
      }),
    updateContabilidade: adminProcedure
      .input(z.object({
        id: z.number(),
        nome: z.string().optional(),
        cnpj: z.string().optional(),
        email: z.string().optional(),
        telefone: z.string().optional(),
        endereco: z.string().optional(),
        planoId: z.number().nullable().optional(),
        ativo: z.boolean().optional(),
        bloqueadoMotivo: z.string().nullable().optional(),
        retencaoMeses: z.number().min(1).max(120).optional(),
        cteHabilitado: z.boolean().optional(),
        cteBaixarPdf: z.boolean().optional(),
        novaSenha: z.string().min(4).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, novaSenha, ...data } = input;
        await db.updateContabilidade(id, data);
        // Se nova senha fornecida, atualizar senha do usuário vinculado
        if (novaSenha) {
          const hash = await hashPassword(novaSenha);
          // Buscar usuário vinculado à contabilidade
          const allUsers = await db.getAllUsers();
          const contabUser = allUsers.find(u => u.contabilidadeId === id && u.role === "contabilidade");
          if (contabUser) {
            await db.updateUserPassword(contabUser.id, hash);
          }
        }
        return { success: true };
      }),
    toggleContabilidade: adminProcedure
      .input(z.object({ id: z.number(), ativo: z.boolean(), motivo: z.string().optional() }))
      .mutation(async ({ input }) => {
        await db.updateContabilidade(input.id, {
          ativo: input.ativo,
          bloqueadoMotivo: input.ativo ? null : (input.motivo || "Desativada pelo administrador"),
        });
        return { success: true };
      }),
    deleteContabilidade: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteContabilidade(input.id);
        return { success: true };
      }),

    // ─── Gestão de Usuários ────────────────────────────────────────
    listUsers: adminProcedure.query(async () => {
      const users = await db.getAllUsers();
      return users.map(u => {
        const { passwordHash, ...safe } = u as any;
        return safe;
      });
    }),
    updateUserRole: adminProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["admin", "contabilidade", "cliente"]),
        contabilidadeId: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role, input.contabilidadeId);
        return { success: true };
      }),
    toggleUser: adminProcedure
      .input(z.object({ userId: z.number(), ativo: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.updateUser(input.userId, { ativo: input.ativo });
        return { success: true };
      }),
    resetPassword: adminProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(6) }))
      .mutation(async ({ input }) => {
        const hash = await hashPassword(input.newPassword);
        await db.updateUserPassword(input.userId, hash);
        return { success: true };
      }),
    createUser: adminProcedure
      .input(z.object({
        name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
        email: z.string().email("E-mail inválido"),
        password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
        role: z.enum(["admin", "contabilidade", "cliente"]),
        contabilidadeId: z.number().nullable().optional(),
      }))
      .mutation(async ({ input }) => {
        // Verificar se email já existe
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este e-mail" });
        const hash = await hashPassword(input.password);
        const openId = `local_${nanoid(24)}`;
        await db.upsertUser({
          openId,
          name: input.name,
          email: input.email,
          passwordHash: hash,
          loginMethod: "password",
          role: input.role,
          contabilidadeId: input.contabilidadeId ?? undefined,
        });
        return { success: true };
      }),
    editUser: adminProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().min(2).optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "contabilidade", "cliente"]).optional(),
        contabilidadeId: z.number().nullable().optional(),
        ativo: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { userId, ...data } = input;
        // Se email mudou, verificar duplicata
        if (data.email) {
          const existing = await db.getUserByEmail(data.email);
          if (existing && existing.id !== userId) {
            throw new TRPCError({ code: "CONFLICT", message: "Já existe outro usuário com este e-mail" });
          }
        }
        const updateData: any = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.ativo !== undefined) updateData.ativo = data.ativo;
        if (data.role !== undefined) updateData.role = data.role;
        if (data.contabilidadeId !== undefined) updateData.contabilidadeId = data.contabilidadeId;
        await db.updateUser(userId, updateData);
        return { success: true };
      }),
    removeUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Não permitir excluir a si mesmo
        if (ctx.user.id === input.userId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir sua própria conta" });
        }
        await db.deleteUser(input.userId);
        return { success: true };
      }),
  }),

  // ═══════════════════════════════════════════════════════════════════
  // CONTABILIDADE PANEL - Portal isolado por contabilidade
  // ═══════════════════════════════════════════════════════════════════

  // ─── Contabilidade Info ────────────────────────────────────────
  contabilidade: router({
    mine: contabilidadeProcedure.query(async ({ ctx }) => {
      const contabId = await getContabilidadeId(ctx.user);
      const contab = await db.getContabilidadeById(contabId);
      if (!contab) throw new TRPCError({ code: "NOT_FOUND" });
      const limits = await db.checkContabilidadeLimits(contabId);
      return { ...contab, limits };
    }),
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") return db.getContabilidades();
      if (ctx.user.contabilidadeId) {
        const c = await db.getContabilidadeById(ctx.user.contabilidadeId);
        return c ? [c] : [];
      }
      return [];
    }),
    update: contabilidadeProcedure
      .input(z.object({
        nome: z.string().optional(),
        telefone: z.string().optional(),
        endereco: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const contabId = await getContabilidadeId(ctx.user);
        await db.updateContabilidade(contabId, input);
        return { success: true };
      }),
  }),

  // ─── Clientes (isolados por contabilidade) ─────────────────────
  cliente: router({
    list: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verClientes");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        return db.getClientesByContabilidade(contabId);
      }),
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verClientes");
        const cliente = await db.getClienteById(input.id);
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
        // Enforce isolation
        if (ctx.user.role !== "admin" && cliente.contabilidadeId !== ctx.user.contabilidadeId)
          throw new TRPCError({ code: "FORBIDDEN" });
        return cliente;
      }),
    create: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        cnpj: z.string(), razaoSocial: z.string(),
        nomeFantasia: z.string().optional(), email: z.string().optional(),
        telefone: z.string().optional(), endereco: z.string().optional(),
        cidade: z.string().optional(), uf: z.string().optional(), cep: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "editarClientes");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        // Check plan limits
        const limits = await db.checkContabilidadeLimits(contabId);
        if (!limits.allowed) throw new TRPCError({ code: "FORBIDDEN", message: limits.reason || "Limite de clientes atingido" });
        const id = await db.createCliente({ ...input, contabilidadeId: contabId });
        return { id };
      }),
    update: contabilidadeProcedure
      .input(z.object({
        id: z.number(), razaoSocial: z.string().optional(),
        nomeFantasia: z.string().optional(), email: z.string().optional(),
        emailSecundario: z.string().optional(),
        telefone: z.string().optional(), telefone2: z.string().optional(),
        contatoPrincipal: z.string().optional(), contatoSecundario: z.string().optional(),
        logradouro: z.string().optional(), numero: z.string().optional(),
        complemento: z.string().optional(), bairro: z.string().optional(),
        cidade: z.string().optional(), uf: z.string().optional(), cep: z.string().optional(),
        endereco: z.string().optional(),
        tipoCliente: z.string().optional(), regimeTributario: z.string().optional(),
        naturezaJuridica: z.string().optional(), capitalSocial: z.string().optional(),
        porte: z.string().optional(), dataAbertura: z.string().optional(),
        situacaoCadastral: z.string().optional(),
        socios: z.string().optional(), // JSON string
        cnaePrincipal: z.string().optional(), cnaePrincipalDescricao: z.string().optional(),
        cnaesSecundarios: z.string().optional(), // JSON string
        optanteSimples: z.boolean().optional().nullable(),
        optanteMEI: z.boolean().optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "editarClientes");
        const cliente = await db.getClienteById(input.id);
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && cliente.contabilidadeId !== ctx.user.contabilidadeId)
          throw new TRPCError({ code: "FORBIDDEN" });
        const { id, ...data } = input;
        await db.updateCliente(id, data as any);
        return { success: true };
      }),
    consultarReceita: contabilidadeProcedure
      .input(z.object({ clienteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "editarClientes");
        const cliente = await db.getClienteById(input.clienteId);
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && cliente.contabilidadeId !== ctx.user.contabilidadeId)
          throw new TRPCError({ code: "FORBIDDEN" });
        try {
          const dados = await db.consultarCnpjReceita(cliente.cnpj);
          await db.atualizarClienteComDadosReceita(cliente.id, dados);
          return { success: true, dados };
        } catch (e: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message || "Erro ao consultar Receita Federal" });
        }
      }),
    consultarReceitaEmLote: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "editarClientes");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const clientes = await db.getClientesByContabilidade(contabId);
        const results: Array<{ clienteId: number; cnpj: string; razaoSocial: string; success: boolean; error?: string }> = [];
        for (const cliente of clientes) {
          try {
            const dados = await db.consultarCnpjReceita(cliente.cnpj);
            await db.atualizarClienteComDadosReceita(cliente.id, dados);
            results.push({ clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: true });
          } catch (e: any) {
            results.push({ clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, success: false, error: e.message });
          }
          // Delay de 1.5s entre consultas para evitar rate limiting
          await new Promise(r => setTimeout(r, 1500));
        }
        return { total: clientes.length, sucesso: results.filter(r => r.success).length, erros: results.filter(r => !r.success).length, results };
      }),
    toggleAtivo: contabilidadeProcedure
      .input(z.object({ id: z.number(), ativo: z.boolean(), contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "editarClientes");
        const cliente = await db.getClienteById(input.id);
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND" });
        if (ctx.user.role !== "admin" && cliente.contabilidadeId !== ctx.user.contabilidadeId)
          throw new TRPCError({ code: "FORBIDDEN" });
        await db.updateCliente(input.id, { ativo: input.ativo });
        return { success: true };
      }),
    delete: contabilidadeProcedure
      .input(z.object({ id: z.number(), contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "apagarClientes");
        const cliente = await db.getClienteById(input.id);
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
        if (ctx.user.role !== "admin" && cliente.contabilidadeId !== ctx.user.contabilidadeId)
          throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para excluir este cliente" });
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        
        console.log(`[DeleteCliente] Excluindo cliente ${cliente.razaoSocial} (${cliente.cnpj}) - ID=${input.id} contab=${contabId}`);
        console.log(`[DeleteCliente] Serão excluídos: notas, certificados, downloads, histórico, agendamentos, auditoria`);
        
        // Registrar auditoria ANTES de excluir (o próprio log de auditoria do cliente também será excluído)
        await db.createAuditLog({
          contabilidadeId: contabId,
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.email || "Desconhecido",
          acao: "apagar_cliente_cascata",
          entidade: "cliente",
          entidadeId: input.id,
          detalhes: JSON.stringify({ 
            razaoSocial: cliente.razaoSocial, 
            cnpj: cliente.cnpj,
            mensagem: "Exclusão completa em cascata: notas, certificados, downloads, histórico, agendamentos e auditoria"
          }),
        });
        
        // Exclusão em cascata completa (cancela downloads, apaga tudo)
        await db.deleteCliente(input.id);
        
        console.log(`[DeleteCliente] Cliente ${cliente.razaoSocial} excluído com sucesso (cascata completa)`);
        return { success: true, message: `Cliente ${cliente.razaoSocial} e todos os dados vinculados foram excluídos com sucesso.` };
      }),
    deleteAll: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "apagarClientes");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const clientesList = await db.getClientesByContabilidade(contabId);
        
        console.log(`[DeleteAll] ===== INICIANDO LIMPEZA TOTAL contab=${contabId} =====`);
        
        // PASSO 1: Cancelar TODOS os downloads em andamento
        const cancelled = await db.cancelDownloadsEmAndamento(contabId);
        if (cancelled > 0) {
          console.log(`[DeleteAll] ${cancelled} download(s) cancelado(s)`);
        }
        
        // PASSO 2: Aguardar workers pararem (eles checam isDownloadCancelled a cada nota)
        // Workers precisam de tempo para detectar o cancelamento
        if (cancelled > 0) {
          console.log(`[DeleteAll] Aguardando 5s para workers detectarem cancelamento...`);
          await new Promise(r => setTimeout(r, 5000));
        }
        
        // PASSO 3: Apagar TUDO
        const deleted = await db.deleteAllClientesByContabilidade(contabId);
        
        // PASSO 4: LOOP AGRESSIVO - repetir até zerar (workers podem re-criar notas)
        // Máximo 10 tentativas, 2s entre cada
        for (let tentativa = 1; tentativa <= 10; tentativa++) {
          await new Promise(r => setTimeout(r, 2000));
          const restantes = await db.countNotasByContabilidade(contabId);
          if (restantes === 0) {
            console.log(`[DeleteAll] Verificação #${tentativa}: 0 notas restantes. Limpeza OK!`);
            break;
          }
          console.log(`[DeleteAll] Verificação #${tentativa}: ${restantes} notas re-criadas. Apagando...`);
          // Re-cancelar downloads (caso novos tenham sido criados)
          await db.cancelDownloadsEmAndamento(contabId);
          // Re-apagar tudo
          await db.deleteAllClientesByContabilidade(contabId);
        }
        
        // PASSO 5: Verificação final absoluta
        const notasFinal = await db.countNotasByContabilidade(contabId);
        if (notasFinal > 0) {
          console.error(`[DeleteAll] FALHA: ${notasFinal} notas ainda restam após 10 tentativas!`);
        } else {
          console.log(`[DeleteAll] ===== LIMPEZA TOTAL CONCLUÍDA COM SUCESSO =====`);
        }
        
        // Limpar status de auto-retomada para não mostrar banner fantasma
        await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
        console.log(`[DeleteAll] Status de auto-retomada limpo para contabilidade ${contabId}`);
        
        return { success: true, deleted, message: `Todos os dados foram apagados: ${clientesList.length} clientes, notas, certificados, downloads, agendamentos e histórico de auditoria.` };
      }),
  }),

  // ─── Gerenciamento de Usuários (pelo contador) ─────────────────────
  usuario: router({
    list: contabilidadeProcedure.query(async ({ ctx }) => {
      checkPermissao(ctx.user, "gerenciarUsuarios");
      const contabId = await getContabilidadeId(ctx.user);
      const allUsers = await db.getAllUsers();
      return allUsers
        .filter(u => u.contabilidadeId === contabId && u.id !== ctx.user.id)
        .map(u => {
          const { passwordHash, ...safe } = u as any;
          return { ...safe, permissoes: u.permissoes ? JSON.parse(u.permissoes) : null };
        });
    }),
    create: contabilidadeProcedure
      .input(z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        permissoes: z.object({
          verClientes: z.boolean(),
          editarClientes: z.boolean(),
          apagarClientes: z.boolean(),
          verCertificados: z.boolean(),
          gerenciarCertificados: z.boolean(),
          fazerDownloads: z.boolean(),
          verHistorico: z.boolean(),
          gerenciarAgendamentos: z.boolean(),
          verRelatorios: z.boolean(),
          gerenciarUsuarios: z.boolean(),
          verCteNotas: z.boolean().optional(),
          fazerDownloadsCte: z.boolean().optional(),
          verHistoricoCte: z.boolean().optional(),
          verRelatoriosCte: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const existing = await db.getUserByEmail(input.email);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com este e-mail" });
        const passwordHash = await hashPassword(input.password);
        const openId = `local_${nanoid(24)}`;
        await db.upsertUser({
          openId, name: input.name, email: input.email, passwordHash,
          loginMethod: "local", role: "usuario",
          contabilidadeId: contabId,
          lastSignedIn: new Date(),
        });
        const user = await db.getUserByOpenId(openId);
        if (user) {
          await db.updateUser(user.id, {
            permissoes: JSON.stringify(input.permissoes),
            criadoPor: ctx.user.id,
          } as any);
        }
        await db.createAuditLog({
          contabilidadeId: contabId,
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.email || "Desconhecido",
          acao: "criar_usuario",
          entidade: "usuario",
          entidadeId: user?.id,
          detalhes: JSON.stringify({ nome: input.name, email: input.email }),
        });
        return { success: true, userId: user?.id };
      }),
    updatePermissoes: contabilidadeProcedure
      .input(z.object({
        userId: z.number(),
        permissoes: z.object({
          verClientes: z.boolean(),
          editarClientes: z.boolean(),
          apagarClientes: z.boolean(),
          verCertificados: z.boolean(),
          gerenciarCertificados: z.boolean(),
          fazerDownloads: z.boolean(),
          verHistorico: z.boolean(),
          gerenciarAgendamentos: z.boolean(),
          verRelatorios: z.boolean(),
          gerenciarUsuarios: z.boolean(),
          verCteNotas: z.boolean().optional(),
          fazerDownloadsCte: z.boolean().optional(),
          verHistoricoCte: z.boolean().optional(),
          verRelatoriosCte: z.boolean().optional(),
        }),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser || targetUser.contabilidadeId !== contabId)
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        await db.updateUser(input.userId, { permissoes: JSON.stringify(input.permissoes) } as any);
        return { success: true };
      }),
    toggle: contabilidadeProcedure
      .input(z.object({ userId: z.number(), ativo: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser || targetUser.contabilidadeId !== contabId)
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        await db.updateUser(input.userId, { ativo: input.ativo });
        await db.createAuditLog({
          contabilidadeId: contabId,
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.email || "Desconhecido",
          acao: input.ativo ? "ativar_usuario" : "desativar_usuario",
          entidade: "usuario",
          entidadeId: input.userId,
          detalhes: JSON.stringify({ nome: targetUser.name, email: targetUser.email }),
        });
        return { success: true };
      }),
    delete: contabilidadeProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser || targetUser.contabilidadeId !== contabId)
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        if (targetUser.id === ctx.user.id)
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode excluir a si mesmo" });
        await db.createAuditLog({
          contabilidadeId: contabId,
          userId: ctx.user.id,
          userName: ctx.user.name || ctx.user.email || "Desconhecido",
          acao: "excluir_usuario",
          entidade: "usuario",
          entidadeId: input.userId,
          detalhes: JSON.stringify({ nome: targetUser.name, email: targetUser.email }),
        });
        await db.deleteUser(input.userId);
        return { success: true };
      }),
    resetPassword: contabilidadeProcedure
      .input(z.object({ userId: z.number(), newPassword: z.string().min(6) }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const targetUser = await db.getUserById(input.userId);
        if (!targetUser || targetUser.contabilidadeId !== contabId)
          throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
        const hash = await hashPassword(input.newPassword);
        await db.updateUserPassword(input.userId, hash);
        return { success: true };
      }),
    myPermissoes: contabilidadeProcedure.query(async ({ ctx }) => {
      return getUserPermissoes(ctx.user);
    }),
    auditLogs: contabilidadeProcedure
      .input(z.object({ limit: z.number().optional(), userName: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        if (input?.userName) {
          return db.getAuditLogsByUser(contabId, input.userName, input?.limit || 500);
        }
        return db.getAuditLogsByContabilidade(contabId, input?.limit || 500);
      }),
    auditLogUpdate: contabilidadeProcedure
      .input(z.object({ id: z.number(), detalhes: z.string() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAuditoria");
        const contabId = await getContabilidadeId(ctx.user);
        await db.updateAuditLog(input.id, contabId, input.detalhes);
        await db.createAuditLog({
          contabilidadeId: contabId,
          userId: ctx.user.id,
          userName: ctx.user.name || "Sistema",
          acao: "editar_auditoria",
          entidade: "auditoria",
          entidadeId: input.id,
          detalhes: JSON.stringify({ registroEditado: input.id }),
        });
        return { success: true };
      }),
    auditLogDelete: contabilidadeProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAuditoria");
        const contabId = await getContabilidadeId(ctx.user);
        await db.deleteAuditLog(input.id, contabId);
        return { success: true };
      }),
    auditLogDeleteAll: contabilidadeProcedure
      .mutation(async ({ ctx }) => {
        checkPermissao(ctx.user, "gerenciarAuditoria");
        const contabId = await getContabilidadeId(ctx.user);
        const deleted = await db.deleteAllAuditLogs(contabId);
        return { success: true, deleted };
      }),
    auditRetencaoGet: contabilidadeProcedure
      .query(async ({ ctx }) => {
        const contabId = await getContabilidadeId(ctx.user);
        const dias = await db.getAuditRetencaoDias(contabId);
        return { dias };
      }),
    auditRetencaoUpdate: contabilidadeProcedure
      .input(z.object({ dias: z.number().min(7).max(365) }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAuditoria");
        const contabId = await getContabilidadeId(ctx.user);
        await db.updateAuditRetencaoDias(contabId, input.dias);
        await db.createAuditLog({
          contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
          acao: "alterar_retencao_auditoria", entidade: "configuracao",
          detalhes: JSON.stringify({ dias: input.dias }),
        });
        // Limpar logs antigos automaticamente
        const removed = await db.cleanupOldAuditLogs(contabId);
        return { success: true, removidos: removed };
      }),
    auditLogUsers: contabilidadeProcedure
      .query(async ({ ctx }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const logs = await db.getAuditLogsByContabilidade(contabId, 10000);
        const uniqueUsers = Array.from(new Set(logs.map(l => l.userName)));
        return uniqueUsers;
      }),
    auditLogReportPdf: contabilidadeProcedure
      .input(z.object({ userName: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarUsuarios");
        const contabId = await getContabilidadeId(ctx.user);
        const logs = input.userName
          ? await db.getAuditLogsByUser(contabId, input.userName, 10000)
          : await db.getAuditLogsByContabilidade(contabId, 10000);

        // Get contabilidade name
        const contab = await db.getContabilidadeById(contabId);
        const contabNome = contab?.nome || "Contabilidade";

        const PDFDocument = (await import("pdfkit")).default;
        const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));

        const pdfDone = new Promise<Buffer>((resolve) => {
          doc.on("end", () => resolve(Buffer.concat(chunks)));
        });

        // Header
        doc.fontSize(18).font("Helvetica-Bold").text("Relatório de Auditoria", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica").text(contabNome, { align: "center" });
        doc.moveDown(0.3);
        const filtro = input.userName ? `Usuário: ${input.userName}` : "Todos os Usuários";
        doc.fontSize(10).fillColor("#666666").text(filtro, { align: "center" });
        doc.moveDown(0.2);
        doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, { align: "center" });
        doc.moveDown(0.5);

        // Summary
        doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text("Resumo");
        doc.moveDown(0.3);
        doc.fontSize(10).font("Helvetica");
        doc.text(`Total de registros: ${logs.length}`);
        const uniqueUsersInLogs = Array.from(new Set(logs.map(l => l.userName)));
        doc.text(`Usuários envolvidos: ${uniqueUsersInLogs.join(", ")}`);
        const uniqueActions = Array.from(new Set(logs.map(l => l.acao)));
        doc.text(`Tipos de ação: ${uniqueActions.join(", ")}`);
        doc.moveDown(0.5);

        // Separator line
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(0.5);

        // Table header
        const tableTop = doc.y;
        const colWidths = [90, 90, 100, 100, 135];
        const colX = [40, 130, 220, 320, 420];
        const headers = ["Data/Hora", "Usuário", "Ação", "Entidade", "Detalhes"];

        doc.fontSize(9).font("Helvetica-Bold").fillColor("#333333");
        headers.forEach((h, i) => {
          doc.text(h, colX[i], tableTop, { width: colWidths[i], align: "left" });
        });
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#cccccc").stroke();
        doc.moveDown(0.3);

        // Table rows
        doc.font("Helvetica").fontSize(8).fillColor("#000000");
        for (const log of logs) {
          if (doc.y > 750) {
            doc.addPage();
          }
          const rowY = doc.y;
          const dateStr = new Date(log.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
          let detalhesStr = "-";
          if (log.detalhes) {
            try {
              const d = JSON.parse(log.detalhes);
              detalhesStr = Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(", ");
            } catch { detalhesStr = log.detalhes; }
          }
          doc.text(dateStr, colX[0], rowY, { width: colWidths[0], lineBreak: false });
          doc.text(log.userName, colX[1], rowY, { width: colWidths[1], lineBreak: false });
          doc.text(log.acao, colX[2], rowY, { width: colWidths[2], lineBreak: false });
          doc.text(log.entidade || "-", colX[3], rowY, { width: colWidths[3], lineBreak: false });
          doc.text(detalhesStr.substring(0, 50), colX[4], rowY, { width: colWidths[4], lineBreak: false });
          doc.moveDown(0.6);
        }

        // Footer with page numbers
        const pages = doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(8).fillColor("#999999");
          doc.text(`Página ${i + 1} de ${pages.count}`, 40, 780, { align: "center", width: 515 });
        }

        // Marca d'água em todas as páginas
        const { addWatermarkToAllPages: addWm1 } = await import("./pdf-watermark");
        await addWm1(doc);

        doc.end();
        const pdfBuffer = await pdfDone;
        const base64 = pdfBuffer.toString("base64");
        return { base64, fileName: `auditoria_${input.userName || "todos"}_${new Date().toISOString().split("T")[0]}.pdf` };
      }),
  }),

  // ─── Certificados (isolados por contabilidade) ─────────────────
  certificado: router({
    list: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verCertificados");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        const certs = await db.getCertificadosByContabilidade(contabId);
        return certs.map(c => ({ ...c, certData: undefined, certSenha: undefined }));
      }),

    uploadBatch: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        certificados: z.array(z.object({
          fileName: z.string(), fileData: z.string(), senha: z.string(),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarCertificados");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const results: Array<{ fileName: string; success: boolean; cnpj?: string; razaoSocial?: string; clienteId?: number; certificadoId?: number; error?: string }> = [];

        for (const cert of input.certificados) {
          try {
            const pfxBuffer = Buffer.from(cert.fileData, "base64");
            const certInfo = await extractPfxCertAndKey(pfxBuffer, cert.senha);
            const cnpjClean = certInfo.cnpj.replace(/[^\d]/g, "");
            let cliente = await db.getClienteByCnpj(certInfo.cnpj, contabId);
            if (!cliente) cliente = await db.getClienteByCnpj(cnpjClean, contabId);

            let clienteId: number;
            if (!cliente) {
              // Check plan limits before creating
              const limits = await db.checkContabilidadeLimits(contabId);
              if (!limits.allowed) {
                results.push({ fileName: cert.fileName, success: false, error: `Limite do plano atingido: ${limits.reason}` });
                continue;
              }
              clienteId = await db.createCliente({
                contabilidadeId: contabId,
                cnpj: certInfo.cnpj,
                razaoSocial: certInfo.razaoSocial || `Empresa ${cnpjClean}`,
              });
              // Consulta automática à Receita Federal para preencher dados
              try {
                const dadosReceita = await db.consultarCnpjReceita(certInfo.cnpj);
                await db.atualizarClienteComDadosReceita(clienteId, dadosReceita);
              } catch (_receitaErr) {
                // Não impede o cadastro se a consulta falhar
              }
            } else {
              clienteId = cliente.id;
              // Desativar certificados antigos do mesmo CNPJ para evitar duplicidade
              await db.desativarCertificadosCliente(clienteId);
            }

            const encryptedData = encrypt(cert.fileData);
            const encryptedSenha = encrypt(cert.senha);
            const certificadoId = await db.createCertificado({
              clienteId, contabilidadeId: contabId,
              cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial,
              certData: encryptedData, certSenha: encryptedSenha,
              serialNumber: certInfo.serialNumber, issuer: certInfo.issuer,
              validFrom: certInfo.validFrom, validTo: certInfo.validTo,
            });

            results.push({ fileName: cert.fileName, success: true, cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial, clienteId, certificadoId });
          } catch (error: any) {
            results.push({ fileName: cert.fileName, success: false, error: error.message || "Erro ao processar certificado" });
          }
        }
        return { results };
      }),

    monitoramento: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verCertificados");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        return db.getCertificadosComStatus(contabId);
      }),

    renovar: contabilidadeProcedure
      .input(z.object({
        clienteId: z.number(), contabilidadeId: z.number().optional(),
        fileName: z.string(), fileData: z.string(), senha: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarCertificados");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const pfxBuffer = Buffer.from(input.fileData, "base64");
        const certInfo = await extractPfxCertAndKey(pfxBuffer, input.senha);
        await db.desativarCertificadosCliente(input.clienteId);
        const encryptedData = encrypt(input.fileData);
        const encryptedSenha = encrypt(input.senha);
        const certificadoId = await db.createCertificado({
          clienteId: input.clienteId, contabilidadeId: contabId,
          cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial,
          certData: encryptedData, certSenha: encryptedSenha,
          serialNumber: certInfo.serialNumber, issuer: certInfo.issuer,
          validFrom: certInfo.validFrom, validTo: certInfo.validTo,
        });
        return { success: true, certificadoId, cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial, validTo: certInfo.validTo };
      }),

    renovarLote: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        certificados: z.array(z.object({ fileName: z.string(), fileData: z.string(), senha: z.string() })),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarCertificados");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const results: Array<{ fileName: string; success: boolean; cnpj?: string; razaoSocial?: string; clienteId?: number; validTo?: Date; error?: string }> = [];

        for (const cert of input.certificados) {
          try {
            const pfxBuffer = Buffer.from(cert.fileData, "base64");
            const certInfo = await extractPfxCertAndKey(pfxBuffer, cert.senha);
            const cnpjClean = certInfo.cnpj.replace(/[^\d]/g, "");
            let cliente = await db.getClienteByCnpj(certInfo.cnpj, contabId);
            if (!cliente) cliente = await db.getClienteByCnpj(cnpjClean, contabId);

            let clienteId: number;
            if (!cliente) {
              clienteId = await db.createCliente({ contabilidadeId: contabId, cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial || `Empresa ${cnpjClean}` });
              // Consulta automática à Receita Federal
              try {
                const dadosReceita = await db.consultarCnpjReceita(certInfo.cnpj);
                await db.atualizarClienteComDadosReceita(clienteId, dadosReceita);
              } catch (_receitaErr) { /* não impede o cadastro */ }
            } else {
              clienteId = cliente.id;
              await db.desativarCertificadosCliente(clienteId);
            }

            const encryptedData = encrypt(cert.fileData);
            const encryptedSenha = encrypt(cert.senha);
            await db.createCertificado({
              clienteId, contabilidadeId: contabId,
              cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial,
              certData: encryptedData, certSenha: encryptedSenha,
              serialNumber: certInfo.serialNumber, issuer: certInfo.issuer,
              validFrom: certInfo.validFrom, validTo: certInfo.validTo,
            });
            results.push({ fileName: cert.fileName, success: true, cnpj: certInfo.cnpj, razaoSocial: certInfo.razaoSocial, clienteId, validTo: certInfo.validTo });
          } catch (error: any) {
            results.push({ fileName: cert.fileName, success: false, error: error.message });
          }
        }
        return { results };
      }),
  }),

  // ─── Notas Fiscais (isoladas por contabilidade) ────────────────
  nota: router({
    list: protectedProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(), clienteId: z.number().optional(),
        status: z.string().optional(), direcao: z.string().optional(),
        ibsCbs: z.string().optional(),
        dataInicio: z.date().optional(), dataFim: z.date().optional(),
        busca: z.string().optional(), limit: z.number().optional(), offset: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verClientes");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        return db.getNotasByContabilidade(contabId, {
          clienteId: input.clienteId, status: input.status, direcao: input.direcao,
          ibsCbs: input.ibsCbs,
          dataInicio: input.dataInicio, dataFim: input.dataFim,
          busca: input.busca, limit: input.limit, offset: input.offset,
        });
      }),
    getXml: protectedProcedure
      .input(z.object({ chaveAcesso: z.string() }))
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verClientes");
        const nota = await db.getNotaByChaveAcesso(input.chaveAcesso);
        if (!nota) throw new TRPCError({ code: "NOT_FOUND" });
        if (nota.xmlOriginal) {
          try { return { xml: decodeXml(nota.xmlOriginal) }; } catch { return { xml: nota.xmlOriginal }; }
        }
        return { xml: "" };
      }),
    getDanfseUrl: protectedProcedure
      .input(z.object({ chaveAcesso: z.string() }))
      .query(({ input }) => ({ url: getDanfseUrl(input.chaveAcesso) })),
    getXmlBatch: protectedProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        clienteId: z.number().optional(),
        status: z.string().optional(),
        direcao: z.string().optional(),
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const allNotas = await db.getNotasForRelatorio(contabId, {
          clienteId: input.clienteId,
          direcao: input.direcao,
          status: input.status,
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });
        return allNotas.map(n => ({
          id: n.id,
          clienteId: n.clienteId,
          numeroNota: n.numeroNota,
          emitenteCnpj: n.emitenteCnpj,
          chaveAcesso: n.chaveAcesso,
          xml: n.xmlOriginal ? (() => { try { return decodeXml(n.xmlOriginal); } catch { return n.xmlOriginal; } })() : null,
        }));
      }),
    deleteByCliente: contabilidadeProcedure
      .input(z.object({ clienteId: z.number(), contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "apagarClientes");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const deleted = await db.deleteNotasByCliente(input.clienteId, contabId);
        return { success: true, deleted };
      }),
    deleteAll: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "apagarClientes");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const deleted = await db.deleteAllNotasByContabilidade(contabId);
        return { success: true, deleted };
      }),
  }),

  // ─── Download de Notas (isolado por contabilidade) ─────────────
  download: router({
    // Lista clientes com status de certificado para a tela de downloads
    clientesComStatus: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        return db.getClientesComStatusCertificado(contabId);
      }),

    executeForCliente: contabilidadeProcedure
      .input(z.object({
        clienteId: z.number(),
        contabilidadeId: z.number().optional(),
        modo: z.enum(["novas", "periodo"]).default("novas"),
        competenciaInicio: z.string().optional(), // YYYY-MM
        competenciaFim: z.string().optional(),     // YYYY-MM
        dataInicio: z.string().optional(),          // YYYY-MM-DD (filtro exato por dia)
        dataFim: z.string().optional(),             // YYYY-MM-DD (filtro exato por dia)
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const cliente = await db.getClienteById(input.clienteId);
        const { cert, vencido } = await db.getCertificadoAtivoValido(input.clienteId);
        
        if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum certificado ativo encontrado" });
        if (vencido) {
          await db.createDownloadLog({
            clienteId: input.clienteId, contabilidadeId: contabId,
            clienteNome: cliente?.razaoSocial ?? "", clienteCnpj: cliente?.cnpj ?? "",
            tipo: "manual", status: "erro", certificadoVencido: true,
            erro: "Certificado digital vencido - download não realizado",
            finalizadoEm: new Date(),
          });
          throw new TRPCError({ code: "BAD_REQUEST", message: "Certificado digital vencido. Renove o certificado para realizar o download." });
        }

        const pfxBase64 = decrypt(cert.certData);
        const senha = decrypt(cert.certSenha);
        const pfxBuffer = Buffer.from(pfxBase64, "base64");
        const certInfo = await extractPfxCertAndKey(pfxBuffer, senha);
        const lastNsu = await db.getUltimoNsu(input.clienteId);

        const isPeriodo = input.modo === "periodo" && input.competenciaInicio;
        const logId = await db.createDownloadLog({
          clienteId: input.clienteId, contabilidadeId: contabId,
          clienteNome: cliente?.razaoSocial ?? "", clienteCnpj: cliente?.cnpj ?? "",
          tipo: "manual", status: "executando", ultimoNsu: lastNsu,
          modo: input.modo || "novas",
          competenciaInicio: input.competenciaInicio || null,
          competenciaFim: input.competenciaFim || null,
          periodoDataInicio: input.dataInicio || null,
          periodoDataFim: input.dataFim || null,
        });

        // Registrar auditoria
        await db.createAuditLog({
          contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
          acao: "download_nfe", entidade: "nfe", entidadeId: input.clienteId,
          detalhes: JSON.stringify({ cliente: cliente?.razaoSocial, cnpj: cliente?.cnpj, modo: input.modo }),
        });

        try {
          // Fase 1: Consultando notas na API Nacional
          await db.updateDownloadLog(logId, { etapa: "Consultando notas na API Nacional..." });
          // Calcular NSU inteligente para período
          let smartNsu = 0;
          if (isPeriodo) {
            if (input.dataInicio) {
              smartNsu = await db.getNsuMinimoPorData(input.clienteId, input.dataInicio, input.dataFim);
            } else if (input.competenciaInicio) {
              smartNsu = await db.getNsuMinimoPorCompetencia(input.clienteId, input.competenciaInicio, input.competenciaFim || input.competenciaInicio);
            }
            if (smartNsu > 0) smartNsu = Math.max(1, smartNsu - 1);
          }
          const docs = await downloadAllDocuments(certInfo.cert, certInfo.key, cert.cnpj, lastNsu + 1,
            async (downloaded) => {
              await db.updateDownloadLog(logId, { progresso: downloaded, etapa: `Consultando API... ${downloaded} nota(s) encontrada(s)` });
            },
            isPeriodo ? {
              competenciaInicio: input.competenciaInicio,
              competenciaFim: input.competenciaFim || input.competenciaInicio,
              dataInicio: input.dataInicio,
              dataFim: input.dataFim,
              smartStartNsu: smartNsu > 0 ? smartNsu : undefined,
              isCancelled: async () => db.isDownloadCancelled(logId),
            } : undefined
          );

          // Se não há notas no período, concluir imediatamente com mensagem clara
          if (docs.length === 0) {
            await db.updateDownloadLog(logId, {
              status: "concluido", totalNotas: 0, notasNovas: 0,
              totalXml: 0, totalPdf: 0, errosPdf: 0,
              ultimoNsu: lastNsu, finalizadoEm: new Date(),
              progresso: 0, totalEsperado: 0,
              etapa: "Nenhuma nota encontrada no período",
            });
            return { success: true, totalDownloaded: 0, notasNovas: 0, pdfsFalharam: 0 };
          }

          // Ler configuração de tentativas máximas
          const maxTentativasStr = await db.getSetting("max_tentativas_pdf");
          const maxTentativas = parseInt(maxTentativasStr || "3", 10);
          const baixarPdfConfig = await db.getSetting("baixar_pdf");
          const baixarPdf = baixarPdfConfig !== "false";

          // Contadores de XML, PDF e erros
          let contXml = 0;
          let contPdf = 0;
          let contErrosPdf = 0;

          // Fase 2: Salvar XMLs no banco (prioridade) + tentar PDF
          const totalDocs = docs.length;
          await db.updateDownloadLog(logId, { totalEsperado: totalDocs, progresso: 0, etapa: `Salvando 0/${totalDocs} nota(s)...` });
          let notasNovas = 0;
          const pdfPendentes: Array<{ doc: typeof docs[0]; index: number }> = [];

          for (let i = 0; i < docs.length; i++) {
            const doc = docs[i];
            const wasCancelled = await db.isDownloadCancelled(logId);
            if (wasCancelled) {
              return { success: false, totalDownloaded: notasNovas, notasNovas, cancelled: true };
            }

            // Tentar buscar PDF (mas não travar se falhar)
            let danfsePdfUrl: string | undefined;
            let danfsePdfKey: string | undefined;
            if (baixarPdf && doc.tipoDocumento === "NFSE" && doc.chaveAcesso) {
              await db.updateDownloadLog(logId, { etapa: `Baixando PDF ${i + 1}/${totalDocs}...` });
              try {
                const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, doc.chaveAcesso);
                if (pdfBuffer) {
                  const pdfKey = `danfse/${contabId}/${input.clienteId}/${doc.chaveAcesso}.pdf`;
                  const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
                  danfsePdfUrl = result.url;
                  danfsePdfKey = result.key;
                  contPdf++;
                } else {
                  pdfPendentes.push({ doc, index: i });
                }
              } catch (e) {
                console.error(`PDF falhou para ${doc.chaveAcesso}, pulando:`, e);
                pdfPendentes.push({ doc, index: i });
              }
            }

            // Salvar nota no banco (XML sempre salva, mesmo sem PDF)
            await db.updateDownloadLog(logId, { etapa: `Salvando nota ${i + 1}/${totalDocs}...` });
            await db.upsertNota({
              clienteId: input.clienteId, contabilidadeId: contabId,
              chaveAcesso: doc.chaveAcesso, nsu: doc.nsu, numeroNota: doc.numeroNota, serie: doc.serie,
              tipoDocumento: doc.tipoDocumento, tipoEvento: doc.tipoEvento,
              direcao: doc.direcao, status: doc.status,
              emitenteCnpj: doc.emitenteCnpj, emitenteNome: doc.emitenteNome,
              tomadorCnpj: doc.tomadorCnpj, tomadorNome: doc.tomadorNome,
              valorServico: doc.valorServico, valorLiquido: doc.valorLiquido, valorRetencao: doc.valorRetencao,
              codigoServico: doc.codigoServico, descricaoServico: doc.descricaoServico,
              dataEmissao: doc.dataEmissao, dataCompetencia: doc.dataCompetencia,
              municipioPrestacao: doc.municipioPrestacao, ufPrestacao: doc.ufPrestacao,
              xmlOriginal: doc.xmlOriginal,
              ...(danfsePdfUrl ? { danfsePdfUrl, danfsePdfKey } : {}),
            });
            contXml++;
            notasNovas++;
            await db.updateDownloadLog(logId, { progresso: notasNovas, totalXml: contXml, totalPdf: contPdf, etapa: `Processando ${notasNovas}/${totalDocs} nota(s)...` });
          }

          // Fase 3: Retry dos PDFs que falharam
          if (baixarPdf && pdfPendentes.length > 0) {
            for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
              if (pdfPendentes.length === 0) break;
              const wasCancelled = await db.isDownloadCancelled(logId);
              if (wasCancelled) break;

              await db.updateDownloadLog(logId, {
                etapa: `Retry ${tentativa}/${maxTentativas}: ${pdfPendentes.length} PDF(s) pendente(s)...`,
              });

              // Aguardar 1s antes de cada retry
              await new Promise(r => setTimeout(r, 1000));

              const aindaPendentes: typeof pdfPendentes = [];
              for (const item of pdfPendentes) {
                const wasCancelled2 = await db.isDownloadCancelled(logId);
                if (wasCancelled2) break;
                try {
                  await db.updateDownloadLog(logId, {
                    etapa: `Retry ${tentativa}/${maxTentativas}: PDF nota ${item.index + 1}/${totalDocs}...`,
                  });
                  const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, item.doc.chaveAcesso);
                  if (pdfBuffer) {
                    const pdfKey = `danfse/${contabId}/${input.clienteId}/${item.doc.chaveAcesso}.pdf`;
                    const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
                    await db.updateNotaByChave(item.doc.chaveAcesso, input.clienteId, {
                      danfsePdfUrl: result.url,
                      danfsePdfKey: result.key,
                    });
                    contPdf++;
                  } else {
                    aindaPendentes.push(item);
                  }
                } catch (e) {
                  console.error(`Retry ${tentativa} falhou para ${item.doc.chaveAcesso}:`, e);
                  aindaPendentes.push(item);
                }
              }
              pdfPendentes.length = 0;
              pdfPendentes.push(...aindaPendentes);
            }
          }

          // Fase 4: Concluído
          contErrosPdf = baixarPdf ? pdfPendentes.length : 0;
          const etapaFinal = baixarPdf && pdfPendentes.length > 0
            ? `Concluído (${pdfPendentes.length} PDF(s) não baixado(s))`
            : "Concluído";
          // Usar contagem REAL do banco para garantir mostradores corretos
          const contagemReal2 = await db.getContagemReaisCliente(input.clienteId, contabId);
          const errosPdfReal2 = contagemReal2.totalXml - contagemReal2.totalPdf;
          await db.updateDownloadLog(logId, {
            status: "concluido", totalNotas: totalDocs, notasNovas,
            totalXml: contagemReal2.totalXml, totalPdf: contagemReal2.totalPdf, errosPdf: errosPdfReal2 > 0 ? errosPdfReal2 : 0,
            ultimoNsu: totalDocs > 0 ? Math.max(...docs.map(d => d.nsu)) : lastNsu,
            finalizadoEm: new Date(), progresso: totalDocs, totalEsperado: totalDocs,
            etapa: etapaFinal,
          });
          return { success: true, totalDownloaded: totalDocs, notasNovas, pdfsFalharam: pdfPendentes.length };
        } catch (error: any) {
          // Identificar tipo de erro e gerar mensagem específica
          const errMsg = error.message || String(error);
          let erroClaro = errMsg;
          if (errMsg.includes("PKCS12") || errMsg.includes("pkcs12") || errMsg.includes("MAC verify")) {
            erroClaro = "Certificado digital inválido ou senha incorreta";
          } else if (errMsg.includes("certificate") || errMsg.includes("SSL") || errMsg.includes("TLS")) {
            erroClaro = "Erro de conexão SSL/TLS com a API Nacional";
          } else if (errMsg.includes("ECONNREFUSED") || errMsg.includes("ENOTFOUND")) {
            erroClaro = "API Nacional indisponível - sem conexão";
          } else if (errMsg.includes("timeout") || errMsg.includes("ETIMEDOUT")) {
            erroClaro = "Timeout na comunicação com a API Nacional";
          } else if (errMsg.includes("socket disconnected") || errMsg.includes("ECONNRESET")) {
            erroClaro = "Conexão interrompida com a API Nacional";
          } else if (errMsg.includes("401") || errMsg.includes("403")) {
            erroClaro = "Certificado não autorizado na API Nacional";
          } else if (errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("503")) {
            erroClaro = "API Nacional retornou erro interno (tente novamente)";
          } else if (errMsg.includes("decrypt") || errMsg.includes("Decrypt")) {
            erroClaro = "Erro ao descriptografar certificado digital";
          }
          await db.updateDownloadLog(logId, { status: "erro", erro: erroClaro, etapa: erroClaro, finalizadoEm: new Date() });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: erroClaro });
        }
      }),

    executeForAll: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        modo: z.enum(["novas", "periodo"]).default("novas"),
        competenciaInicio: z.string().optional(),
        competenciaFim: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const allClientes = await db.getClientesByContabilidade(contabId);
        // Filtrar clientes com certificado válido (excluir vencidos e sem certificado)
        const clientesList: typeof allClientes = [];
        for (const c of allClientes) {
          const { cert, vencido } = await db.getCertificadoAtivoValido(c.id);
          if (cert && !vencido) clientesList.push(c);
        }

        // Deduplicar por CNPJ: cada CNPJ só pode aparecer uma vez na lista de downloads
        const cnpjsSeen = new Set<string>();
        const clientesUnicos: typeof clientesList = [];
        for (const c of clientesList) {
          const cnpjNorm = c.cnpj.replace(/\D/g, '');
          if (!cnpjsSeen.has(cnpjNorm)) {
            cnpjsSeen.add(cnpjNorm);
            clientesUnicos.push(c);
          }
        }
        if (clientesUnicos.length < clientesList.length) {
          console.log(`[Download] Deduplicado: ${clientesList.length} -> ${clientesUnicos.length} empresa(s) (únicas por CNPJ)`);
        }

        const isPeriodo = input.modo === "periodo" && input.competenciaInicio;

        // PASSO 1: Criar TODOS os logs como "pendente" imediatamente
        const logIds: Array<{ clienteId: number; cnpj: string; razaoSocial: string; logId: number }> = [];
        for (const cliente of clientesUnicos) {
          const logId = await db.createDownloadLog({
            clienteId: cliente.id, contabilidadeId: contabId,
            clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
            tipo: "manual", status: "pendente",
            etapa: "Aguardando na fila...",
            modo: input.modo || "novas",
            competenciaInicio: input.competenciaInicio || null,
            competenciaFim: input.competenciaFim || null,
            periodoDataInicio: input.dataInicio || null,
            periodoDataFim: input.dataFim || null,
          });
          logIds.push({ clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId });
        }

        // Registrar auditoria
        await db.createAuditLog({
          contabilidadeId: contabId, userId: ctx.user.id, userName: ctx.user.name || "Sistema",
          acao: "download_nfe_todos", entidade: "nfe",
          detalhes: JSON.stringify({ totalClientes: logIds.length, modo: input.modo }),
        });

        // PASSO 2: Processar em BACKGROUND usando Download Engine v2 (worker pool)
        const processInBackground = async () => {
          const config = await getDownloadConfig();
          const tasks: DownloadTask[] = logIds.map(item => ({
            clienteId: item.clienteId,
            cnpj: item.cnpj,
            razaoSocial: item.razaoSocial,
            logId: item.logId,
          }));

          // No modo "novas" (incremental), remover logs de empresas sem notas novas para não poluir o histórico
          const removeLogSeVazio = input.modo === "novas" || !input.modo;
          await runDownloadEngine(tasks, contabId, async (task) => {
            const cliente = clientesList.find(c => c.id === task.clienteId)!;
            await processClienteDownload(cliente, contabId, isPeriodo, input, task.logId, removeLogSeVazio);
          }, config);

          // Auto-correção após todos terminarem
          const autoCorrecao = await db.getSetting("auto_correcao_pdf");
          if (autoCorrecao === "true") {
            autoRetomarDownloadsComErro(contabId);
          }
          console.log(`[Download] Engine v2 concluído para ${logIds.length} empresa(s)`);
        };

        // Disparar em background (não bloqueia a resposta)
        processInBackground().catch(err => console.error('[Download] Erro geral no background:', err.message));

        // Retornar imediatamente com os logIds criados
        return {
          results: logIds.map(item => ({
            clienteId: item.clienteId, cnpj: item.cnpj, razaoSocial: item.razaoSocial,
            success: true, logId: item.logId,
          })),
          message: `${logIds.length} empresa(s) adicionadas à fila de download`,
        };
      }),

    // Download de múltiplos clientes selecionados
    executeForSelected: contabilidadeProcedure
      .input(z.object({
        clienteIds: z.array(z.number()).min(1),
        contabilidadeId: z.number().optional(),
        modo: z.enum(["novas", "periodo"]).default("novas"),
        competenciaInicio: z.string().optional(),
        competenciaFim: z.string().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const allClientes = await db.getClientesByContabilidade(contabId);
        const selectedClientes = allClientes.filter(c => input.clienteIds.includes(c.id));
        // Filtrar clientes com certificado válido (excluir vencidos e sem certificado)
        const clientesList: typeof selectedClientes = [];
        for (const c of selectedClientes) {
          const { cert, vencido } = await db.getCertificadoAtivoValido(c.id);
          if (cert && !vencido) clientesList.push(c);
        }
        if (clientesList.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum dos clientes selecionados possui certificado digital válido" });
        }

        // Deduplicar por CNPJ: cada CNPJ só pode aparecer uma vez
        const cnpjsSeenSel = new Set<string>();
        const clientesUnicosSel: typeof clientesList = [];
        for (const c of clientesList) {
          const cnpjNorm = c.cnpj.replace(/\D/g, '');
          if (!cnpjsSeenSel.has(cnpjNorm)) {
            cnpjsSeenSel.add(cnpjNorm);
            clientesUnicosSel.push(c);
          }
        }

        const isPeriodo = input.modo === "periodo" && input.competenciaInicio;

        // PASSO 1: Criar TODOS os logs como "pendente" imediatamente
        const logIds: Array<{ clienteId: number; cnpj: string; razaoSocial: string; logId: number }> = [];
        for (const cliente of clientesUnicosSel) {
          const logId = await db.createDownloadLog({
            clienteId: cliente.id, contabilidadeId: contabId,
            clienteNome: cliente.razaoSocial, clienteCnpj: cliente.cnpj,
            tipo: "manual", status: "pendente",
            etapa: "Aguardando na fila...",
            modo: input.modo || "novas",
            competenciaInicio: input.competenciaInicio || null,
            competenciaFim: input.competenciaFim || null,
            periodoDataInicio: input.dataInicio || null,
            periodoDataFim: input.dataFim || null,
          });
          logIds.push({ clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId });
        }

        // PASSO 2: Processar em BACKGROUND usando Download Engine v2 (worker pool)
        const processInBackground = async () => {
          const config = await getDownloadConfig();
          const tasks: DownloadTask[] = logIds.map(item => ({
            clienteId: item.clienteId,
            cnpj: item.cnpj,
            razaoSocial: item.razaoSocial,
            logId: item.logId,
          }));

          // No modo "novas" (incremental), remover logs de empresas sem notas novas para não poluir o histórico
          const removeLogSeVazioSel = input.modo === "novas" || !input.modo;
          await runDownloadEngine(tasks, contabId, async (task) => {
            const cliente = clientesList.find(c => c.id === task.clienteId)!;
            await processClienteDownload(cliente, contabId, isPeriodo, input, task.logId, removeLogSeVazioSel);
          }, config);

          const autoCorrecao = await db.getSetting("auto_correcao_pdf");
          if (autoCorrecao === "true") {
            autoRetomarDownloadsComErro(contabId);
          }
          console.log(`[Download] Engine v2 concluído para ${logIds.length} empresa(s) selecionada(s)`);
        };

        processInBackground().catch(err => console.error('[Download] Erro geral no background:', err.message));

        return {
          results: logIds.map(item => ({
            clienteId: item.clienteId, cnpj: item.cnpj, razaoSocial: item.razaoSocial,
            success: true, logId: item.logId,
          })),
          message: `${logIds.length} empresa(s) adicionadas à fila de download`,
        };
      }),

    // Listar períodos disponíveis com notas baixadas para um ou mais clientes
    periodosDisponiveis: contabilidadeProcedure
      .input(z.object({
        clienteIds: z.array(z.number()),
        contabilidadeId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        return db.getPeriodosDisponiveis(input.clienteIds, contabId);
      }),

    // Gerar ZIP com estrutura de pastas para download individual por cliente
    gerarZipCliente: contabilidadeProcedure
      .input(z.object({
        clienteId: z.number(),
        contabilidadeId: z.number().optional(),
        periodoInicio: z.string().optional(),
        periodoFim: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const cliente = await db.getClienteById(input.clienteId);
        if (!cliente) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });

        const periodoInicio = input.periodoInicio ? new Date(input.periodoInicio) : undefined;
        const periodoFim = input.periodoFim ? new Date(input.periodoFim) : undefined;
        const allNotas = await db.getNotasByClienteForDownload(input.clienteId, contabId, periodoInicio, periodoFim);
        if (allNotas.length === 0) return { base64: "", fileName: "", totalNotas: 0, semNotas: true };

        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        const clienteCnpj = cliente.cnpj?.replace(/\D/g, "") || "";

        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
        const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
        const nomeEmpresa = cliente.razaoSocial.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
        const pastaRaiz = `${nomeEmpresa}_${dateStr}_${timeStr}`;

        // Separar notas por tipo
        const emitidas = allNotas.filter(n => n.direcao === "emitida" && n.status !== "cancelada");
        const tomadas = allNotas.filter(n => n.direcao === "recebida" && n.status !== "cancelada");
        const canceladas = allNotas.filter(n => n.status === "cancelada");

        // Não tentar re-baixar PDFs via mTLS no ZIP (muito lento para muitas notas)
        // Usar apenas PDFs já salvos no S3 durante o download original

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
            const baseNome = `NF${nota.numeroNota || "sem-numero"}_${nota.chaveAcesso}`;
            const nomeArquivo = getUniqueFileName(baseNome, pastaName);
            // XML
            if (nota.xmlOriginal) {
              try {
                const xmlDecoded = decodeXml(nota.xmlOriginal);
                zip.file(`${pastaRaiz}/${pastaName}/${nomeArquivo}.xml`, xmlDecoded);
              } catch {
                zip.file(`${pastaRaiz}/${pastaName}/${nomeArquivo}.xml`, nota.xmlOriginal);
              }
            }
            // PDF (DANFSe) - usar apenas PDFs já salvos no S3 (não re-baixar via mTLS)
            if (nota.danfsePdfUrl) {
              try {
                const resp = await fetch(nota.danfsePdfUrl);
                if (resp.ok) {
                  const pdfBuffer = Buffer.from(await resp.arrayBuffer());
                  if (pdfBuffer.length > 4 && pdfBuffer.toString("utf-8", 0, 4) === "%PDF") {
                    zip.file(`${pastaRaiz}/${pastaName}/${nomeArquivo}.pdf`, pdfBuffer);
                  }
                }
              } catch (e) {
                console.error(`Erro ao baixar PDF do S3 para nota ${nota.numeroNota}:`, e);
              }
            }
          }
        };

        // Adicionar notas nas pastas
        await addNotasToPasta(emitidas, "Notas Emitidas");
        await addNotasToPasta(tomadas, "Notas Tomadas");
        await addNotasToPasta(canceladas, "Notas Canceladas");

        // Gerar relatórios Excel completos com todos os campos fiscais
        if (emitidas.length > 0) {
          const xlsxEmitidas = await gerarRelatorioExcelCompleto(emitidas as any, "Emitidas", clienteCnpj);
          zip.file(`${pastaRaiz}/Relatorio_Emitidas_${nomeEmpresa}.xlsx`, xlsxEmitidas);
        }
        if (tomadas.length > 0) {
          const xlsxTomadas = await gerarRelatorioExcelCompleto(tomadas as any, "Recebidas", clienteCnpj);
          zip.file(`${pastaRaiz}/Relatorio_Recebidas_${nomeEmpresa}.xlsx`, xlsxTomadas);
        }
        if (canceladas.length > 0) {
          const xlsxCanceladas = await gerarRelatorioExcelCompleto(canceladas as any, "Canceladas", clienteCnpj);
          zip.file(`${pastaRaiz}/Relatorio_Canceladas_${nomeEmpresa}.xlsx`, xlsxCanceladas);
        }

        // 4º relatório: Emitidas + Canceladas juntas (com coluna Status)
        const emitidasECanceladas = [...emitidas, ...canceladas];
        if (emitidasECanceladas.length > 0) {
          const xlsxEmitidasCanceladas = await gerarRelatorioExcelCompleto(emitidasECanceladas as any, "Emitidas_e_Canceladas", clienteCnpj);
          zip.file(`${pastaRaiz}/Relatorio_Emitidas_e_Canceladas_${nomeEmpresa}.xlsx`, xlsxEmitidasCanceladas);
        }

        // Gerar ZIP e retornar como base64 (sem dependência de S3)
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
        const base64 = zipBuffer.toString("base64");

        return { base64, fileName: `${pastaRaiz}.zip`, totalNotas: allNotas.length, emitidas: emitidas.length, tomadas: tomadas.length, canceladas: canceladas.length };
      }),

    // Gerar ZIP consolidado para múltiplos clientes selecionados
    gerarZipMultiplos: contabilidadeProcedure
      .input(z.object({
        clienteIds: z.array(z.number()).min(1),
        contabilidadeId: z.number().optional(),
        periodoInicio: z.string().optional(),
        periodoFim: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();

        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
        const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
        const pastaRaiz = `Notas_${input.clienteIds.length}empresas_${dateStr}_${timeStr}`;

        const periodoInicio = input.periodoInicio ? new Date(input.periodoInicio) : undefined;
        const periodoFim = input.periodoFim ? new Date(input.periodoFim) : undefined;

        let totalNotas = 0;
        let totalEmpresas = 0;

        for (const clienteId of input.clienteIds) {
          const cliente = await db.getClienteById(clienteId);
          if (!cliente) continue;

          const allNotas = await db.getNotasByClienteForDownload(clienteId, contabId, periodoInicio, periodoFim);
          if (allNotas.length === 0) continue;

          totalEmpresas++;
          totalNotas += allNotas.length;

          const nomeEmpresa = cliente.razaoSocial.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
          const pastaEmpresa = `${pastaRaiz}/${nomeEmpresa}_${cliente.cnpj.replace(/[^0-9]/g, "")}`;

          const emitidas = allNotas.filter(n => n.direcao === "emitida" && n.status !== "cancelada");
          const tomadas = allNotas.filter(n => n.direcao === "recebida" && n.status !== "cancelada");
          const canceladas = allNotas.filter(n => n.status === "cancelada");

          // Buscar certificado do cliente para retry de DANFSe
          const { cert: certObjMulti } = await db.getCertificadoAtivoValido(clienteId);
          let certInfoMulti: { cert: string; key: string } | null = null;
          if (certObjMulti) {
            try {
              const pfxBase64 = decrypt(certObjMulti.certData);
              const senha = decrypt(certObjMulti.certSenha);
              const pfxBuffer = Buffer.from(pfxBase64, "base64");
              certInfoMulti = await extractPfxCertAndKey(pfxBuffer, senha);
            } catch (e) {
              console.error("Erro ao extrair certificado para ZIP multiplos:", e);
            }
          }

          const fetchPdfRetryMulti = async (chaveAcesso: string, maxRetries = 3): Promise<Buffer | null> => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                if (certInfoMulti) {
                  const pdfBuffer = await fetchDanfsePdf(certInfoMulti.cert, certInfoMulti.key, chaveAcesso);
                  if (pdfBuffer) return pdfBuffer;
                }
              } catch (e) {
                console.error(`Tentativa ${attempt}/${maxRetries} falhou para DANFSe ${chaveAcesso}:`, e);
              }
              if (attempt < maxRetries) await new Promise(r => setTimeout(r, 1000 * attempt));
            }
            return null;
          };

          const usedNamesMulti = new Map<string, number>();
          const getUniqueNameMulti = (base: string, pasta: string): string => {
            const key = `${pasta}/${base}`;
            const count = usedNamesMulti.get(key) || 0;
            usedNamesMulti.set(key, count + 1);
            return count > 0 ? `${base}_${count}` : base;
          };

          const addNotasToPasta = async (notasList: typeof allNotas, pastaName: string) => {
            for (const nota of notasList) {
              const baseNome = `NF${nota.numeroNota || "sem-numero"}_${nota.chaveAcesso}`;
              const nomeArquivo = getUniqueNameMulti(baseNome, pastaName);
              if (nota.xmlOriginal) {
                try {
                  const xmlDecoded = decodeXml(nota.xmlOriginal);
                  zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.xml`, xmlDecoded);
                } catch {
                  zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.xml`, nota.xmlOriginal);
                }
              }
              // PDF - tentar do S3 primeiro, se não tiver buscar via mTLS com retry
              let pdfAdded = false;
              if (nota.danfsePdfUrl) {
                try {
                  const resp = await fetch(nota.danfsePdfUrl);
                  if (resp.ok) {
                    const pdfBuffer = Buffer.from(await resp.arrayBuffer());
                    if (pdfBuffer.length > 4 && pdfBuffer.toString("utf-8", 0, 4) === "%PDF") {
                      zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.pdf`, pdfBuffer);
                      pdfAdded = true;
                    }
                  }
                } catch (e) {
                  console.error(`Erro ao baixar PDF do S3 para nota ${nota.numeroNota}:`, e);
                }
              }
              if (!pdfAdded && nota.tipoDocumento !== "EVENTO" && certInfoMulti) {
                const pdfBuffer = await fetchPdfRetryMulti(nota.chaveAcesso);
                if (pdfBuffer) {
                  zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.pdf`, pdfBuffer);
                  // Tentar salvar no S3 opcionalmente (não bloqueia se falhar)
                  try {
                    const pdfKey = `danfse/${contabId}/${clienteId}/${nota.chaveAcesso}.pdf`;
                    const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
                    await db.updateNota(nota.id, { danfsePdfUrl: result.url, danfsePdfKey: result.key });
                  } catch (_e) {
                    // S3 opcional - PDF já foi adicionado ao ZIP
                  }
                }
              }
            }
          };

          const clienteCnpjMulti = cliente.cnpj?.replace(/\D/g, "") || "";

          await addNotasToPasta(emitidas, "Notas Emitidas");
          await addNotasToPasta(tomadas, "Notas Tomadas");
          await addNotasToPasta(canceladas, "Notas Canceladas");

          if (emitidas.length > 0) {
            const xlsx = await gerarRelatorioExcelCompleto(emitidas as any, "Emitidas", clienteCnpjMulti);
            zip.file(`${pastaEmpresa}/Relatorio_Emitidas.xlsx`, xlsx);
          }
          if (tomadas.length > 0) {
            const xlsx = await gerarRelatorioExcelCompleto(tomadas as any, "Recebidas", clienteCnpjMulti);
            zip.file(`${pastaEmpresa}/Relatorio_Recebidas.xlsx`, xlsx);
          }
          if (canceladas.length > 0) {
            const xlsx = await gerarRelatorioExcelCompleto(canceladas as any, "Canceladas", clienteCnpjMulti);
            zip.file(`${pastaEmpresa}/Relatorio_Canceladas.xlsx`, xlsx);
          }

          // 4º relatório: Emitidas + Canceladas juntas (com coluna Status)
          const emitidasECanceladas = [...emitidas, ...canceladas];
          if (emitidasECanceladas.length > 0) {
            const xlsx = await gerarRelatorioExcelCompleto(emitidasECanceladas as any, "Emitidas_e_Canceladas", clienteCnpjMulti);
            zip.file(`${pastaEmpresa}/Relatorio_Emitidas_e_Canceladas.xlsx`, xlsx);
          }
        }

        if (totalNotas === 0) {
          return { base64: "", fileName: "", totalNotas: 0, totalEmpresas: 0, semNotas: true };
        }

        const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
        const base64 = zipBuffer.toString("base64");

        return { base64, fileName: `${pastaRaiz}.zip`, totalNotas, totalEmpresas };
      }),

    // Iniciar geração de ZIP de todas as empresas de forma assíncrona
    iniciarZipTodas: contabilidadeProcedure
      .input(z.object({
        clienteIds: z.array(z.number()).min(1),
        contabilidadeId: z.number().optional(),
        periodoInicio: z.string().optional(),
        periodoFim: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const jobId = `zip_todas_${contabId}_${Date.now()}`;
        const periodoInicio = input.periodoInicio ? new Date(input.periodoInicio) : undefined;
        const periodoFim = input.periodoFim ? new Date(input.periodoFim) : undefined;

        // Salvar status inicial
        await db.upsertSetting(jobId, JSON.stringify({
          status: "processando",
          total: input.clienteIds.length,
          processados: 0,
          empresaAtual: "",
          totalNotas: 0,
          totalEmpresas: 0,
          erros: 0,
          semNotas: 0,
          iniciado: new Date().toISOString(),
        }));

        // Processar em background (não bloqueia a resposta)
        (async () => {
          try {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            const now = new Date();
            const dateStr = now.toLocaleDateString("pt-BR").replace(/\//g, "");
            const timeStr = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
            const pastaRaiz = `Notas_${input.clienteIds.length}empresas_${dateStr}_${timeStr}`;

            let totalNotas = 0;
            let totalEmpresas = 0;
            let erros = 0;
            let semNotas = 0;

            for (let i = 0; i < input.clienteIds.length; i++) {
              // Verificar se foi cancelado
              const currentStatusStr = await db.getSetting(jobId);
              if (currentStatusStr) {
                const currentStatus = JSON.parse(currentStatusStr);
                if (currentStatus.status === "cancelado") {
                  console.log(`ZIP job ${jobId} cancelado pelo usuário na empresa ${i+1}/${input.clienteIds.length}`);
                  return;
                }
              }

              const clienteId = input.clienteIds[i];
              const cliente = await db.getClienteById(clienteId);
              if (!cliente) { erros++; continue; }

              // Atualizar progresso
              await db.upsertSetting(jobId, JSON.stringify({
                status: "processando",
                total: input.clienteIds.length,
                processados: i,
                empresaAtual: cliente.razaoSocial,
                totalNotas,
                totalEmpresas,
                erros,
                semNotas,
                iniciado: now.toISOString(),
              }));

              try {
                const allNotas = await db.getNotasByClienteForDownload(clienteId, contabId, periodoInicio, periodoFim);
                if (allNotas.length === 0) { semNotas++; continue; }

                totalEmpresas++;
                totalNotas += allNotas.length;

                const nomeEmpresa = cliente.razaoSocial.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 50);
                const pastaEmpresa = `${pastaRaiz}/${nomeEmpresa}_${cliente.cnpj.replace(/[^0-9]/g, "")}`;
                const clienteCnpj = cliente.cnpj?.replace(/\D/g, "") || "";

                const emitidas = allNotas.filter(n => n.direcao === "emitida" && n.status !== "cancelada");
                const tomadas = allNotas.filter(n => n.direcao === "recebida" && n.status !== "cancelada");
                const canceladas = allNotas.filter(n => n.status === "cancelada");

                // Adicionar XMLs nas pastas
                const usedNames = new Map<string, number>();
                const getUniqueName = (base: string, pasta: string): string => {
                  const key = `${pasta}/${base}`;
                  const count = usedNames.get(key) || 0;
                  usedNames.set(key, count + 1);
                  return count > 0 ? `${base}_${count}` : base;
                };

                const addNotasToPasta = async (notasList: typeof allNotas, pastaName: string) => {
                  for (const nota of notasList) {
                    const baseNome = `NF${nota.numeroNota || "sem-numero"}_${nota.chaveAcesso}`;
                    const nomeArquivo = getUniqueName(baseNome, pastaName);
                    if (nota.xmlOriginal) {
                      try {
                        const xmlDecoded = decodeXml(nota.xmlOriginal);
                        zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.xml`, xmlDecoded);
                      } catch {
                        zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.xml`, nota.xmlOriginal);
                      }
                    }
                    // Adicionar PDF se disponível
                    if (nota.danfsePdfUrl) {
                      try {
                        const resp = await fetch(nota.danfsePdfUrl);
                        if (resp.ok) {
                          const pdfBuf = Buffer.from(await resp.arrayBuffer());
                          zip.file(`${pastaEmpresa}/${pastaName}/${nomeArquivo}.pdf`, pdfBuf);
                        }
                      } catch { /* PDF opcional */ }
                    }
                  }
                };

                await addNotasToPasta(emitidas, "Notas Emitidas");
                await addNotasToPasta(tomadas, "Notas Tomadas");
                await addNotasToPasta(canceladas, "Notas Canceladas");

                // Gerar relatórios Excel completos
                if (emitidas.length > 0) {
                  const xlsx = await gerarRelatorioExcelCompleto(emitidas as any, "Emitidas", clienteCnpj);
                  zip.file(`${pastaEmpresa}/Relatorio_Emitidas.xlsx`, xlsx);
                }
                if (tomadas.length > 0) {
                  const xlsx = await gerarRelatorioExcelCompleto(tomadas as any, "Recebidas", clienteCnpj);
                  zip.file(`${pastaEmpresa}/Relatorio_Recebidas.xlsx`, xlsx);
                }
                if (canceladas.length > 0) {
                  const xlsx = await gerarRelatorioExcelCompleto(canceladas as any, "Canceladas", clienteCnpj);
                  zip.file(`${pastaEmpresa}/Relatorio_Canceladas.xlsx`, xlsx);
                }

                // 4º relatório: Emitidas + Canceladas juntas (com coluna Status)
                const emitidasECanceladas = [...emitidas, ...canceladas];
                if (emitidasECanceladas.length > 0) {
                  const xlsx = await gerarRelatorioExcelCompleto(emitidasECanceladas as any, "Emitidas_e_Canceladas", clienteCnpj);
                  zip.file(`${pastaEmpresa}/Relatorio_Emitidas_e_Canceladas.xlsx`, xlsx);
                }
              } catch (e) {
                console.error(`Erro ao processar empresa ${clienteId} para ZIP:`, e);
                erros++;
              }
            }

            if (totalNotas === 0) {
              await db.upsertSetting(jobId, JSON.stringify({
                status: "concluido",
                total: input.clienteIds.length,
                processados: input.clienteIds.length,
                empresaAtual: "",
                totalNotas: 0,
                totalEmpresas: 0,
                erros,
                semNotas,
                iniciado: now.toISOString(),
                finalizado: new Date().toISOString(),
                downloadUrl: null,
              }));
              return;
            }

            // Gerar ZIP e fazer upload para S3
            const zipBuffer = await zip.generateAsync({
              type: "nodebuffer",
              compression: "DEFLATE",
              compressionOptions: { level: 6 },
            });

            const fileName = `${pastaRaiz}.zip`;
            const fileKey = `zips/${contabId}/${fileName}`;
            const { url } = await storagePut(fileKey, zipBuffer, "application/zip");

            await db.upsertSetting(jobId, JSON.stringify({
              status: "concluido",
              total: input.clienteIds.length,
              processados: input.clienteIds.length,
              empresaAtual: "",
              totalNotas,
              totalEmpresas,
              erros,
              semNotas,
              iniciado: now.toISOString(),
              finalizado: new Date().toISOString(),
              downloadUrl: url,
              fileName,
            }));
          } catch (e) {
            console.error("Erro fatal na geração do ZIP Todas:", e);
            await db.upsertSetting(jobId, JSON.stringify({
              status: "erro",
              mensagem: e instanceof Error ? e.message : "Erro desconhecido",
              total: input.clienteIds.length,
              processados: 0,
              totalNotas: 0,
              totalEmpresas: 0,
              erros: 1,
              semNotas: 0,
            }));
          }
        })();

        return { jobId };
      }),

    // Cancelar geração de ZIP Todas
    cancelarZipTodas: contabilidadeProcedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ input }) => {
        const statusStr = await db.getSetting(input.jobId);
        if (!statusStr) return { success: false, message: "Job não encontrado" };
        const status = JSON.parse(statusStr);
        if (status.status === "processando") {
          await db.upsertSetting(input.jobId, JSON.stringify({
            ...status,
            status: "cancelado",
            mensagem: "Cancelado pelo usuário",
            finalizado: new Date().toISOString(),
          }));
          return { success: true, message: "ZIP cancelado com sucesso" };
        }
        return { success: false, message: "Job não está em processamento" };
      }),

    // Consultar status do ZIP Todas assíncrono
    zipTodasStatus: contabilidadeProcedure
      .input(z.object({ jobId: z.string() }))
      .query(async ({ input }) => {
        const statusStr = await db.getSetting(input.jobId);
        if (!statusStr) return null;
        return JSON.parse(statusStr) as {
          status: string;
          total: number;
          processados: number;
          empresaAtual: string;
          totalNotas: number;
          totalEmpresas: number;
          erros: number;
          semNotas: number;
          iniciado?: string;
          finalizado?: string;
          downloadUrl?: string | null;
          fileName?: string;
          mensagem?: string;
        };
      }),

    logs: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verHistorico");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        // Auto-fix downloads travados (mais de 10 min) com auto-retry
        const stalledLogs = await db.getStallledDownloads(contabId);
        if (stalledLogs.length > 0) {
          const maxTentativasStr = await db.getSetting("max_tentativas_pdf");
          const maxTentativas = parseInt(maxTentativasStr || "3", 10);
          for (const stalled of stalledLogs) {
            const tentativasAtuais = (stalled.tentativas ?? 0) + 1;
            if (tentativasAtuais >= maxTentativas) {
              // Excedeu tentativas - marcar como erro definitivo
              await db.markStalledAsError(stalled.id, tentativasAtuais);
            } else {
              // Ainda tem tentativas - marcar para retry
              await db.markStalledForRetry(stalled.id, tentativasAtuais);
            }
          }
        }
        return db.getDownloadLogsByContabilidade(contabId, 1000);
      }),

    // Resumo do lote de downloads (card de resumo final)
    batchSummary: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verHistorico");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);

        // Ler status do engine
        const statusRaw = await db.getSetting(`download_engine_status_${contabId}`);
        if (!statusRaw) return { ativo: false } as const;

        let engineStatus: { total: number; concluidas: number; erros: number; executando: number; naFila: number; iniciadoEm: number; finalizadoEm?: number; activeLogIds?: number[] };
        try {
          engineStatus = JSON.parse(statusRaw);
        } catch {
          return { ativo: false } as const;
        }

        // Verificar se o lote terminou (nenhum executando/na fila)
        // IMPORTANTE: Verificar também se há auto-retomada ativa com logs pendentes/retomando
        // Durante a auto-retomada, o engine pode ter finalizadoEm de uma rodada anterior,
        // mas ainda há logs pendentes para a próxima rodada
        const autoRetomadaRaw = await db.getSetting(`auto_retomada_status_${contabId}`);
        let autoRetomadaAtiva = false;
        if (autoRetomadaRaw) {
          try {
            const ar = JSON.parse(autoRetomadaRaw);
            autoRetomadaAtiva = ar.fase === 'retomando' || ar.fase === 'aguardando';
          } catch {}
        }
        const loteTerminou = engineStatus.finalizadoEm && engineStatus.executando === 0 && engineStatus.naFila === 0 && !autoRetomadaAtiva;

        // Buscar logs para calcular estatísticas detalhadas
        // SIMPLIFICADO: Usar TODOS os logs da contabilidade sem filtro de timestamp.
        // O filtro por timestamp causava problemas de timezone (MySQL timestamp vs JS Date.now()).
        // Como os logs são limpos pelo "Limpar Histórico", não há risco de poluição.
        const logs = await db.getDownloadLogsByContabilidade(contabId, 1000);

        // Calcular estatísticas agregadas
        const concluidos = logs.filter((l: any) => l.status === "concluido");
        const comErro = logs.filter((l: any) => l.status === "erro");
        const cancelados = logs.filter((l: any) => l.status === "cancelado");
        const retomando = logs.filter((l: any) => l.status === "retomando");
        const pendentes = logs.filter((l: any) => l.status === "pendente");
        const executando = logs.filter((l: any) => l.status === "executando");

        // Concluídos com notas vs sem notas
        const comNotas = concluidos.filter((l: any) => (l.totalXml ?? 0) > 0);
        const semNotas = concluidos.filter((l: any) => (l.totalXml ?? 0) === 0);

        // Certificados vencidos (dentro dos erros)
        const certVencidos = comErro.filter((l: any) => l.certificadoVencido === true || l.certificadoVencido === 1);
        const errosSemCertVencido = comErro.filter((l: any) => !(l.certificadoVencido === true || l.certificadoVencido === 1));

        // Totais de XMLs e PDFs
        const totalXmls = logs.reduce((acc: number, l: any) => acc + (l.totalXml ?? 0), 0);
        const totalPdfs = logs.reduce((acc: number, l: any) => acc + (l.totalPdf ?? 0), 0);
        const totalErrosPdf = logs.reduce((acc: number, l: any) => acc + (l.errosPdf ?? 0), 0);
        const totalNotas = logs.reduce((acc: number, l: any) => acc + (l.totalNotas ?? 0), 0);
        const notasNovas = logs.reduce((acc: number, l: any) => acc + (l.notasNovas ?? 0), 0);

        // Tempo de execução
        // Se auto-retomada está ativa, continuar contando o tempo mesmo que o engine tenha finalizadoEm
        const tempoExecucaoMs = (engineStatus.finalizadoEm && !autoRetomadaAtiva)
          ? engineStatus.finalizadoEm - engineStatus.iniciadoEm
          : Date.now() - engineStatus.iniciadoEm;

        // Total de empresas: usar o total dos logs do lote atual
        const totalEmpresas = logs.length;

        // Porcentagem de sucesso (concluídos com notas / total processados)
        const processadas = concluidos.length + comErro.length + cancelados.length;
        const percentSucesso = processadas > 0 ? Math.round((comNotas.length / processadas) * 100) : 0;

        // Usar contagem do engine (tempo real) para executando quando o lote está ativo
        // O banco pode mostrar 0 executando por timing, mas o engine sabe quantos workers estão ativos
        const executandoReal = (!loteTerminou && engineStatus.executando > 0)
          ? engineStatus.executando
          : executando.length;
        const naFilaReal = (!loteTerminou)
          ? Math.max(0, retomando.length + pendentes.length)
          : 0;

        // Empresas que serão retomadas (retomando + pendentes + executando)
        const aindaSerao = retomando.length + pendentes.length + executandoReal;

        return {
          ativo: true,
          loteTerminou: !!loteTerminou,
          totalEmpresas,
          concluidos: concluidos.length,
          comNotas: comNotas.length,
          semNotas: semNotas.length,
          comErro: comErro.length,
          certVencidos: certVencidos.length,
          errosSemCertVencido: errosSemCertVencido.length,
          cancelados: cancelados.length,
          retomando: retomando.length,
          pendentes: naFilaReal,
          executando: executandoReal,
          aindaSerao,
          totalXmls,
          totalPdfs,
          totalErrosPdf,
          totalNotas,
          notasNovas,
          tempoExecucaoMs,
          percentSucesso,
          iniciadoEm: engineStatus.iniciadoEm,
          finalizadoEm: engineStatus.finalizadoEm ?? null,
          activeLogIds: engineStatus.activeLogIds ?? [],
        };
      }),

    // Cancelar todos os downloads em andamento
    cancelAll: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        // 1. Sinalizar cancelamento global (flag que a auto-retomada verifica)
        await db.upsertSetting(`cancel_all_flag_${contabId}`, "true");
        // 2. Cancelar todos os downloads em andamento no banco
        const affected = await db.cancelDownloadsEmAndamento(contabId);
        // 3. Limpar status da auto-retomada para parar o loop
        await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
        // 4. Limpar o engine status para que o frontend não mostre "em andamento"
        await db.upsertSetting(`download_engine_status_${contabId}`, "");
        console.log(`[CancelAll] Contabilidade ${contabId}: ${affected} download(s) cancelado(s), auto-retomada parada, flag ativada`);
        // 5. Limpar flag após 30s (tempo suficiente para loops detectarem)
        setTimeout(async () => {
          try { await db.upsertSetting(`cancel_all_flag_${contabId}`, ""); } catch (_) {}
        }, 30000);
        return { success: true, cancelled: affected };
      }),

    // Cancelar um download específico
    cancelOne: contabilidadeProcedure
      .input(z.object({ logId: z.number(), contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const ok = await db.cancelDownloadById(input.logId, contabId);
        return { success: ok };
      }),

    // Retomar download que falhou ou foi cancelado
    retry: contabilidadeProcedure
      .input(z.object({
        logId: z.number(),
        contabilidadeId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        // Buscar o log original para obter o clienteId
        const logs = await db.getDownloadLogsByContabilidade(contabId, 1000);
        const log = logs.find((l: any) => l.id === input.logId);
        if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Download não encontrado" });
        if (log.status !== "erro" && log.status !== "cancelado") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Só é possível retomar downloads com erro ou cancelados" });
        }
        if (!log.clienteId) throw new TRPCError({ code: "BAD_REQUEST", message: "Download sem cliente vinculado" });

        const cliente = await db.getClienteById(log.clienteId);
        const { cert, vencido } = await db.getCertificadoAtivoValido(log.clienteId);
        if (!cert) throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum certificado ativo encontrado" });
        if (vencido) throw new TRPCError({ code: "BAD_REQUEST", message: "Certificado digital vencido" });

        // Atualizar o log existente para "retomando" (reutilizar em vez de criar novo)
        await db.updateDownloadLog(input.logId, {
          status: "retomando", erro: null, etapa: "Retomando download...",
          progresso: 0, totalEsperado: 0, totalNotas: 0, notasNovas: 0,
          totalXml: 0, totalPdf: 0, errosPdf: 0, certificadoVencido: false,
          finalizadoEm: null, iniciadoEm: new Date(),
        });

        // Processar usando processClienteDownload com o logId existente
        // IMPORTANTE: Ler o período salvo no log para respeitar o filtro original
        const { isPeriodo: logIsPeriodo, input: logPeriodoInput } = extractPeriodoFromLog(log);
        if (logIsPeriodo) {
          console.log(`[Retry] Retomando com período original: ${logPeriodoInput.competenciaInicio || logPeriodoInput.dataInicio} a ${logPeriodoInput.competenciaFim || logPeriodoInput.dataFim}`);
        }
        const clienteObj = { id: log.clienteId, cnpj: cliente?.cnpj ?? log.clienteCnpj ?? "", razaoSocial: cliente?.razaoSocial ?? log.clienteNome ?? "" };
        try {
          const result = await processClienteDownload(clienteObj, contabId, logIsPeriodo, logPeriodoInput, input.logId);
          return { success: result.success, totalDownloaded: result.total ?? 0, notasNovas: result.total ?? 0 };
        } catch (error: any) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
        }
      }),

    // Retomar TODOS os downloads com erro ou cancelados
    retryAll: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const logs = await db.getDownloadLogsByContabilidade(contabId, 1000);
        const logsComErro = logs.filter((l: any) => l.status === "erro" || l.status === "cancelado");
        if (logsComErro.length === 0) {
          return { success: true, total: 0, message: "Nenhum download com erro ou cancelado encontrado" };
        }

        // PASSO 1: Marcar TODOS os logs com erro como "pendente" (na fila)
        // O engine mudará para "executando" quando realmente começar a processar cada um
        for (const log of logsComErro) {
          await db.updateDownloadLog(log.id, {
            status: "pendente", erro: null, etapa: "Aguardando retomada...",
            progresso: 0, totalEsperado: 0, totalNotas: 0, notasNovas: 0,
            totalXml: 0, totalPdf: 0, errosPdf: 0, certificadoVencido: false,
            finalizadoEm: null, iniciadoEm: new Date(),
          });
        }

        // PASSO 2: Processar em background usando Download Engine v2
        const retryInBackground = async () => {
          const config = await getDownloadConfig();
          // Filtrar logs válidos e preparar tasks
          const validTasks: DownloadTask[] = [];
          for (const log of logsComErro) {
            if (!log.clienteId) continue;
            const cliente = await db.getClienteById(log.clienteId);
            if (!cliente) continue;
            const { cert, vencido } = await db.getCertificadoAtivoValido(log.clienteId);
            if (!cert || vencido) {
              await db.updateDownloadLog(log.id, {
                status: "erro", erro: !cert ? "Sem certificado ativo" : "Certificado vencido",
                etapa: !cert ? "Sem certificado" : "Certificado vencido",
                certificadoVencido: !!vencido, finalizadoEm: new Date(),
              });
              continue;
            }
            validTasks.push({ clienteId: log.clienteId, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId: log.id });
          }

          if (validTasks.length > 0) {
            await runDownloadEngine(validTasks, contabId, async (task) => {
              const cliente = await db.getClienteById(task.clienteId);
              if (!cliente) throw new Error("Cliente não encontrado");
              // IMPORTANTE: Ler o período salvo no log para respeitar o filtro original
              const taskLog = logsComErro.find((l: any) => l.id === task.logId);
              const { isPeriodo: taskIsPeriodo, input: taskPeriodoInput } = taskLog ? extractPeriodoFromLog(taskLog) : { isPeriodo: false, input: {} };
              if (taskIsPeriodo) {
                console.log(`[RetryAll] ${cliente.razaoSocial}: retomando com período ${taskPeriodoInput.competenciaInicio || taskPeriodoInput.dataInicio} a ${taskPeriodoInput.competenciaFim || taskPeriodoInput.dataFim}`);
              }
              const clienteObj = { id: task.clienteId, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial };
              await processClienteDownload(clienteObj, contabId, taskIsPeriodo, taskPeriodoInput, task.logId);
            }, config);
          }
          console.log(`[RetryAll] Engine v2 concluído: ${validTasks.length} retomados`);
        };

        // Disparar em background (não bloquear a resposta)
        retryInBackground().catch(err => console.error('[RetryAll] Erro geral:', err.message));

        return { success: true, total: logsComErro.length, retomados: logsComErro.length, falhas: 0 };
      }),

    // ═══════════════════════════════════════════════════════════════════
    // RETOMAR SOMENTE PDFs: Re-tenta baixar PDFs (DANFSe) de notas que já têm XML
    // ═══════════════════════════════════════════════════════════════════
    retryPdfs: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "fazerDownloads");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);

        // Buscar todos os clientes da contabilidade
        const clientes = await db.getClientesByContabilidade(contabId);
        if (clientes.length === 0) {
          return { success: true, totalPdfs: 0, message: "Nenhum cliente encontrado" };
        }

        // Contar total de PDFs pendentes
        let totalPendentes = 0;
        const clientesComPdfPendente: { clienteId: number; razaoSocial: string; cnpj: string; chaves: string[] }[] = [];
        for (const cliente of clientes) {
          const notasSemPdf = await db.getNotasSemPdf(cliente.id, contabId);
          if (notasSemPdf.length > 0) {
            totalPendentes += notasSemPdf.length;
            clientesComPdfPendente.push({
              clienteId: cliente.id,
              razaoSocial: cliente.razaoSocial,
              cnpj: cliente.cnpj,
              chaves: notasSemPdf.map(n => n.chaveAcesso).filter(Boolean) as string[],
            });
          }
        }

        if (totalPendentes === 0) {
          return { success: true, totalPdfs: 0, message: "Todos os PDFs já foram baixados" };
        }

        // Ler configuração de tentativas
        const maxTentConfig = await db.getSetting("retry_pdfs_max_tentativas");
        const maxTentativas = maxTentConfig ? parseInt(maxTentConfig) : 3;
        const infinito = maxTentConfig === "infinito";

        // Salvar status para o frontend acompanhar
        await db.upsertSetting(`retry_pdfs_status_${contabId}`, JSON.stringify({
          fase: "executando", total: totalPendentes, processados: 0, sucesso: 0, falhas: 0,
          inicioEm: Date.now(),
        }));

        // Processar em background
        (async () => {
          let totalSucesso = 0;
          let totalFalhas = 0;
          let processados = 0;

          for (const item of clientesComPdfPendente) {
            // Verificar cancelamento
            const cancelFlag = await db.getSetting(`retry_pdfs_cancel_${contabId}`);
            if (cancelFlag === "true") {
              await db.upsertSetting(`retry_pdfs_cancel_${contabId}`, "");
              break;
            }

            try {
              const { cert, vencido } = await db.getCertificadoAtivoValido(item.clienteId);
              if (!cert || vencido) {
                totalFalhas += item.chaves.length;
                processados += item.chaves.length;
                continue;
              }
              const certInfo = extractPfxCertAndKey(cert.pfxBase64, cert.senha);

              for (const chave of item.chaves) {
                // Verificar cancelamento
                const cancelCheck = await db.getSetting(`retry_pdfs_cancel_${contabId}`);
                if (cancelCheck === "true") break;

                let sucesso = false;
                const tentativasMax = infinito ? 999 : maxTentativas;
                for (let tent = 1; tent <= tentativasMax; tent++) {
                  try {
                    const pdfBuffer = await fetchDanfsePdf(certInfo.cert, certInfo.key, chave);
                    if (pdfBuffer) {
                      const pdfKey = `danfse/${contabId}/${item.clienteId}/${chave}.pdf`;
                      const result = await storagePut(pdfKey, pdfBuffer, "application/pdf");
                      await db.updateNotaByChave(chave, item.clienteId, { danfsePdfUrl: result.url, danfsePdfKey: result.key });
                      sucesso = true;
                      break;
                    }
                  } catch (e) {
                    // Aguardar antes de tentar novamente
                    if (tent < tentativasMax) {
                      await new Promise(r => setTimeout(r, 2000 * tent));
                    }
                  }
                }

                if (sucesso) totalSucesso++;
                else totalFalhas++;
                processados++;

                // Atualizar status
                await db.upsertSetting(`retry_pdfs_status_${contabId}`, JSON.stringify({
                  fase: "executando", total: totalPendentes, processados, sucesso: totalSucesso, falhas: totalFalhas,
                  empresa: item.razaoSocial, inicioEm: Date.now(),
                }));
              }
            } catch (err: any) {
              console.error(`[RetryPDFs] Erro cliente ${item.clienteId}:`, err.message);
              totalFalhas += item.chaves.length;
              processados += item.chaves.length;
            }
          }

          // Finalizar
          await db.upsertSetting(`retry_pdfs_status_${contabId}`, JSON.stringify({
            fase: "concluido", total: totalPendentes, processados, sucesso: totalSucesso, falhas: totalFalhas,
            finalizadoEm: Date.now(),
          }));

          // Limpar status após 30s
          setTimeout(async () => {
            await db.upsertSetting(`retry_pdfs_status_${contabId}`, "");
          }, 30000);

          // Atualizar os logs de download com os novos totais de PDF
          const logs = await db.getDownloadLogsByContabilidade(contabId, 1000);
          for (const log of logs) {
            if (log.status === "concluido" && log.clienteId) {
              const notasSemPdf = await db.getNotasSemPdf(log.clienteId, contabId);
              // Se diminuiu o número de PDFs faltantes, atualizar o log
              const errosPdfAtual = notasSemPdf.length;
              if (errosPdfAtual !== (log.errosPdf ?? 0)) {
                await db.updateDownloadLog(log.id, {
                  errosPdf: errosPdfAtual,
                  totalPdf: (log.totalXml ?? 0) - errosPdfAtual,
                });
              }
            }
          }

          console.log(`[RetryPDFs] Concluído: ${totalSucesso} sucesso, ${totalFalhas} falhas de ${totalPendentes} total`);
        })().catch(err => console.error('[RetryPDFs] Erro geral:', err.message));

        return { success: true, totalPdfs: totalPendentes, empresas: clientesComPdfPendente.length };
      }),

    // Cancelar retomada de PDFs
    cancelRetryPdfs: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        await db.upsertSetting(`retry_pdfs_cancel_${contabId}`, "true");
        return { success: true };
      }),

    // Limpar histórico de downloads (concluídos, erros, cancelados)
    clearHistory: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verHistorico");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const deleted = await db.clearDownloadHistory(contabId);
        return { success: true, deleted };
      }),

    // Relatório de histórico de downloads em PDF
    historicoRelatorioPdf: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verHistorico");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const logs = await db.getDownloadLogsByContabilidade(contabId, 1000);
        const contab = await db.getContabilidadeById(contabId);
        const contabNome = contab?.nome || "Contabilidade";
        const userName = ctx.user.name || ctx.user.email || "Usu\u00e1rio";
        const now = new Date();
        const dataStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        const horaStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });

        const PDFDocument = (await import("pdfkit")).default;
        const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        const pdfDone = new Promise<Buffer>((resolve) => {
          doc.on("end", () => resolve(Buffer.concat(chunks)));
        });

        // Cores do tema
        const PRIMARY = "#1E3A5F";
        const SUCCESS = "#16A34A";
        const ERROR = "#DC2626";
        const WARNING = "#F59E0B";
        const INFO = "#2563EB";
        const GRAY = "#6B7280";
        const LIGHT_BG = "#F8FAFC";
        const BORDER = "#E2E8F0";
        const pageW = 842; // A4 landscape
        const margin = 30;
        const contentW = pageW - margin * 2;

        // ═══════════════════════════════════════════════
        // CABE\u00c7ALHO PRINCIPAL
        // ═══════════════════════════════════════════════
        // Fundo azul escuro do cabe\u00e7alho
        doc.rect(0, 0, pageW, 85).fill(PRIMARY);

        // T\u00edtulo
        doc.fontSize(20).font("Helvetica-Bold").fillColor("#FFFFFF");
        doc.text("Relat\u00f3rio de Hist\u00f3rico de Downloads", margin, 18, { align: "center", width: contentW });

        // Subtitulo - contabilidade
        doc.fontSize(11).font("Helvetica").fillColor("#CBD5E1");
        doc.text(contabNome, margin, 45, { align: "center", width: contentW });

        // Linha de info: usu\u00e1rio, data, hora
        doc.fontSize(8).fillColor("#94A3B8");
        doc.text(`Gerado por: ${userName}  |  Data: ${dataStr}  |  Hora: ${horaStr}`, margin, 65, { align: "center", width: contentW });

        // ═══════════════════════════════════════════════
        // RESUMO EM CARDS
        // ═══════════════════════════════════════════════
        const total = logs.length;
        const concluidosLogs = logs.filter(l => l.status === "concluido");
        const concluidos = concluidosLogs.length;
        const comNotas = concluidosLogs.filter(l => (l.totalXml || 0) > 0).length;
        const semNotas = concluidosLogs.filter(l => (l.totalXml || 0) === 0).length;
        const errosLogs = logs.filter(l => l.status === "erro");
        const erros = errosLogs.length;
        const certVencidos = errosLogs.filter((l: any) => l.certificadoVencido === true || l.certificadoVencido === 1).length;
        const errosSemCert = erros - certVencidos;
        const cancelados = logs.filter(l => l.status === "cancelado").length;
        const executando = logs.filter(l => l.status === "executando").length;
        const pendentes = logs.filter(l => l.status === "pendente").length;
        const retomando = logs.filter(l => l.status === "retomando").length;
        const totalNotas = logs.reduce((s, l) => s + (l.totalNotas || 0), 0);
        const totalNovas = logs.reduce((s, l) => s + (l.notasNovas || 0), 0);
        const totalXml = logs.reduce((s, l) => s + (l.totalXml || 0), 0);
        const totalPdf = logs.reduce((s, l) => s + (l.totalPdf || 0), 0);
        const totalErrosPdf = logs.reduce((s, l) => s + (l.errosPdf || 0), 0);
        const processadas = concluidos + erros + cancelados;
        const percentSucesso = processadas > 0 ? Math.round((comNotas / processadas) * 100) : 0;

        const cardY = 95;
        const cardH = 52;
        const cardGap = 5;
        const numCards = 8;
        const cardW = (contentW - cardGap * (numCards - 1)) / numCards;

        const cards = [
          { label: "Total Empresas", value: String(total), color: PRIMARY },
          { label: "Sucesso", value: String(comNotas), color: SUCCESS },
          { label: "Sem Notas", value: String(semNotas), color: GRAY },
          { label: "Erros", value: String(errosSemCert), color: ERROR },
          { label: "Cert. Vencido", value: String(certVencidos), color: WARNING },
          { label: "XMLs Baixados", value: String(totalXml), color: INFO },
          { label: "PDFs Baixados", value: String(totalPdf), color: "#059669" },
          { label: "Erros PDF", value: String(totalErrosPdf), color: ERROR },
        ];

        cards.forEach((card, i) => {
          const cx = margin + i * (cardW + cardGap);
          // Card background
          doc.roundedRect(cx, cardY, cardW, cardH, 4).fill(LIGHT_BG);
          // Barra lateral colorida
          doc.rect(cx, cardY, 4, cardH).fill(card.color);
          // Valor grande
          doc.fontSize(18).font("Helvetica-Bold").fillColor(card.color).text(card.value, cx + 10, cardY + 8, { width: cardW - 16, align: "center" });
          // Label
          doc.fontSize(7).font("Helvetica").fillColor(GRAY).text(card.label, cx + 6, cardY + 32, { width: cardW - 12, align: "center" });
        });

        // ═══════════════════════════════════════════════
        // MINI GR\u00c1FICO DE PIZZA (Status Distribution)
        // ═══════════════════════════════════════════════
        const chartY = cardY + cardH + 12;
        const chartCenterX = margin + 60;
        const chartCenterY = chartY + 40;
        const chartR = 30;

        // Fundo do gr\u00e1fico
        doc.roundedRect(margin, chartY, 180, 82, 4).fill(LIGHT_BG);
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#1E293B").text("Distribui\u00e7\u00e3o por Status", margin + 8, chartY + 5);

        // Desenhar pizza
        const slices = [
          { value: concluidos, color: SUCCESS, label: "Conclu\u00eddos" },
          { value: erros, color: ERROR, label: "Erros" },
          { value: cancelados, color: "#F97316", label: "Cancelados" },
          { value: executando, color: INFO, label: "Executando" },
          { value: pendentes, color: WARNING, label: "Na Fila" },
        ].filter(s => s.value > 0);

        if (slices.length > 0 && total > 0) {
          let startAngle = -Math.PI / 2;
          for (const slice of slices) {
            const sliceAngle = (slice.value / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;
            // Desenhar fatia
            doc.save();
            doc.moveTo(chartCenterX, chartCenterY);
            // Arco manual com lineTo
            const steps = Math.max(20, Math.ceil(sliceAngle * 20));
            for (let s = 0; s <= steps; s++) {
              const angle = startAngle + (sliceAngle * s) / steps;
              const px = chartCenterX + chartR * Math.cos(angle);
              const py = chartCenterY + chartR * Math.sin(angle);
              doc.lineTo(px, py);
            }
            doc.lineTo(chartCenterX, chartCenterY);
            doc.fill(slice.color);
            doc.restore();
            startAngle = endAngle;
          }
        } else {
          // C\u00edrculo vazio
          doc.circle(chartCenterX, chartCenterY, chartR).fill(BORDER);
        }

        // Legenda do gr\u00e1fico
        const legendX = margin + 105;
        let legendY = chartY + 18;
        const allSlices = [
          { value: concluidos, color: SUCCESS, label: "Conclu\u00eddos" },
          { value: erros, color: ERROR, label: "Erros" },
          { value: cancelados, color: "#F97316", label: "Cancelados" },
          { value: executando, color: INFO, label: "Executando" },
          { value: pendentes, color: WARNING, label: "Na Fila" },
        ];
        for (const item of allSlices) {
          doc.rect(legendX, legendY, 6, 6).fill(item.color);
          doc.fontSize(6.5).font("Helvetica").fillColor("#374151");
          doc.text(`${item.label}: ${item.value}`, legendX + 10, legendY - 0.5, { width: 65 });
          legendY += 11;
        }

        // ═══════════════════════════════════════════════
        // RESUMO DETALHADO (ao lado do gr\u00e1fico)
        // ═══════════════════════════════════════════════
        const detailX = margin + 195;
        doc.roundedRect(detailX, chartY, contentW - 195, 92, 4).fill(LIGHT_BG);
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#1E293B").text("Detalhes do Processamento", detailX + 10, chartY + 5);

        const detailItems = [
          [`Usu\u00e1rio: ${userName}`, `Data: ${dataStr}`, `Hora: ${horaStr}`],
          [`Total empresas: ${total}`, `Sucesso (com notas): ${comNotas}`, `Sem notas: ${semNotas}`],
          [`Erros: ${errosSemCert}`, `Cert. vencido: ${certVencidos}`, `Cancelados: ${cancelados}`],
          [`XMLs baixados: ${totalXml}`, `PDFs baixados: ${totalPdf}`, `Erros PDF: ${totalErrosPdf}`],
          [`Total notas: ${totalNotas}`, `Notas novas: ${totalNovas}`, `Taxa de sucesso: ${percentSucesso}%`],
        ];

        let detY = chartY + 20;
        doc.fontSize(7).font("Helvetica").fillColor("#374151");
        for (const row of detailItems) {
          const colWidth = (contentW - 195 - 20) / 3;
          row.forEach((text, ci) => {
            doc.text(text, detailX + 10 + ci * colWidth, detY, { width: colWidth });
          });
          detY += 13;
        }

        // ═══════════════════════════════════════════════
        // TABELA DE REGISTROS
        // ═══════════════════════════════════════════════
        const tableStartY = chartY + 102;
        doc.y = tableStartY;

        // Colunas da tabela (ajustadas para linhas maiores)
        const colX = [margin, margin + 95, margin + 290, margin + 410, margin + 465, margin + 510, margin + 555, margin + 600, margin + 680];
        const colW = [95, 195, 120, 55, 45, 45, 45, 80, 102];
        const hdrs = ["Data/Hora", "Empresa", "CNPJ", "Tipo", "XML", "PDF", "Erros", "Status", "Etapa"];

        // Fun\u00e7\u00e3o para desenhar cabe\u00e7alho da tabela
        const drawTableHeader = () => {
          const hdrY = doc.y;
          doc.rect(margin, hdrY - 2, contentW, 18).fill(PRIMARY);
          doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#FFFFFF");
          hdrs.forEach((h, i) => {
            doc.text(h, colX[i] + 3, hdrY + 2, { width: colW[i] - 6, lineBreak: false });
          });
          doc.y = hdrY + 20;
        };

        drawTableHeader();

        // Fun\u00e7\u00e3o para desenhar \u00edcone de status
        const drawStatusIcon = (x: number, y: number, status: string) => {
          switch (status) {
            case "concluido":
              doc.circle(x + 3, y + 4, 3.5).fill(SUCCESS);
              break;
            case "erro":
              doc.circle(x + 3, y + 4, 3.5).fill(ERROR);
              break;
            case "executando":
              doc.circle(x + 3, y + 4, 3.5).fill(INFO);
              break;
            case "pendente":
              doc.circle(x + 3, y + 4, 3.5).fill(WARNING);
              break;
            case "cancelado":
              doc.circle(x + 3, y + 4, 3.5).fill("#F97316");
              break;
            case "retomando":
              doc.circle(x + 3, y + 4, 3.5).fill("#9333EA");
              break;
          }
        };

        const statusMap: Record<string, string> = { concluido: "Conclu\u00eddo", executando: "Executando", erro: "Erro", cancelado: "Cancelado", pendente: "Na Fila", retomando: "Retomando" };
        const tipoMap: Record<string, string> = { manual: "Manual", agendado: "Agend." };
        const rowH = 22; // Linhas maiores

        for (let idx = 0; idx < logs.length; idx++) {
          const log = logs[idx];
          if (doc.y + rowH > 545) {
            doc.addPage();
            drawTableHeader();
          }
          const rowY = doc.y;

          // Fundo alternado
          if (idx % 2 === 0) {
            doc.rect(margin, rowY - 2, contentW, rowH).fill("#F8FAFC");
          } else {
            doc.rect(margin, rowY - 2, contentW, rowH).fill("#FFFFFF");
          }

          // Borda inferior
          doc.moveTo(margin, rowY + rowH - 2).lineTo(margin + contentW, rowY + rowH - 2).strokeColor(BORDER).lineWidth(0.5).stroke();

          const textY = rowY + 3;
          const dateStr = log.iniciadoEm ? new Date(log.iniciadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-";

          doc.fontSize(7).font("Helvetica").fillColor("#374151");
          doc.text(dateStr, colX[0] + 3, textY, { width: colW[0] - 6, lineBreak: false });
          doc.text((log.clienteNome || "-").substring(0, 38), colX[1] + 3, textY, { width: colW[1] - 6, lineBreak: false });
          doc.text(log.clienteCnpj || "-", colX[2] + 3, textY, { width: colW[2] - 6, lineBreak: false });
          doc.text(tipoMap[log.tipo] || log.tipo || "-", colX[3] + 3, textY, { width: colW[3] - 6, lineBreak: false });
          doc.text(String(log.totalXml ?? 0), colX[4] + 3, textY, { width: colW[4] - 6, lineBreak: false });
          doc.text(String(log.totalPdf ?? 0), colX[5] + 3, textY, { width: colW[5] - 6, lineBreak: false });

          // Erros PDF com cor
          const errosPdfVal = log.errosPdf ?? 0;
          if (errosPdfVal > 0) {
            doc.fillColor(ERROR).text(String(errosPdfVal), colX[6] + 3, textY, { width: colW[6] - 6, lineBreak: false });
          } else {
            doc.fillColor("#374151").text("0", colX[6] + 3, textY, { width: colW[6] - 6, lineBreak: false });
          }

          // Status com \u00edcone
          drawStatusIcon(colX[7] + 3, textY - 1, log.status);
          doc.fontSize(7).font("Helvetica-Bold");
          const statusColor = log.status === "concluido" ? SUCCESS : log.status === "erro" ? ERROR : log.status === "executando" ? INFO : log.status === "pendente" ? WARNING : log.status === "retomando" ? "#9333EA" : "#F97316";
          doc.fillColor(statusColor).text(statusMap[log.status] || log.status, colX[7] + 14, textY, { width: colW[7] - 17, lineBreak: false });

          // Etapa
          doc.font("Helvetica").fillColor(GRAY).fontSize(6.5);
          doc.text((log.etapa || "-").substring(0, 30), colX[8] + 3, textY, { width: colW[8] - 6, lineBreak: false });

          doc.y = rowY + rowH;
        }

        // ═══════════════════════════════════════════════
        // RODAPÉ + MARCA D'ÁGUA (sem criar páginas extras)
        // ═══════════════════════════════════════════════
        const pages = doc.bufferedPageRange();
        const totalPages = pages.count;
        const { getWatermarkBuffer } = await import("./pdf-watermark");
        const watermarkBuf = await getWatermarkBuffer();

        for (let i = pages.start; i < pages.start + totalPages; i++) {
          doc.switchToPage(i);

          // Marca d'água (antes do rodapé para ficar atrás)
          if (watermarkBuf) {
            const pw = doc.page.width;
            const ph = doc.page.height;
            const imgAspect = 1920 / 1080;
            const tw = pw * 0.55;
            const th = tw / imgAspect;
            doc.save();
            doc.opacity(0.05);
            doc.image(watermarkBuf, (pw - tw) / 2, (ph - th) / 2, { width: tw, height: th });
            doc.opacity(1);
            doc.restore();
          }

          // Linha do rodapé
          doc.moveTo(margin, 555).lineTo(margin + contentW, 555).strokeColor(BORDER).lineWidth(0.5).stroke();
          // Rodapé esquerdo (posição fixa, sem lineBreak para não criar página)
          doc.fontSize(6.5).fillColor(GRAY).font("Helvetica");
          doc.text(
            `Pegasus NFSe - Lan7 Tecnologia  |  ${contabNome}  |  Gerado em ${dataStr} às ${horaStr}`,
            margin, 559,
            { width: contentW / 2, lineBreak: false }
          );
          // Rodapé direito
          doc.text(
            `Página ${i - pages.start + 1} de ${totalPages}`,
            margin + contentW / 2, 559,
            { width: contentW / 2, align: "right", lineBreak: false }
          );
        }

        doc.end();
        const pdfBuffer = await pdfDone;
        const base64 = pdfBuffer.toString("base64");
        return { base64, fileName: `historico_downloads_${new Date().toISOString().split("T")[0]}.pdf` };
      }),

    // Relatório de histórico de downloads em Excel
    historicoRelatorioExcel: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verHistorico");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const logs = await db.getDownloadLogsByContabilidade(contabId, 1000);

        const ExcelJS = (await import("exceljs")).default;
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Histórico Downloads");

        sheet.columns = [
          { header: "Data/Hora Início", key: "inicio", width: 20 },
          { header: "Data/Hora Fim", key: "fim", width: 20 },
          { header: "Empresa", key: "empresa", width: 40 },
          { header: "CNPJ", key: "cnpj", width: 22 },
          { header: "Tipo", key: "tipo", width: 12 },
          { header: "Total Notas", key: "totalNotas", width: 14 },
          { header: "Notas Novas", key: "notasNovas", width: 14 },
          { header: "Progresso", key: "progresso", width: 14 },
          { header: "Status", key: "status", width: 14 },
          { header: "Etapa", key: "etapa", width: 35 },
          { header: "Erro", key: "erro", width: 40 },
        ];

        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
        headerRow.alignment = { horizontal: "center" };

        const fmtDate = (d: Date | null) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "-";
        const statusMap: Record<string, string> = { concluido: "Concluído", executando: "Executando", erro: "Erro", cancelado: "Cancelado", pendente: "Pendente", retomando: "Retomando" };
        const tipoMap: Record<string, string> = { manual: "Manual", agendado: "Agendado" };

        for (const log of logs) {
          sheet.addRow({
            inicio: fmtDate(log.iniciadoEm),
            fim: fmtDate(log.finalizadoEm),
            empresa: log.clienteNome || "-",
            cnpj: log.clienteCnpj || "-",
            tipo: tipoMap[log.tipo] || log.tipo || "-",
            totalNotas: log.totalNotas ?? 0,
            notasNovas: log.notasNovas ?? 0,
            progresso: log.totalEsperado ? `${log.progresso || 0}/${log.totalEsperado}` : `${log.progresso || 0}`,
            status: statusMap[log.status] || log.status,
            etapa: log.etapa || "-",
            erro: log.erro || "-",
          });
        }

        // Summary row
        const totalNotas = logs.reduce((s, l) => s + (l.totalNotas || 0), 0);
        const totalNovas = logs.reduce((s, l) => s + (l.notasNovas || 0), 0);
        const totalRow = sheet.addRow({
          inicio: "TOTAL",
          totalNotas,
          notasNovas: totalNovas,
        });
        totalRow.font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const base64 = Buffer.from(buffer as ArrayBuffer).toString("base64");
        return { base64, filename: `historico_downloads_${new Date().toISOString().slice(0, 10)}.xlsx` };
      }),
  }),

  // ─── Dashboard (por contabilidade) ─────────────────────────────
  dashboard: router({
    stats: protectedProcedure
      .input(z.object({ contabilidadeId: z.number().optional(), clienteId: z.number().optional(), mes: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verDashboard");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        return db.getDashboardStats(contabId, input?.clienteId, input?.mes);
      }),
    allClientes: protectedProcedure
      .input(z.object({ contabilidadeId: z.number().optional(), mes: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verDashboard");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        return db.getDashboardAllClientes(contabId, input.mes);
      }),
    exportPdf: protectedProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        mes: z.string().optional(),
        clienteId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verDashboard");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const stats = await db.getDashboardStats(contabId, input.clienteId, input.mes);
        const allClientes = input.clienteId ? [] : await db.getDashboardAllClientes(contabId, input.mes);
        if (!stats) throw new TRPCError({ code: "NOT_FOUND", message: "Sem dados" });

        const contab = await db.getContabilidadeById(contabId);
        const mesLabel = input.mes ? new Date(input.mes + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Todos os per\u00edodos";

        const PDFDocument = (await import("pdfkit")).default;
        const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));

        // Header
        doc.fontSize(18).fillColor("#1e3a5f").text("Relat\u00f3rio do Dashboard", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor("#666").text(`Contabilidade: ${contab?.nome || "N/A"} | Per\u00edodo: ${mesLabel}`, { align: "center" });
        doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, { align: "center" });
        doc.moveDown(1);

        // Cards de resumo - layout adaptativo
        const cardY = doc.y;
        const cards = [
          { label: "Total Notas", value: stats.totalNotas.toLocaleString("pt-BR"), color: "#3b82f6" },
          { label: "Emitidas", value: stats.emitidas.toLocaleString("pt-BR"), color: "#10b981" },
          { label: "Recebidas", value: stats.recebidas.toLocaleString("pt-BR"), color: "#f59e0b" },
          { label: "Canceladas", value: stats.canceladas.toLocaleString("pt-BR"), color: "#ef4444" },
          { label: "Valor Total", value: `R$ ${stats.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, color: "#8b5cf6" },
          { label: "Clientes", value: stats.totalClientes.toLocaleString("pt-BR"), color: "#06b6d4" },
        ];
        const totalW = 720; // landscape A4 usable width
        const gap = 8;
        const cardW = Math.floor((totalW - gap * (cards.length - 1)) / cards.length);
        const cardH = 55;
        const startX = 40;
        cards.forEach((card, i) => {
          const x = startX + i * (cardW + gap);
          doc.save();
          doc.roundedRect(x, cardY, cardW, cardH, 4).fillAndStroke("#f8fafc", "#e2e8f0");
          // Auto-size font for value to fit card width
          let fontSize = 16;
          const maxValWidth = cardW - 10;
          while (fontSize > 8 && doc.fontSize(fontSize).widthOfString(card.value) > maxValWidth) { fontSize -= 1; }
          doc.fillColor(card.color).fontSize(fontSize).text(card.value, x + 5, cardY + 10, { width: maxValWidth, align: "center" });
          doc.fillColor("#64748b").fontSize(8).text(card.label, x + 5, cardY + 34, { width: maxValWidth, align: "center" });
          doc.restore();
        });
        doc.y = cardY + cardH + 20;

        // Top Clientes table - listar TODOS os clientes
        const tableData = allClientes.length > 0 ? allClientes : stats.topClientes;
        if (tableData.length > 0) {
          doc.fontSize(12).fillColor("#1e3a5f").text("Top Clientes por Valor", 40);
          doc.moveDown(0.5);

          const colWidths = [30, 280, 80, 100, 100, 100];
          const headers = ["#", "Cliente", "Notas", "Emitido", "Recebido", "Total"];
          let ty = doc.y;
          // Header row
          doc.save();
          doc.rect(40, ty, 690, 18).fill("#1e3a5f");
          let cx = 40;
          headers.forEach((h, i) => {
            doc.fillColor("#ffffff").fontSize(8).text(h, cx + 4, ty + 4, { width: colWidths[i] - 8, align: i >= 2 ? "right" : "left" });
            cx += colWidths[i];
          });
          doc.restore();
          ty += 18;

          tableData.forEach((c: any, idx: number) => {
            if (ty > 520) { doc.addPage(); ty = 40; }
            const bg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            doc.save();
            doc.rect(40, ty, 690, 16).fill(bg);
            cx = 40;
            const vals = [
              String(idx + 1),
              c.razaoSocial?.substring(0, 45) || "N/A",
              c.totalNotas?.toLocaleString("pt-BR") || "0",
              `R$ ${(c.valorEmitido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              `R$ ${(c.valorRecebido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
              `R$ ${(c.valorTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            ];
            vals.forEach((v, i) => {
              doc.fillColor("#334155").fontSize(7).text(v, cx + 4, ty + 4, { width: colWidths[i] - 8, align: i >= 2 ? "right" : "left" });
              cx += colWidths[i];
            });
            doc.restore();
            ty += 16;
          });
        }

        // Marca d'água em todas as páginas
        const { addWatermarkToAllPages: addWm3 } = await import("./pdf-watermark");
        await addWm3(doc);

        doc.end();
        await new Promise<void>(r => doc.on("end", r));
        return { base64: Buffer.concat(chunks).toString("base64"), filename: `dashboard_${input.mes || "geral"}.pdf` };
      }),
    exportExcel: protectedProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        mes: z.string().optional(),
        clienteId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verDashboard");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const stats = await db.getDashboardStats(contabId, input.clienteId, input.mes);
        const allClientes = input.clienteId ? [] : await db.getDashboardAllClientes(contabId, input.mes);
        if (!stats) throw new TRPCError({ code: "NOT_FOUND", message: "Sem dados" });

        const contab = await db.getContabilidadeById(contabId);
        const mesLabel = input.mes ? new Date(input.mes + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "Todos os per\u00edodos";

        const { gerarExcelDashboard } = await import("./excel-dashboard");
        const buffer = await gerarExcelDashboard(stats, allClientes, contab?.nome || "N/A", mesLabel);
        return { base64: buffer.toString("base64"), filename: `dashboard_${input.mes || "geral"}.xlsx` };
      }),
  }),

  // ─── Agendamentos (por contabilidade) ──────────────────────────
  agendamento: router({
    list: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAgendamentos");
        const contabId = await getContabilidadeId(ctx.user, input?.contabilidadeId);
        return db.getAgendamentosByContabilidade(contabId);
      }),
    create: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        clienteId: z.number().nullable().optional(),
        frequencia: z.enum(["diario", "semanal", "mensal", "dia_util"]),
        horario: z.string(),
        diaSemana: z.number().optional(),
        diaMes: z.number().optional(),
        diaUtil: z.number().optional(),
        mesAlvo: z.number().optional(),
        dataInicial: z.string().optional(), // YYYY-MM-DD
        dataFinal: z.string().optional(),
        periodoTipo: z.enum(["fixo", "relativo"]).optional(),
        periodoDias: z.number().optional(),
        tipoDocumento: z.enum(["nfe", "cte", "ambos"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAgendamentos");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        // Check plan limits
        const id = await db.createAgendamento({
          contabilidadeId: contabId,
          clienteId: input.clienteId ?? undefined,
          frequencia: input.frequencia,
          horario: input.horario,
          diaSemana: input.diaSemana,
          diaMes: input.diaMes,
          diaUtil: input.diaUtil,
          mesAlvo: input.mesAlvo,
          dataInicial: input.dataInicial,
          dataFinal: input.dataFinal,
          periodoTipo: input.periodoTipo || "fixo",
          periodoDias: input.periodoDias,
        });
        return { id };
      }),
    update: contabilidadeProcedure
      .input(z.object({
        id: z.number(), frequencia: z.enum(["diario", "semanal", "mensal", "dia_util"]).optional(),
        horario: z.string().optional(), diaSemana: z.number().optional(),
        diaMes: z.number().optional(), diaUtil: z.number().optional(),
        mesAlvo: z.number().optional(), ativo: z.boolean().optional(),
        clienteId: z.number().nullable().optional(),
        dataInicial: z.string().optional(), // YYYY-MM-DD
        dataFinal: z.string().optional(), // YYYY-MM-DD
        periodoTipo: z.enum(["fixo", "relativo"]).optional(),
        periodoDias: z.number().optional(),
        tipoDocumento: z.enum(["nfe", "cte", "ambos"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAgendamentos");
        const { id, ...data } = input;
        await db.updateAgendamento(id, data);
        // Recalcular próxima execução se horário ou frequência mudaram
        if (data.horario || data.frequencia || data.diaSemana !== undefined || data.diaMes !== undefined || data.diaUtil !== undefined || data.mesAlvo !== undefined) {
          const { calcularProximaExecucao } = await import("./scheduler");
          const agendamentoAtualizado = await db.getAgendamentoById(id);
          if (agendamentoAtualizado) {
            const proxima = calcularProximaExecucao(agendamentoAtualizado);
            await db.updateAgendamento(id, { proximaExecucao: proxima });
          }
        }
        return { success: true };
      }),
    delete: contabilidadeProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "gerenciarAgendamentos");
        await db.deleteAgendamento(input.id);
        return { success: true };
      }),
  }),

  // ─── Relatórios (por contabilidade) ─────────────────────────
  relatorio: router({
    getData: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        clienteId: z.number().optional(),
        direcao: z.enum(["emitida", "recebida"]).optional(),
        status: z.string().optional(),
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
      }))
      .query(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verRelatorios");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const notasRaw = await db.getNotasForRelatorio(contabId, {
          clienteId: input.clienteId,
          direcao: input.direcao,
          status: input.status,
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });

        // Enriquecer cada nota com dados completos do XML
        return notasRaw.map(nota => {
          let xmlCompleto: NfseCompleta | null = null;
          if (nota.xmlOriginal) {
            try {
              const xmlText = decodeXml(nota.xmlOriginal);
              const cnpjCliente = nota.emitenteCnpj || nota.tomadorCnpj || "";
              xmlCompleto = parseNfseXmlCompleto(xmlText, cnpjCliente);
            } catch (e) {
              // Se falhar o parse, continua sem dados extras
            }
          }
          return {
            id: nota.id,
            clienteId: nota.clienteId,
            numeroNota: nota.numeroNota,
            dataEmissao: nota.dataEmissao,
            dataCompetencia: nota.dataCompetencia,
            emitenteCnpj: nota.emitenteCnpj,
            emitenteNome: nota.emitenteNome,
            tomadorCnpj: nota.tomadorCnpj,
            tomadorNome: nota.tomadorNome,
            valorServico: nota.valorServico,
            valorLiquido: nota.valorLiquido,
            direcao: nota.direcao,
            status: nota.status,
            codigoServico: nota.codigoServico,
            descricaoServico: nota.descricaoServico,
            municipioPrestacao: nota.municipioPrestacao,
            chaveAcesso: nota.chaveAcesso,
            // Campos IBS/CBS (Reforma Tributaria)
            temIbsCbs: nota.temIbsCbs,
            cstIbsCbs: nota.cstIbsCbs,
            cIndOp: nota.cIndOp,
            finNFSe: nota.finNFSe,
            vBcIbsCbs: nota.vBcIbsCbs,
            aliqIbsUf: nota.aliqIbsUf,
            aliqIbsMun: nota.aliqIbsMun,
            aliqCbs: nota.aliqCbs,
            vIbsUf: nota.vIbsUf,
            vIbsMun: nota.vIbsMun,
            vCbs: nota.vCbs,
            vTotTribIbsCbs: nota.vTotTribIbsCbs,
            vPis: nota.vPis,
            vCofins: nota.vCofins,
            cstPisCofins: nota.cstPisCofins,
            pDifUf: nota.pDifUf,
            pDifMun: nota.pDifMun,
            pDifCbs: nota.pDifCbs,
            // Dados completos do XML
            xml: xmlCompleto,
          };
        });
      }),
    exportExcel: contabilidadeProcedure
      .input(z.object({
        contabilidadeId: z.number().optional(),
        clienteId: z.number().optional(),
        direcao: z.enum(["emitida", "recebida"]).optional(),
        status: z.string().optional(),
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        checkPermissao(ctx.user, "verRelatorios");
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const data = await db.getNotasForRelatorio(contabId, {
          clienteId: input.clienteId,
          direcao: input.direcao,
          status: input.status,
          dataInicio: input.dataInicio,
          dataFim: input.dataFim,
        });

        // Parse XML completo de cada nota
        const notasComXml = data.map(nota => {
          let raw: NfseCompletaRaw | null = null;
          if (nota.xmlOriginal) {
            try {
              const xmlText = decodeXml(nota.xmlOriginal);
              raw = parseNfseXmlCompletoRaw(xmlText, nota.emitenteCnpj || nota.tomadorCnpj || "");
            } catch (e) { /* ignora */ }
          }
          return { ...nota, raw };
        });

        const contab = await db.getContabilidadeById(contabId);
        const direcaoLabel = input.direcao === "emitida" ? "Emitidas" : input.direcao === "recebida" ? "Recebidas" : "Todas";

        const { gerarExcelRelatorio } = await import("./excel-relatorio");
        const buffer = await gerarExcelRelatorio(notasComXml as any, contab?.nome || "N/A", direcaoLabel);
        const base64 = buffer.toString("base64");
        return { base64, filename: `Relatorio_Completo_${input.direcao ?? "Todas"}_${new Date().toISOString().slice(0, 10)}.xlsx` };
      }),
  }),

  // ─── Seed data for testing ────────────────────────────────────
  seed: router({
    generate: adminProcedure.mutation(async ({ ctx }) => {
      // Create a test plano
      const planoId = await db.createPlano({
        nome: "Plano Básico", descricao: "Até 20 clientes", maxClientes: 20,
        maxCertificados: 20, maxDownloadsDia: 200, permiteAgendamento: true, preco: "99.90",
      });
      const planoProId = await db.createPlano({
        nome: "Plano Profissional", descricao: "Até 100 clientes", maxClientes: 100,
        maxCertificados: 100, maxDownloadsDia: 1000, permiteAgendamento: true, preco: "299.90",
      });

      // Create test contabilidade
      const contabId = await db.createContabilidade({
        nome: "Contabilidade Exemplo Ltda", cnpj: "12.345.678/0001-90",
        email: "contato@exemplo.com.br", telefone: "(47) 3083-3385",
        ownerId: ctx.user.id, planoId: planoId,
      });
      await db.updateUserRole(ctx.user.id, "admin", contabId);

      const clienteIds: number[] = [];
      const empresas = [
        { cnpj: "34.324.910/0001-41", razaoSocial: "LAN7 Tecnologia Ltda", cidade: "Itajaí", uf: "SC" },
        { cnpj: "11.222.333/0001-44", razaoSocial: "Tech Solutions SA", cidade: "São Paulo", uf: "SP" },
        { cnpj: "55.666.777/0001-88", razaoSocial: "Consultoria ABC Ltda", cidade: "Curitiba", uf: "PR" },
        { cnpj: "99.888.777/0001-66", razaoSocial: "Serviços XYZ ME", cidade: "Florianópolis", uf: "SC" },
      ];
      for (const emp of empresas) {
        const id = await db.createCliente({ contabilidadeId: contabId, ...emp });
        clienteIds.push(id);
      }

      const now = new Date();
      let notasCount = 0;
      for (const clienteId of clienteIds) {
        const cliente = await db.getClienteById(clienteId);
        if (!cliente) continue;
        for (let m = 0; m < 12; m++) {
          const numNotas = Math.floor(Math.random() * 8) + 3;
          for (let n = 0; n < numNotas; n++) {
            const date = new Date(now.getFullYear(), now.getMonth() - m, Math.floor(Math.random() * 28) + 1);
            const valor = (Math.random() * 5000 + 500).toFixed(2);
            const isEmitida = Math.random() > 0.4;
            const isCancelada = Math.random() < 0.1;
            const chave = `${Date.now()}${Math.random().toString(36).slice(2, 15)}${clienteId}${m}${n}`.padEnd(50, "0").slice(0, 50);
            await db.upsertNota({
              clienteId, contabilidadeId: contabId, chaveAcesso: chave,
              nsu: notasCount + 1, numeroNota: String(notasCount + 1), serie: "1",
              tipoDocumento: "NFSE", direcao: isEmitida ? "emitida" : "recebida",
              status: isCancelada ? "cancelada" : "valida",
              emitenteCnpj: isEmitida ? cliente.cnpj : "00.111.222/0001-33",
              emitenteNome: isEmitida ? cliente.razaoSocial : "Fornecedor Teste SA",
              tomadorCnpj: isEmitida ? "00.111.222/0001-33" : cliente.cnpj,
              tomadorNome: isEmitida ? "Cliente Tomador Ltda" : cliente.razaoSocial,
              valorServico: valor, valorLiquido: valor, codigoServico: "010701",
              descricaoServico: "Serviço de tecnologia da informação",
              dataEmissao: date, dataCompetencia: date,
              municipioPrestacao: cliente.cidade || "Itajaí", ufPrestacao: cliente.uf || "SC",
            });
            notasCount++;
          }
        }
      }
      return { contabilidadeId: contabId, clientesCreated: clienteIds.length, notasCreated: notasCount };
    }),

    clear: adminProcedure.mutation(async () => {
      const dbConn = await db.getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await dbConn.delete(downloadLogs);
      await dbConn.delete(agendamentos);
      await dbConn.delete(notas);
      await dbConn.delete(certificados);
      await dbConn.delete(clientes);
      await dbConn.delete(contabilidades);
      await dbConn.delete(planos);
      return { success: true };
    }),
  }),

  // ═════════════════════════════════════════════════════════════════
  // SETTINGS (configurações do sistema)
  // ═════════════════════════════════════════════════════════════════
  settings: router({
    getAll: publicProcedure.query(async () => {
      return db.getAllSettings();
    }),
    getMaxTentativasPdf: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("max_tentativas_pdf");
      return { valor: valor || "3" };
    }),
    setMaxTentativasPdf: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const num = parseInt(input.valor, 10);
        if (isNaN(num) || num < 1 || num > 10) throw new TRPCError({ code: "BAD_REQUEST", message: "Valor deve ser entre 1 e 10" });
        await db.upsertSetting("max_tentativas_pdf", String(num));
        return { success: true };
      }),
    getModoDownload: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("modo_download");
      return { valor: valor || "sequencial" };
    }),
    setModoDownload: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("modo_download", input.valor);
        return { success: true };
      }),
    getBaixarPdf: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("baixar_pdf");
      return { valor: valor !== "false" }; // padrão: true
    }),
    setBaixarPdf: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("baixar_pdf", String(input.valor));
        return { success: true };
      }),
    getAutoCorrecaoPdf: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("auto_correcao_pdf");
      return { valor: valor === "true" };
    }),
    setAutoCorrecaoPdf: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("auto_correcao_pdf", String(input.valor));
        return { success: true };
      }),
    getAutoCorrecaoTempo: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("auto_correcao_tempo");
      return { valor: valor || "00:00:30" };
    }),
    setAutoCorrecaoTempo: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        // Validar formato HH:MM:SS
        const regex = /^\d{2}:\d{2}:\d{2}$/;
        if (!regex.test(input.valor)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Formato inv\u00e1lido. Use HH:MM:SS" });
        }
        await db.upsertSetting("auto_correcao_tempo", input.valor);
        return { success: true };
      }),
    getMaxEmpresasSimultaneas: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("max_empresas_simultaneas");
      return { valor: valor || "3" };
    }),
    setMaxEmpresasSimultaneas: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const num = parseInt(input.valor);
        if (isNaN(num) || num < 1 || num > 10) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valor deve ser entre 1 e 10" });
        }
        await db.upsertSetting("max_empresas_simultaneas", String(num));
        return { success: true };
      }),
    // Timeout por empresa (segundos)
    getTimeoutPorEmpresa: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("timeout_por_empresa");
      return { valor: valor || "180" };
    }),
    setTimeoutPorEmpresa: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const num = parseInt(input.valor);
        if (isNaN(num) || num < 60 || num > 900) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valor deve ser entre 60 e 900 segundos" });
        }
        await db.upsertSetting("timeout_por_empresa", String(num));
        return { success: true };
      }),
    // Timeout dinâmico (ativa/desativa)
    getTimeoutDinamico: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("timeout_dinamico");
      return { valor: valor !== "false" }; // padrão: true
    }),
    setTimeoutDinamico: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("timeout_dinamico", String(input.valor));
        return { success: true };
      }),
    // Máximo de rodadas da auto-retomada
    getMaxRodadasRetomada: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("max_rodadas_retomada");
      return { valor: valor || "3" };
    }),
    setMaxRodadasRetomada: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const num = parseInt(input.valor);
        if (isNaN(num) || num < 1 || num > 10) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valor deve ser entre 1 e 10" });
        }
        await db.upsertSetting("max_rodadas_retomada", String(num));
        return { success: true };
      }),
    // Retomada Infinita (até 0 erros)
    getRetomadaInfinita: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("retomada_infinita");
      return { valor: valor === "true" };
    }),
    setRetomadaInfinita: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("retomada_infinita", String(input.valor));
        return { success: true };
      }),
    // Delay entre PDFs (ms)
    getDelayEntrePdfs: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("delay_entre_pdfs");
      return { valor: valor || "500" };
    }),
    setDelayEntrePdfs: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const num = parseInt(input.valor);
        if (isNaN(num) || num < 0 || num > 5000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valor deve ser entre 0 e 5000 ms" });
        }
        await db.upsertSetting("delay_entre_pdfs", String(num));
        return { success: true };
      }),
    // Delay entre páginas da API (ms)
    getDelayEntrePaginas: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("delay_entre_paginas");
      return { valor: valor || "300" };
    }),
    setDelayEntrePaginas: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const num = parseInt(input.valor);
        if (isNaN(num) || num < 0 || num > 5000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Valor deve ser entre 0 e 5000 ms" });
        }
        await db.upsertSetting("delay_entre_paginas", String(num));
        return { success: true };
      }),
    // Pular PDFs com erro na retomada
    getPularPdfErro: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("pular_pdf_erro_retomada");
      return { valor: valor === "true" };
    }),
    setPularPdfErro: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("pular_pdf_erro_retomada", String(input.valor));
        return { success: true };
      }),
    // ═══ CT-e Auto-Retomada Settings ═══
    getAutoCorrecaoCte: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("auto_correcao_cte");
      return { valor: valor === "true" };
    }),
    setAutoCorrecaoCte: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("auto_correcao_cte", String(input.valor));
        return { success: true };
      }),
    getAutoCorrecaoTempoCte: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("auto_correcao_tempo_cte");
      return { valor: valor || "00:00:20" };
    }),
    setAutoCorrecaoTempoCte: contabilidadeProcedure
      .input(z.object({ valor: z.string() }))
      .mutation(async ({ input }) => {
        const regex = /^\d{2}:\d{2}:\d{2}$/;
        if (!regex.test(input.valor)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Formato inválido. Use HH:MM:SS" });
        }
        await db.upsertSetting("auto_correcao_tempo_cte", input.valor);
        return { success: true };
      }),
    getRetomadaInfinitaCte: contabilidadeProcedure.query(async () => {
      const valor = await db.getSetting("retomada_infinita_cte");
      return { valor: valor === "true" };
    }),
    setRetomadaInfinitaCte: contabilidadeProcedure
      .input(z.object({ valor: z.boolean() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("retomada_infinita_cte", String(input.valor));
        return { success: true };
      }),
    getAutoRetomadaCteStatus: contabilidadeProcedure.query(async ({ ctx }) => {
      const contabId = await getContabilidadeId(ctx.user);
      const inativo = { ativa: false, fase: null, totalErros: 0, processados: 0, retomados: 0, falhas: 0, tempoEspera: null, inicioEm: null, finalizadoEm: null };
      const valor = await db.getSetting(`auto_retomada_cte_status_${contabId}`);
      if (!valor) return inativo;
      try {
        const data = JSON.parse(valor);
        if (data.fase === "retomando" || data.fase === "aguardando") {
          const logs = await db.getCteDownloadLogsByContabilidade(contabId, 5);
          const temDownloads = logs.some((l: any) => ["erro", "cancelado", "retomando", "executando", "pendente"].includes(l.status));
          if (!temDownloads) {
            await db.upsertSetting(`auto_retomada_cte_status_${contabId}`, "");
            return inativo;
          }
        }
        return { ativa: true, ...data };
      } catch {
        return inativo;
      }
    }),
    getAutoRetomadaStatus: contabilidadeProcedure.query(async ({ ctx }) => {
      const contabId = await getContabilidadeId(ctx.user);
      const inativo = { ativa: false, fase: null, totalErros: 0, processados: 0, retomados: 0, falhas: 0, tempoEspera: null, inicioEm: null, finalizadoEm: null };
      const valor = await db.getSetting(`auto_retomada_status_${contabId}`);
      if (!valor) return inativo;
      try {
        const data = JSON.parse(valor);
        // Se fase é "retomando" ou "aguardando", verificar se realmente existem downloads
        if (data.fase === "retomando" || data.fase === "aguardando") {
          const logs = await db.getDownloadLogsByContabilidade(contabId, 5);
          const temDownloads = logs.some((l: any) => ["erro", "cancelado", "retomando", "executando", "pendente"].includes(l.status));
          if (!temDownloads) {
            // Limpar status fantasma
            await db.upsertSetting(`auto_retomada_status_${contabId}`, "");
            return inativo;
          }
        }
        return { ativa: true, ...data };
      } catch {
        return inativo;
      }
    }),
    // Status da retomada de PDFs
    getRetryPdfsStatus: contabilidadeProcedure.query(async ({ ctx }) => {
      const contabId = await getContabilidadeId(ctx.user);
      const inativo = { ativa: false, fase: null, total: 0, processados: 0, sucesso: 0, falhas: 0, empresa: null, inicioEm: null, finalizadoEm: null };
      const valor = await db.getSetting(`retry_pdfs_status_${contabId}`);
      if (!valor) return inativo;
      try {
        const data = JSON.parse(valor);
        return { ativa: true, ...data };
      } catch {
        return inativo;
      }
    }),
    // Configuração de retomada de PDFs
    getRetryPdfsConfig: contabilidadeProcedure.query(async () => {
      const maxTent = await db.getSetting("retry_pdfs_max_tentativas");
      const autoRetomada = await db.getSetting("retry_pdfs_auto");
      const tempoEspera = await db.getSetting("retry_pdfs_tempo_espera");
      return {
        maxTentativas: maxTent || "3",
        autoRetomada: autoRetomada === "true",
        tempoEspera: tempoEspera || "00:05:00",
      };
    }),
    setRetryPdfsConfig: contabilidadeProcedure
      .input(z.object({
        maxTentativas: z.string(), // "3", "5", "10", "infinito"
        autoRetomada: z.boolean(),
        tempoEspera: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.upsertSetting("retry_pdfs_max_tentativas", input.maxTentativas);
        await db.upsertSetting("retry_pdfs_auto", input.autoRetomada ? "true" : "false");
        if (input.tempoEspera) {
          await db.upsertSetting("retry_pdfs_tempo_espera", input.tempoEspera);
        }
        return { success: true };
      }),
    // Contar PDFs pendentes (sem PDF baixado)
    countPdfsPendentes: contabilidadeProcedure
      .input(z.object({ contabilidadeId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const contabId = await getContabilidadeId(ctx.user, input.contabilidadeId);
        const clientes = await db.getClientesByContabilidade(contabId);
        let total = 0;
        for (const cliente of clientes) {
          const notasSemPdf = await db.getNotasSemPdf(cliente.id, contabId);
          total += notasSemPdf.length;
        }
        return { total };
      }),
    get: publicProcedure.input(z.object({ chave: z.string() })).query(async ({ input }) => {
      const valor = await db.getSetting(input.chave);
      return { chave: input.chave, valor };
    }),
    update: adminProcedure
      .input(z.object({ chave: z.string(), valor: z.string() }))
      .mutation(async ({ input }) => {
        await db.upsertSetting(input.chave, input.valor);
        return { success: true };
      }),
    updateMultiple: adminProcedure
      .input(z.object({ settings: z.array(z.object({ chave: z.string(), valor: z.string() })) }))
      .mutation(async ({ input }) => {
        await db.upsertMultipleSettings(input.settings);
        return { success: true };
      }),
    uploadLogo: adminProcedure
      .input(z.object({ base64: z.string(), mimeType: z.string(), fileName: z.string() }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.fileName.split(".").pop() || "png";
        const key = `landing/logo-${Date.now()}.${ext}`;
        const { url } = await storagePut(key, buffer, input.mimeType);
        await db.upsertSetting("landing_logo_url", url);
        return { success: true, url };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// ─── Recuperação de downloads órfãos após restart do servidor ──────────
// Chamada pelo server/_core/index.ts ao iniciar
let recoveryRunning = false;
export async function recoverOrphanedDownloads() {
  if (recoveryRunning) {
    console.log("[Recovery] Já em execução, ignorando chamada duplicada.");
    return;
  }
  recoveryRunning = true;
  try {
    const orphaned = await db.getOrphanedDownloads();
    if (orphaned.length === 0) {
      console.log("[Recovery] Nenhum download órfão encontrado.");
      return;
    }
    console.log(`[Recovery] Encontrados ${orphaned.length} download(s) órfão(s). Retomando...`);

    // Agrupar por contabilidadeId para processar sequencialmente por contabilidade
    const byContab = new Map<number, typeof orphaned>();
    for (const log of orphaned) {
      const contabId = log.contabilidadeId;
      if (!byContab.has(contabId)) byContab.set(contabId, []);
      byContab.get(contabId)!.push(log);
    }

    const contabIds = Array.from(byContab.keys());
    for (const contabId of contabIds) {
      const logs = byContab.get(contabId)!;
      console.log(`[Recovery] Contabilidade ${contabId}: ${logs.length} download(s) órfão(s)`);

      // Usar Download Engine v2 para recovery
      const config = await getDownloadConfig();
      const validTasks: DownloadTask[] = [];
      for (const log of logs) {
        if (!log.clienteId) continue;
        const cliente = await db.getClienteById(log.clienteId);
        if (!cliente) {
          await db.updateDownloadLog(log.id, {
            status: "erro", erro: "Cliente não encontrado (recovery)",
            etapa: "Cliente não encontrado", finalizadoEm: new Date(),
          });
          continue;
        }
        await db.updateDownloadLog(log.id, {
          status: "pendente", etapa: "Retomando após reinicialização...", erro: null,
        });
        validTasks.push({ clienteId: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial, logId: log.id });
      }

      if (validTasks.length > 0) {
        await runDownloadEngine(validTasks, contabId, async (task) => {
          const cliente = await db.getClienteById(task.clienteId);
          if (!cliente) throw new Error("Cliente não encontrado");
          // IMPORTANTE: Ler o período salvo no log para respeitar o filtro original
          const taskLog = logs.find((l: any) => l.id === task.logId);
          const { isPeriodo: taskIsPeriodo, input: taskPeriodoInput } = taskLog ? extractPeriodoFromLog(taskLog) : { isPeriodo: false, input: {} };
          if (taskIsPeriodo) {
            console.log(`[Recovery] ${cliente.razaoSocial}: retomando com período ${taskPeriodoInput.competenciaInicio || taskPeriodoInput.dataInicio} a ${taskPeriodoInput.competenciaFim || taskPeriodoInput.dataFim}`);
          }
          await processClienteDownload(
            { id: cliente.id, cnpj: cliente.cnpj, razaoSocial: cliente.razaoSocial },
            contabId, taskIsPeriodo, taskPeriodoInput, task.logId,
          );
        }, config);
      }

      console.log(`[Recovery] Contabilidade ${contabId}: Engine v2 concluído.`);
      const autoCorrecao = await db.getSetting("auto_correcao_pdf");
      if (autoCorrecao === "true") {
        autoRetomarDownloadsComErro(contabId);
      }
    }
  } catch (error: any) {
    console.error("[Recovery] Erro geral:", error.message);
  } finally {
    recoveryRunning = false;
  }
}
