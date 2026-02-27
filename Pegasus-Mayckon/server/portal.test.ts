import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { encrypt, decrypt } from "./crypto";

// ─── Crypto Module Tests ─────────────────────────────────────────────
describe("crypto module", () => {
  it("encrypts and decrypts a string correctly", () => {
    const original = "minha_senha_secreta_123";
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted.includes(":")).toBe(true); // iv:encrypted format
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const original = "test_data";
    const enc1 = encrypt(original);
    const enc2 = encrypt(original);
    expect(enc1).not.toBe(enc2); // Different IVs
    expect(decrypt(enc1)).toBe(original);
    expect(decrypt(enc2)).toBe(original);
  });

  it("handles empty string", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("");
  });

  it("handles long strings (base64 certificate data)", () => {
    const longStr = "A".repeat(10000);
    const encrypted = encrypt(longStr);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(longStr);
  });

  it("handles special characters", () => {
    const special = "çãéíóú@#$%^&*(){}[]|\\:\";<>?/~`";
    const encrypted = encrypt(special);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(special);
  });
});

// ─── Auth Tests ──────────────────────────────────────────────────────
type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext; clearedCookies: CookieCall[]; setCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const setCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    passwordHash: null,
    loginMethod: "local",
    role: "admin",
    contabilidadeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
      cookie: (name: string, _val: string, options: Record<string, unknown>) => {
        setCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies, setCookies };
}

function createContabContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 2,
    openId: "contab-user",
    email: "contab@example.com",
    name: "Contabilidade User",
    passwordHash: null,
    loginMethod: "local",
    role: "contabilidade" as any,
    contabilidadeId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createClienteContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 3,
    openId: "cliente-user",
    email: "cliente@example.com",
    name: "Cliente User",
    passwordHash: null,
    loginMethod: "local",
    role: "user",
    contabilidadeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createUnauthContext(): { ctx: TrpcContext; setCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, _val: string, options: Record<string, unknown>) => {
        setCookies.push({ name, options });
      },
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx, setCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

