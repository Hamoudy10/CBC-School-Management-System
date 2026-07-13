import { describe, it, expect } from "@jest/globals";
import { gradingRequestSchema } from "@/features/ai-grading/validators/ai-grading.schema";
import { computeLevel } from "@/features/ai-grading/services/ai-grading.service";

describe("gradingRequestSchema", () => {
  const validRequest = {
    subject: "Mathematics",
    grade: "Grade 4",
    questions: [
      { number: 1, prompt: "What is 2+2?", type: "short_answer" as const, marks: 5 },
      { number: 2, prompt: "Solve 10-3", type: "short_answer" as const, marks: 5 },
    ],
    studentResponses: [
      {
        studentId: "s1",
        studentName: "Alice",
        answers: [
          { questionNumber: 1, response: "4" },
          { questionNumber: 2, response: "7" },
        ],
      },
    ],
  };

  it("accepts valid grading request", () => {
    const result = gradingRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("rejects request with no questions", () => {
    const result = gradingRequestSchema.safeParse({ ...validRequest, questions: [] });
    expect(result.success).toBe(false);
  });

  it("rejects request with more than 50 questions", () => {
    const questions = Array.from({ length: 51 }, (_, i) => ({
      number: i + 1,
      prompt: `Q${i + 1}`,
      type: "short_answer" as const,
      marks: 5,
    }));
    const result = gradingRequestSchema.safeParse({ ...validRequest, questions });
    expect(result.success).toBe(false);
  });

  it("rejects request with no students", () => {
    const result = gradingRequestSchema.safeParse({ ...validRequest, studentResponses: [] });
    expect(result.success).toBe(false);
  });

  it("rejects request with more than 100 students", () => {
    const studentResponses = Array.from({ length: 101 }, (_, i) => ({
      studentId: `s${i}`,
      studentName: `Student ${i}`,
      answers: [{ questionNumber: 1, response: "A" }],
    }));
    const result = gradingRequestSchema.safeParse({ ...validRequest, studentResponses });
    expect(result.success).toBe(false);
  });

  it("rejects question marks < 1", () => {
    const result = gradingRequestSchema.safeParse({
      ...validRequest,
      questions: [{ number: 1, prompt: "Test", type: "short_answer", marks: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects question marks > 50", () => {
    const result = gradingRequestSchema.safeParse({
      ...validRequest,
      questions: [{ number: 1, prompt: "Test", type: "short_answer", marks: 51 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("computeLevel", () => {
  it("returns exceeding for 80% and above", () => {
    expect(computeLevel(80)).toBe("exceeding");
    expect(computeLevel(95)).toBe("exceeding");
    expect(computeLevel(100)).toBe("exceeding");
  });

  it("returns meeting for 60-79%", () => {
    expect(computeLevel(60)).toBe("meeting");
    expect(computeLevel(70)).toBe("meeting");
    expect(computeLevel(79)).toBe("meeting");
  });

  it("returns approaching for 40-59%", () => {
    expect(computeLevel(40)).toBe("approaching");
    expect(computeLevel(50)).toBe("approaching");
    expect(computeLevel(59)).toBe("approaching");
  });

  it("returns below_expectation for below 40%", () => {
    expect(computeLevel(0)).toBe("below_expectation");
    expect(computeLevel(25)).toBe("below_expectation");
    expect(computeLevel(39)).toBe("below_expectation");
  });

  it("handles decimal percentages", () => {
    expect(computeLevel(79.9)).toBe("meeting");
    expect(computeLevel(59.9)).toBe("approaching");
  });
});
