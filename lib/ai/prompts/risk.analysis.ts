import type { AIPromptDefinition } from "../ai.types";

type RiskAnalysisPromptInput = {
  learnerName: string;
  attendancePercent: number;
  gradeTrendSummary: string;
  disciplineSummary: string;
};

export function buildRiskAnalysisPrompt(input: RiskAnalysisPromptInput): AIPromptDefinition {
  const constraints = [
    "Base reasoning strictly on supplied attendance, assessment, and discipline signals.",
    "Do not infer protected traits or sensitive personal assumptions.",
    "Provide practical school intervention actions.",
    "Return valid JSON only.",
  ];

  const responseSchema = {
    riskLevel: "low | medium | high",
    reason: ["string"],
    recommendation: ["string"],
  };

  const fallbackBehavior =
    "If evidence quality is weak, return medium risk with explicit data quality warning and request additional records.";

  return {
    systemRole: "You are a school risk analyst focused on early learner support.",
    constraints,
    responseSchema,
    fallbackBehavior,
    system: [
      "Assess dropout or disengagement risk from educational signals only.",
      "Prioritize student welfare and intervention planning.",
      "Return JSON only using the target schema.",
    ].join(" "),
    user: [
      `Learner name: ${input.learnerName}`,
      `Attendance percent: ${input.attendancePercent}`,
      `Grade trend summary: ${input.gradeTrendSummary}`,
      `Discipline summary: ${input.disciplineSummary}`,
      "Output schema:",
      JSON.stringify(responseSchema),
      `Constraints: ${constraints.join(" ")}`,
      `Fallback behavior: ${fallbackBehavior}`,
    ].join("\n"),
  };
}
