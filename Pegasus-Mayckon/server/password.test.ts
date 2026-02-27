import { describe, expect, it } from "vitest";
import { hashPassword, isBcryptHash, verifyPassword } from "./password";

describe("password helpers", () => {
  it("hashPassword gera hash bcrypt válido", async () => {
    const hash = await hashPassword("SenhaSegura123");
    expect(isBcryptHash(hash)).toBe(true);
    expect(hash).not.toBe("SenhaSegura123");
  });

  it("verifyPassword valida hash bcrypt corretamente", async () => {
    const plain = "SenhaSegura123";
    const hash = await hashPassword(plain);

    const ok = await verifyPassword(plain, hash);
    const wrong = await verifyPassword("Errada321", hash);

    expect(ok).toEqual({ valid: true, needsRehash: false });
    expect(wrong).toEqual({ valid: false, needsRehash: false });
  });

  it("verifyPassword suporta legado em texto puro e sinaliza rehash", async () => {
    const ok = await verifyPassword("123456", "123456");
    const wrong = await verifyPassword("654321", "123456");

    expect(ok).toEqual({ valid: true, needsRehash: true });
    expect(wrong).toEqual({ valid: false, needsRehash: false });
  });
});
