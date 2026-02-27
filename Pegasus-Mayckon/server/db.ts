import { eq, and, desc, asc, sql, gte, lte, like, or, inArray, count, ne, gt, lt, isNull, not } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  contabilidades, InsertContabilidade,
  clientes, InsertCliente,
  certificados, InsertCertificado,
  notas, InsertNota,
  downloadLogs, InsertDownloadLog,
  agendamentos, InsertAgendamento,
  planos, InsertPlano,
  settings, InsertSetting,
  auditLogs, InsertAuditLog,
  cteNotas, InsertCteNota,
  cteDownloadLogs, InsertCteDownloadLog,
  cteNsuControl, InsertCteNsuControl,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Usar timezone: 'Z' para garantir que o mysql2 envie/receba timestamps em UTC
      // Sem isso, o mysql2 converte Date para hora local do servidor antes de enviar ao MySQL
      _db = drizzle({
        connection: {
          uri: process.env.DATABASE_URL,
          timezone: 'Z',
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (user.contabilidadeId !== undefined) { values.contabilidadeId = user.contabilidadeId; updateSet.contabilidadeId = user.contabilidadeId; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "admin" | "contabilidade" | "cliente", contabilidadeId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role, contabilidadeId: contabilidadeId ?? null }).where(eq(users.id, userId));
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, userId));
}

// ─── Planos ─────────────────────────────────────────────────────────
export async function createPlano(data: InsertPlano) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(planos).values(data);
  return result[0].insertId;
}

export async function getPlanos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planos).orderBy(asc(planos.nome));
}

export async function getPlanoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(planos).where(eq(planos.id, id)).limit(1);
  return result[0];
}

export async function updatePlano(id: number, data: Partial<InsertPlano>) {
  const db = await getDb();
  if (!db) return;
  await db.update(planos).set(data).where(eq(planos.id, id));
}

export async function deletePlano(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(planos).where(eq(planos.id, id));
}

// ─── Contabilidades ─────────────────────────────────────────────────
export async function createContabilidade(data: InsertContabilidade) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(contabilidades).values(data);
  return result[0].insertId;
}

export async function getContabilidades() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contabilidades).orderBy(desc(contabilidades.createdAt));
}

export async function getContabilidadeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contabilidades).where(eq(contabilidades.id, id)).limit(1);
  return result[0];
}

export async function updateContabilidade(id: number, data: Partial<InsertContabilidade>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contabilidades).set(data).where(eq(contabilidades.id, id));
}

export async function getContabilidadesComStats() {
  const db = await getDb();
  if (!db) return [];

  const contabs = await db.select().from(contabilidades).orderBy(desc(contabilidades.createdAt));

  const result = await Promise.all(contabs.map(async (c) => {
    const [clienteCount] = await db.select({ count: count() }).from(clientes).where(eq(clientes.contabilidadeId, c.id));
    const [certCount] = await db.select({ count: count() }).from(certificados).where(and(eq(certificados.contabilidadeId, c.id), eq(certificados.ativo, true)));
    const [notaCount] = await db.select({ count: count() }).from(notas).where(eq(notas.contabilidadeId, c.id));
    const [userCount] = await db.select({ count: count() }).from(users).where(and(eq(users.contabilidadeId, c.id), eq(users.role, "contabilidade")));
    const plano = c.planoId ? await getPlanoById(c.planoId) : null;

    return {
      ...c,
      totalClientes: clienteCount?.count ?? 0,
      totalCertificados: certCount?.count ?? 0,
      totalNotas: notaCount?.count ?? 0,
      totalUsuarios: userCount?.count ?? 0,
      plano: plano ? { id: plano.id, nome: plano.nome, maxClientes: plano.maxClientes } : null,
    };
  }));

  return result;
}