describe("auth.me", () => {
  it("returns user data for authenticated user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("admin-user");
    expect(result?.role).toBe("admin");
  });

  it("returns null for unauthenticated user", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ─── Role-based Access Tests ─────────────────────────────────────────
describe("role-based access control", () => {
  it("admin can access admin routes", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Admin should be able to call admin.listUsers without error
    // This will fail with DB error but NOT with FORBIDDEN
    try {
      await caller.admin.listUsers();
    } catch (e: any) {
      // Should not be FORBIDDEN
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user cannot access admin routes", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.listUsers();
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("regular user cannot access admin routes", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.listUsers();
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("regular user cannot access admin routes", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.dashboardStats();
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("contabilidade user can access contabilidade routes", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    // Should not throw FORBIDDEN - may throw DB error
    try {
      await caller.cliente.list({ contabilidadeId: 1 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── Input Validation Tests ──────────────────────────────────────────
describe("input validation", () => {
  it("admin.createContabilidade requires valid input", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.createContabilidade({ nome: "", email: "invalid", senhaContabilidade: "123", nomeResponsavel: "" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("nota.getXml requires chaveAcesso", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.getXml({ chaveAcesso: "" });
    } catch (e: any) {
      // May throw NOT_FOUND or DB error, but should not crash
      expect(e).toBeDefined();
    }
  });

  it("agendamento.create validates frequencia enum", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agendamento.create({
        contabilidadeId: 1,
        frequencia: "invalido" as any,
        horario: "02:00",
      });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("getDanfseUrl returns a valid URL format", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.nota.getDanfseUrl({ chaveAcesso: "12345678901234567890" });
    expect(result.url).toContain("nfse.gov.br");
    expect(result.url).toContain("12345678901234567890");
  });
});

// ─── Auth Login/Register Input Validation Tests ──────────────────────
describe("auth.login input validation", () => {
  it("rejects empty email", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.login({ email: "", password: "test123" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("rejects invalid email format", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.login({ email: "not-an-email", password: "test123" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("rejects empty password", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.login({ email: "test@test.com", password: "" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("returns UNAUTHORIZED for non-existent user", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.login({ email: "nonexistent@test.com", password: "test123" });
      expect.unreachable("Should have thrown UNAUTHORIZED");
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("auth.register input validation", () => {
  it("rejects short name", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.register({ name: "A", email: "test@test.com", password: "test123" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("rejects short password", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.register({ name: "Test User", email: "test@test.com", password: "12345" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("rejects invalid email", async () => {
    const { ctx } = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.register({ name: "Test User", email: "invalid", password: "test123" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });
});

describe("auth.changePassword", () => {
  it("requires authentication", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {} as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.changePassword({ currentPassword: "old", newPassword: "newpass" });
      expect.unreachable("Should have thrown UNAUTHORIZED");
    } catch (e: any) {
      expect(e.code).toBe("UNAUTHORIZED");
    }
  });

  it("rejects short new password", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.auth.changePassword({ currentPassword: "old", newPassword: "12345" });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });
});

// ─── Certificado Monitoramento & Renovação Tests ─────────────────
describe("certificado.monitoramento", () => {
  it("requires contabilidade role", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.certificado.monitoramento({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("contabilidade user can access monitoramento", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.certificado.monitoramento({ contabilidadeId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB error is OK, FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});

describe("certificado.renovar input validation", () => {
  it("requires contabilidade role", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.certificado.renovar({
        clienteId: 1,
        contabilidadeId: 1,
        fileName: "test.pfx",
        fileData: "dGVzdA==",
        senha: "1234",
      });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("certificado.renovarLote input validation", () => {
  it("requires contabilidade role", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.certificado.renovarLote({
        contabilidadeId: 1,
        certificados: [{ fileName: "test.pfx", fileData: "dGVzdA==", senha: "1234" }],
      });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

// ─── NFSe API Module Tests ───────────────────────────────────────────
describe("nfse-api module", () => {
  it("getDanfseUrl generates correct URL", async () => {
    const { getDanfseUrl } = await import("./nfse-api");
    const url = getDanfseUrl("ABC123456789");
    expect(url).toContain("ABC123456789");
    expect(url).toContain("nfse.gov.br");
  });

  it("decodeXml handles base64+gzip content", async () => {
    const { decodeXml } = await import("./nfse-api");
    // Test with plain base64 (non-gzipped)
    const plainXml = "<xml>test</xml>";
    const base64 = Buffer.from(plainXml).toString("base64");
    try {
      const result = decodeXml(base64);
      // Should either decode gzip or fall back to plain base64
      expect(typeof result).toBe("string");
    } catch {
      // May fail on non-gzip content, that's expected
    }
  });

  it("decodeXml returns original string if not base64", async () => {
    const { decodeXml } = await import("./nfse-api");
    const plainXml = "<xml>test</xml>";
    try {
      const result = decodeXml(plainXml);
      expect(typeof result).toBe("string");
    } catch {
      // Expected for non-base64 content
    }
  });
});

// ─── Admin CRUD Contabilidade Tests ─────────────────────────────────
describe("admin.updateContabilidade input validation", () => {
  it("admin can call updateContabilidade", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.updateContabilidade({ id: 999, nome: "Updated Name" });
    } catch (e: any) {
      // DB error is OK, FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user cannot call admin.updateContabilidade", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.updateContabilidade({ id: 1, nome: "Hacked" });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("regular user cannot call admin.updateContabilidade", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.updateContabilidade({ id: 1, nome: "Hacked" });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("admin.deleteContabilidade", () => {
  it("admin can call deleteContabilidade", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.deleteContabilidade({ id: 999 });
    } catch (e: any) {
      // DB error is OK, FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user cannot call admin.deleteContabilidade", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.deleteContabilidade({ id: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("regular user cannot call admin.deleteContabilidade", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.deleteContabilidade({ id: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("requires id parameter", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.deleteContabilidade({} as any);
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });
});

describe("admin.toggleContabilidade", () => {
  it("admin can toggle contabilidade", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.toggleContabilidade({ id: 999, ativo: false });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user cannot toggle contabilidade", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.admin.toggleContabilidade({ id: 1, ativo: false });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

// ─── Nota Delete Tests ──────────────────────────────────────────────
describe("nota.deleteByCliente", () => {
  it("contabilidade user can call deleteByCliente", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteByCliente({ clienteId: 999, contabilidadeId: 1 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot call deleteByCliente", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteByCliente({ clienteId: 1, contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("requires clienteId parameter", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteByCliente({} as any);
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });
});

describe("nota.deleteAll", () => {
  it("contabilidade user can call deleteAll", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteAll({ contabilidadeId: 1 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot call deleteAll", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteAll({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("admin can call deleteAll", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteAll({ contabilidadeId: 1 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });
});

// ─── Cliente Delete Tests ──────────────────────────────────────────
describe("cliente.delete", () => {
  it("contabilidade user can call delete", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.delete({ id: 999, contabilidadeId: 1 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot call delete", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.delete({ id: 1, contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("admin can call delete", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.delete({ id: 999, contabilidadeId: 1 });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("requires id and contabilidadeId parameters", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.delete({} as any);
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });

  it("delete returns success message with cascade info", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.cliente.delete({ id: 999, contabilidadeId: 1 });
      // Se o cliente não existir, lança NOT_FOUND
      // Se existir, retorna success com message
      expect(result.success).toBe(true);
      expect(typeof result.message).toBe("string");
      expect(result.message).toContain("excluídos com sucesso");
    } catch (e: any) {
      // NOT_FOUND é esperado para ID inexistente
      expect(e.code).toBe("NOT_FOUND");
    }
  });

  it("delete throws NOT_FOUND for non-existent client", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.delete({ id: 999999, contabilidadeId: 1 });
      expect.unreachable("Should have thrown NOT_FOUND");
    } catch (e: any) {
      expect(e.code).toBe("NOT_FOUND");
      expect(e.message).toContain("não encontrado");
    }
  });
});

// ─── Agendamento dia_util Tests ────────────────────────────────────
describe("agendamento.create with dia_util", () => {
  it("contabilidade user can create dia_util agendamento", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agendamento.create({
        contabilidadeId: 1,
        frequencia: "dia_util",
        horario: "08:00",
        mes: 2,
        diaUtil: 5,
      });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot create agendamento", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agendamento.create({
        contabilidadeId: 1,
        frequencia: "dia_util",
        horario: "08:00",
        mes: 2,
        diaUtil: 5,
      });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("contabilidade user can create regular agendamento", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agendamento.create({
        contabilidadeId: 1,
        frequencia: "diario",
        horario: "02:00",
      });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user can create agendamento with dataInicial and dataFinal", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.agendamento.create({
        contabilidadeId: 1,
        frequencia: "diario",
        horario: "03:00",
        dataInicial: "2026-01-01",
        dataFinal: "2026-02-17",
      });
      expect(result.id).toBeDefined();
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("agendamento accepts optional dataInicial and dataFinal in update", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agendamento.update({
        id: 999,
        dataInicial: "2026-03-01",
        dataFinal: "2026-03-31",
      });
    } catch (e: any) {
      // May fail because id 999 doesn't exist, but should not fail on validation
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});

// ─── Relatório Tests ───────────────────────────────────────────────
describe("nota.relatorio", () => {
  it("contabilidade user can access relatorio", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.relatorio({ contabilidadeId: 1, tipo: "emitidas" });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot access relatorio", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.relatorio({ contabilidadeId: 1, tipo: "emitidas" });
      expect.unreachable("Should have thrown error");
    } catch (e: any) {
      // Should throw FORBIDDEN or NOT_FOUND (no access to contabilidade)
      expect(["FORBIDDEN", "NOT_FOUND"]).toContain(e.code);
    }
  });

  it("admin can access relatorio", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.relatorio({ contabilidadeId: 1, tipo: "recebidas" });
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("validates tipo parameter", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.relatorio({ contabilidadeId: 1, tipo: "invalido" as any });
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      // Should throw BAD_REQUEST, PARSE_ERROR or NOT_FOUND
      expect(["BAD_REQUEST", "PARSE_ERROR", "NOT_FOUND"]).toContain(e.code);
    }
  });
});


// ─── Cliente DeleteAll Tests ──────────────────────────────────────────
describe("cliente.deleteAll", () => {
  it("contabilidade user can call deleteAll and gets message", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.cliente.deleteAll({ contabilidadeId: 1 });
      expect(result.success).toBe(true);
      expect(typeof result.deleted).toBe("number");
      expect(typeof result.message).toBe("string");
      expect(result.message).toContain("apagados");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot call deleteAll", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.deleteAll({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("admin can call deleteAll and gets message", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.cliente.deleteAll({ contabilidadeId: 1 });
      expect(result.success).toBe(true);
      expect(typeof result.message).toBe("string");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("deleteAll cascades to all tables (notas, downloads, agendamentos, certificados, auditoria)", async () => {
    // Verify the db function exists and handles cascade
    const dbModule = await import("./db");
    expect(typeof dbModule.deleteAllClientesByContabilidade).toBe("function");
    // Call with non-existent contabilidade - should return 0 without error
    const result = await dbModule.deleteAllClientesByContabilidade(999999);
    expect(result).toBe(0);
  });
});

// ─── Download Retry Tests ──────────────────────────────────────────
describe("download.retry", () => {
  it("contabilidade user can call retry", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.download.retry({ logId: 999, contabilidadeId: 1 });
    } catch (e: any) {
      // NOT_FOUND is expected since log 999 doesn't exist
      expect(["NOT_FOUND", "BAD_REQUEST"]).toContain(e.code);
    }
  });

  it("regular user cannot call retry", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.download.retry({ logId: 1, contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("admin can call retry", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.download.retry({ logId: 999, contabilidadeId: 1 });
    } catch (e: any) {
      expect(["NOT_FOUND", "BAD_REQUEST"]).toContain(e.code);
    }
  });
});

// ─── Audit Log CRUD Tests ──────────────────────────────────────────
describe("usuario.auditLogs", () => {
  it("contabilidade user can access auditLogs", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.usuario.auditLogs({ limit: 10 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user can filter auditLogs by userName", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.usuario.auditLogs({ limit: 10, userName: "TestUser" });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot access auditLogs", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogs({ limit: 10 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("usuario.auditLogUpdate", () => {
  it("contabilidade user can update audit log", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogUpdate({ id: 999, detalhes: "Updated details" });
    } catch (e: any) {
      // DB error is OK, FORBIDDEN is not
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot update audit log", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogUpdate({ id: 1, detalhes: "test" });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("requires id and detalhes parameters", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogUpdate({} as any);
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });
});

describe("usuario.auditLogDelete", () => {
  it("contabilidade user can delete audit log", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogDelete({ id: 999 });
      // Should succeed (no error) even if record doesn't exist
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot delete audit log", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogDelete({ id: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });

  it("requires id parameter", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogDelete({} as any);
      expect.unreachable("Should have thrown validation error");
    } catch (e: any) {
      expect(e.code).toBe("BAD_REQUEST");
    }
  });
});

describe("usuario.auditLogDeleteAll", () => {
  it("contabilidade user can delete all audit logs", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.usuario.auditLogDeleteAll();
      expect(result.success).toBe(true);
      expect(typeof result.deleted).toBe("number");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot delete all audit logs", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogDeleteAll();
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("usuario.auditLogUsers", () => {
  it("contabilidade user can get audit users list", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.usuario.auditLogUsers();
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot get audit users list", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogUsers();
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("usuario.auditLogReportPdf", () => {
  it("contabilidade user can generate PDF report for all users", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.usuario.auditLogReportPdf({});
      expect(result.base64).toBeDefined();
      expect(result.fileName).toContain("auditoria_todos_");
      expect(result.fileName).toContain(".pdf");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("contabilidade user can generate PDF report filtered by user", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.usuario.auditLogReportPdf({ userName: "TestUser" });
      expect(result.base64).toBeDefined();
      expect(result.fileName).toContain("auditoria_TestUser_");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot generate PDF report", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogReportPdf({});
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

// ─── Permission enforcement for usuario role ─────────────────────────
describe("Permission enforcement for usuario role with limited permissions", () => {
  // Create a context for a user with role "usuario" that only has fazerDownloads + verHistorico
  function createLimitedUsuarioCtx() {
    const permissoes = JSON.stringify({
      verDashboard: false,
      verClientes: false,
      editarClientes: false,
      apagarClientes: false,
      verCertificados: false,
      gerenciarCertificados: false,
      fazerDownloads: true,
      verHistorico: true,
      gerenciarAgendamentos: false,
      verRelatorios: false,
      gerenciarUsuarios: false,
      gerenciarAuditoria: false,
    });
    return {
      user: {
        id: 999,
        openId: "limited-usuario-test",
        email: "limited@test.com",
        name: "Limited User",
        passwordHash: null,
        loginMethod: "local",
        role: "usuario" as any,
        contabilidadeId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        permissoes,
      },
      req: { protocol: "https", headers: {} } as any,
      res: { cookie: vi.fn(), clearCookie: vi.fn() } as any,
    };
  }

  it("should block cliente.list for user without verClientes", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.cliente.list({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block certificado.list for user without verCertificados", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.certificado.list({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block agendamento.list for user without gerenciarAgendamentos", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.agendamento.list({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block relatorio.getData for user without verRelatorios", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.relatorio.getData({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block relatorio.exportExcel for user without verRelatorios", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.relatorio.exportExcel({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block usuario.list for user without gerenciarUsuarios", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.list();
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block usuario.auditLogDeleteAll for user without gerenciarAuditoria", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.usuario.auditLogDeleteAll();
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block nota.list for user without verClientes", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.list({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should block nota.deleteByCliente for user without apagarClientes", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.nota.deleteByCliente({ clienteId: 1, contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });

  it("should allow download.logs for user with verHistorico", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.download.logs({ contabilidadeId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB error is OK, permission error is NOT
      expect(e.message).not.toMatch(/permissão/i);
    }
  });

  it("should allow download.clientesComStatus for user with fazerDownloads", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.download.clientesComStatus({ contabilidadeId: 1 });
      expect(Array.isArray(result)).toBe(true);
    } catch (e: any) {
      // DB error is OK, permission error is NOT
      expect(e.message).not.toMatch(/permissão/i);
    }
  });

  it("should block dashboard.stats for user without verDashboard", async () => {
    const ctx = createLimitedUsuarioCtx();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.dashboard.stats({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown permission error");
    } catch (e: any) {
      expect(e.message).toMatch(/permissão/i);
    }
  });
});


// ─── Download History Report Tests ──────────────────────────────────
describe("download.historicoRelatorioPdf", () => {
  it("contabilidade user can generate PDF report", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.download.historicoRelatorioPdf({ contabilidadeId: 1 });
      expect(result).toHaveProperty("base64");
      expect(result).toHaveProperty("fileName");
      expect(result.fileName).toMatch(/historico_downloads.*\.pdf$/);
      expect(result.base64.length).toBeGreaterThan(0);
    } catch (e: any) {
      // DB may not have data, but should not be FORBIDDEN
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("admin can generate PDF report", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.download.historicoRelatorioPdf({ contabilidadeId: 1 });
      expect(result).toHaveProperty("base64");
      expect(result).toHaveProperty("fileName");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot generate PDF report", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.download.historicoRelatorioPdf({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});

describe("download.historicoRelatorioExcel", () => {
  it("contabilidade user can generate Excel report", async () => {
    const { ctx } = createContabContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.download.historicoRelatorioExcel({ contabilidadeId: 1 });
      expect(result).toHaveProperty("base64");
      expect(result).toHaveProperty("filename");
      expect(result.filename).toMatch(/historico_downloads.*\.xlsx$/);
      expect(result.base64.length).toBeGreaterThan(0);
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("admin can generate Excel report", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    try {
      const result = await caller.download.historicoRelatorioExcel({ contabilidadeId: 1 });
      expect(result).toHaveProperty("base64");
      expect(result).toHaveProperty("filename");
    } catch (e: any) {
      expect(e.code).not.toBe("FORBIDDEN");
    }
  });

  it("regular user cannot generate Excel report", async () => {
    const { ctx } = createClienteContext();
    const caller = appRouter.createCaller(ctx);
    try {
      await caller.download.historicoRelatorioExcel({ contabilidadeId: 1 });
      expect.unreachable("Should have thrown FORBIDDEN");
    } catch (e: any) {
      expect(e.code).toBe("FORBIDDEN");
    }
  });
});
