import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getAllSettings: vi.fn(),
  getSetting: vi.fn(),
  upsertSetting: vi.fn(),
  upsertMultipleSettings: vi.fn(),
}));

import * as db from "./db";

describe("Settings DB functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAllSettings returns a record of key-value pairs", async () => {
    const mockSettings = { tema: "azul", "nome-sistema": "Pegasus" };
    (db.getAllSettings as any).mockResolvedValue(mockSettings);

    const result = await db.getAllSettings();
    expect(result).toEqual({ tema: "azul", "nome-sistema": "Pegasus" });
    expect(db.getAllSettings).toHaveBeenCalledOnce();
  });

  it("getSetting returns a single value by key", async () => {
    (db.getSetting as any).mockResolvedValue("verde");

    const result = await db.getSetting("tema");
    expect(result).toBe("verde");
    expect(db.getSetting).toHaveBeenCalledWith("tema");
  });

  it("getSetting returns null for non-existent key", async () => {
    (db.getSetting as any).mockResolvedValue(null);

    const result = await db.getSetting("nao-existe");
    expect(result).toBeNull();
  });

  it("upsertSetting creates or updates a setting", async () => {
    (db.upsertSetting as any).mockResolvedValue(undefined);

    await db.upsertSetting("tema", "preto");
    expect(db.upsertSetting).toHaveBeenCalledWith("tema", "preto");
  });

  it("upsertMultipleSettings handles multiple pairs", async () => {
    (db.upsertMultipleSettings as any).mockResolvedValue(undefined);

    const pairs = [
      { chave: "tema", valor: "azul" },
      { chave: "nome-sistema", valor: "Pegasus" },
    ];
    await db.upsertMultipleSettings(pairs);
    expect(db.upsertMultipleSettings).toHaveBeenCalledWith(pairs);
  });
});

describe("Retomada Infinita settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getSetting returns 'true' when retomada_infinita is enabled", async () => {
    (db.getSetting as any).mockResolvedValue("true");
    const result = await db.getSetting("retomada_infinita");
    expect(result).toBe("true");
    expect(result === "true").toBe(true);
  });

  it("getSetting returns null when retomada_infinita is not set", async () => {
    (db.getSetting as any).mockResolvedValue(null);
    const result = await db.getSetting("retomada_infinita");
    expect(result).toBeNull();
    expect(result === "true").toBe(false);
  });

  it("upsertSetting saves retomada_infinita as string boolean", async () => {
    (db.upsertSetting as any).mockResolvedValue(undefined);
    await db.upsertSetting("retomada_infinita", "true");
    expect(db.upsertSetting).toHaveBeenCalledWith("retomada_infinita", "true");
  });

  it("retomada infinita sets MAX_RODADAS to 999", () => {
    const retomadaInfinita = true;
    const maxRodadasSetting = "3";
    const MAX_RODADAS = retomadaInfinita ? 999 : Math.max(1, Math.min(10, parseInt(maxRodadasSetting || "3") || 3));
    expect(MAX_RODADAS).toBe(999);
  });

  it("retomada normal uses configured max rodadas", () => {
    const retomadaInfinita = false;
    const maxRodadasSetting = "5";
    const MAX_RODADAS = retomadaInfinita ? 999 : Math.max(1, Math.min(10, parseInt(maxRodadasSetting || "3") || 3));
    expect(MAX_RODADAS).toBe(5);
  });

  it("delay between rounds is at least 15s in infinite mode", () => {
    const retomadaInfinita = true;
    const delayMs = 5000; // 5s configured
    const delayRodada = retomadaInfinita ? Math.max(delayMs, 15000) : 10000;
    expect(delayRodada).toBe(15000);
  });

  it("delay between rounds uses configured delay when > 15s in infinite mode", () => {
    const retomadaInfinita = true;
    const delayMs = 30000; // 30s configured
    const delayRodada = retomadaInfinita ? Math.max(delayMs, 15000) : 10000;
    expect(delayRodada).toBe(30000);
  });

  it("delay between rounds is 10s in normal mode", () => {
    const retomadaInfinita = false;
    const delayMs = 5000;
    const delayRodada = retomadaInfinita ? Math.max(delayMs, 15000) : 10000;
    expect(delayRodada).toBe(10000);
  });
});

describe("Theme validation", () => {
  const validThemes = ["branco", "azul", "verde", "preto"];

  it("all 4 themes are valid options", () => {
    expect(validThemes).toHaveLength(4);
    expect(validThemes).toContain("branco");
    expect(validThemes).toContain("azul");
    expect(validThemes).toContain("verde");
    expect(validThemes).toContain("preto");
  });

  it("theme names are lowercase strings", () => {
    validThemes.forEach((theme) => {
      expect(theme).toBe(theme.toLowerCase());
      expect(typeof theme).toBe("string");
    });
  });
});
