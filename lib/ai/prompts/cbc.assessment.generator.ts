import type { AIPromptDefinition } from "../ai.types";

type AssessmentPromptInput = {
  grade: string;
  subject: string;
  strand: string;
  subStrand: string;
  assessmentType: "quiz" | "test";
  questionCount: number;
};

export function buildCbcAssessmentPrompt(
  input: AssessmentPromptInput,
): AIPromptDefinition {
  const constraints = [
    "Align all questions to Kenya CBC grade expectations.",
    "Ensure language level matches learner age.",
    "Include a marking guide for objective and open-ended items.",
    "Return valid JSON only.",
  ];

  const responseSchema = {
    title: "string",
    instructions: "string",
    questions: [
      {
        prompt: "string",
        type: "multiple_choice | short_answer | structured",
        marks: 0,
        options: ["string"],
        expectedAnswer: "string",
      },
    ],
    markingScheme: [
      {
        questionIndex: 1,
        expectedPoints: ["string"],
        totalMarks: 0,
      },
    ],
  };

  const fallbackBehavior =
    "If curriculum context is ambiguous, generate a balanced mixed-skill assessment for the stated grade and subject with a warning note.";

  return {
    systemRole: "You are a CBC assessment design assistant for Kenyan teachers.",
    constraints,
    responseSchema,
    fallbackBehavior,
    system: [
      "Create CBC-compliant assessments with clear marking schemes.",
      "Prioritize clarity, fairness, and progression of cognitive demand.",
      "Return JSON only using the specified schema.",
    ].join(" "),
    user: [
      `Grade: ${input.grade}`,
      `Subject: ${input.subject}`,
      `Strand: ${input.strand}`,
      `Sub-strand: ${input.subStrand}`,
      `Assessment type: ${input.assessmentType}`,
      `Question count: ${input.questionCount}`,
      "Output schema:",
      JSON.stringify(responseSchema),
      `Constraints: ${constraints.join(" ")}`,
      `Fallback behavior: ${fallbackBehavior}`,
    ].join("\n"),
  };
}
