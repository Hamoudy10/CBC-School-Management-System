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
  it("maps score 1 to below_expectation", () => {
    expect(mapScoreToLevel(1)).toBe("below_expectation");
    expect(mapScoreToLevelFromIndex(1)).toBe("below_expectation");
  });

  it("maps score 2 to approaching", () => {
    expect(mapScoreToLevel(2)).toBe("approaching");
    expect(mapScoreToLevelFromIndex(2)).toBe("approaching");
  });

  it("maps score 3 to meeting", () => {
    expect(mapScoreToLevel(3)).toBe("meeting");
    expect(mapScoreToLevelFromIndex(3)).toBe("meeting");
  });

  it("maps score 4 to exceeding", () => {
    expect(mapScoreToLevel(4)).toBe("exceeding");
    expect(mapScoreToLevelFromIndex(4)).toBe("exceeding");
  });

  it("maps decimal scores to correct levels", () => {
    expect(mapScoreToLevel(1.5)).toBe("below_expectation");
    expect(mapScoreToLevel(2.3)).toBe("approaching");
    expect(mapScoreToLevel(3.7)).toBe("meeting");
    expect(mapScoreToLevel(4.0)).toBe("exceeding");
  });

  it("maps scores below 1 to below_expectation", () => {
    expect(mapScoreToLevel(0.5)).toBe("below_expectation");
    expect(mapScoreToLevel(0)).toBe("below_expectation");
  });

  it("maps scores above 4 to exceeding", () => {
    expect(mapScoreToLevel(4.5)).toBe("exceeding");
    expect(mapScoreToLevel(5)).toBe("exceeding");
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
