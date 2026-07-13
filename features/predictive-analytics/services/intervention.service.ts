import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { InterventionRecommendation, InterventionRecommendationResult } from "../types";

const interventionSchema = z.object({
  recommendations: z.array(
    z.object({
      studentId: z.string(),
      riskLevel: z.enum(["low", "medium", "high"]),
      priority: z.number().min(1).max(100),
      interventions: z.array(
        z.object({
          type: z.enum(["academic", "attendance", "behavioral", "social", "financial"]),
          action: z.string(),
          responsibleParty: z.enum(["teacher", "parent", "counselor", "admin", "both"]),
          timeline: z.enum(["immediate", "this_week", "this_month", "this_term"]),
          expectedImpact: z.enum(["high", "medium", "low"]),
        })
      ),
      notes: z.string(),
    })
  ),
});

export async function generateInterventionRecommendations(
  classId: string,
  minRiskLevel: string,
  schoolId: string,
  termId?: string,
  academicYearId?: string
): Promise<InterventionRecommendationResult> {
  const supabase = await createSupabaseServerClient();

  const { data: classData } = await supabase
    .from("classes")
    .select("name")
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .single();

  const { data: students } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, users!left(first_name, last_name)")
    .eq("current_class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (!students || students.length === 0) {
    throw new Error("No active students found");
  }

  const studentData: any[] = [];

  for (const student of students) {
    let aggQuery = supabase
      .from("assessment_aggregates")
      .select("average_score, learning_area_id")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId);
    if (termId) aggQuery = aggQuery.eq("term_id", termId);
    if (academicYearId) aggQuery = aggQuery.eq("academic_year_id", academicYearId);
    const { data: aggregates } = await aggQuery;

    const { data: attendance } = await supabase
      .from("attendance")
      .select("status, date")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId)
      .order("date", { ascending: false })
      .limit(30);

    const { data: discipline } = await supabase
      .from("disciplinary_records")
      .select("severity, incident_type")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId);

    const { data: fees } = await supabase
      .from("student_fees")
      .select("status, amount_due, due_date")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId)
      .eq("status", "overdue");

    const scores = (aggregates || []).map((a: any) => a.average_score);
    const avgScore = scores.length > 0
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      : 0;
    const presentCount = (attendance || []).filter(
      (a: any) => a.status === "present"
    ).length;
    const totalAttendance = (attendance || []).length;
    const attendanceRate = totalAttendance > 0 ? presentCount / totalAttendance : 1;
    const disciplineCount = (discipline || []).length;
    const majorIncidents = (discipline || []).filter(
      (d: any) => d.severity === "high" || d.severity === "severe"
    ).length;
    const overdueFees = (fees || []).length;

    const usersArr = student.users as { first_name?: string; last_name?: string }[] | undefined;
    const studentName =
      `${usersArr?.[0]?.first_name ?? student.first_name} ${usersArr?.[0]?.last_name ?? student.last_name}`.trim();

    studentData.push({
      studentId: student.student_id,
      name: studentName,
      averageScore: Math.round(avgScore * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100),
      disciplineCount,
      majorIncidents,
      overdueFees,
    });
  }

  try {
    const ai = await generateGroqCompletion<z.infer<typeof interventionSchema>>({
      system: `You are an educational intervention specialist for Kenyan CBC schools.
Recommend specific, actionable interventions for students based on their academic, attendance, discipline, and financial profiles.
Prioritize interventions by urgency and potential impact.
Return JSON only.`,
      prompt: `Generate intervention recommendations for these ${studentData.length} students.
Minimum risk level to include: ${minRiskLevel}

Student data:
${JSON.stringify(studentData, null, 2)}

For each student at or above the minimum risk level, provide:
- riskLevel: overall risk assessment
- priority: 1-100 urgency score
- interventions: specific actions (at least 2 per student)
- notes: context/observations

Risk criteria:
- High risk: avgScore < 2.0 OR (attendance < 70% AND avgScore < 2.5)
- Medium risk: avgScore 2.0-2.5 OR attendance 70-80% OR discipline >= 2 incidents
- Low risk: everything else

Rules:
- Be specific and practical for Kenyan school context
- Suggest concrete actions, not generic advice
- Consider CBC competency-based approach
- Assign responsible parties appropriately`,
      responseFormat: "json",
      temperature: 0.3,
      responseSchema: interventionSchema,
      requestLabel: "predictive-analytics.intervention",
      cache: { schoolId, classId, ttlSeconds: 3600 },
    });

    const parsed = interventionSchema.parse(ai.data);

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const r of parsed.recommendations) {
      if (r.riskLevel === "high") highCount++;
      else if (r.riskLevel === "medium") mediumCount++;
      else lowCount++;
    }

    const recommendations: InterventionRecommendation[] = parsed.recommendations.map(
      (r: any) => ({
        studentId: r.studentId,
        studentName: studentData.find((s) => s.studentId === r.studentId)?.name ?? "",
        riskLevel: r.riskLevel,
        priority: r.priority,
        interventions: r.interventions,
        notes: r.notes,
      })
    );

    return {
      classId,
      className: classData?.name ?? "",
      recommendations,
      summary: {
        totalStudents: recommendations.length,
        highRiskCount: highCount,
        mediumRiskCount: mediumCount,
        lowRiskCount: lowCount,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("AI intervention failed, using deterministic fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const recommendations: InterventionRecommendation[] = [];
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const s of studentData) {
      const isHighRisk = s.averageScore < 2.0 || (s.attendanceRate < 70 && s.averageScore < 2.5);
      const isMediumRisk =
        (s.averageScore >= 2.0 && s.averageScore < 2.5) ||
        (s.attendanceRate >= 70 && s.attendanceRate < 80) ||
        s.disciplineCount >= 2;

      const level = isHighRisk ? "high" : isMediumRisk ? "medium" : "low";
      if (level === "low" && minRiskLevel !== "low") continue;

      if (level === "high") highCount++;
      else if (level === "medium") mediumCount++;
      else lowCount++;

      const interventions: any[] = [];

      if (s.averageScore < 2.5) {
        interventions.push({
          type: "academic",
          action: isHighRisk
            ? "Schedule daily remedial sessions focusing on core competencies."
            : "Provide weekly small-group tutoring in weak learning areas.",
          responsibleParty: "teacher",
          timeline: isHighRisk ? "immediate" : "this_week",
          expectedImpact: "high",
        });
      }

      if (s.attendanceRate < 80) {
        interventions.push({
          type: "attendance",
          action: "Contact parent to discuss attendance patterns and develop improvement plan.",
          responsibleParty: "teacher",
          timeline: "this_week",
          expectedImpact: "high",
        });
      }

      if (s.majorIncidents > 0) {
        interventions.push({
          type: "behavioral",
          action: "Refer to counselor for behavioral support and create behavior monitoring plan.",
          responsibleParty: "counselor",
          timeline: "immediate",
          expectedImpact: "medium",
        });
      }

      if (s.overdueFees > 0) {
        interventions.push({
          type: "financial",
          action: "Contact parent regarding overdue fees and discuss payment plan options.",
          responsibleParty: "admin",
          timeline: "this_week",
          expectedImpact: "medium",
        });
      }

      if (interventions.length === 0) {
        interventions.push({
          type: "academic",
          action: "Continue monitoring performance. Provide enrichment activities to maintain progress.",
          responsibleParty: "teacher",
          timeline: "this_term",
          expectedImpact: "low",
        });
      }

      recommendations.push({
        studentId: s.studentId,
        studentName: s.name,
        riskLevel: level as "high" | "medium" | "low",
        priority: isHighRisk ? s.averageScore * 25 + (100 - s.attendanceRate) : 50,
        interventions,
        notes: `Average score: ${s.averageScore}, Attendance: ${s.attendanceRate}%, Discipline incidents: ${s.disciplineCount}`,
      });
    }

    return {
      classId,
      className: classData?.name ?? "",
      recommendations,
      summary: {
        totalStudents: recommendations.length,
        highRiskCount: highCount,
        mediumRiskCount: mediumCount,
        lowRiskCount: lowCount,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