// ─── Admin Dashboard Stats ──────────────────────────────────────────
export async function getAdminDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  const [totalContabilidades] = await db.select({ count: count() }).from(contabilidades);
  const [contabilidadesAtivas] = await db.select({ count: count() }).from(contabilidades).where(eq(contabilidades.ativo, true));
  const [contabilidadesInativas] = await db.select({ count: count() }).from(contabilidades).where(eq(contabilidades.ativo, false));
  const [totalClientesGlobal] = await db.select({ count: count() }).from(clientes);
  const [totalCertificadosGlobal] = await db.select({ count: count() }).from(certificados).where(eq(certificados.ativo, true));
  const [totalNotasGlobal] = await db.select({ count: count() }).from(notas);
  const [totalUsuarios] = await db.select({ count: count() }).from(users);
  const [totalPlanosAtivos] = await db.select({ count: count() }).from(planos).where(eq(planos.ativo, true));

  const [certVencidosGlobal] = await db.select({ count: count() }).from(certificados)
    .where(and(eq(certificados.ativo, true), lte(certificados.validTo, sql`NOW()`)));

  const [certAVencer30Global] = await db.select({ count: count() }).from(certificados)
    .where(and(
      eq(certificados.ativo, true),
      gte(certificados.validTo, sql`NOW()`),
      lte(certificados.validTo, sql`DATE_ADD(NOW(), INTERVAL 30 DAY)`)
    ));

  const [valorTotalGlobal] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${notas.valorServico} AS DECIMAL(15,2))), 0)`
  }).from(notas).where(eq(notas.status, "valida"));

  // Contabilidades recentes com contagem de clientes
  const contabilidadesRecentes = await db.select({
    id: contabilidades.id,
    nome: contabilidades.nome,
    cnpj: contabilidades.cnpj,
    ativo: contabilidades.ativo,
    totalClientes: sql<number>`(SELECT COUNT(*) FROM clientes WHERE clientes.contabilidadeId = ${contabilidades.id})`,
  }).from(contabilidades).orderBy(desc(contabilidades.createdAt)).limit(5);

  return {
    totalContabilidades: totalContabilidades?.count ?? 0,
    contabilidadesAtivas: contabilidadesAtivas?.count ?? 0,
    contabilidadesInativas: contabilidadesInativas?.count ?? 0,
    totalClientes: totalClientesGlobal?.count ?? 0,
    totalCertificados: totalCertificadosGlobal?.count ?? 0,
    totalNotas: totalNotasGlobal?.count ?? 0,
    totalUsuarios: totalUsuarios?.count ?? 0,
    totalPlanos: totalPlanosAtivos?.count ?? 0,
    certVencidos: certVencidosGlobal?.count ?? 0,
    certAVencer30: certAVencer30Global?.count ?? 0,
    valorTotal: parseFloat(valorTotalGlobal?.total ?? "0"),
    contabilidadesRecentes,
  };
}

// ─── Clientes ───────────────────────────────────────────────────────
export async function createCliente(data: InsertCliente) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(clientes).values(data);
  return result[0].insertId;
}

export async function getClientesByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(clientes).where(eq(clientes.contabilidadeId, contabilidadeId)).orderBy(asc(clientes.razaoSocial));
}

export async function getClienteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);
  return result[0];
}

export async function getClienteByCnpj(cnpj: string, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(clientes)
    .where(and(eq(clientes.cnpj, cnpj), eq(clientes.contabilidadeId, contabilidadeId)))
    .limit(1);
  return result[0];
}

export async function updateCliente(id: number, data: Partial<InsertCliente>) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientes).set(data).where(eq(clientes.id, id));
}

// ─── Certificados ───────────────────────────────────────────────────
export async function createCertificado(data: InsertCertificado) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(certificados).values(data);
  return result[0].insertId;
}

export async function getCertificadosByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(certificados).where(eq(certificados.contabilidadeId, contabilidadeId)).orderBy(desc(certificados.createdAt));
}

export async function getCertificadosByCliente(clienteId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(certificados).where(and(eq(certificados.clienteId, clienteId), eq(certificados.ativo, true))).orderBy(desc(certificados.createdAt));
}

export async function getCertificadoAtivo(clienteId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(certificados)
    .where(and(eq(certificados.clienteId, clienteId), eq(certificados.ativo, true)))
    .orderBy(desc(certificados.createdAt))
    .limit(1);
  return result[0];
}

export async function updateCertificado(id: number, data: Partial<InsertCertificado>) {
  const db = await getDb();
  if (!db) return;
  await db.update(certificados).set(data).where(eq(certificados.id, id));
}

export async function desativarCertificadosCliente(clienteId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(certificados)
    .set({ ativo: false })
    .where(and(eq(certificados.clienteId, clienteId), eq(certificados.ativo, true)));
}

export async function getCertificadosComStatus(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];

  const certs = await db.select({
    certId: certificados.id,
    clienteId: certificados.clienteId,
    cnpj: certificados.cnpj,
    razaoSocial: certificados.razaoSocial,
    serialNumber: certificados.serialNumber,
    issuer: certificados.issuer,
    validFrom: certificados.validFrom,
    validTo: certificados.validTo,
    ativo: certificados.ativo,
    createdAt: certificados.createdAt,
    clienteRazaoSocial: clientes.razaoSocial,
    clienteCidade: clientes.cidade,
    clienteUf: clientes.uf,
  }).from(certificados)
    .innerJoin(clientes, eq(certificados.clienteId, clientes.id))
    .where(and(
      eq(certificados.contabilidadeId, contabilidadeId),
      eq(certificados.ativo, true)
    ))
    .orderBy(asc(certificados.validTo));

  return certs;
}

// ─── Notas ──────────────────────────────────────────────────────────
export async function createNota(data: InsertNota) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(notas).values(data);
  return result[0].insertId;
}

export async function upsertNota(data: InsertNota) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(notas).values(data).onDuplicateKeyUpdate({
    set: {
      status: data.status,
      tipoEvento: data.tipoEvento,
      ...(data.danfsePdfUrl ? { danfsePdfUrl: data.danfsePdfUrl } : {}),
      ...(data.danfsePdfKey ? { danfsePdfKey: data.danfsePdfKey } : {}),
      // Campos IBS/CBS - atualizar se presentes
      ...(data.temIbsCbs !== undefined ? { temIbsCbs: data.temIbsCbs } : {}),
      ...(data.cstIbsCbs ? { cstIbsCbs: data.cstIbsCbs } : {}),
      ...(data.cIndOp ? { cIndOp: data.cIndOp } : {}),
      ...(data.finNFSe ? { finNFSe: data.finNFSe } : {}),
      ...(data.vBcIbsCbs ? { vBcIbsCbs: data.vBcIbsCbs } : {}),
      ...(data.aliqIbsUf ? { aliqIbsUf: data.aliqIbsUf } : {}),
      ...(data.aliqIbsMun ? { aliqIbsMun: data.aliqIbsMun } : {}),
      ...(data.aliqCbs ? { aliqCbs: data.aliqCbs } : {}),
      ...(data.vIbsUf ? { vIbsUf: data.vIbsUf } : {}),
      ...(data.vIbsMun ? { vIbsMun: data.vIbsMun } : {}),
      ...(data.vCbs ? { vCbs: data.vCbs } : {}),
      ...(data.vTotTribIbsCbs ? { vTotTribIbsCbs: data.vTotTribIbsCbs } : {}),
      ...(data.indZfmalc !== undefined ? { indZfmalc: data.indZfmalc } : {}),
      ...(data.vPis ? { vPis: data.vPis } : {}),
      ...(data.vCofins ? { vCofins: data.vCofins } : {}),
      ...(data.cstPisCofins ? { cstPisCofins: data.cstPisCofins } : {}),
      ...(data.pDifUf ? { pDifUf: data.pDifUf } : {}),
      ...(data.pDifMun ? { pDifMun: data.pDifMun } : {}),
      ...(data.pDifCbs ? { pDifCbs: data.pDifCbs } : {}),
      updatedAt: new Date(),
    }
  });
}

/**
 * Verifica quais chaves de acesso já existem no banco para um cliente.
 * Retorna um Set com as chaves que já foram baixadas (com XML salvo).
 */
export async function getChavesExistentes(clienteId: number, chaves: string[]): Promise<Set<string>> {
  const db = await getDb();
  if (!db || chaves.length === 0) return new Set();
  // Buscar em lotes de 500 para evitar query muito grande
  const result = new Set<string>();
  const BATCH = 500;
  for (let i = 0; i < chaves.length; i += BATCH) {
    const batch = chaves.slice(i, i + BATCH);
    const rows = await db.select({ chaveAcesso: notas.chaveAcesso, danfsePdfUrl: notas.danfsePdfUrl })
      .from(notas)
      .where(and(
        eq(notas.clienteId, clienteId),
        inArray(notas.chaveAcesso, batch)
      ));
    for (const row of rows) {
      // Considerar como "já baixada" se tem XML (chaveAcesso existe no banco)
      result.add(row.chaveAcesso);
    }
  }
  return result;
}

/**
 * Verifica quais notas existentes estão sem PDF (para rebaixar apenas o PDF)
 */
export async function getChavesSemPdf(clienteId: number, chaves: string[]): Promise<Set<string>> {
  const db = await getDb();
  if (!db || chaves.length === 0) return new Set();
  const result = new Set<string>();
  const BATCH = 500;
  for (let i = 0; i < chaves.length; i += BATCH) {
    const batch = chaves.slice(i, i + BATCH);
    const rows = await db.select({ chaveAcesso: notas.chaveAcesso, danfsePdfUrl: notas.danfsePdfUrl })
      .from(notas)
      .where(and(
        eq(notas.clienteId, clienteId),
        inArray(notas.chaveAcesso, batch),
        isNull(notas.danfsePdfUrl)
      ));
    for (const row of rows) {
      result.add(row.chaveAcesso);
    }
  }
  return result;
}

export async function updateNota(notaId: number, data: Partial<InsertNota>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notas).set({ ...data, updatedAt: new Date() }).where(eq(notas.id, notaId));
}

export async function updateNotaByChave(chaveAcesso: string, clienteId: number, data: Partial<InsertNota>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notas).set({ ...data, updatedAt: new Date() }).where(and(eq(notas.chaveAcesso, chaveAcesso), eq(notas.clienteId, clienteId)));
}

export async function getNotasByContabilidade(contabilidadeId: number, filters?: {
  clienteId?: number;
  status?: string;
  direcao?: string;
  ibsCbs?: string;
  dataInicio?: Date;
  dataFim?: Date;
  busca?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { notas: [], total: 0 };

  const conditions = [eq(notas.contabilidadeId, contabilidadeId)];
  if (filters?.clienteId) conditions.push(eq(notas.clienteId, filters.clienteId));
  if (filters?.status) conditions.push(eq(notas.status, filters.status as any));
  if (filters?.direcao) conditions.push(eq(notas.direcao, filters.direcao as any));
  if (filters?.dataInicio) conditions.push(gte(notas.dataEmissao, filters.dataInicio));
  if (filters?.dataFim) conditions.push(lte(notas.dataEmissao, filters.dataFim));
  // Filtro IBS/CBS
  if (filters?.ibsCbs === "comIbsCbs") {
    conditions.push(eq(notas.temIbsCbs, true));
  } else if (filters?.ibsCbs === "comIbs") {
    conditions.push(or(gt(notas.vIbsUf, "0"), gt(notas.vIbsMun, "0"))!);
  } else if (filters?.ibsCbs === "comCbs") {
    conditions.push(gt(notas.vCbs, "0"));
  } else if (filters?.ibsCbs === "semIbsCbs") {
    conditions.push(or(eq(notas.temIbsCbs, false), isNull(notas.temIbsCbs))!);
  }
  if (filters?.busca) {
    conditions.push(or(
      like(notas.emitenteNome, `%${filters.busca}%`),
      like(notas.tomadorNome, `%${filters.busca}%`),
      like(notas.chaveAcesso, `%${filters.busca}%`),
      like(notas.emitenteCnpj, `%${filters.busca}%`),
      like(notas.tomadorCnpj, `%${filters.busca}%`),
      like(notas.numeroNota, `%${filters.busca}%`),
      like(notas.municipioPrestacao, `%${filters.busca}%`),
      like(notas.valorServico, `%${filters.busca}%`),
    )!);
  }

  const where = and(...conditions);
  const [rows, totalResult] = await Promise.all([
    db.select().from(notas).where(where).orderBy(desc(notas.dataEmissao)).limit(filters?.limit ?? 50).offset(filters?.offset ?? 0),
    db.select({ count: count() }).from(notas).where(where),
  ]);

  return { notas: rows, total: totalResult[0]?.count ?? 0 };
}

export async function getNotaByChaveAcesso(chaveAcesso: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notas).where(eq(notas.chaveAcesso, chaveAcesso)).limit(1);
  return result[0];
}

// ─── Notas para Relatório (sem paginação) ───────────────────────────
export async function getNotasForRelatorio(contabilidadeId: number, filters?: {
  clienteId?: number;
  status?: string;
  direcao?: string;
  dataInicio?: Date;
  dataFim?: Date;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(notas.contabilidadeId, contabilidadeId)];
  if (filters?.clienteId) conditions.push(eq(notas.clienteId, filters.clienteId));
  if (filters?.status) conditions.push(eq(notas.status, filters.status as any));
  if (filters?.direcao) conditions.push(eq(notas.direcao, filters.direcao as any));
  if (filters?.dataInicio) conditions.push(gte(notas.dataEmissao, filters.dataInicio));
  if (filters?.dataFim) conditions.push(lte(notas.dataEmissao, filters.dataFim));

  return db.select({
    id: notas.id,
    clienteId: notas.clienteId,
    numeroNota: notas.numeroNota,
    dataEmissao: notas.dataEmissao,
    dataCompetencia: notas.dataCompetencia,
    emitenteCnpj: notas.emitenteCnpj,
    emitenteNome: notas.emitenteNome,
    tomadorCnpj: notas.tomadorCnpj,
    tomadorNome: notas.tomadorNome,
    valorServico: notas.valorServico,
    valorLiquido: notas.valorLiquido,
    direcao: notas.direcao,
    status: notas.status,
    codigoServico: notas.codigoServico,
    descricaoServico: notas.descricaoServico,
    municipioPrestacao: notas.municipioPrestacao,
    chaveAcesso: notas.chaveAcesso,
    xmlOriginal: notas.xmlOriginal,
    // Campos IBS/CBS (Reforma Tributária)
    temIbsCbs: notas.temIbsCbs,
    cstIbsCbs: notas.cstIbsCbs,
    cIndOp: notas.cIndOp,
    finNFSe: notas.finNFSe,
    vBcIbsCbs: notas.vBcIbsCbs,
    aliqIbsUf: notas.aliqIbsUf,
    aliqIbsMun: notas.aliqIbsMun,
    aliqCbs: notas.aliqCbs,
    vIbsUf: notas.vIbsUf,
    vIbsMun: notas.vIbsMun,
    vCbs: notas.vCbs,
    vTotTribIbsCbs: notas.vTotTribIbsCbs,
    vPis: notas.vPis,
    vCofins: notas.vCofins,
    cstPisCofins: notas.cstPisCofins,
    pDifUf: notas.pDifUf,
    pDifMun: notas.pDifMun,
    pDifCbs: notas.pDifCbs,
  }).from(notas)
    .where(and(...conditions))
    .orderBy(desc(notas.dataEmissao));
}

// ─── Dashboard Stats (per contabilidade) ────────────────────────────
export async function getDashboardStats(contabilidadeId: number, clienteId?: number, mes?: string) {
  const db = await getDb();
  if (!db) return null;

  const conditions: any[] = [eq(notas.contabilidadeId, contabilidadeId)];
  if (clienteId) conditions.push(eq(notas.clienteId, clienteId));
  // Filtro por mês (YYYY-MM)
  if (mes) {
    conditions.push(sql`DATE_FORMAT(${notas.dataEmissao}, '%Y-%m') = ${mes}`);
  }
  const where = and(...conditions);

  const [totalNotas] = await db.select({ count: count() }).from(notas).where(where);
  const [emitidas] = await db.select({ count: count() }).from(notas).where(and(...conditions, eq(notas.direcao, "emitida")));
  const [recebidas] = await db.select({ count: count() }).from(notas).where(and(...conditions, eq(notas.direcao, "recebida")));
  const [canceladas] = await db.select({ count: count() }).from(notas).where(and(...conditions, eq(notas.status, "cancelada")));
  const [validas] = await db.select({ count: count() }).from(notas).where(and(...conditions, eq(notas.status, "valida")));

  const [valorTotal] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${notas.valorServico} AS DECIMAL(15,2))), 0)`
  }).from(notas).where(and(...conditions, eq(notas.status, "valida")));

  const [valorEmitido] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${notas.valorServico} AS DECIMAL(15,2))), 0)`
  }).from(notas).where(and(...conditions, eq(notas.direcao, "emitida"), eq(notas.status, "valida")));

  const [valorRecebido] = await db.select({
    total: sql<string>`COALESCE(SUM(CAST(${notas.valorServico} AS DECIMAL(15,2))), 0)`
  }).from(notas).where(and(...conditions, eq(notas.direcao, "recebida"), eq(notas.status, "valida")));

  // Use raw SQL to avoid Drizzle adding backticks inside DATE_FORMAT which causes GROUP BY mismatch
  const clienteFilter = clienteId ? sql`AND \`notas\`.\`clienteId\` = ${clienteId}` : sql``;
  // Gráfico notasPorMes: sempre mostra todos os meses disponíveis (sem filtro de mês)
  // para dar contexto visual mesmo quando um mês específico está selecionado
  const notasPorMes = await db.execute(sql`
    SELECT 
      DATE_FORMAT(dataEmissao, '%Y-%m') as mes,
      COUNT(*) as total,
      SUM(CASE WHEN direcao = 'emitida' THEN 1 ELSE 0 END) as emitidas,
      SUM(CASE WHEN direcao = 'recebida' THEN 1 ELSE 0 END) as recebidas,
      COALESCE(SUM(CAST(valorServico AS DECIMAL(15,2))), 0) as valor
    FROM notas 
    WHERE contabilidadeId = ${contabilidadeId} 
      ${clienteFilter}
      AND dataEmissao >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
    GROUP BY DATE_FORMAT(dataEmissao, '%Y-%m')
    ORDER BY mes
  `) as any;
  const notasPorMesRows = (notasPorMes[0] || []).map((r: any) => ({
    mes: r.mes as string,
    total: Number(r.total),
    emitidas: Number(r.emitidas),
    recebidas: Number(r.recebidas),
    valor: String(r.valor),
  }));

  const [totalClientes] = await db.select({ count: count() }).from(clientes).where(eq(clientes.contabilidadeId, contabilidadeId));
  const [totalCertificados] = await db.select({ count: count() }).from(certificados)
    .where(and(eq(certificados.contabilidadeId, contabilidadeId), eq(certificados.ativo, true)));
  const [certVencidos] = await db.select({ count: count() }).from(certificados)
    .where(and(eq(certificados.contabilidadeId, contabilidadeId), eq(certificados.ativo, true), lte(certificados.validTo, sql`NOW()`)));
  const [certAVencer30] = await db.select({ count: count() }).from(certificados)
    .where(and(eq(certificados.contabilidadeId, contabilidadeId), eq(certificados.ativo, true), gte(certificados.validTo, sql`NOW()`), lte(certificados.validTo, sql`DATE_ADD(NOW(), INTERVAL 30 DAY)`)));
  const [certAVencer60] = await db.select({ count: count() }).from(certificados)
    .where(and(eq(certificados.contabilidadeId, contabilidadeId), eq(certificados.ativo, true), gte(certificados.validTo, sql`NOW()`), lte(certificados.validTo, sql`DATE_ADD(NOW(), INTERVAL 60 DAY)`)));

  // Último download
  const ultimoDownloadRows = await db.select({
    createdAt: downloadLogs.createdAt,
    status: downloadLogs.status,
    totalNotas: downloadLogs.totalNotas,
  }).from(downloadLogs)
    .where(eq(downloadLogs.contabilidadeId, contabilidadeId))
    .orderBy(desc(downloadLogs.createdAt))
    .limit(1);
  const ultimoDownload = ultimoDownloadRows[0] ?? null;

  // Próximo agendamento
  const proximoAgendamentoRows = await db.select({
    frequencia: agendamentos.frequencia,
    horario: agendamentos.horario,
    proximaExecucao: agendamentos.proximaExecucao,
  }).from(agendamentos)
    .where(and(eq(agendamentos.contabilidadeId, contabilidadeId), eq(agendamentos.ativo, true)))
    .orderBy(agendamentos.proximaExecucao)
    .limit(1);
  const proximoAgendamento = proximoAgendamentoRows[0] ?? null;

  // Top 10 clientes por valor (apenas se não filtrado por cliente)
  let topClientes: { clienteId: number; razaoSocial: string; cnpj: string; totalNotas: number; valorTotal: number; valorEmitido: number; valorRecebido: number }[] = [];
  if (!clienteId) {
    const mesFilterTop = mes ? sql`AND DATE_FORMAT(n.dataEmissao, '%Y-%m') = ${mes}` : sql``;
    const topRows = await db.execute(sql`
      SELECT 
        n.clienteId,
        c.razaoSocial,
        c.cnpj,
        COUNT(*) as totalNotas,
        COALESCE(SUM(CAST(n.valorServico AS DECIMAL(15,2))), 0) as valorTotal,
        COALESCE(SUM(CASE WHEN n.direcao = 'emitida' THEN CAST(n.valorServico AS DECIMAL(15,2)) ELSE 0 END), 0) as valorEmitido,
        COALESCE(SUM(CASE WHEN n.direcao = 'recebida' THEN CAST(n.valorServico AS DECIMAL(15,2)) ELSE 0 END), 0) as valorRecebido
      FROM notas n
      INNER JOIN clientes c ON n.clienteId = c.id
      WHERE n.contabilidadeId = ${contabilidadeId}
        AND n.status = 'valida'
        ${mesFilterTop}
      GROUP BY n.clienteId, c.razaoSocial, c.cnpj
      ORDER BY valorTotal DESC
      LIMIT 10
    `) as any;
    topClientes = (topRows[0] || []).map((r: any) => ({
      clienteId: r.clienteId,
      razaoSocial: r.razaoSocial,
      cnpj: r.cnpj || '',
      totalNotas: Number(r.totalNotas),
      valorTotal: parseFloat(String(r.valorTotal)),
      valorEmitido: parseFloat(String(r.valorEmitido)),
      valorRecebido: parseFloat(String(r.valorRecebido)),
    }));
  }

  // Notas recentes (últimas 5)
  const notasRecentesConditions: any[] = [eq(notas.contabilidadeId, contabilidadeId)];
  if (clienteId) notasRecentesConditions.push(eq(notas.clienteId, clienteId));
  if (mes) notasRecentesConditions.push(sql`DATE_FORMAT(${notas.dataEmissao}, '%Y-%m') = ${mes}`);
  const notasRecentes = await db.select({
    id: notas.id,
    numeroNota: notas.numeroNota,
    emitenteNome: notas.emitenteNome,
    tomadorNome: notas.tomadorNome,
    valorServico: notas.valorServico,
    dataEmissao: notas.dataEmissao,
    direcao: notas.direcao,
    status: notas.status,
  }).from(notas)
    .where(and(...notasRecentesConditions))
    .orderBy(desc(notas.dataEmissao))
    .limit(5);

  // Clientes sem certificado ativo
  let clientesSemCert = 0;
  if (!clienteId) {
    const allClientes = await db.select({ id: clientes.id }).from(clientes).where(eq(clientes.contabilidadeId, contabilidadeId));
    const clientesComCert = await db.select({ clienteId: certificados.clienteId }).from(certificados)
      .where(and(eq(certificados.contabilidadeId, contabilidadeId), eq(certificados.ativo, true)))
      .groupBy(certificados.clienteId);
    const comCertIds = new Set(clientesComCert.map(c => c.clienteId));
    clientesSemCert = allClientes.filter(c => !comCertIds.has(c.id)).length;
  }

  return {
    totalNotas: totalNotas?.count ?? 0,
    emitidas: emitidas?.count ?? 0,
    recebidas: recebidas?.count ?? 0,
    canceladas: canceladas?.count ?? 0,
    validas: validas?.count ?? 0,
    valorTotal: parseFloat(valorTotal?.total ?? "0"),
    valorEmitido: parseFloat(valorEmitido?.total ?? "0"),
    valorRecebido: parseFloat(valorRecebido?.total ?? "0"),
    notasPorMes: notasPorMesRows,
    totalClientes: totalClientes?.count ?? 0,
    totalCertificados: totalCertificados?.count ?? 0,
    certVencidos: certVencidos?.count ?? 0,
    certAVencer30: certAVencer30?.count ?? 0,
    certAVencer60: certAVencer60?.count ?? 0,
    ultimoDownload,
    proximoAgendamento,
    topClientes,
    notasRecentes,
    clientesSemCert,
  };
}

