import type { AIPromptDefinition } from "../ai.types";

type CommentPromptInput = {
  learnerName: string;
  grade: string;
  subject: string;
  score: number;
  performanceLevel: string;
  attendanceSummary?: string;
  behaviorSummary?: string;
};

export function buildCbcCommentPrompt(input: CommentPromptInput): AIPromptDefinition {
  const constraints = [
    "Use constructive, parent-friendly language.",
    "Reference both strengths and concrete growth areas.",
    "Keep comments personalized but concise.",
    "Return valid JSON only.",
  ];

  const responseSchema = {
    teacherComment: "string",
    parentSummary: "string",
    nextSteps: ["string"],
  };

  const fallbackBehavior =
    "If limited learner data is provided, generate a neutral and supportive comment with explicit uncertainty warning.";

  return {
    systemRole: "You are a CBC report comment assistant for class teachers.",
    constraints,
    responseSchema,
    fallbackBehavior,
    system: [
      "Generate report comments aligned with CBC progression language.",
      "Be factual, encouraging, and actionable.",
      "Return JSON only with the provided schema.",
    ].join(" "),
    user: [
      `Learner name: ${input.learnerName}`,
      `Grade: ${input.grade}`,
      `Subject: ${input.subject}`,
      `Score: ${input.score}`,
      `Performance level: ${input.performanceLevel}`,
      `Attendance summary: ${input.attendanceSummary ?? "Not provided"}`,
      `Behavior summary: ${input.behaviorSummary ?? "Not provided"}`,
      "Output schema:",
      JSON.stringify(responseSchema),
      `Constraints: ${constraints.join(" ")}`,
      `Fallback behavior: ${fallbackBehavior}`,
    ].join("\n"),
  };
}
