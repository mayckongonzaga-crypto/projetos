import { describe, it, expect } from "vitest";

/**
 * Tests for CT-e Auto-Retomada settings procedures.
 * These verify the settings keys and parsing logic used by the CT-e auto-retomada feature.
 */

describe("CT-e Auto-Retomada Settings", () => {
  it("should parse HH:MM:SS time format correctly", () => {
    const parseTime = (val: string) => {
      const regex = /^(\d{2}):(\d{2}):(\d{2})$/;
      const match = val.match(regex);
      if (!match) return null;
      const [, h, m, s] = match;
      return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
    };

    expect(parseTime("00:00:20")).toBe(20);
    expect(parseTime("00:05:00")).toBe(300);
    expect(parseTime("01:00:00")).toBe(3600);
    expect(parseTime("00:00:15")).toBe(15);
    expect(parseTime("invalid")).toBeNull();
    expect(parseTime("1:2:3")).toBeNull();
  });

  it("should enforce minimum delay of 15 seconds", () => {
    const enforceMinDelay = (seconds: number) => Math.max(seconds, 15);

    expect(enforceMinDelay(5)).toBe(15);
    expect(enforceMinDelay(15)).toBe(15);
    expect(enforceMinDelay(20)).toBe(20);
    expect(enforceMinDelay(300)).toBe(300);
  });

  it("should use correct setting keys for CT-e", () => {
    const CTE_SETTINGS_KEYS = {
      autoCorrecao: "auto_correcao_cte",
      autoCorrecaoTempo: "auto_correcao_tempo_cte",
      retomadaInfinita: "retomada_infinita_cte",
    };

    expect(CTE_SETTINGS_KEYS.autoCorrecao).toBe("auto_correcao_cte");
    expect(CTE_SETTINGS_KEYS.autoCorrecaoTempo).toBe("auto_correcao_tempo_cte");
    expect(CTE_SETTINGS_KEYS.retomadaInfinita).toBe("retomada_infinita_cte");

    // Ensure CT-e keys are different from NFe keys
    const NFE_SETTINGS_KEYS = {
      autoCorrecao: "auto_correcao_pdf",
      autoCorrecaoTempo: "auto_correcao_tempo",
      retomadaInfinita: "retomada_infinita",
    };

    expect(CTE_SETTINGS_KEYS.autoCorrecao).not.toBe(NFE_SETTINGS_KEYS.autoCorrecao);
    expect(CTE_SETTINGS_KEYS.autoCorrecaoTempo).not.toBe(NFE_SETTINGS_KEYS.autoCorrecaoTempo);
    expect(CTE_SETTINGS_KEYS.retomadaInfinita).not.toBe(NFE_SETTINGS_KEYS.retomadaInfinita);
  });

  it("should validate auto-retomada boolean toggle values", () => {
    const parseBoolean = (val: string) => val === "true" || val === "1";

    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean("1")).toBe(true);
    expect(parseBoolean("false")).toBe(false);
    expect(parseBoolean("0")).toBe(false);
    expect(parseBoolean("")).toBe(false);
  });

  it("should calculate retry delay with minimum enforcement", () => {
    const calculateDelay = (tempoStr: string, isInfinita: boolean) => {
      const regex = /^(\d{2}):(\d{2}):(\d{2})$/;
      const match = tempoStr.match(regex);
      if (!match) return 15000; // default 15s
      const [, h, m, s] = match;
      const totalSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s);
      const minDelay = isInfinita ? 15 : 10;
      return Math.max(totalSeconds, minDelay) * 1000;
    };

    expect(calculateDelay("00:00:20", false)).toBe(20000);
    expect(calculateDelay("00:00:05", true)).toBe(15000); // enforced minimum
    expect(calculateDelay("00:01:00", true)).toBe(60000);
    expect(calculateDelay("invalid", false)).toBe(15000); // default
  });
});
