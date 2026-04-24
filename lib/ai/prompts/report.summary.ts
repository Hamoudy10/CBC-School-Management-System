import type { AIPromptDefinition } from "../ai.types";

type ReportSummaryPromptInput = {
  learnerName: string;
  grade: string;
  term: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

export function buildReportSummaryPrompt(
  input: ReportSummaryPromptInput,
): AIPromptDefinition {
  const constraints = [
    "Use plain language that parents can understand.",
    "Keep tone balanced: celebratory but honest on support needs.",
    "Ensure recommendations are practical for home and school.",
    "Return valid JSON only.",
  ];

  const responseSchema = {
    teacherSummary: "string",
    parentFriendlySummary: "string",
    actionPlan: ["string"],
  };

  const fallbackBehavior =
    "If academic evidence is incomplete, provide a concise provisional summary and include a warning in the action plan.";

  return {
    systemRole: "You are a CBC report writer producing clear teacher and parent summaries.",
    constraints,
    responseSchema,
    fallbackBehavior,
    system: [
      "Draft end-term report summaries for Kenyan CBC learners.",
      "Use clear, supportive, and actionable communication.",
      "Return JSON only using the requested schema.",
    ].join(" "),
    user: [
      `Learner name: ${input.learnerName}`,
      `Grade: ${input.grade}`,
      `Term: ${input.term}`,
      `Strengths: ${input.strengths.join("; ") || "None provided"}`,
      `Weaknesses: ${input.weaknesses.join("; ") || "None provided"}`,
      `Recommendations: ${input.recommendations.join("; ") || "None provided"}`,
      "Output schema:",
      JSON.stringify(responseSchema),
      `Constraints: ${constraints.join(" ")}`,
      `Fallback behavior: ${fallbackBehavior}`,
    ].join("\n"),
  };
}
