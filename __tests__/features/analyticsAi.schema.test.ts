import { describe, expect, it } from "@jest/globals";
import {
  classPerformanceRequestSchema,
  dropoutRiskRequestSchema,
  schoolHealthRequestSchema,
} from "@/features/analytics-ai";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("analyticsAi validators", () => {
  it("accepts valid dropout risk payload", () => {
    const parsed = dropoutRiskRequestSchema.parse({
      classId: uuid,
      lookbackDays: 60,
      maxStudents: 25,
    });

    expect(parsed.classId).toBe(uuid);
    expect(parsed.lookbackDays).toBe(60);
  });

  it("rejects invalid dropout lookback days", () => {
    const result = dropoutRiskRequestSchema.safeParse({
      classId: uuid,
      lookbackDays: 7,
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid class performance payload", () => {
    const parsed = classPerformanceRequestSchema.parse({
      classId: uuid,
      learningAreaId: uuid,
      lookbackDays: 90,
    });

    expect(parsed.classId).toBe(uuid);
    expect(parsed.lookbackDays).toBe(90);
  });

  it("accepts school health payload", () => {
    const parsed = schoolHealthRequestSchema.parse({
      lookbackDays: 120,
      minAssessments: 15,
    });

    expect(parsed.lookbackDays).toBe(120);
    expect(parsed.minAssessments).toBe(15);
  });
});