// ─── Dashboard All Clientes ─────────────────────────────────────────
export async function getDashboardAllClientes(contabilidadeId: number, mes?: string) {
  const db = await getDb();
  if (!db) return [];

  const mesFilter = mes ? sql`AND DATE_FORMAT(n.dataEmissao, '%Y-%m') = ${mes}` : sql``;
  const rows = await db.execute(sql`
    SELECT 
      n.clienteId,
      c.razaoSocial,
      c.cnpj,
      COUNT(*) as totalNotas,
      COALESCE(SUM(CAST(n.valorServico AS DECIMAL(15,2))), 0) as valorTotal,
      COALESCE(SUM(CASE WHEN n.direcao = 'emitida' THEN CAST(n.valorServico AS DECIMAL(15,2)) ELSE 0 END), 0) as valorEmitido,
      COALESCE(SUM(CASE WHEN n.direcao = 'recebida' THEN CAST(n.valorServico AS DECIMAL(15,2)) ELSE 0 END), 0) as valorRecebido,
      SUM(CASE WHEN n.direcao = 'emitida' THEN 1 ELSE 0 END) as notasEmitidas,
      SUM(CASE WHEN n.direcao = 'recebida' THEN 1 ELSE 0 END) as notasRecebidas,
      SUM(CASE WHEN n.status = 'cancelada' THEN 1 ELSE 0 END) as notasCanceladas
    FROM notas n
    INNER JOIN clientes c ON n.clienteId = c.id
    WHERE n.contabilidadeId = ${contabilidadeId}
      AND n.status = 'valida'
      ${mesFilter}
    GROUP BY n.clienteId, c.razaoSocial, c.cnpj
    ORDER BY valorTotal DESC
  `) as any;
  return (rows[0] || []).map((r: any) => ({
    clienteId: r.clienteId as number,
    razaoSocial: r.razaoSocial as string,
    cnpj: (r.cnpj || '') as string,
    totalNotas: Number(r.totalNotas),
    valorTotal: parseFloat(String(r.valorTotal)),
    valorEmitido: parseFloat(String(r.valorEmitido)),
    valorRecebido: parseFloat(String(r.valorRecebido)),
    notasEmitidas: Number(r.notasEmitidas || 0),
    notasRecebidas: Number(r.notasRecebidas || 0),
    notasCanceladas: Number(r.notasCanceladas || 0),
  }));
}

// ─── Download Logs ──────────────────────────────────────────────────
export async function createDownloadLog(data: InsertDownloadLog) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(downloadLogs).values(data);
  return result[0].insertId;
}

export async function updateDownloadLog(id: number, data: Partial<InsertDownloadLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(downloadLogs).set(data).where(eq(downloadLogs.id, id));
}

export async function deleteDownloadLog(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(downloadLogs).where(eq(downloadLogs.id, id));
}

export async function getDownloadLogsByContabilidade(contabilidadeId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(downloadLogs)
    .where(eq(downloadLogs.contabilidadeId, contabilidadeId))
    .orderBy(desc(downloadLogs.createdAt))
    .limit(limit);
}

// ─── Agendamentos ───────────────────────────────────────────────────
export async function createAgendamento(data: InsertAgendamento) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(agendamentos).values(data);
  return result[0].insertId;
}

export async function getAgendamentoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(agendamentos).where(eq(agendamentos.id, id));
  return rows[0] ?? null;
}

export async function getAgendamentosByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agendamentos)
    .where(eq(agendamentos.contabilidadeId, contabilidadeId))
    .orderBy(desc(agendamentos.createdAt));
}

export async function updateAgendamento(id: number, data: Partial<InsertAgendamento>) {
  const db = await getDb();
  if (!db) return;
  await db.update(agendamentos).set(data).where(eq(agendamentos.id, id));
}

