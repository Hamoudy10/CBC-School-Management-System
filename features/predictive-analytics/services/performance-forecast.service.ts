import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type {
  PerformanceForecast,
  PerformanceForecastResult,
  TrendDirection,
} from "../types";

const forecastSchema = z.object({
  forecasts: z.array(
    z.object({
      studentId: z.string(),
      predictedEndTermScore: z.number().min(0).max(4),
      predictedEndYearScore: z.number().min(0).max(4),
      riskOfDecline: z.enum(["low", "medium", "high"]),
      contributingFactors: z.array(z.string()),
    })
  ),
  classSummary: z.object({
    averageCurrentScore: z.number(),
    averagePredictedScore: z.number(),
    improvingCount: z.number(),
    decliningCount: z.number(),
    stableCount: z.number(),
    atRiskCount: z.number(),
  }),
});

function determineTrend(scores: number[]): TrendDirection {
  if (scores.length < 3) return "stable";
  const half = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const secondHalf = scores.slice(half).reduce((a, b) => a + b, 0) / (scores.length - half);
  const delta = secondHalf - firstHalf;
  if (delta > 0.15) return "improving";
  if (delta < -0.15) return "declining";
  return "stable";
}

export async function generatePerformanceForecast(
  input: z.infer<typeof import("../validators/predictive-analytics.schema").performanceForecastRequestSchema>,
  schoolId: string
): Promise<PerformanceForecastResult> {
  const supabase = await createSupabaseServerClient();
  const startedAt = new Date().toISOString();

  const { data: classData } = await supabase
    .from("classes")
    .select("name, grade:grades(name, level_order)")
    .eq("class_id", input.classId)
    .eq("school_id", schoolId)
    .single();

  const { data: students } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, users!inner(first_name, last_name)")
    .eq("current_class_id", input.classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (!students || students.length === 0) {
    throw new Error("No active students found in this class");
  }

  const forecasts: PerformanceForecast[] = [];
  const studentSignals: any[] = [];

  for (const student of students) {
    let query = supabase
      .from("assessment_aggregates")
      .select("learning_area_id, average_score, computed_at, learning_areas!inner(name)")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId);

    if (input.learningAreaIds?.length) {
      query = query.in("learning_area_id", input.learningAreaIds);
    }

    if (input.termId) query = query.eq("term_id", input.termId);
    if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);

    const { data: aggregates } = await query;

    if (!aggregates || aggregates.length === 0) continue;

    const { data: rawAssessments } = await supabase
      .from("assessments")
      .select("learning_area_id, score, assessment_date")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId)
      .order("assessment_date", { ascending: true });

    for (const agg of aggregates) {
      const areaScores = (rawAssessments || [])
        .filter((a) => a.learning_area_id === agg.learning_area_id)
        .map((a) => a.score);

      const trend = determineTrend(areaScores);
      const studentName = `${student.users?.first_name ?? student.first_name} ${student.users?.last_name ?? student.last_name}`;
      const areaName = Array.isArray(agg.learning_areas)
        ? agg.learning_areas[0]?.name
        : (agg.learning_areas as any)?.name ?? "Unknown";

      studentSignals.push({
        studentId: student.student_id,
        studentName,
        learningAreaId: agg.learning_area_id,
        learningAreaName: areaName,
        currentScore: agg.average_score,
        trend,
        assessmentCount: areaScores.length,
        recentScores: areaScores.slice(-5),
      });

      forecasts.push({
        studentId: student.student_id,
        studentName,
        className: classData?.name ?? "",
        learningAreaId: agg.learning_area_id,
        learningAreaName: areaName,
        currentScore: agg.average_score,
        predictedEndTermScore: agg.average_score,
        predictedEndYearScore: agg.average_score,
        confidenceInterval: { lower: 0, upper: 4 },
        trend,
        riskOfDecline: "low",
        contributingFactors: [],
      });
    }
  }

  if (studentSignals.length === 0) {
    throw new Error("No assessment data found for students in this class");
  }

  try {
    const ai = await generateGroqCompletion<z.infer<typeof forecastSchema>>({
      system: `You are an educational performance forecaster for Kenyan CBC schools.
Analyze student assessment data and predict future performance.
Use CBC scoring scale (1-4): 1=Below Expectation, 2=Approaching, 3=Meeting, 4=Exceeding.
Return JSON only with the exact schema.`,
      prompt: `Analyze these ${studentSignals.length} student performance records and generate forecasts:

${JSON.stringify(studentSignals, null, 2)}

For each student, predict:
- predictedEndTermScore: expected score by end of current term (1-4)
- predictedEndYearScore: expected score by end of academic year (1-4)
- riskOfDecline: likelihood of score dropping
- contributingFactors: what's driving the prediction

Provide class summary with averages and counts.

Rules:
- Base predictions on trends, recent performance, and assessment patterns
- Be conservative - don't predict dramatic changes without strong evidence
- Students with declining trends and recent low scores are higher risk`,
      responseFormat: "json",
      temperature: 0.2,
      responseSchema: forecastSchema,
      requestLabel: "predictive-analytics.performance-forecast",
      cache: { schoolId, classId: input.classId, ttlSeconds: 3600 },
    });

    const parsed = forecastSchema.parse(ai.data);

    for (let i = 0; i < forecasts.length; i++) {
      const match = parsed.forecasts.find(
        (f: any) => f.studentId === forecasts[i].studentId && f.learningAreaId === forecasts[i].learningAreaId
      );
      if (match) {
        forecasts[i].predictedEndTermScore = match.predictedEndTermScore;
        forecasts[i].predictedEndYearScore = match.predictedEndYearScore;
        forecasts[i].riskOfDecline = match.riskOfDecline;
        forecasts[i].contributingFactors = match.contributingFactors;
      }
    }

    return {
      classId: input.classId,
      className: classData?.name ?? "",
      termId: input.termId ?? "",
      academicYearId: input.academicYearId ?? "",
      forecasts,
      classSummary: parsed.classSummary,
      generatedAt: startedAt,
    };
  } catch (error) {
    logger.warn("AI forecast failed, using deterministic fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const improvingCount = forecasts.filter((f) => f.trend === "improving").length;
    const decliningCount = forecasts.filter((f) => f.trend === "declining").length;
    const stableCount = forecasts.filter((f) => f.trend === "stable").length;
    const avgCurrent =
      forecasts.reduce((sum, f) => sum + f.currentScore, 0) / forecasts.length;
    const atRiskCount = forecasts.filter((f) => f.currentScore < 2.0).length;

    for (const f of forecasts) {
      const delta = f.trend === "improving" ? 0.3 : f.trend === "declining" ? -0.3 : 0;
      f.predictedEndTermScore = Math.min(4, Math.max(1, f.currentScore + delta));
      f.predictedEndYearScore = Math.min(4, Math.max(1, f.currentScore + delta * 2));
      f.riskOfDecline = f.currentScore < 2.0 ? "high" : f.currentScore < 2.5 ? "medium" : "low";
      f.contributingFactors = [];
    }

    return {
      classId: input.classId,
      className: classData?.name ?? "",
      termId: input.termId ?? "",
      academicYearId: input.academicYearId ?? "",
      forecasts,
      classSummary: {
        averageCurrentScore: avgCurrent,
        averagePredictedScore: Math.min(4, avgCurrent + 0.1),
        improvingCount,
        decliningCount,
        stableCount,
        atRiskCount,
      },
      generatedAt: startedAt,
    };
  }
}
