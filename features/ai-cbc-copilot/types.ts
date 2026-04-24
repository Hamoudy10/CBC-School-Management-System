import type { CBCContext } from "@/lib/ai/cbc-context-builder";

export type LessonPlanOutput = {
  objectives: string[];
  activities: string[];
  materials: string[];
  assessment: string[];
  cbcCompetenciesMapped: string[];
};

export type AssessmentQuestion = {
  prompt: string;
  type: "multiple_choice" | "short_answer" | "structured";
  marks: number;
  options?: string[];
  expectedAnswer: string;
};

export type AssessmentMarkingGuide = {
  questionIndex: number;
  expectedPoints: string[];
  totalMarks: number;
};

export type AssessmentOutput = {
  title: string;
  instructions: string;
  questions: AssessmentQuestion[];
  markingScheme: AssessmentMarkingGuide[];
};

export type ExplanationOutput = {
  simplifiedExplanation: string;
  examples: string[];
  activities: string[];
  commonMistakes: string[];
};

export type CopilotResult<T> = {
  result: T;
  context: CBCContext;
  confidence: number;
  warnings: string[];
};