export async function deleteAgendamento(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(agendamentos).where(eq(agendamentos.id, id));
}

// ─── Último NSU por cliente ─────────────────────────────────────────
export async function getUltimoNsu(clienteId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({
    maxNsu: sql<number>`COALESCE(MAX(${notas.nsu}), 0)`
  }).from(notas).where(eq(notas.clienteId, clienteId));
  return result[0]?.maxNsu ?? 0;
}

// ─── NSU por Competência (para busca otimizada por período) ────────
/**
 * Retorna o menor NSU de notas já salvas para um cliente em uma competência específica.
 * Usado para pular diretamente ao período desejado sem percorrer todas as notas.
 * Se não houver notas nessa competência, retorna 0.
 */
export async function getNsuMinimoPorCompetencia(
  clienteId: number,
  competenciaInicio: string, // YYYY-MM
  competenciaFim?: string    // YYYY-MM
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [yI, mI] = competenciaInicio.split("-").map(Number);
  const dataInicio = new Date(yI, mI - 1, 1);
  const fim = competenciaFim || competenciaInicio;
  const [yF, mF] = fim.split("-").map(Number);
  const dataFim = new Date(yF, mF, 0, 23, 59, 59); // último dia do mês
  const result = await db.select({
    minNsu: sql<number>`COALESCE(MIN(${notas.nsu}), 0)`
  }).from(notas).where(
    and(
      eq(notas.clienteId, clienteId),
      gte(notas.dataCompetencia, dataInicio),
      lte(notas.dataCompetencia, dataFim)
    )
  );
  return result[0]?.minNsu ?? 0;
}

/**
 * Retorna o menor NSU de notas já salvas para um cliente em um intervalo de datas específico.
 */
export async function getNsuMinimoPorData(
  clienteId: number,
  dataInicioStr: string, // YYYY-MM-DD
  dataFimStr?: string    // YYYY-MM-DD
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [yI, mI, dI] = dataInicioStr.split("-").map(Number);
  const dataInicio = new Date(yI, mI - 1, dI, 0, 0, 0);
  const fim = dataFimStr || dataInicioStr;
  const [yF, mF, dF] = fim.split("-").map(Number);
  const dataFim = new Date(yF, mF - 1, dF, 23, 59, 59);
  const result = await db.select({
    minNsu: sql<number>`COALESCE(MIN(${notas.nsu}), 0)`
  }).from(notas).where(
    and(
      eq(notas.clienteId, clienteId),
      gte(notas.dataEmissao, dataInicio),
      lte(notas.dataEmissao, dataFim)
    )
  );
  return result[0]?.minNsu ?? 0;
}

// ─── Delete Notas ───────────────────────────────────────────────────
export async function deleteNotasByCliente(clienteId: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(notas).where(and(eq(notas.clienteId, clienteId), eq(notas.contabilidadeId, contabilidadeId)));
  return result[0].affectedRows ?? 0;
}

export async function deleteAllNotasByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(notas).where(eq(notas.contabilidadeId, contabilidadeId));
  return result[0].affectedRows ?? 0;
}

// ─── Delete Cliente (cascade COMPLETA) ──────────────────────────────
// Apaga TUDO vinculado ao cliente: cancela downloads em andamento, depois
// exclui notas, download_logs, agendamentos, certificados, audit_logs e o cliente
export async function deleteCliente(clienteId: number) {
  const db = await getDb();
  if (!db) return;
  
  // PASSO 1: Cancelar downloads em andamento deste cliente
  await db.update(downloadLogs)
    .set({ status: "cancelado", erro: "Cliente excluído", finalizadoEm: new Date() })
    .where(and(
      eq(downloadLogs.clienteId, clienteId),
      or(
        eq(downloadLogs.status, "executando"),
        eq(downloadLogs.status, "pendente"),
        eq(downloadLogs.status, "retomando"),
      ),
    ));
  
  // PASSO 2: Aguardar brevemente para workers detectarem cancelamento
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // PASSO 3: Excluir em ordem (dependências primeiro)
  // CT-e: Notas, logs de download e controle NSU
  await db.delete(cteNotas).where(eq(cteNotas.clienteId, clienteId));
  await db.delete(cteDownloadLogs).where(eq(cteDownloadLogs.clienteId, clienteId));
  await db.delete(cteNsuControl).where(eq(cteNsuControl.clienteId, clienteId));
  // NFe: Notas fiscais
  await db.delete(notas).where(eq(notas.clienteId, clienteId));
  // Histórico de downloads NFe
  await db.delete(downloadLogs).where(eq(downloadLogs.clienteId, clienteId));
  // Agendamentos (clienteId específico)
  await db.delete(agendamentos).where(eq(agendamentos.clienteId, clienteId));
  // Certificados digitais
  await db.delete(certificados).where(eq(certificados.clienteId, clienteId));
  // Audit logs referenciando este cliente
  await db.delete(auditLogs).where(and(
    eq(auditLogs.entidade, "cliente"),
    eq(auditLogs.entidadeId, clienteId),
  ));
  // O próprio cliente
  await db.delete(clientes).where(eq(clientes.id, clienteId));
  
  // PASSO 4: Verificação final - garantir que notas foram apagadas
  const notasRestantes = await db.select({ count: sql<number>`COUNT(*)` })
    .from(notas).where(eq(notas.clienteId, clienteId));
  if (notasRestantes[0]?.count > 0) {
    console.log(`[DeleteCliente] ${notasRestantes[0].count} notas restantes, tentando SQL direto...`);
    await (db as any).execute(sql`DELETE FROM notas WHERE clienteId = ${clienteId}`);
  }
  
  // Verificar downloads restantes
  const logsRestantes = await db.select({ count: sql<number>`COUNT(*)` })
    .from(downloadLogs).where(eq(downloadLogs.clienteId, clienteId));
  if (logsRestantes[0]?.count > 0) {
    console.log(`[DeleteCliente] ${logsRestantes[0].count} logs restantes, tentando SQL direto...`);
    await (db as any).execute(sql`DELETE FROM download_logs WHERE clienteId = ${clienteId}`);
  }
}

// ─── Delete Contabilidade (cascade) ─────────────────────────────────
export async function deleteContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return;
  // Delete in order: notas -> download_logs -> agendamentos -> certificados -> clientes -> users -> contabilidade
  await db.delete(notas).where(eq(notas.contabilidadeId, contabilidadeId));
  await db.delete(downloadLogs).where(eq(downloadLogs.contabilidadeId, contabilidadeId));
  await db.delete(agendamentos).where(eq(agendamentos.contabilidadeId, contabilidadeId));
  await db.delete(certificados).where(eq(certificados.contabilidadeId, contabilidadeId));
  await db.delete(clientes).where(eq(clientes.contabilidadeId, contabilidadeId));
  await db.delete(users).where(eq(users.contabilidadeId, contabilidadeId));
  await db.delete(contabilidades).where(eq(contabilidades.id, contabilidadeId));
}

// ─── Check plan limits ──────────────────────────────────────────────
export async function checkContabilidadeLimits(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return { allowed: false, reason: "DB not available" };

  const contab = await getContabilidadeById(contabilidadeId);
  if (!contab) return { allowed: false, reason: "Contabilidade não encontrada" };
  if (!contab.ativo) return { allowed: false, reason: "Contabilidade desativada" };

  if (!contab.planoId) return { allowed: true, maxClientes: 999, currentClientes: 0 };

  const plano = await getPlanoById(contab.planoId);
  if (!plano || !plano.ativo) return { allowed: false, reason: "Plano inativo" };

  const [clienteCount] = await db.select({ count: count() }).from(clientes).where(eq(clientes.contabilidadeId, contabilidadeId));
  const currentClientes = clienteCount?.count ?? 0;

  return {
    allowed: currentClientes < plano.maxClientes,
    maxClientes: plano.maxClientes,
    currentClientes,
    planoNome: plano.nome,
  };
}

// ─── Settings (configurações do sistema) ────────────────────────────
export async function getSetting(chave: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(settings).where(eq(settings.chave, chave)).limit(1);
  return row?.valor ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.chave] = row.valor;
  }
  return result;
}

export async function upsertSetting(chave: string, valor: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [existing] = await db.select().from(settings).where(eq(settings.chave, chave)).limit(1);
  if (existing) {
    await db.update(settings).set({ valor }).where(eq(settings.chave, chave));
  } else {
    await db.insert(settings).values({ chave, valor });
  }
}

export async function upsertMultipleSettings(pairs: { chave: string; valor: string }[]): Promise<void> {
  for (const pair of pairs) {
    await upsertSetting(pair.chave, pair.valor);
  }
}

// ─── Certificado Ativo e Válido (não vencido) ──────────────────────
export async function getCertificadoAtivoValido(clienteId: number) {
  const cert = await getCertificadoAtivo(clienteId);
  if (!cert) return { cert: undefined, vencido: false };
  if (cert.validTo && new Date(cert.validTo) < new Date()) {
    return { cert, vencido: true };
  }
  return { cert, vencido: false };
}

// ─── Notas por cliente para relatório de download ──────────────────
export async function getNotasByClienteForDownload(clienteId: number, contabilidadeId: number, periodoInicio?: Date, periodoFim?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notas.clienteId, clienteId), eq(notas.contabilidadeId, contabilidadeId)];
  if (periodoInicio) conditions.push(gte(notas.dataEmissao, periodoInicio));
  if (periodoFim) conditions.push(lte(notas.dataEmissao, periodoFim));
  return db.select({
    id: notas.id,
    numeroNota: notas.numeroNota,
    dataEmissao: notas.dataEmissao,
    dataCompetencia: notas.dataCompetencia,
    emitenteCnpj: notas.emitenteCnpj,
    emitenteNome: notas.emitenteNome,
    tomadorCnpj: notas.tomadorCnpj,
    tomadorNome: notas.tomadorNome,
    valorServico: notas.valorServico,
    valorLiquido: notas.valorLiquido,
    direcao: notas.direcao,
    status: notas.status,
    chaveAcesso: notas.chaveAcesso,
    tipoDocumento: notas.tipoDocumento,
    xmlOriginal: notas.xmlOriginal,
    danfsePdfUrl: notas.danfsePdfUrl,
  }).from(notas)
    .where(and(...conditions))
    .orderBy(desc(notas.dataEmissao));
}

// ─── Clientes com status de certificado ────────────────────────────
export async function getClientesComStatusCertificado(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const clientesList = await db.select().from(clientes)
    .where(eq(clientes.contabilidadeId, contabilidadeId))
    .orderBy(asc(clientes.razaoSocial));
  
  const result = [];
  for (const cliente of clientesList) {
    const cert = await getCertificadoAtivo(cliente.id);
    let certStatus: "valido" | "vencido" | "sem_certificado" = "sem_certificado";
    let certValidTo: Date | null = null;
    if (cert) {
      certValidTo = cert.validTo ? new Date(cert.validTo) : null;
      if (certValidTo && certValidTo < new Date()) {
        certStatus = "vencido";
      } else {
        certStatus = "valido";
      }
    }
    result.push({
      ...cliente,
      certStatus,
      certValidTo,
    });
  }
  return result;
}

