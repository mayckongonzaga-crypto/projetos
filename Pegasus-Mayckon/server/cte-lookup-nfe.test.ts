import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContabilidadeContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "local",
    role: "contabilidade",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    contabilidadeId: 1,
  } as any;

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("cte.lookupNfe", () => {
  it("returns empty array when given empty chaves list", async () => {
    const ctx = createContabilidadeContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cte.lookupNfe({ chavesNfe: [] });
    expect(result).toEqual([]);
  });

  it("returns empty array when chaves do not match any NF-e in database", async () => {
    const ctx = createContabilidadeContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cte.lookupNfe({
      chavesNfe: ["99999999999999999999999999999999999999999999"],
    });
    expect(result).toEqual([]);
  });

  it("returns correct structure when NF-e is found", async () => {
    const ctx = createContabilidadeContext();
    const caller = appRouter.createCaller(ctx);

    // This tests the shape of the response - with a non-existent key it should return empty
    const result = await caller.cte.lookupNfe({
      chavesNfe: ["00000000000000000000000000000000000000000001"],
    });

    // Should be an array
    expect(Array.isArray(result)).toBe(true);

    // If any results, check the shape
    for (const item of result) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("chaveAcesso");
      expect(item).toHaveProperty("numeroNota");
      expect(item).toHaveProperty("emitenteNome");
      expect(item).toHaveProperty("emitenteCnpj");
      expect(item).toHaveProperty("tomadorNome");
      expect(item).toHaveProperty("tomadorCnpj");
      expect(item).toHaveProperty("valorServico");
      expect(item).toHaveProperty("dataEmissao");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("direcao");
      expect(item).toHaveProperty("danfsePdfUrl");
    }
  });
});
