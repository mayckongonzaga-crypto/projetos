import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTimeout, getCircuitBreaker } from "./download-engine";

// ─── withTimeout ─────────────────────────────────────────────────
describe("withTimeout", () => {
  it("deve resolver quando a promise termina antes do timeout", async () => {
    const result = await withTimeout(
      Promise.resolve("ok"),
      5000,
      "timeout!"
    );
    expect(result).toBe("ok");
  });

  it("deve rejeitar quando a promise excede o timeout", async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("tarde"), 5000);
    });
    await expect(
      withTimeout(slow, 50, "Demorou demais")
    ).rejects.toThrow("Demorou demais");
  });

  it("deve propagar erro da promise original", async () => {
    const failing = Promise.reject(new Error("falha interna"));
    await expect(
      withTimeout(failing, 5000, "timeout")
    ).rejects.toThrow("falha interna");
  });
});

// ─── CircuitBreaker ──────────────────────────────────────────────
describe("CircuitBreaker (global)", () => {
  it("deve retornar o circuit breaker global", () => {
    const cb = getCircuitBreaker();
    expect(cb).toBeDefined();
    expect(typeof cb.waitIfNeeded).toBe("function");
    expect(typeof cb.trigger429).toBe("function");
    expect(typeof cb.onSuccess).toBe("function");
  });

  it("deve passar direto quando não há pausa", async () => {
    const cb = getCircuitBreaker();
    cb.onSuccess(); // resetar
    const start = Date.now();
    await cb.waitIfNeeded();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

// ─── runDownloadEngine (exports check) ───────────────────────────
describe("runDownloadEngine", () => {
  it("deve exportar runDownloadEngine", async () => {
    const { runDownloadEngine } = await import("./download-engine");
    expect(typeof runDownloadEngine).toBe("function");
  });

  it("deve exportar getDownloadConfig", async () => {
    const { getDownloadConfig } = await import("./download-engine");
    expect(typeof getDownloadConfig).toBe("function");
  });

  it("deve exportar DownloadTask type (via runtime check)", async () => {
    const mod = await import("./download-engine");
    // Verificar que runDownloadEngine aceita tasks como primeiro parâmetro
    expect(mod.runDownloadEngine.length).toBeGreaterThanOrEqual(3);
  });
});
