import { afterEach, describe, expect, it, vi } from "vitest";
import { createContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import * as db from "./db";

describe("createContext auth strategy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa Bearer token quando presente e válido", async () => {
    const user = {
      id: 10,
      openId: "u_bearer",
      name: "Bearer User",
      email: "bearer@test.com",
      passwordHash: null,
      loginMethod: "local",
      role: "admin",
      contabilidadeId: null,
      ativo: true,
      permissoes: null,
      criadoPor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any;

    vi.spyOn(sdk, "verifySession").mockResolvedValue({ openId: "u_bearer", appId: "pegasus", name: "Bearer User" });
    vi.spyOn(sdk, "verifySessionFromRequest").mockResolvedValue(null);
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(user);

    const ctx = await createContext({
      req: { headers: { authorization: "Bearer token123" } } as any,
      res: {} as any,
      info: {} as any,
    });

    expect(ctx.user?.openId).toBe("u_bearer");
    expect(sdk.verifySession).toHaveBeenCalledWith("token123");
    expect(sdk.verifySessionFromRequest).not.toHaveBeenCalled();
  });

  it("faz fallback para cookie quando Bearer não existe", async () => {
    const user = {
      id: 11,
      openId: "u_cookie",
      name: "Cookie User",
      email: "cookie@test.com",
      passwordHash: null,
      loginMethod: "local",
      role: "cliente",
      contabilidadeId: null,
      ativo: true,
      permissoes: null,
      criadoPor: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any;

    vi.spyOn(sdk, "verifySession").mockResolvedValue(null);
    vi.spyOn(sdk, "verifySessionFromRequest").mockResolvedValue({ openId: "u_cookie", appId: "pegasus", name: "Cookie User" });
    vi.spyOn(db, "getUserByOpenId").mockResolvedValue(user);

    const ctx = await createContext({
      req: { headers: { cookie: "pegasus_session=fake" } } as any,
      res: {} as any,
      info: {} as any,
    });

    expect(ctx.user?.openId).toBe("u_cookie");
    expect(sdk.verifySessionFromRequest).toHaveBeenCalled();
  });
});
