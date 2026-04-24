import { describe, expect, it } from "@jest/globals";
import {
  classroomInsightsRequestSchema,
  markEntryAssistantRequestSchema,
  reportCommentRequestSchema,
} from "@/features/teacher-ai";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("teacherAi validators", () => {
  it("accepts valid report comment payload", () => {
    const parsed = reportCommentRequestSchema.parse({
      classId: uuid,
      studentId: uuid,
      learningAreaId: uuid,
    });

    expect(parsed.classId).toBe(uuid);
    expect(parsed.studentId).toBe(uuid);
  });

  it("accepts valid mark assistant payload", () => {
    const parsed = markEntryAssistantRequestSchema.parse({
      classId: uuid,
      rawMark: 75,
      maxMark: 100,
    });

    expect(parsed.rawMark).toBe(75);
    expect(parsed.maxMark).toBe(100);
  });

  it("rejects invalid mark payload", () => {
    const result = markEntryAssistantRequestSchema.safeParse({
      classId: uuid,
      rawMark: 120,
      maxMark: 100,
    });

    expect(result.success).toBe(false);
  });

  it("accepts classroom insights payload", () => {
    const parsed = classroomInsightsRequestSchema.parse({
      classId: uuid,
      lookbackDays: 30,
    });

    expect(parsed.classId).toBe(uuid);
    expect(parsed.lookbackDays).toBe(30);
  });
});