// ─── Cancelar downloads em andamento ───────────────────────────────
export async function cancelDownloadsEmAndamento(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  // Cancelar todos os downloads com status "executando", "pendente" ou "retomando"
  const result = await db.update(downloadLogs)
    .set({ status: "cancelado", erro: "Cancelado pelo usu\u00e1rio", finalizadoEm: new Date() })
    .where(and(
      eq(downloadLogs.contabilidadeId, contabilidadeId),
      or(
        eq(downloadLogs.status, "executando"),
        eq(downloadLogs.status, "pendente"),
        eq(downloadLogs.status, "retomando"),
      ),
    ));
  return result[0]?.affectedRows ?? 0;
}

// Buscar downloads órfãos (pendente/executando/retomando) que ficaram travados após restart do servidor
export async function getOrphanedDownloads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(downloadLogs)
    .where(
      or(
        eq(downloadLogs.status, "pendente"),
        eq(downloadLogs.status, "executando"),
        eq(downloadLogs.status, "retomando"),
      ),
    )
    .orderBy(downloadLogs.iniciadoEm);
}

// Auto-detectar downloads travados (mais de 10 min sem finalizar)
// Retorna os logs travados para que o caller possa decidir se faz auto-retry
// Ignora logs com totalEsperado=0 (sem notas) e logs em auto-correção
export async function getStallledDownloads(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const stalled = await db.select().from(downloadLogs)
    .where(and(
      eq(downloadLogs.contabilidadeId, contabilidadeId),
      eq(downloadLogs.status, "executando"),
      lte(downloadLogs.iniciadoEm, tenMinAgo),
    ));
  // Filtrar: não marcar como travado se totalEsperado=0 (sem notas) ou se está em auto-correção
  return stalled.filter(log => {
    // Se totalEsperado é 0 e já foi concluído com "sem notas", ignorar
    if (log.totalEsperado === 0 && log.totalNotas === 0) return false;
    // Se a etapa indica auto-correção em andamento, ignorar
    const etapa = (log.etapa || "").toLowerCase();
    if (etapa.includes("auto-correção") || etapa.includes("auto-correcao")) return false;
    return true;
  });
}

// Marcar download travado como erro definitivo (excedeu tentativas)
export async function markStalledAsError(logId: number, tentativas: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(downloadLogs)
    .set({
      status: "erro",
      erro: `Download travado - timeout automático (${tentativas} tentativa(s))`,
      finalizadoEm: new Date(),
      tentativas,
    })
    .where(eq(downloadLogs.id, logId));
}

// Marcar download travado como pendente de retry (incrementar tentativas)
export async function markStalledForRetry(logId: number, tentativas: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(downloadLogs)
    .set({
      status: "erro",
      erro: `Download travado - tentativa ${tentativas}, retomando automaticamente...`,
      finalizadoEm: new Date(),
      tentativas,
    })
    .where(eq(downloadLogs.id, logId));
}

// Compatibilidade: auto-fix que marca como erro (usado quando não há auto-retry)
export async function autoFixStalledDownloads(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const result = await db.update(downloadLogs)
    .set({ status: "erro", erro: "Download travado - timeout automático", finalizadoEm: new Date() })
    .where(and(
      eq(downloadLogs.contabilidadeId, contabilidadeId),
      eq(downloadLogs.status, "executando"),
      lte(downloadLogs.iniciadoEm, tenMinAgo),
    ));
  return result[0]?.affectedRows ?? 0;
}

export async function cancelDownloadById(logId: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(downloadLogs)
    .set({ status: "cancelado", erro: "Cancelado pelo usuário", finalizadoEm: new Date() })
    .where(and(
      eq(downloadLogs.id, logId),
      eq(downloadLogs.contabilidadeId, contabilidadeId),
      eq(downloadLogs.status, "executando"),
    ));
  return (result[0]?.affectedRows ?? 0) > 0;
}

// ─── Limpar histórico de downloads ─────────────────────────────────
export async function clearDownloadHistory(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(downloadLogs)
    .where(and(
      eq(downloadLogs.contabilidadeId, contabilidadeId),
      or(
        eq(downloadLogs.status, "concluido"),
        eq(downloadLogs.status, "erro"),
        eq(downloadLogs.status, "cancelado"),
      ),
    ));
  return result[0]?.affectedRows ?? 0;
}

// ─── Verificar se download foi cancelado ───────────────────────────
export async function isDownloadCancelled(logId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return true; // sem DB = considerar cancelado (seguro)
  const result = await db.select({ status: downloadLogs.status })
    .from(downloadLogs).where(eq(downloadLogs.id, logId)).limit(1);
  // Se o log NÃO EXISTE (foi deletado pelo deleteAll), considerar CANCELADO
  // Isso impede que workers continuem criando notas após o deleteAll apagar os logs
  if (!result[0]) return true;
  return result[0].status === "cancelado";
}


// ─── Delete All Clientes by Contabilidade (cascade TOTAL) ─────────────────
// Apaga TUDO: notas, downloads, agendamentos, certificados, auditoria, clientes
// Estratégia: SQL DIRETO como método primário (mais confiável que Drizzle ORM)
// IMPORTANTE: cancelar downloads em andamento ANTES de chamar esta função!
export async function deleteAllClientesByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  
  // Contar clientes antes de apagar (para retornar o total)
  const [countResult] = await (db as any).execute(
    sql`SELECT COUNT(*) as cnt FROM clientes WHERE contabilidadeId = ${contabilidadeId}`
  );
  const totalClientes = Number(countResult?.[0]?.cnt ?? 0);
  
  console.log(`[DeleteAll] Iniciando limpeza TOTAL da contabilidade ${contabilidadeId} (${totalClientes} clientes)`);
  
  // MÉTODO PRIMÁRIO: SQL DIRETO (não depende do Drizzle ORM)
  // ORDEM: tabelas filhas primeiro, tabelas pai por último
  const tabelas = [
    // CT-e: Notas, logs de download e controle NSU
    { nome: 'cte_notas', sql: sql`DELETE FROM cte_notas WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'cte_download_logs', sql: sql`DELETE FROM cte_download_logs WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'cte_nsu_control', sql: sql`DELETE FROM cte_nsu_control WHERE contabilidadeId = ${contabilidadeId}` },
    // NFe
    { nome: 'notas', sql: sql`DELETE FROM notas WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'download_logs', sql: sql`DELETE FROM download_logs WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'agendamentos', sql: sql`DELETE FROM agendamentos WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'certificados', sql: sql`DELETE FROM certificados WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'audit_logs', sql: sql`DELETE FROM audit_logs WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'clientes', sql: sql`DELETE FROM clientes WHERE contabilidadeId = ${contabilidadeId}` },
  ];
  
  for (const tabela of tabelas) {
    try {
      const [result] = await (db as any).execute(tabela.sql);
      const affected = result?.affectedRows ?? 0;
      console.log(`[DeleteAll] ${tabela.nome}: ${affected} registro(s) apagado(s)`);
    } catch (err: any) {
      console.error(`[DeleteAll] ERRO ao apagar ${tabela.nome}:`, err.message);
    }
  }
  
  // Limpar status do download engine
  try {
    await (db as any).execute(
      sql`DELETE FROM settings WHERE \`chave\` LIKE CONCAT('download_engine_status_', ${contabilidadeId})`
    );
  } catch (_) {}
  
  // VERIFICAÇÃO FINAL: conferir se realmente não sobrou nada
  const [notasCheck] = await (db as any).execute(
    sql`SELECT COUNT(*) as cnt FROM notas WHERE contabilidadeId = ${contabilidadeId}`
  );
  const [clientesCheck] = await (db as any).execute(
    sql`SELECT COUNT(*) as cnt FROM clientes WHERE contabilidadeId = ${contabilidadeId}`
  );
  const [certsCheck] = await (db as any).execute(
    sql`SELECT COUNT(*) as cnt FROM certificados WHERE contabilidadeId = ${contabilidadeId}`
  );
  const [logsCheck] = await (db as any).execute(
    sql`SELECT COUNT(*) as cnt FROM download_logs WHERE contabilidadeId = ${contabilidadeId}`
  );
  
  const notasRest = Number(notasCheck?.[0]?.cnt ?? 0);
  const clientesRest = Number(clientesCheck?.[0]?.cnt ?? 0);
  const certsRest = Number(certsCheck?.[0]?.cnt ?? 0);
  const logsRest = Number(logsCheck?.[0]?.cnt ?? 0);
  
  if (notasRest > 0 || clientesRest > 0 || certsRest > 0 || logsRest > 0) {
    console.error(`[DeleteAll] ATENÇÃO: Restaram dados! Notas: ${notasRest}, Clientes: ${clientesRest}, Certs: ${certsRest}, Logs: ${logsRest}`);
    // Retry agressivo: apagar com LIMIT grande em loop
    for (let retry = 0; retry < 3; retry++) {
      await (db as any).execute(sql`DELETE FROM notas WHERE contabilidadeId = ${contabilidadeId} LIMIT 10000`);
      await (db as any).execute(sql`DELETE FROM download_logs WHERE contabilidadeId = ${contabilidadeId} LIMIT 10000`);
      await (db as any).execute(sql`DELETE FROM certificados WHERE contabilidadeId = ${contabilidadeId} LIMIT 10000`);
      await (db as any).execute(sql`DELETE FROM clientes WHERE contabilidadeId = ${contabilidadeId} LIMIT 10000`);
      await (db as any).execute(sql`DELETE FROM audit_logs WHERE contabilidadeId = ${contabilidadeId} LIMIT 10000`);
      await (db as any).execute(sql`DELETE FROM agendamentos WHERE contabilidadeId = ${contabilidadeId} LIMIT 10000`);
    }
    console.log(`[DeleteAll] Retry agressivo concluído`);
  }
  
  console.log(`[DeleteAll] Limpeza TOTAL concluída para contabilidade ${contabilidadeId}: ${totalClientes} clientes removidos`);
  return totalClientes;
}

