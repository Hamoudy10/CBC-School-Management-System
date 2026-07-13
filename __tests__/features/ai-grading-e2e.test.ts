import { describe, it, expect } from "@jest/globals";
import type { GradingRequest } from "@/features/ai-grading/types";
import { gradeStudentResponses, computeLevel } from "@/features/ai-grading/services/ai-grading.service";

const validRequest: GradingRequest = {
  subject: "Mathematics",
  grade: "Grade 4",
  questions: [
    { number: 1, prompt: "What is 2+2?", type: "short_answer", marks: 5 },
    { number: 2, prompt: "Solve 10-3", type: "short_answer", marks: 5 },
    { number: 3, prompt: "What is 5x3?", type: "short_answer", marks: 10 },
  ],
  studentResponses: [
    {
      studentId: "s1",
      studentName: "Alice",
      answers: [
        { questionNumber: 1, response: "4" },
        { questionNumber: 2, response: "7" },
        { questionNumber: 3, response: "15" },
      ],
    },
    {
      studentId: "s2",
      studentName: "Bob",
      answers: [
        { questionNumber: 1, response: "3" },
        { questionNumber: 2, response: "7" },
        { questionNumber: 3, response: "8" },
      ],
    },
  ],
};

describe("gradeStudentResponses (deterministic fallback)", () => {
  it("returns a result for every input student", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    expect(result.gradedResponses).toHaveLength(2);
    expect(result.gradedResponses.map((r) => r.studentId).sort()).toEqual(["s1", "s2"]);
  });

  it("clamps each question score between 0 and its max marks", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    for (const gr of result.gradedResponses) {
      for (const qr of gr.questionResults) {
        expect(qr.score).toBeGreaterThanOrEqual(0);
        expect(qr.score).toBeLessThanOrEqual(qr.maxScore);
        expect(qr.maxScore).toBeGreaterThan(0);
      }
    }
  });

  it("computes totalScore from sum of question scores", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    for (const gr of result.gradedResponses) {
      const sumFromQuestions = gr.questionResults.reduce((s, qr) => s + qr.score, 0);
      expect(gr.totalScore).toBe(sumFromQuestions);
    }
  });

  it("computes percentage correctly from totalScore / maxTotalScore", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    const maxTotal = 20;
    for (const gr of result.gradedResponses) {
      const expectedPct = Math.round((gr.totalScore / maxTotal) * 10000) / 100;
      expect(gr.percentage).toBe(expectedPct);
    }
  });

  it("assigns performanceLevel based on percentage", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    for (const gr of result.gradedResponses) {
      expect(gr.performanceLevel).toBe(computeLevel(gr.percentage));
    }
  });

  it("recomputes classSummary from graded responses instead of trusting AI", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    const scores = result.gradedResponses.map((r) => r.totalScore);
    const sorted = [...scores].sort((a, b) => a - b);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const distribution: Record<string, number> = {};
    for (const r of result.gradedResponses) {
      distribution[r.performanceLevel] = (distribution[r.performanceLevel] || 0) + 1;
    }

    expect(result.classSummary.averageScore).toBe(Math.round(avg * 100) / 100);
    expect(result.classSummary.highestScore).toBe(Math.max(...scores));
    expect(result.classSummary.lowestScore).toBe(Math.min(...scores));
    expect(result.classSummary.medianScore).toBe(sorted[Math.floor(sorted.length / 2)]);
    expect(result.classSummary.levelDistribution).toEqual(distribution);
  });

  it("marks each question result with a maxScore matching the question marks", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    for (const gr of result.gradedResponses) {
      for (const qr of gr.questionResults) {
        const question = validRequest.questions.find((q) => q.number === qr.questionNumber);
        expect(qr.maxScore).toBe(question?.marks ?? 0);
      }
    }
  });

  it("handles a single student", async () => {
    const result = await gradeStudentResponses(
      { ...validRequest, studentResponses: [validRequest.studentResponses[0]] },
      "test-school",
    );
    expect(result.gradedResponses).toHaveLength(1);
    expect(result.totalStudents).toBe(1);
  });

  it("reports deterministic fallback warnings", async () => {
    const result = await gradeStudentResponses(validRequest, "test-school");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("deterministic");
  });

  it("handles empty student answers gracefully", async () => {
    const request: GradingRequest = {
      subject: "Math",
      grade: "Grade 4",
      questions: [{ number: 1, prompt: "Test", type: "short_answer", marks: 5 }],
      studentResponses: [{
        studentId: "s1",
        studentName: "Alice",
        answers: [{ questionNumber: 1, response: "" }],
      }],
    };
    const result = await gradeStudentResponses(request, "test-school");
    expect(result.gradedResponses).toHaveLength(1);
    expect(result.gradedResponses[0].questionResults[0].score).toBe(0);
  });
});
