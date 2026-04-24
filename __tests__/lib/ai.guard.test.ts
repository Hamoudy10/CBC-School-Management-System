import { describe, expect, it } from "@jest/globals";
import {
  clampTemperature,
  enforceOutputTokenLimit,
  enforcePromptLimit,
  safeJsonParse,
} from "@/lib/ai/ai.guard";

describe("ai.guard", () => {
  it("clamps temperature within 0..1", () => {
    expect(clampTemperature(-1)).toBe(0);
    expect(clampTemperature(2)).toBe(1);
    expect(clampTemperature(0.6)).toBe(0.6);
  });

  it("truncates prompt above max chars", () => {
    const result = enforcePromptLimit("abcdefghij", 5);
    expect(result.truncated).toBe(true);
    expect(result.prompt).toBe("abcde");
  });

  it("enforces output token ceiling", () => {
    expect(enforceOutputTokenLimit(4000, 2048)).toBe(2048);
    expect(enforceOutputTokenLimit(512, 2048)).toBe(512);
  });

  it("parses valid json safely", () => {
    const ok = safeJsonParse<{ value: number }>("{\"value\":3}");
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.value).toBe(3);
    }

    const bad = safeJsonParse("{not-json}");
    expect(bad.success).toBe(false);
  });
});