// ─── Log de Auditoria ───────────────────────────────────────────────
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogsByContabilidade(contabilidadeId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs)
    .where(eq(auditLogs.contabilidadeId, contabilidadeId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function getAuditLogsByUser(contabilidadeId: number, userName: string, limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLogs)
    .where(and(eq(auditLogs.contabilidadeId, contabilidadeId), eq(auditLogs.userName, userName)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function updateAuditLog(id: number, contabilidadeId: number, detalhes: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(auditLogs)
    .set({ detalhes })
    .where(and(eq(auditLogs.id, id), eq(auditLogs.contabilidadeId, contabilidadeId)));
}

export async function deleteAuditLog(id: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(auditLogs)
    .where(and(eq(auditLogs.id, id), eq(auditLogs.contabilidadeId, contabilidadeId)));
}

export async function deleteAllAuditLogs(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(auditLogs)
    .where(eq(auditLogs.contabilidadeId, contabilidadeId));
  return (result as any)[0]?.affectedRows || 0;
}

// ─── Consulta CNPJ na Receita Federal (BrasilAPI) ───────────────────
export async function consultarCnpjReceita(cnpj: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  const headers = { "User-Agent": "PegasusNFSe/1.0", "Accept": "application/json" };
  
  // Tenta BrasilAPI primeiro, fallback para ReceitaWS
  let data: any;
  let response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, { headers });
  if (response.ok) {
    data = await response.json();
  } else {
    // Fallback: ReceitaWS
    response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpjLimpo}`, { headers });
    if (!response.ok) {
      throw new Error(`Erro ao consultar CNPJ: ${response.status} ${response.statusText}`);
    }
    const rws = await response.json();
    if (rws.status === "ERROR") throw new Error(rws.message || "CNPJ não encontrado");
    // Normalizar formato ReceitaWS para o mesmo formato
    data = {
      razao_social: rws.nome || "",
      nome_fantasia: rws.fantasia || "",
      logradouro: rws.logradouro || "",
      numero: rws.numero || "",
      complemento: rws.complemento || "",
      bairro: rws.bairro || "",
      municipio: rws.municipio || "",
      uf: rws.uf || "",
      cep: rws.cep?.replace(/[^\d-]/g, "") || "",
      ddd_telefone_1: rws.telefone?.split("/")?.[0]?.trim() || "",
      ddd_telefone_2: rws.telefone?.split("/")?.[1]?.trim() || "",
      email: rws.email || "",
      porte: rws.porte || "",
      capital_social: rws.capital_social || "",
      natureza_juridica: rws.natureza_juridica || "",
      data_inicio_atividade: rws.abertura || "",
      descricao_situacao_cadastral: rws.situacao || "",
      cnae_fiscal: rws.atividade_principal?.[0]?.code || "",
      cnae_fiscal_descricao: rws.atividade_principal?.[0]?.text || "",
      cnaes_secundarios: rws.atividades_secundarias?.map((a: any) => ({ codigo: a.code, descricao: a.text })) || [],
      qsa: rws.qsa?.map((s: any) => ({ nome_socio: s.nome, qualificacao_socio: s.qual })) || [],
      opcao_pelo_simples: rws.simples?.optante === true ? true : rws.simples?.optante === false ? false : null,
      opcao_pelo_mei: rws.simei?.optante === true ? true : rws.simei?.optante === false ? false : null,
    };
  }
  return {
    razaoSocial: data.razao_social || "",
    nomeFantasia: data.nome_fantasia || "",
    logradouro: data.descricao_tipo_de_logradouro ? `${data.descricao_tipo_de_logradouro} ${data.logradouro}` : data.logradouro || "",
    numero: data.numero || "",
    complemento: data.complemento || "",
    bairro: data.bairro || "",
    cidade: data.municipio || "",
    uf: data.uf || "",
    cep: data.cep || "",
    telefone: data.ddd_telefone_1 || "",
    telefone2: data.ddd_telefone_2 || "",
    email: data.email || "",
    porte: data.porte || "",
    capitalSocial: data.capital_social?.toString() || "",
    naturezaJuridica: data.natureza_juridica || "",
    dataAbertura: data.data_inicio_atividade || "",
    situacaoCadastral: data.descricao_situacao_cadastral || "",
    cnaePrincipal: data.cnae_fiscal?.toString() || "",
    cnaePrincipalDescricao: data.cnae_fiscal_descricao || "",
    cnaesSecundarios: data.cnaes_secundarios?.map((c: any) => ({
      codigo: c.codigo?.toString() || "",
      descricao: c.descricao || "",
    })) || [],
    socios: data.qsa?.map((s: any) => ({
      nome: s.nome_socio || "",
      qualificacao: s.qualificacao_socio || "",
      dataEntrada: s.data_entrada_sociedade || "",
    })) || [],
    optanteSimples: data.opcao_pelo_simples ?? null,
    optanteMEI: data.opcao_pelo_mei ?? null,
    regimeTributario: data.regime_tributario?.[0]?.forma_de_tributacao || "",
    tipoCliente: data.porte || "",
  };
}

// ─── Atualizar cliente com dados da Receita ─────────────────────────
export async function atualizarClienteComDadosReceita(clienteId: number, dadosReceita: Awaited<ReturnType<typeof consultarCnpjReceita>>) {
  const db = await getDb();
  if (!db) return;
  await db.update(clientes).set({
    nomeFantasia: dadosReceita.nomeFantasia || undefined,
    logradouro: dadosReceita.logradouro || undefined,
    numero: dadosReceita.numero || undefined,
    complemento: dadosReceita.complemento || undefined,
    bairro: dadosReceita.bairro || undefined,
    cidade: dadosReceita.cidade || undefined,
    uf: dadosReceita.uf || undefined,
    cep: dadosReceita.cep || undefined,
    telefone: dadosReceita.telefone || undefined,
    telefone2: dadosReceita.telefone2 || undefined,
    email: dadosReceita.email || undefined,
    porte: dadosReceita.porte || undefined,
    capitalSocial: dadosReceita.capitalSocial || undefined,
    naturezaJuridica: dadosReceita.naturezaJuridica || undefined,
    dataAbertura: dadosReceita.dataAbertura || undefined,
    situacaoCadastral: dadosReceita.situacaoCadastral || undefined,
    cnaePrincipal: dadosReceita.cnaePrincipal || undefined,
    cnaePrincipalDescricao: dadosReceita.cnaePrincipalDescricao || undefined,
    cnaesSecundarios: JSON.stringify(dadosReceita.cnaesSecundarios),
    socios: JSON.stringify(dadosReceita.socios),
    optanteSimples: dadosReceita.optanteSimples,
    optanteMEI: dadosReceita.optanteMEI,
    regimeTributario: dadosReceita.regimeTributario || undefined,
    tipoCliente: dadosReceita.tipoCliente || undefined,
    dadosReceitaAtualizadosEm: new Date(),
  }).where(eq(clientes.id, clienteId));
}


// Buscar logs concluídos com erros de PDF para auto-correção
export async function getDownloadLogsComErrosPdf(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: downloadLogs.id,
    clienteId: downloadLogs.clienteId,
    clienteNome: downloadLogs.clienteNome,
    clienteCnpj: downloadLogs.clienteCnpj,
    totalPdf: downloadLogs.totalPdf,
    errosPdf: downloadLogs.errosPdf,
  }).from(downloadLogs)
    .where(and(
      eq(downloadLogs.contabilidadeId, contabilidadeId),
      eq(downloadLogs.status, "concluido"),
      gt(downloadLogs.errosPdf, 0),
    ))
    .orderBy(desc(downloadLogs.createdAt));
}

// Contagem REAL de XMLs e PDFs de um cliente na tabela notas
export async function getContagemReaisCliente(clienteId: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return { totalXml: 0, totalPdf: 0 };
  const result = await db.select({
    totalXml: sql<number>`COUNT(*)`,
    totalPdf: sql<number>`SUM(CASE WHEN ${notas.danfsePdfUrl} IS NOT NULL AND ${notas.danfsePdfUrl} != '' THEN 1 ELSE 0 END)`,
  }).from(notas)
    .where(and(
      eq(notas.clienteId, clienteId),
      eq(notas.contabilidadeId, contabilidadeId),
      eq(notas.tipoDocumento, "NFSE"),
    ));
  return {
    totalXml: Number(result[0]?.totalXml ?? 0),
    totalPdf: Number(result[0]?.totalPdf ?? 0),
  };
}

// Buscar notas de um cliente que não têm PDF (tipoDocumento = NFSE e sem danfsePdfUrl)
export async function getNotasSemPdf(clienteId: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: notas.id,
    chaveAcesso: notas.chaveAcesso,
  }).from(notas)
    .where(and(
      eq(notas.clienteId, clienteId),
      eq(notas.contabilidadeId, contabilidadeId),
      eq(notas.tipoDocumento, "NFSE"),
      isNull(notas.danfsePdfUrl),
    ));
}


// Listar períodos (meses) disponíveis com notas baixadas para um ou mais clientes
export async function getPeriodosDisponiveis(clienteIds: number[], contabilidadeId: number) {
  const db = await getDb();
  if (!db) return [];
  // Use raw SQL to avoid Drizzle backtick issues with GROUP BY/ORDER BY
  const idsList = clienteIds.join(',');
  const [rows] = await (db as any).execute(
    sql`SELECT YEAR(dataCompetencia) as ano, MONTH(dataCompetencia) as mes, COUNT(*) as totalNotas FROM notas WHERE clienteId IN (${sql.raw(idsList)}) AND contabilidadeId = ${contabilidadeId} AND dataCompetencia IS NOT NULL GROUP BY YEAR(dataCompetencia), MONTH(dataCompetencia) ORDER BY YEAR(dataCompetencia) DESC, MONTH(dataCompetencia) DESC`
  );
  return (rows as any[]).map((r: any) => ({
    ano: Number(r.ano),
    mes: Number(r.mes),
    totalNotas: Number(r.totalNotas),
    label: `${String(r.mes).padStart(2, "0")}/${r.ano}`,
  }));
}


// ─── Contar notas por contabilidade (para verificação após deleteAll) ───
export async function countNotasByContabilidade(contabilidadeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(notas)
    .where(eq(notas.contabilidadeId, contabilidadeId));
  return Number(result[0]?.count ?? 0);
}


// ═══════════════════════════════════════════════════════════════════════
// ─── CT-e: Helpers de Banco de Dados ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

// ─── CT-e: Notas ──────────────────────────────────────────────────────
export async function createCteNota(data: InsertCteNota) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(cteNotas).values(data);
  return result[0].insertId;
}

export async function upsertCteNota(data: InsertCteNota) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(cteNotas).values(data).onDuplicateKeyUpdate({
    set: {
      status: data.status,
      tipoEvento: data.tipoEvento,
      ...(data.dactePdfUrl ? { dactePdfUrl: data.dactePdfUrl } : {}),
      ...(data.dactePdfKey ? { dactePdfKey: data.dactePdfKey } : {}),
      // Atualizar campos extras se fornecidos
      ...(data.produtoPredominante ? { produtoPredominante: data.produtoPredominante } : {}),
      ...(data.pesoBruto ? { pesoBruto: data.pesoBruto } : {}),
      ...(data.valorCarga ? { valorCarga: data.valorCarga } : {}),
      ...(data.cstIcms ? { cstIcms: data.cstIcms } : {}),
      ...(data.baseCalcIcms ? { baseCalcIcms: data.baseCalcIcms } : {}),
      ...(data.aliqIcms ? { aliqIcms: data.aliqIcms } : {}),
      ...(data.rntrc ? { rntrc: data.rntrc } : {}),
      ...(data.placa ? { placa: data.placa } : {}),
      ...(data.protocolo ? { protocolo: data.protocolo } : {}),
      ...(data.chavesNfe ? { chavesNfe: data.chavesNfe } : {}),
      ...(data.observacoes ? { observacoes: data.observacoes } : {}),
      ...(data.remetenteUf ? { remetenteUf: data.remetenteUf } : {}),
      ...(data.destinatarioUf ? { destinatarioUf: data.destinatarioUf } : {}),
      ...(data.tomadorUf ? { tomadorUf: data.tomadorUf } : {}),
      updatedAt: new Date(),
    }
  });
}

export async function getCteChavesExistentes(clienteId: number, chaves: string[]): Promise<Set<string>> {
  const db = await getDb();
  if (!db || chaves.length === 0) return new Set();
  const result = new Set<string>();
  const BATCH = 500;
  for (let i = 0; i < chaves.length; i += BATCH) {
    const batch = chaves.slice(i, i + BATCH);
    const rows = await db.select({ chaveAcesso: cteNotas.chaveAcesso, dactePdfUrl: cteNotas.dactePdfUrl })
      .from(cteNotas)
      .where(and(
        eq(cteNotas.clienteId, clienteId),
        inArray(cteNotas.chaveAcesso, batch)
      ));
    for (const row of rows) {
      result.add(row.chaveAcesso);
    }
  }
  return result;
}

export async function getCteChavesSemPdf(clienteId: number, chaves: string[]): Promise<Set<string>> {
  const db = await getDb();
  if (!db || chaves.length === 0) return new Set();
  const result = new Set<string>();
  const BATCH = 500;
  for (let i = 0; i < chaves.length; i += BATCH) {
    const batch = chaves.slice(i, i + BATCH);
    const rows = await db.select({ chaveAcesso: cteNotas.chaveAcesso })
      .from(cteNotas)
      .where(and(
        eq(cteNotas.clienteId, clienteId),
        inArray(cteNotas.chaveAcesso, batch),
        isNull(cteNotas.dactePdfUrl)
      ));
    for (const row of rows) {
      result.add(row.chaveAcesso);
    }
  }
  return result;
}

export async function updateCteNota(notaId: number, data: Partial<InsertCteNota>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(cteNotas).set({ ...data, updatedAt: new Date() }).where(eq(cteNotas.id, notaId));
}

export async function updateCteNotaByChave(chaveAcesso: string, clienteId: number, data: Partial<InsertCteNota>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(cteNotas).set({ ...data, updatedAt: new Date() }).where(and(eq(cteNotas.chaveAcesso, chaveAcesso), eq(cteNotas.clienteId, clienteId)));
}

export async function getCteNotasByContabilidade(contabilidadeId: number, filters?: {
  clienteId?: number;
  status?: string;
  direcao?: string;
  tipoDocumento?: string;
  modal?: string;
  dataInicio?: string;
  dataFim?: string;
  busca?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { notas: [], total: 0 };

  const conditions: any[] = [eq(cteNotas.contabilidadeId, contabilidadeId)];
  if (filters?.clienteId) conditions.push(eq(cteNotas.clienteId, filters.clienteId));
  if (filters?.status) conditions.push(eq(cteNotas.status, filters.status as any));
  if (filters?.direcao) conditions.push(eq(cteNotas.direcao, filters.direcao as any));
  if (filters?.tipoDocumento) conditions.push(eq(cteNotas.tipoDocumento, filters.tipoDocumento as any));
  if (filters?.modal) conditions.push(eq(cteNotas.modal, filters.modal as any));
  if (filters?.dataInicio) conditions.push(gte(cteNotas.dataEmissao, new Date(filters.dataInicio)));
  if (filters?.dataFim) conditions.push(lte(cteNotas.dataEmissao, new Date(filters.dataFim + 'T23:59:59')));
  if (filters?.busca) {
    conditions.push(or(
      like(cteNotas.emitenteNome, `%${filters.busca}%`),
      like(cteNotas.remetenteNome, `%${filters.busca}%`),
      like(cteNotas.destinatarioNome, `%${filters.busca}%`),
      like(cteNotas.tomadorNome, `%${filters.busca}%`),
      like(cteNotas.chaveAcesso, `%${filters.busca}%`),
      like(cteNotas.emitenteCnpj, `%${filters.busca}%`),
      like(cteNotas.numeroCte, `%${filters.busca}%`),
      like(clientes.razaoSocial, `%${filters.busca}%`),
      like(clientes.cnpj, `%${filters.busca}%`),
    )!);
  }

  const where = and(...conditions);
  const [rows, totalResult] = await Promise.all([
    db.select({
      id: cteNotas.id,
      clienteId: cteNotas.clienteId,
      contabilidadeId: cteNotas.contabilidadeId,
      chaveAcesso: cteNotas.chaveAcesso,
      nsu: cteNotas.nsu,
      numeroCte: cteNotas.numeroCte,
      serie: cteNotas.serie,
      modelo: cteNotas.modelo,
      tipoDocumento: cteNotas.tipoDocumento,
      tipoEvento: cteNotas.tipoEvento,
      direcao: cteNotas.direcao,
      status: cteNotas.status,
      emitenteCnpj: cteNotas.emitenteCnpj,
      emitenteNome: cteNotas.emitenteNome,
      emitenteUf: cteNotas.emitenteUf,
      remetenteCnpj: cteNotas.remetenteCnpj,
      remetenteNome: cteNotas.remetenteNome,
      destinatarioCnpj: cteNotas.destinatarioCnpj,
      destinatarioNome: cteNotas.destinatarioNome,
      tomadorCnpj: cteNotas.tomadorCnpj,
      tomadorNome: cteNotas.tomadorNome,
      valorTotal: cteNotas.valorTotal,
      valorReceber: cteNotas.valorReceber,
      valorICMS: cteNotas.valorICMS,
      modal: cteNotas.modal,
      cfop: cteNotas.cfop,
      natOp: cteNotas.natOp,
      ufInicio: cteNotas.ufInicio,
      ufFim: cteNotas.ufFim,
      munInicio: cteNotas.munInicio,
      munFim: cteNotas.munFim,
      // ICMS detalhado
      cstIcms: cteNotas.cstIcms,
      baseCalcIcms: cteNotas.baseCalcIcms,
      aliqIcms: cteNotas.aliqIcms,
      // Carga
      valorCarga: cteNotas.valorCarga,
      pesoBruto: cteNotas.pesoBruto,
      produtoPredominante: cteNotas.produtoPredominante,
      // Modal rodoviário
      rntrc: cteNotas.rntrc,
      placa: cteNotas.placa,
      // Protocolo
      protocolo: cteNotas.protocolo,
      observacoes: cteNotas.observacoes,
      // UFs participantes
      remetenteUf: cteNotas.remetenteUf,
      destinatarioUf: cteNotas.destinatarioUf,
      tomadorUf: cteNotas.tomadorUf,
      // DACTE
      dactePdfUrl: cteNotas.dactePdfUrl,
      dataEmissao: cteNotas.dataEmissao,
      xmlOriginal: cteNotas.xmlOriginal,
      chavesNfe: cteNotas.chavesNfe,
      createdAt: cteNotas.createdAt,
      updatedAt: cteNotas.updatedAt,
      // Dados do cliente (empresa)
      clienteRazaoSocial: clientes.razaoSocial,
      clienteCnpj: clientes.cnpj,
    })
      .from(cteNotas)
      .leftJoin(clientes, eq(cteNotas.clienteId, clientes.id))
      .where(where)
      .orderBy(desc(cteNotas.dataEmissao))
      .limit(filters?.limit ?? 50)
      .offset(filters?.offset ?? 0),
    db.select({ count: count() })
      .from(cteNotas)
      .leftJoin(clientes, eq(cteNotas.clienteId, clientes.id))
      .where(where),
  ]);

  return { notas: rows, total: totalResult[0]?.count ?? 0 };
}

export async function getCteNotaByChaveAcesso(chaveAcesso: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cteNotas).where(eq(cteNotas.chaveAcesso, chaveAcesso)).limit(1);
  return result[0];
}

export async function getCteNotasForRelatorio(contabilidadeId: number, filters?: {
  clienteId?: number;
  status?: string;
  direcao?: string;
  tipoDocumento?: string;
  modal?: string;
  dataInicio?: string;
  dataFim?: string;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [eq(cteNotas.contabilidadeId, contabilidadeId)];
  if (filters?.clienteId) conditions.push(eq(cteNotas.clienteId, filters.clienteId));
  if (filters?.status) conditions.push(eq(cteNotas.status, filters.status as any));
  if (filters?.direcao) conditions.push(eq(cteNotas.direcao, filters.direcao as any));
  if (filters?.tipoDocumento) conditions.push(eq(cteNotas.tipoDocumento, filters.tipoDocumento as any));
  if (filters?.modal) conditions.push(eq(cteNotas.modal, filters.modal as any));
  if (filters?.dataInicio) conditions.push(gte(cteNotas.dataEmissao, new Date(filters.dataInicio)));
  if (filters?.dataFim) conditions.push(lte(cteNotas.dataEmissao, new Date(filters.dataFim + 'T23:59:59')));

  return db.select().from(cteNotas).where(and(...conditions)).orderBy(desc(cteNotas.dataEmissao));
}

export async function deleteCteNotasByCliente(clienteId: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.delete(cteNotas).where(and(eq(cteNotas.clienteId, clienteId), eq(cteNotas.contabilidadeId, contabilidadeId)));
  return result[0].affectedRows ?? 0;
}

// ─── CT-e: Download Logs ──────────────────────────────────────────────
export async function createCteDownloadLog(data: InsertCteDownloadLog) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(cteDownloadLogs).values(data);
  return result[0].insertId;
}

export async function updateCteDownloadLog(id: number, data: Partial<InsertCteDownloadLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(cteDownloadLogs).set(data).where(eq(cteDownloadLogs.id, id));
}

export async function getCteDownloadLogsByContabilidade(contabilidadeId: number, limit = 500) {
  const db = await getDb();
  if (!db) return [];
  // Retornar todos os logs das últimas 24h + qualquer pendente/executando
  // Isso garante que batches grandes (200+ empresas) sejam totalmente visíveis
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.select().from(cteDownloadLogs)
    .where(and(
      eq(cteDownloadLogs.contabilidadeId, contabilidadeId),
      or(
        inArray(cteDownloadLogs.status, ["pendente", "executando", "retomando"]),
        gte(cteDownloadLogs.createdAt, oneDayAgo)
      )
    ))
    .orderBy(desc(cteDownloadLogs.createdAt))
    .limit(limit);
}

export async function isCteDownloadCancelled(logId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return true;
  const rows = await db.select({ status: cteDownloadLogs.status })
    .from(cteDownloadLogs)
    .where(eq(cteDownloadLogs.id, logId));
  return rows[0]?.status === "cancelado";
}

export async function cancelCteDownloadById(logId: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(cteDownloadLogs)
    .set({ status: "cancelado", finalizadoEm: new Date() })
    .where(and(eq(cteDownloadLogs.id, logId), eq(cteDownloadLogs.contabilidadeId, contabilidadeId)));
}

export async function cancelCteDownloadsEmAndamento(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(cteDownloadLogs)
    .set({ status: "cancelado", finalizadoEm: new Date() })
    .where(and(
      eq(cteDownloadLogs.contabilidadeId, contabilidadeId),
      inArray(cteDownloadLogs.status, ["pendente", "executando", "retomando"])
    ));
}

export async function clearCteDownloadHistory(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(cteDownloadLogs)
    .where(and(
      eq(cteDownloadLogs.contabilidadeId, contabilidadeId),
      inArray(cteDownloadLogs.status, ["concluido", "erro", "cancelado"])
    ));
}

// ─── CT-e: NSU Control ────────────────────────────────────────────────
export async function getCteUltimoNsu(clienteId: number, contabilidadeId: number): Promise<{ ultimoNsu: number; maxNsu: number }> {
  const db = await getDb();
  if (!db) return { ultimoNsu: 0, maxNsu: 0 };
  const rows = await db.select().from(cteNsuControl)
    .where(and(eq(cteNsuControl.clienteId, clienteId), eq(cteNsuControl.contabilidadeId, contabilidadeId)));
  if (rows.length === 0) return { ultimoNsu: 0, maxNsu: 0 };
  return { ultimoNsu: rows[0].ultimoNsu, maxNsu: rows[0].maxNsu };
}

export async function upsertCteNsuControl(data: InsertCteNsuControl) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(cteNsuControl).values(data).onDuplicateKeyUpdate({
    set: {
      ultimoNsu: data.ultimoNsu,
      maxNsu: data.maxNsu,
      ultimaConsulta: new Date(),
      updatedAt: new Date(),
    }
  });
}

// ─── CT-e: Estatísticas para Dashboard ────────────────────────────────
export async function getCteStats(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return { totalCtes: 0, emitidos: 0, tomados: 0, cancelados: 0, valorTotal: 0 };

  const [totalResult, emitidosResult, tomadosResult, canceladosResult, valorResult] = await Promise.all([
    db.select({ count: count() }).from(cteNotas).where(eq(cteNotas.contabilidadeId, contabilidadeId)),
    db.select({ count: count() }).from(cteNotas).where(and(eq(cteNotas.contabilidadeId, contabilidadeId), eq(cteNotas.direcao, "emitido"))),
    db.select({ count: count() }).from(cteNotas).where(and(eq(cteNotas.contabilidadeId, contabilidadeId), eq(cteNotas.direcao, "tomado"))),
    db.select({ count: count() }).from(cteNotas).where(and(eq(cteNotas.contabilidadeId, contabilidadeId), eq(cteNotas.status, "cancelado"))),
    db.select({ total: sql<number>`COALESCE(SUM(${cteNotas.valorTotal}), 0)` }).from(cteNotas).where(eq(cteNotas.contabilidadeId, contabilidadeId)),
  ]);

  return {
    totalCtes: totalResult[0]?.count ?? 0,
    emitidos: emitidosResult[0]?.count ?? 0,
    tomados: tomadosResult[0]?.count ?? 0,
    cancelados: canceladosResult[0]?.count ?? 0,
    valorTotal: Number(valorResult[0]?.total ?? 0),
  };
}

export async function countCteNotasByContabilidade(contabilidadeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(cteNotas)
    .where(eq(cteNotas.contabilidadeId, contabilidadeId));
  return Number(result[0]?.count ?? 0);
}

export async function getOrphanedCteDownloads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cteDownloadLogs)
    .where(
      or(
        eq(cteDownloadLogs.status, "pendente"),
        eq(cteDownloadLogs.status, "executando"),
      ),
    );
}

export async function countCteNotasByCliente(clienteId: number, contabilidadeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` })
    .from(cteNotas)
    .where(and(eq(cteNotas.clienteId, clienteId), eq(cteNotas.contabilidadeId, contabilidadeId)));
  return Number(result[0]?.count ?? 0);
}

export async function getCteNotaById(id: number, contabilidadeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cteNotas)
    .where(and(eq(cteNotas.id, id), eq(cteNotas.contabilidadeId, contabilidadeId)))
    .limit(1);
  return result[0];
}

