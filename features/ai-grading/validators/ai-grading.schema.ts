import { z } from "zod";

const uuidField = z.string().uuid("Invalid UUID format");

export const gradingRequestSchema = z.object({
  subject: z.string().min(1),
  grade: z.string().min(1),
  questions: z
    .array(
      z.object({
        number: z.number().int().min(1),
        prompt: z.string().min(1),
        type: z.enum(["multiple_choice", "short_answer", "structured", "essay"]),
        marks: z.number().int().min(1).max(50),
        options: z.array(z.string()).optional(),
        correctAnswer: z.string().optional(),
        expectedPoints: z.array(z.string()).optional(),
      })
    )
    .min(1)
    .max(50),
  studentResponses: z
    .array(
      z.object({
        studentId: z.string(),
        studentName: z.string(),
        answers: z
          .array(
            z.object({
              questionNumber: z.number().int().min(1),
              response: z.string(),
            })
          )
          .min(1),
      })
    )
    .min(1)
    .max(100),
  markingScheme: z
    .array(
      z.object({
        questionNumber: z.number().int().min(1),
        maxMarks: z.number().int().min(1),
        rubric: z.array(z.string()),
      })
    )
    .optional(),
});

export const lessonPlanRequestSchema = z.object({
  classId: uuidField,
  learningAreaId: uuidField,
  strandId: uuidField.optional(),
  subStrandId: uuidField.optional(),
  competencyId: uuidField.optional(),
  durationMinutes: z.coerce.number().int().min(15).max(180).default(60),
  pedagogicalApproach: z
    .enum(["learner-centered", "teacher-directed", "differentiated", "inquiry-based"])
    .default("learner-centered"),
  includeResources: z.boolean().default(true),
  includeAssessment: z.boolean().default(true),
});

export type GradingInput = z.infer<typeof gradingRequestSchema>;
export type LessonPlanInput = z.infer<typeof lessonPlanRequestSchema>;
