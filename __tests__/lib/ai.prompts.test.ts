import { describe, expect, it } from "@jest/globals";
import { buildCbcLessonPlanPrompt } from "@/lib/ai/prompts/cbc.lesson.plan";
import { buildCbcAssessmentPrompt } from "@/lib/ai/prompts/cbc.assessment.generator";
import { buildCbcCommentPrompt } from "@/lib/ai/prompts/cbc.comment.generator";
import { buildRiskAnalysisPrompt } from "@/lib/ai/prompts/risk.analysis";
import { buildReportSummaryPrompt } from "@/lib/ai/prompts/report.summary";

describe("ai prompts", () => {
  it("builds lesson plan prompt package", () => {
    const prompt = buildCbcLessonPlanPrompt({
      grade: "Grade 5",
      subject: "Mathematics",
      strand: "Numbers",
      subStrand: "Fractions",
      durationMinutes: 40,
    });

    expect(prompt.systemRole.length).toBeGreaterThan(0);
    expect(prompt.constraints.length).toBeGreaterThan(0);
    expect(prompt.fallbackBehavior.length).toBeGreaterThan(0);
    expect(prompt.user).toContain("Fractions");
  });

  it("builds assessment prompt package", () => {
    const prompt = buildCbcAssessmentPrompt({
      grade: "Grade 6",
      subject: "Science",
      strand: "Living Things",
      subStrand: "Nutrition",
      assessmentType: "quiz",
      questionCount: 10,
    });

    expect(prompt.user).toContain("Question count: 10");
    expect(prompt.system).toContain("Return JSON only");
  });

  it("builds comment prompt package", () => {
    const prompt = buildCbcCommentPrompt({
      learnerName: "John",
      grade: "Grade 4",
      subject: "English",
      score: 72,
      performanceLevel: "Meeting expectations",
      attendanceSummary: "Good attendance",
      behaviorSummary: "Participates actively",
    });

    expect(prompt.responseSchema).toHaveProperty("teacherComment");
    expect(prompt.user).toContain("John");
  });

  it("builds risk analysis prompt package", () => {
    const prompt = buildRiskAnalysisPrompt({
      learnerName: "Amina",
      attendancePercent: 81,
      gradeTrendSummary: "Declining from B to C",
      disciplineSummary: "2 incidents in current term",
    });

    expect(prompt.responseSchema).toHaveProperty("riskLevel");
    expect(prompt.constraints.join(" ")).toContain("attendance");
  });

  it("builds report summary prompt package", () => {
    const prompt = buildReportSummaryPrompt({
      learnerName: "Kevin",
      grade: "Grade 7",
      term: "Term 2",
      strengths: ["Creative writing", "Reading fluency"],
      weaknesses: ["Computation speed"],
      recommendations: ["Daily math drills"],
    });

    expect(prompt.responseSchema).toHaveProperty("parentFriendlySummary");
    expect(prompt.user).toContain("Creative writing");
  });
});
