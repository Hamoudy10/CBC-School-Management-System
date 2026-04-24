import type { AIPromptDefinition } from "../ai.types";

type LessonPlanPromptInput = {
  grade: string;
  subject: string;
  strand: string;
  subStrand: string;
  durationMinutes: number;
};

export function buildCbcLessonPlanPrompt(input: LessonPlanPromptInput): AIPromptDefinition {
  const constraints = [
    "Align with Kenya CBC expectations for learner-centered teaching.",
    "Use practical activities appropriate for the requested grade.",
    "Map outcomes to CBC competencies and assessment evidence.",
    "Return valid JSON only, no markdown.",
  ];

  const responseSchema = {
    objectives: ["string"],
    activities: ["string"],
    materials: ["string"],
    assessment: ["string"],
    cbcCompetenciesMapped: ["string"],
  };

  const fallbackBehavior =
    "If strand context is incomplete, generate a generic CBC-aligned lesson for the same grade and subject and include warnings.";

  return {
    systemRole: "You are a Kenyan CBC lesson planning assistant for teachers.",
    constraints,
    responseSchema,
    fallbackBehavior,
    system: [
      "You are a CBC lesson planning assistant for Kenyan schools.",
      "Produce concise, teacher-ready plans aligned to the CBC curriculum.",
      "Return JSON only using the required schema.",
    ].join(" "),
    user: [
      `Grade: ${input.grade}`,
      `Subject: ${input.subject}`,
      `Strand: ${input.strand}`,
      `Sub-strand: ${input.subStrand}`,
      `Duration minutes: ${input.durationMinutes}`,
      "Output schema:",
      JSON.stringify(responseSchema),
      `Constraints: ${constraints.join(" ")}`,
      `Fallback behavior: ${fallbackBehavior}`,
    ].join("\n"),
  };
}
