// __tests__/services/assessments.service.test.ts
// ============================================================
// Unit tests for Assessment service layer
// Tests score validation, level mapping, trend logic
// ============================================================

import { describe, it, expect } from "@jest/globals";
import { mapScoreToLevel } from "@/features/assessments/services/performanceLevels.service";
import {
  mapScoreToLevel as mapScoreToLevelFromIndex,
  determineTrend,
} from "@/features/assessments";

// ============================================================
// Score to Level Mapping
// ============================================================
describe("mapScoreToLevel", () => {
  it("maps score 1 to Below Expectation", () => {
    expect(mapScoreToLevel(1)).toBe("Below Expectation");
    expect(mapScoreToLevelFromIndex(1)).toBe("Below Expectation");
  });

  it("maps score 2 to Approaching Expectation", () => {
    expect(mapScoreToLevel(2)).toBe("Approaching Expectation");
    expect(mapScoreToLevelFromIndex(2)).toBe("Approaching Expectation");
  });

  it("maps score 3 to Meeting Expectation", () => {
    expect(mapScoreToLevel(3)).toBe("Meeting Expectation");
    expect(mapScoreToLevelFromIndex(3)).toBe("Meeting Expectation");
  });

  it("maps score 4 to Exceeding Expectation", () => {
    expect(mapScoreToLevel(4)).toBe("Exceeding Expectation");
    expect(mapScoreToLevelFromIndex(4)).toBe("Exceeding Expectation");
  });

  it("maps decimal scores to correct levels", () => {
    expect(mapScoreToLevel(1.5)).toBe("Below Expectation");
    expect(mapScoreToLevel(2.3)).toBe("Approaching Expectation");
    expect(mapScoreToLevel(3.7)).toBe("Meeting Expectation");
    expect(mapScoreToLevel(4.0)).toBe("Exceeding Expectation");
  });

  it("maps scores below 1 to Below Expectation", () => {
    expect(mapScoreToLevel(0.5)).toBe("Below Expectation");
    expect(mapScoreToLevel(0)).toBe("Below Expectation");
  });

  it("maps scores above 4 to Exceeding Expectation", () => {
    expect(mapScoreToLevel(4.5)).toBe("Exceeding Expectation");
    expect(mapScoreToLevel(5)).toBe("Exceeding Expectation");
  });
});

// ============================================================
// Trend Determination
// ============================================================
describe("determineTrend", () => {
  it("returns 'improving' when current > previous", () => {
    expect(determineTrend(3.5, 2.5)).toBe("improving");
    expect(determineTrend(4, 3)).toBe("improving");
  });

  it("returns 'declining' when current < previous", () => {
    expect(determineTrend(2, 3)).toBe("declining");
    expect(determineTrend(1.5, 2.5)).toBe("declining");
  });

  it("returns 'stable' when current === previous", () => {
    expect(determineTrend(3, 3)).toBe("stable");
    expect(determineTrend(2.5, 2.5)).toBe("stable");
  });

  it("handles edge cases with zero", () => {
    expect(determineTrend(0, 0)).toBe("stable");
    expect(determineTrend(1, 0)).toBe("improving");
    expect(determineTrend(0, 1)).toBe("declining");
  });
});