export async function updateCteNotaDacteUrl(id: number, url: string, fileKey: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(cteNotas).set({ dactePdfUrl: url, dactePdfKey: fileKey, updatedAt: new Date() }).where(eq(cteNotas.id, id));
}


// ═══ APAGAR TODOS OS CT-e DE UMA CONTABILIDADE ═══
export async function deleteAllCteByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return { cteNotas: 0, cteDownloadLogs: 0, cteNsuControl: 0 };

  const tabelas = [
    { nome: 'cte_notas', sql: sql`DELETE FROM cte_notas WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'cte_download_logs', sql: sql`DELETE FROM cte_download_logs WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'cte_nsu_control', sql: sql`DELETE FROM cte_nsu_control WHERE contabilidadeId = ${contabilidadeId}` },
  ];

  const results: Record<string, number> = {};
  for (const tabela of tabelas) {
    try {
      const [result] = await (db as any).execute(tabela.sql);
      results[tabela.nome] = result?.affectedRows ?? 0;
      console.log(`[DeleteAllCte] ${tabela.nome}: ${results[tabela.nome]} registro(s) apagado(s)`);
    } catch (err: any) {
      console.error(`[DeleteAllCte] ERRO ao apagar ${tabela.nome}:`, err.message);
      results[tabela.nome] = 0;
    }
  }

  return {
    cteNotas: results['cte_notas'] ?? 0,
    cteDownloadLogs: results['cte_download_logs'] ?? 0,
    cteNsuControl: results['cte_nsu_control'] ?? 0,
  };
}

