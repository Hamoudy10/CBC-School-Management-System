import { z } from "zod";
import type { AuthUser } from "@/types/auth";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { buildCbcLessonPlanPrompt } from "@/lib/ai/prompts/cbc.lesson.plan";
import { buildCbcAssessmentPrompt } from "@/lib/ai/prompts/cbc.assessment.generator";
import {
  buildCBCContext,
  formatCBCContextForPrompt,
} from "@/lib/ai/cbc-context-builder";
import type {
  AssessmentOutput,
  CopilotResult,
  ExplanationOutput,
  LessonPlanOutput,
} from "../types";
import type {
  AssessmentGeneratorRequestInput,
  ExplanationModeRequestInput,
  LessonPlanRequestInput,
} from "../validators/cbcCopilot.schema";

const lessonPlanOutputSchema = z.object({
  objectives: z.array(z.string().min(1)).min(1),
  activities: z.array(z.string().min(1)).min(1),
  materials: z.array(z.string().min(1)).min(1),
  assessment: z.array(z.string().min(1)).min(1),
  cbcCompetenciesMapped: z.array(z.string().min(1)).min(1),
});

const assessmentOutputSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1),
        type: z.enum(["multiple_choice", "short_answer", "structured"]),
        marks: z.coerce.number().int().min(1).max(20),
        options: z.array(z.string().min(1)).optional(),
        expectedAnswer: z.string().min(1),
      }),
    )
    .min(1),
  markingScheme: z
    .array(
      z.object({
        questionIndex: z.coerce.number().int().min(1),
        expectedPoints: z.array(z.string().min(1)).min(1),
        totalMarks: z.coerce.number().int().min(1).max(20),
      }),
    )
    .min(1),
});

const explanationOutputSchema = z.object({
  simplifiedExplanation: z.string().min(1),
  examples: z.array(z.string().min(1)).min(2),
  activities: z.array(z.string().min(1)).min(2),
  commonMistakes: z.array(z.string().min(1)).min(2),
});

function resolveGradeLabel(gradeName: string | undefined, gradeLevel: number | null | undefined) {
  if (gradeName && gradeName.trim().length > 0) {
    return gradeName;
  }

  if (typeof gradeLevel === "number") {
    return `Grade ${gradeLevel}`;
  }

  return "Grade";
}

export async function generateCbcLessonPlan(
  input: LessonPlanRequestInput,
  user: AuthUser,
): Promise<CopilotResult<LessonPlanOutput>> {
  const context = await buildCBCContext({
    user,
    classId: input.classId,
    learningAreaId: input.learningAreaId,
    strandId: input.strandId,
    subStrandId: input.subStrandId,
  });

  const prompt = buildCbcLessonPlanPrompt({
    grade: resolveGradeLabel(context.class?.gradeName, context.class?.gradeLevel),
    subject: context.learning_area?.name ?? "Learning Area",
    strand: context.strand?.name ?? "Strand",
    subStrand: context.sub_strand?.name ?? "Sub-strand",
    durationMinutes: input.durationMinutes,
  });

  const contextBlock = formatCBCContextForPrompt(context);
  const response = await generateGroqCompletion<LessonPlanOutput>({
    system: prompt.system,
    prompt: [
      contextBlock,
      "",
      prompt.user,
      "",
      `Additional instructions: ${input.additionalInstructions ?? "None"}`,
    ].join("\n"),
    responseFormat: "json",
    temperature: 0.2,
    responseSchema: lessonPlanOutputSchema,
    requestLabel: "cbc-copilot.lesson-plan",
    cache: {
      schoolId: user.schoolId,
      classId: input.classId,
      subject: context.learning_area?.name ?? "general",
    },
  });

  return {
    result: lessonPlanOutputSchema.parse(response.data),
    context,
    confidence: response.confidence,
    warnings: [...context.warnings, ...(response.warnings ?? [])],
  };
}

export async function generateCbcAssessment(
  input: AssessmentGeneratorRequestInput,
  user: AuthUser,
): Promise<CopilotResult<AssessmentOutput>> {
  const context = await buildCBCContext({
    user,
    classId: input.classId,
    learningAreaId: input.learningAreaId,
    strandId: input.strandId,
    subStrandId: input.subStrandId,
  });

  const prompt = buildCbcAssessmentPrompt({
    grade: resolveGradeLabel(context.class?.gradeName, context.class?.gradeLevel),
    subject: context.learning_area?.name ?? "Learning Area",
    strand: context.strand?.name ?? "Strand",
    subStrand: context.sub_strand?.name ?? "Sub-strand",
    assessmentType: input.assessmentType,
    questionCount: input.questionCount,
  });

  const contextBlock = formatCBCContextForPrompt(context);
  const response = await generateGroqCompletion<AssessmentOutput>({
    system: prompt.system,
    prompt: [
      contextBlock,
      "",
      prompt.user,
      "",
      `Additional instructions: ${input.additionalInstructions ?? "None"}`,
    ].join("\n"),
    responseFormat: "json",
    temperature: 0.2,
    responseSchema: assessmentOutputSchema,
    requestLabel: "cbc-copilot.assessment-generator",
    cache: {
      schoolId: user.schoolId,
      classId: input.classId,
      subject: context.learning_area?.name ?? "general",
    },
  });

  return {
    result: assessmentOutputSchema.parse(response.data),
    context,
    confidence: response.confidence,
    warnings: [...context.warnings, ...(response.warnings ?? [])],
  };
}

export async function generateCbcExplanation(
  input: ExplanationModeRequestInput,
  user: AuthUser,
): Promise<CopilotResult<ExplanationOutput>> {
  const context = await buildCBCContext({
    user,
    classId: input.classId,
    learningAreaId: input.learningAreaId,
    strandId: input.strandId,
    subStrandId: input.subStrandId,
    competencyId: input.competencyId,
  });

  const system = [
    "You are a CBC explanation assistant for Kenyan teachers.",
    "Explain concepts for classroom use using age-appropriate language.",
    "Return JSON only with keys: simplifiedExplanation, examples, activities, commonMistakes.",
  ].join(" ");

  const response = await generateGroqCompletion<ExplanationOutput>({
    system,
    prompt: [
      formatCBCContextForPrompt(context),
      "",
      `Teacher request: ${input.question}`,
      "",
      "Instructions:",
      "1. Keep explanation practical and simple.",
      "2. Include at least 2 examples and 2 activities.",
      "3. Include common misconceptions learners often have.",
      "4. Keep content aligned to Kenya CBC context.",
    ].join("\n"),
    responseFormat: "json",
    temperature: 0.25,
    responseSchema: explanationOutputSchema,
    requestLabel: "cbc-copilot.explanation-mode",
    cache: {
      schoolId: user.schoolId,
      classId: input.classId,
      subject: context.learning_area?.name ?? "general",
    },
  });

  return {
    result: explanationOutputSchema.parse(response.data),
    context,
    confidence: response.confidence,
    warnings: [...context.warnings, ...(response.warnings ?? [])],
  };
}
