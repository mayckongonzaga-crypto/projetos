import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, decimal, boolean, json } from "drizzle-orm/mysql-core";

// ─── Planos ─────────────────────────────────────────────────────────
export const planos = mysqlTable("planos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  maxClientes: int("maxClientes").default(10).notNull(),
  maxCertificados: int("maxCertificados").default(10).notNull(),
  maxDownloadsDia: int("maxDownloadsDia").default(100).notNull(),
  permiteAgendamento: boolean("permiteAgendamento").default(true).notNull(),
  preco: decimal("preco", { precision: 10, scale: 2 }).default("0.00"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plano = typeof planos.$inferSelect;
export type InsertPlano = typeof planos.$inferInsert;

// ─── Users (auth base) ───────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "contabilidade", "usuario", "cliente"]).default("cliente").notNull(),
  contabilidadeId: int("contabilidadeId"),
  // Permissões granulares (JSON) - usado para role='usuario'
  permissoes: text("permissoes"), // JSON: {verClientes, editarClientes, apagarClientes, verCertificados, gerenciarCertificados, fazerDownloads, verHistorico, gerenciarAgendamentos, verRelatorios, gerenciarUsuarios}
  criadoPor: int("criadoPor"), // ID do usuário que criou este usuário
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Contabilidades (tenants) ────────────────────────────────────────
export const contabilidades = mysqlTable("contabilidades", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }),
  endereco: text("endereco"),
  ownerId: int("ownerId").notNull(),
  planoId: int("planoId"),
  ativo: boolean("ativo").default(true).notNull(),
  bloqueadoMotivo: text("bloqueadoMotivo"),
  dataExpiracao: timestamp("dataExpiracao"),
  retencaoMeses: int("retencaoMeses").default(12).notNull(),
  auditRetencaoDias: int("auditRetencaoDias").default(90).notNull(),
  cteHabilitado: boolean("cteHabilitado").default(false).notNull(),
  cteBaixarPdf: boolean("cteBaixarPdf").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contabilidade = typeof contabilidades.$inferSelect;
export type InsertContabilidade = typeof contabilidades.$inferInsert;

// ─── Clientes (empresas de cada contabilidade) ──────────────────────
export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  contabilidadeId: int("contabilidadeId").notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  razaoSocial: varchar("razaoSocial", { length: 255 }).notNull(),
  nomeFantasia: varchar("nomeFantasia", { length: 255 }),
  // Contatos
  contatoPrincipal: varchar("contatoPrincipal", { length: 255 }),
  contatoSecundario: varchar("contatoSecundario", { length: 255 }),
  email: varchar("email", { length: 320 }),
  emailSecundario: varchar("emailSecundario", { length: 320 }),
  telefone: varchar("telefone", { length: 20 }),
  telefone2: varchar("telefone2", { length: 20 }),
  // Endereço
  logradouro: varchar("logradouro", { length: 255 }),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 255 }),
  bairro: varchar("bairro", { length: 100 }),
  cidade: varchar("cidade", { length: 100 }),
  uf: varchar("uf", { length: 2 }),
  cep: varchar("cep", { length: 10 }),
  endereco: text("endereco"), // legado, campo completo
  // Dados da empresa (Receita Federal)
  tipoCliente: varchar("tipoCliente", { length: 50 }), // ex: MEI, ME, EPP, Demais
  regimeTributario: varchar("regimeTributario", { length: 100 }), // Simples Nacional, Lucro Presumido, etc.
  naturezaJuridica: varchar("naturezaJuridica", { length: 255 }),
  capitalSocial: varchar("capitalSocial", { length: 50 }),
  porte: varchar("porte", { length: 50 }),
  dataAbertura: varchar("dataAbertura", { length: 20 }),
  situacaoCadastral: varchar("situacaoCadastral", { length: 50 }),
  // Sócios (JSON array)
  socios: text("socios"), // JSON: [{nome, qualificacao, dataEntrada}]
  // CNAEs
  cnaePrincipal: varchar("cnaePrincipal", { length: 20 }),
  cnaePrincipalDescricao: varchar("cnaePrincipalDescricao", { length: 500 }),
  cnaesSecundarios: text("cnaesSecundarios"), // JSON: [{codigo, descricao}]
  // Opções fiscais
  optanteSimples: boolean("optanteSimples"),
  optanteMEI: boolean("optanteMEI"),
  // Controle
  dadosReceitaAtualizadosEm: timestamp("dadosReceitaAtualizadosEm"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

// ─── Certificados Digitais ──────────────────────────────────────────
export const certificados = mysqlTable("certificados", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  contabilidadeId: int("contabilidadeId").notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  razaoSocial: varchar("razaoSocial", { length: 255 }),
  certData: text("certData").notNull(),
  certSenha: text("certSenha").notNull(),
  serialNumber: varchar("serialNumber", { length: 128 }),
  issuer: varchar("issuer", { length: 255 }),
  validFrom: timestamp("validFrom"),
  validTo: timestamp("validTo"),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Certificado = typeof certificados.$inferSelect;
export type InsertCertificado = typeof certificados.$inferInsert;

// ─── Notas Fiscais (NFSe) ──────────────────────────────────────────
export const notas = mysqlTable("notas", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  contabilidadeId: int("contabilidadeId").notNull(),
  chaveAcesso: varchar("chaveAcesso", { length: 60 }).notNull().unique(),
  nsu: bigint("nsu", { mode: "number" }),
  numeroNota: varchar("numeroNota", { length: 20 }),
  serie: varchar("serie", { length: 10 }),
  tipoDocumento: mysqlEnum("tipoDocumento", ["NFSE", "EVENTO"]).notNull(),
  tipoEvento: varchar("tipoEvento", { length: 50 }),
  direcao: mysqlEnum("direcao", ["emitida", "recebida"]).default("emitida").notNull(),
  status: mysqlEnum("status", ["valida", "cancelada", "substituida"]).default("valida").notNull(),
  emitenteCnpj: varchar("emitenteCnpj", { length: 18 }),
  emitenteNome: varchar("emitenteNome", { length: 255 }),
  tomadorCnpj: varchar("tomadorCnpj", { length: 18 }),
  tomadorNome: varchar("tomadorNome", { length: 255 }),
  valorServico: decimal("valorServico", { precision: 15, scale: 2 }),
  valorLiquido: decimal("valorLiquido", { precision: 15, scale: 2 }),
  valorRetencao: decimal("valorRetencao", { precision: 15, scale: 2 }),
  codigoServico: varchar("codigoServico", { length: 20 }),
  descricaoServico: text("descricaoServico"),
  dataEmissao: timestamp("dataEmissao"),
  dataCompetencia: timestamp("dataCompetencia"),
  municipioPrestacao: varchar("municipioPrestacao", { length: 100 }),
  ufPrestacao: varchar("ufPrestacao", { length: 2 }),
  xmlOriginal: text("xmlOriginal"),
  danfsePdfUrl: varchar("danfsePdfUrl", { length: 512 }),
  danfsePdfKey: varchar("danfsePdfKey", { length: 255 }),
  dataDownload: timestamp("dataDownload").defaultNow(),
  // --- Campos IBS/CBS (Reforma Tributaria 2026) ---
  cstIbsCbs: varchar("cstIbsCbs", { length: 5 }),
  cIndOp: varchar("cIndOp", { length: 10 }),
  finNFSe: varchar("finNFSe", { length: 5 }),
  vBcIbsCbs: decimal("vBcIbsCbs", { precision: 15, scale: 2 }),
  aliqIbsUf: decimal("aliqIbsUf", { precision: 7, scale: 4 }),
  aliqIbsMun: decimal("aliqIbsMun", { precision: 7, scale: 4 }),
  aliqCbs: decimal("aliqCbs", { precision: 7, scale: 4 }),
  vIbsUf: decimal("vIbsUf", { precision: 15, scale: 2 }),
  vIbsMun: decimal("vIbsMun", { precision: 15, scale: 2 }),
  vCbs: decimal("vCbs", { precision: 15, scale: 2 }),
  vTotTribIbsCbs: decimal("vTotTribIbsCbs", { precision: 15, scale: 2 }),
  indZfmalc: int("indZfmalc"),
  vPis: decimal("vPis", { precision: 15, scale: 2 }),
  vCofins: decimal("vCofins", { precision: 15, scale: 2 }),
  cstPisCofins: varchar("cstPisCofins", { length: 5 }),
  pDifUf: decimal("pDifUf", { precision: 7, scale: 4 }),
  pDifMun: decimal("pDifMun", { precision: 7, scale: 4 }),
  pDifCbs: decimal("pDifCbs", { precision: 7, scale: 4 }),
  temIbsCbs: boolean("temIbsCbs").default(false),
  // --- Fim campos IBS/CBS ---
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Nota = typeof notas.$inferSelect;
export type InsertNota = typeof notas.$inferInsert;

// ─── Histórico de Downloads ─────────────────────────────────────────
export const downloadLogs = mysqlTable("download_logs", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  contabilidadeId: int("contabilidadeId").notNull(),
  clienteNome: varchar("clienteNome", { length: 255 }),
  clienteCnpj: varchar("clienteCnpj", { length: 18 }),
  tipo: mysqlEnum("tipo", ["manual", "agendado"]).default("manual").notNull(),
  status: mysqlEnum("status", ["pendente", "executando", "concluido", "erro", "cancelado", "retomando"]).default("pendente").notNull(),
  totalNotas: int("totalNotas").default(0),
  notasNovas: int("notasNovas").default(0),
  progresso: int("progresso").default(0),
  totalEsperado: int("totalEsperado").default(0),
  ultimoNsu: bigint("ultimoNsu", { mode: "number" }).default(0),
  certificadoVencido: boolean("certificadoVencido").default(false),
  totalXml: int("totalXml").default(0),
  totalPdf: int("totalPdf").default(0),
  errosPdf: int("errosPdf").default(0),
  tentativas: int("tentativas").default(0),
  etapa: varchar("etapa", { length: 255 }),
  erro: text("erro"),
  // Período do download (para retomadas respeitarem o filtro original)
  modo: varchar("modo", { length: 20 }), // "novas" | "periodo"
  competenciaInicio: varchar("competenciaInicio", { length: 7 }), // YYYY-MM
  competenciaFim: varchar("competenciaFim", { length: 7 }),       // YYYY-MM
  periodoDataInicio: varchar("periodoDataInicio", { length: 10 }), // YYYY-MM-DD
  periodoDataFim: varchar("periodoDataFim", { length: 10 }),       // YYYY-MM-DD
  iniciadoEm: timestamp("iniciadoEm").defaultNow(),
  finalizadoEm: timestamp("finalizadoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DownloadLog = typeof downloadLogs.$inferSelect;
export type InsertDownloadLog = typeof downloadLogs.$inferInsert;

// ─── Agendamentos de Download ───────────────────────────────────────
export const agendamentos = mysqlTable("agendamentos", {
  id: int("id").autoincrement().primaryKey(),
  contabilidadeId: int("contabilidadeId").notNull(),
  clienteId: int("clienteId"),
  frequencia: mysqlEnum("frequencia", ["diario", "semanal", "mensal", "dia_util"]).default("diario").notNull(),
  horario: varchar("horario", { length: 5 }).default("02:00").notNull(),
  diaSemana: int("diaSemana"),
  diaMes: int("diaMes"),
  diaUtil: int("diaUtil"), // Nth business day of the month (1=1st business day, 2=2nd, etc.)
  mesAlvo: int("mesAlvo"), // Target month (1-12), null = every month
  dataInicial: varchar("dataInicial", { length: 10 }), // Formato YYYY-MM-DD - data inicial do período de notas
  dataFinal: varchar("dataFinal", { length: 10 }), // Formato YYYY-MM-DD - data final do período de notas
  periodoTipo: varchar("periodoTipo", { length: 20 }).default("fixo"), // "fixo" = datas fixas, "relativo" = últimos X dias
  periodoDias: int("periodoDias"), // Número de dias para trás (usado quando periodoTipo = "relativo")
  tipoDocumento: mysqlEnum("tipoDocumento", ["nfe", "cte", "ambos"]).default("nfe").notNull(), // Tipo de documento a baixar
  ativo: boolean("ativo").default(true).notNull(),
  ultimaExecucao: timestamp("ultimaExecucao"),
  proximaExecucao: timestamp("proximaExecucao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Agendamento = typeof agendamentos.$inferSelect;
export type InsertAgendamento = typeof agendamentos.$inferInsert;

// ─── Configurações do Sistema ──────────────────────────────────────
export const settings = mysqlTable("settings", {
  id: int("id").autoincrement().primaryKey(),
  chave: varchar("chave", { length: 100 }).notNull().unique(),
  valor: text("valor").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = typeof settings.$inferInsert;

// ─── Log de Auditoria ──────────────────────────────────────────────
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  contabilidadeId: int("contabilidadeId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }).notNull(),
  acao: varchar("acao", { length: 100 }).notNull(), // ex: "apagar_cliente", "apagar_todos_clientes", "editar_cliente"
  entidade: varchar("entidade", { length: 100 }).notNull(), // ex: "cliente", "certificado"
  entidadeId: int("entidadeId"), // ID do registro afetado (null se ação em lote)
  detalhes: text("detalhes"), // JSON com informações adicionais (nome do cliente, CNPJ, etc.)
  ip: varchar("ip", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ─── CT-e: Notas (Conhecimento de Transporte Eletrônico) ──────────────
export const cteNotas = mysqlTable("cte_notas", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  contabilidadeId: int("contabilidadeId").notNull(),
  chaveAcesso: varchar("chaveAcesso", { length: 60 }).notNull().unique(),
  nsu: bigint("nsu", { mode: "number" }),
  numeroCte: varchar("numeroCte", { length: 20 }),
  serie: varchar("serie", { length: 10 }),
  modelo: varchar("modelo", { length: 5 }), // 57=CT-e, 67=CT-e OS
  tipoDocumento: mysqlEnum("tipoDocumento", ["CTE", "CTE_OS", "GTVE", "CTE_SIMP", "EVENTO"]).notNull(),
  tipoEvento: varchar("tipoEvento", { length: 100 }),
  direcao: mysqlEnum("direcao", ["emitido", "tomado", "terceiro"]).default("tomado").notNull(),
  status: mysqlEnum("status", ["autorizado", "cancelado", "denegado"]).default("autorizado").notNull(),
  // Emitente
  emitenteCnpj: varchar("emitenteCnpj", { length: 18 }),
  emitenteNome: varchar("emitenteNome", { length: 255 }),
  emitenteUf: varchar("emitenteUf", { length: 2 }),
  // Remetente
  remetenteCnpj: varchar("remetenteCnpj", { length: 18 }),
  remetenteNome: varchar("remetenteNome", { length: 255 }),
  // Destinatário
  destinatarioCnpj: varchar("destinatarioCnpj", { length: 18 }),
  destinatarioNome: varchar("destinatarioNome", { length: 255 }),
  // Tomador
  tomadorCnpj: varchar("tomadorCnpj", { length: 18 }),
  tomadorNome: varchar("tomadorNome", { length: 255 }),
  // Valores
  valorTotal: decimal("valorTotal", { precision: 15, scale: 2 }),
  valorReceber: decimal("valorReceber", { precision: 15, scale: 2 }),
  valorICMS: decimal("valorICMS", { precision: 15, scale: 2 }),
  // Transporte
  cfop: varchar("cfop", { length: 10 }),
  natOp: varchar("natOp", { length: 255 }),
  modal: mysqlEnum("modal", ["rodoviario", "aereo", "aquaviario", "ferroviario", "dutoviario", "multimodal"]),
  ufInicio: varchar("ufInicio", { length: 2 }),
  ufFim: varchar("ufFim", { length: 2 }),
  munInicio: varchar("munInicio", { length: 100 }),
  munFim: varchar("munFim", { length: 100 }),
  // Carga
  produtoPredominante: varchar("produtoPredominante", { length: 255 }),
  pesoBruto: decimal("pesoBruto", { precision: 15, scale: 4 }),
  valorCarga: decimal("valorCarga", { precision: 15, scale: 2 }),
  // ICMS detalhado
  cstIcms: varchar("cstIcms", { length: 10 }),
  baseCalcIcms: decimal("baseCalcIcms", { precision: 15, scale: 2 }),
  aliqIcms: decimal("aliqIcms", { precision: 5, scale: 2 }),
  // Modal rodoviário
  rntrc: varchar("rntrc", { length: 20 }),
  placa: varchar("placa", { length: 20 }),
  // Protocolo
  protocolo: varchar("protocolo", { length: 30 }),
  // Documentos referenciados
  chavesNfe: text("chavesNfe"), // JSON array de chaves NFe
  // Observações
  observacoes: text("observacoes"),
  // Remetente UF / Destinatário UF
  remetenteUf: varchar("remetenteUf", { length: 2 }),
  destinatarioUf: varchar("destinatarioUf", { length: 2 }),
  // Tomador UF
  tomadorUf: varchar("tomadorUf", { length: 2 }),
  // Datas
  dataEmissao: timestamp("dataEmissao"),
  // XML
  xmlOriginal: text("xmlOriginal"),
  dactePdfUrl: varchar("dactePdfUrl", { length: 512 }),
  dactePdfKey: varchar("dactePdfKey", { length: 255 }),
  dataDownload: timestamp("dataDownload").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CteNota = typeof cteNotas.$inferSelect;
export type InsertCteNota = typeof cteNotas.$inferInsert;

// ─── CT-e: Histórico de Downloads ─────────────────────────────────────
export const cteDownloadLogs = mysqlTable("cte_download_logs", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  contabilidadeId: int("contabilidadeId").notNull(),
  clienteNome: varchar("clienteNome", { length: 255 }),
  clienteCnpj: varchar("clienteCnpj", { length: 18 }),
  tipo: mysqlEnum("tipo", ["manual", "agendado"]).default("manual").notNull(),
  status: mysqlEnum("status", ["pendente", "executando", "concluido", "erro", "cancelado", "retomando"]).default("pendente").notNull(),
  totalCtes: int("totalCtes").default(0),
  ctesNovos: int("ctesNovos").default(0),
  progresso: int("progresso").default(0),
  totalEsperado: int("totalEsperado").default(0),
  ultimoNsu: bigint("ultimoNsu", { mode: "number" }).default(0),
  certificadoVencido: boolean("certificadoVencido").default(false),
  tentativas: int("tentativas").default(0),
  etapa: varchar("etapa", { length: 255 }),
  erro: text("erro"),
  iniciadoEm: timestamp("iniciadoEm").defaultNow(),
  finalizadoEm: timestamp("finalizadoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CteDownloadLog = typeof cteDownloadLogs.$inferSelect;
export type InsertCteDownloadLog = typeof cteDownloadLogs.$inferInsert;

// ─── CT-e: Controle de NSU por Empresa ────────────────────────────────
export const cteNsuControl = mysqlTable("cte_nsu_control", {
  id: int("id").autoincrement().primaryKey(),
  clienteId: int("clienteId").notNull(),
  contabilidadeId: int("contabilidadeId").notNull(),
  cnpj: varchar("cnpj", { length: 18 }).notNull(),
  ultimoNsu: bigint("ultimoNsu", { mode: "number" }).default(0).notNull(),
  maxNsu: bigint("maxNsu", { mode: "number" }).default(0).notNull(),
  ultimaConsulta: timestamp("ultimaConsulta"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CteNsuControl = typeof cteNsuControl.$inferSelect;
export type InsertCteNsuControl = typeof cteNsuControl.$inferInsert;