// ═══ APAGAR TODOS OS NFe DE UMA CONTABILIDADE ═══
export async function deleteAllNfeByContabilidade(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return { notas: 0, downloadLogs: 0 };

  const tabelas = [
    { nome: 'notas', sql: sql`DELETE FROM notas WHERE contabilidadeId = ${contabilidadeId}` },
    { nome: 'download_logs', sql: sql`DELETE FROM download_logs WHERE contabilidadeId = ${contabilidadeId}` },
  ];

  const results: Record<string, number> = {};
  for (const tabela of tabelas) {
    try {
      const [result] = await (db as any).execute(tabela.sql);
      results[tabela.nome] = result?.affectedRows ?? 0;
      console.log(`[DeleteAllNfe] ${tabela.nome}: ${results[tabela.nome]} registro(s) apagado(s)`);
    } catch (err: any) {
      console.error(`[DeleteAllNfe] ERRO ao apagar ${tabela.nome}:`, err.message);
      results[tabela.nome] = 0;
    }
  }

  return {
    notas: results['notas'] ?? 0,
    downloadLogs: results['download_logs'] ?? 0,
  };
}


// ═══ AUDITORIA: Retenção e limpeza ═══

export async function getAuditRetencaoDias(contabilidadeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 90;
  const [contab] = await db.select({ auditRetencaoDias: contabilidades.auditRetencaoDias })
    .from(contabilidades).where(eq(contabilidades.id, contabilidadeId)).limit(1);
  return contab?.auditRetencaoDias ?? 90;
}

export async function updateAuditRetencaoDias(contabilidadeId: number, dias: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contabilidades)
    .set({ auditRetencaoDias: dias })
    .where(eq(contabilidades.id, contabilidadeId));
}

export async function cleanupOldAuditLogs(contabilidadeId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const dias = await getAuditRetencaoDias(contabilidadeId);
  const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const [result]: any = await db.delete(auditLogs)
    .where(and(
      eq(auditLogs.contabilidadeId, contabilidadeId),
      lt(auditLogs.createdAt, cutoff)
    ));
  return result?.affectedRows ?? 0;
}


// Repopular chavesNfe dos XMLs existentes
export async function repopularChavesNfeCte(contabilidadeId: number) {
  const db = await getDb();
  if (!db) return { updated: 0, total: 0 };

  // Buscar todos os CT-e que têm xmlOriginal mas não têm chavesNfe
  const notas = await db.select({
    id: cteNotas.id,
    xmlOriginal: cteNotas.xmlOriginal,
  })
  .from(cteNotas)
  .where(and(
    eq(cteNotas.contabilidadeId, contabilidadeId),
    not(isNull(cteNotas.xmlOriginal)),
    isNull(cteNotas.chavesNfe),
  ));

  let updated = 0;
  for (const nota of notas) {
    if (!nota.xmlOriginal) continue;
    try {
      // Decodificar base64 para XML
      const xmlBuffer = Buffer.from(nota.xmlOriginal, "base64");
      const xml = xmlBuffer.toString("utf-8");

      // Extrair chaves NF-e
      const chavesNfeArr: string[] = [];
      const chaveRegex = /<chave>([^<]+)<\/chave>/gi;
      let match;
      while ((match = chaveRegex.exec(xml)) !== null) {
        chavesNfeArr.push(match[1].trim());
      }

      if (chavesNfeArr.length > 0) {
        await db.update(cteNotas)
          .set({ chavesNfe: JSON.stringify(chavesNfeArr) })
          .where(eq(cteNotas.id, nota.id));
        updated++;
      }
    } catch (e) {
      // Ignorar erros de parsing
    }
  }

  return { updated, total: notas.length };
}


// Buscar notas NFe por múltiplas chaves de acesso (para verificar se NF-e vinculada ao CT-e já foi baixada)
export async function getNotasByChavesAcesso(chaves: string[]) {
  const db = await getDb();
  if (!db || chaves.length === 0) return [];
  const BATCH = 100;
  const result: Array<{
    id: number;
    chaveAcesso: string;
    numeroNota: string | null;
    emitenteNome: string | null;
    emitenteCnpj: string | null;
    tomadorNome: string | null;
    tomadorCnpj: string | null;
    valorServico: string | null;
    dataEmissao: Date | null;
    status: string;
    direcao: string;
    danfsePdfUrl: string | null;
  }> = [];
  for (let i = 0; i < chaves.length; i += BATCH) {
    const batch = chaves.slice(i, i + BATCH);
    const rows = await db.select({
      id: notas.id,
      chaveAcesso: notas.chaveAcesso,
      numeroNota: notas.numeroNota,
      emitenteNome: notas.emitenteNome,
      emitenteCnpj: notas.emitenteCnpj,
      tomadorNome: notas.tomadorNome,
      tomadorCnpj: notas.tomadorCnpj,
      valorServico: notas.valorServico,
      dataEmissao: notas.dataEmissao,
      status: notas.status,
      direcao: notas.direcao,
      danfsePdfUrl: notas.danfsePdfUrl,
    }).from(notas).where(inArray(notas.chaveAcesso, batch));
    result.push(...rows);
  }
  return result;
}
