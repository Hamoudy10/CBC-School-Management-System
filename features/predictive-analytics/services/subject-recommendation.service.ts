import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { SubjectRecommendationResult } from "../types";

const recommendationSchema = z.object({
  recommendedLearningAreas: z.array(
    z.object({
      learningAreaId: z.string(),
      learningAreaName: z.string(),
      matchScore: z.number().min(0).max(100),
      rationale: z.string(),
      expectedPerformance: z.enum(["strong", "moderate", "challenging"]),
    })
  ),
  careerPaths: z.array(
    z.object({
      name: z.string(),
      match: z.number().min(0).max(100),
      description: z.string(),
    })
  ),
  guidance: z.string(),
});

export async function generateSubjectRecommendation(
  studentId: string,
  classId: string | undefined,
  includeCareerPaths: boolean,
  schoolId: string
): Promise<SubjectRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("*, users!left(first_name, last_name), classes!inner(name, grade:grades(name, level_order))")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .single();

  if (!student) throw new Error("Student not found");

  const { data: aggregates } = await supabase
    .from("assessment_aggregates")
    .select("*, learning_areas!inner(name, code)")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .order("average_score", { ascending: false });

  const currentAreas = (aggregates || []).map((a: any) => ({
    id: a.learning_area_id,
    name: a.learning_areas?.name ?? "Unknown",
    score: a.average_score,
  }));

  const { data: allLearningAreas } = await supabase
    .from("learning_areas")
    .select("learning_area_id, name, code")
    .eq("school_id", schoolId);

  const usersArr = student.users as { first_name?: string; last_name?: string }[] | undefined;
  const studentName =
    `${usersArr?.[0]?.first_name ?? ""} ${usersArr?.[0]?.last_name ?? ""}`.trim();
  const className = student.classes?.name ?? "";
  const grade = student.classes?.grade?.name ?? "";

  try {
    const ai = await generateGroqCompletion<z.infer<typeof recommendationSchema>>({
      system: `You are a CBC subject selection and career guidance advisor for Kenyan schools.
Recommend learning areas that align with a student's demonstrated strengths and career aspirations.
Use CBC competency data to provide evidence-based guidance.
Return JSON only.`,
      prompt: `Student: ${studentName}
Grade: ${grade}
Class: ${className}

Current performance across learning areas (CBC scale 1-4):
${JSON.stringify(currentAreas, null, 2)}

Available learning areas:
${JSON.stringify(allLearningAreas?.map((la: any) => ({ id: la.learning_area_id, name: la.name })), null, 2)}

${includeCareerPaths ? "Also suggest career paths based on performance patterns." : "Focus only on learning area recommendations."}

For each recommended area:
- matchScore: how well it aligns (0-100)
- rationale: evidence-based reason
- expectedPerformance: prediction

Rules:
- Match areas where the student shows aptitude
- Suggest complementary areas that build well-rounded skills
- Consider grade-appropriate subject combinations
- Be specific and practical`,
      responseFormat: "json",
      temperature: 0.3,
      responseSchema: recommendationSchema,
      requestLabel: "predictive-analytics.subject-recommendation",
      cache: { schoolId, classId, ttlSeconds: 7200 },
    });

    const parsed = recommendationSchema.parse(ai.data);

    return {
      studentId,
      studentName,
      className,
      grade,
      recommendation: {
        studentId,
        studentName,
        currentLearningAreas: currentAreas,
        recommendedLearningAreas: parsed.recommendedLearningAreas,
        careerPaths: includeCareerPaths ? parsed.careerPaths : [],
        guidance: parsed.guidance,
      },
      confidence: ai.confidence,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("AI recommendation failed, using deterministic fallback", {
      error: error instanceof Error ? error.message : "Unknown",
      studentId,
    });

    const strongAreas = currentAreas.filter((a) => a.score >= 3.0);
    const weakAreas = currentAreas.filter((a) => a.score < 2.0);
    const moderateAreas = currentAreas.filter(
      (a) => a.score >= 2.0 && a.score < 3.0
    );

    const recommended = [
      ...strongAreas.map((a) => ({
        learningAreaId: a.id,
        learningAreaName: a.name,
        matchScore: Math.round(a.score * 25),
        rationale: "Strong demonstrated performance in this area.",
        expectedPerformance: "strong" as const,
      })),
      ...moderateAreas.slice(0, 2).map((a) => ({
        learningAreaId: a.id,
        learningAreaName: a.name,
        matchScore: Math.round(a.score * 25),
        rationale: "Adequate performance with potential for growth.",
        expectedPerformance: "moderate" as const,
      })),
    ];

    return {
      studentId,
      studentName,
      className,
      grade,
      recommendation: {
        studentId,
        studentName,
        currentLearningAreas: currentAreas,
        recommendedLearningAreas: recommended,
        careerPaths: [],
        guidance: `Based on current performance, ${studentName} shows strength in ${strongAreas.map((a) => a.name).join(", ") || "various areas"}. Focus on maintaining strong areas while improving moderate ones.`,
      },
      confidence: 0.7,
      generatedAt: new Date().toISOString(),
    };
  }
}
