import { describe, expect, it } from "@jest/globals";
import {
  assessmentGeneratorRequestSchema,
  explanationModeRequestSchema,
  lessonPlanRequestSchema,
} from "@/features/ai-cbc-copilot";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("cbcCopilot validators", () => {
  it("accepts valid lesson plan payload", () => {
    const parsed = lessonPlanRequestSchema.parse({
      classId: uuid,
      learningAreaId: uuid,
      strandId: uuid,
      subStrandId: uuid,
      durationMinutes: 40,
    });

    expect(parsed.durationMinutes).toBe(40);
  });

  it("rejects invalid lesson duration", () => {
    const result = lessonPlanRequestSchema.safeParse({
      classId: uuid,
      learningAreaId: uuid,
      strandId: uuid,
      subStrandId: uuid,
      durationMinutes: 5,
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid assessment payload", () => {
    const parsed = assessmentGeneratorRequestSchema.parse({
      classId: uuid,
      learningAreaId: uuid,
      strandId: uuid,
      subStrandId: uuid,
      assessmentType: "quiz",
      questionCount: 12,
    });

    expect(parsed.assessmentType).toBe("quiz");
    expect(parsed.questionCount).toBe(12);
  });

  it("accepts explanation payload with optional curriculum ids", () => {
    const parsed = explanationModeRequestSchema.parse({
      classId: uuid,
      question: "Explain fractions for Grade 5 CBC in simple steps.",
    });

    expect(parsed.classId).toBe(uuid);
  });
});
