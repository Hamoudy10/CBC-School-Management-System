import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { WeeklySummaryResult, WeeklySummary } from "../types";

const summaryOutputSchema = z.object({
  academicHighlights: z.array(
    z.object({
      learningArea: z.string(),
      performance: z.string(),
      teacherComment: z.string(),
    })
  ),
  behaviorNotes: z.array(z.string()),
  upcomingEvents: z.array(z.string()),
  teacherMessage: z.string(),
  parentTips: z.array(z.string()),
});

export async function generateWeeklySummary(
  studentId: string,
  language: string,
  schoolId: string,
  termId?: string,
  academicYearId?: string
): Promise<WeeklySummaryResult> {
  const supabase = await createSupabaseServerClient();

  const { data: student } = await supabase
    .from("students")
    .select("*, users!inner(first_name, last_name), classes!inner(name)")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .single();

  if (!student) throw new Error("Student not found");

  const studentName =
    `${student.users?.first_name ?? ""} ${student.users?.last_name ?? ""}`.trim();
  const className = (student.classes as any)?.name ?? "";

  const { data: aggregates } = await supabase
    .from("assessment_aggregates")
    .select("*, learning_areas!inner(name)")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .order("computed_at", { ascending: false })
    .limit(15);

  const { data: attendance } = await supabase
    .from("attendance")
    .select("status, date")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .order("date", { ascending: false })
    .limit(30);

  const { data: discipline } = await supabase
    .from("disciplinary_records")
    .select("incident_type, description, created_at")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: messages } = await supabase
    .from("messages")
    .select("body, created_at")
    .or(`sender_id.eq.${student.user_id},and(sender_id.eq.${studentId})`)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(10);

  const presentCount = (attendance || []).filter(
    (a: any) => a.status === "present"
  ).length;
  const absentCount = (attendance || []).filter(
    (a: any) => a.status === "absent"
  ).length;
  const lateCount = (attendance || []).filter(
    (a: any) => a.status === "late"
  ).length;
  const attendanceRate =
    (attendance || []).length > 0
      ? Math.round(
          (presentCount / (attendance || []).length) * 100
        )
      : 100;

  const academicData = (aggregates || []).map((a: any) => ({
    area: a.learning_areas?.name ?? "Unknown",
    score: a.average_score,
    level:
      a.average_score >= 3.5
        ? "Exceeding"
        : a.average_score >= 2.5
        ? "Meeting"
        : a.average_score >= 1.5
        ? "Approaching"
        : "Below Expectation",
  }));

  const recentMessages =
    messages?.slice(0, 5).map((m: any) => m.body).join("\n") || "";

  try {
    const ai = await generateGroqCompletion<z.infer<typeof summaryOutputSchema>>({
      system: `You are a parent engagement assistant for Kenyan CBC schools.
Generate a warm, informative weekly summary for parents about their child's progress.
Use plain, parent-friendly language. Avoid educational jargon.
${language === "sw" ? "Respond in Swahili." : language === "code-mix" ? "Mix English and Swahili naturally." : "Respond in English."}
Return JSON only.`,
      prompt: `Generate a weekly progress summary for ${studentName} (Class: ${className})

Academic Performance (CBC scale 1-4, 4=highest):
${JSON.stringify(academicData, null, 2)}

Attendance: ${presentCount} present, ${absentCount} absent, ${lateCount} late (${attendanceRate}% rate)

Recent discipline records:
${JSON.stringify(discipline?.slice(0, 3), null, 2)}

Recent communications:
${recentMessages.slice(0, 300)}

Generate:
1. academicHighlights: per learning area with performance summary and encouraging comment
2. behaviorNotes: observations (positive first)
3. upcomingEvents: suggest typical school events
4. teacherMessage: warm personal message from teacher
5. parentTips: 2-3 practical tips for supporting learning at home

Rules:
- Be encouraging and constructive
- If there are concerns, phrase them positively with suggestions
- Keep the teacherMessage warm and personal
- Make parentTips actionable and specific`,
      responseFormat: "json",
      temperature: 0.3,
      responseSchema: summaryOutputSchema,
      requestLabel: "parent-engagement.weekly-summary",
      cache: { schoolId, ttlSeconds: 1800 },
    });

    const parsed = summaryOutputSchema.parse(ai.data);

    const summary: WeeklySummary = {
      studentName,
      className,
      term: termId || "Current Term",
      weekLabel: "This Week",
      academicHighlights: parsed.academicHighlights,
      attendanceSummary: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        rate: attendanceRate,
      },
      behaviorNotes: parsed.behaviorNotes,
      upcomingEvents: parsed.upcomingEvents,
      teacherMessage: parsed.teacherMessage,
      parentTips: parsed.parentTips,
      generatedAt: new Date().toISOString(),
    };

    return {
      summary,
      confidence: ai.confidence,
      warnings: ai.warnings || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("AI weekly summary failed, using template fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const summary: WeeklySummary = {
      studentName,
      className,
      term: termId || "Current Term",
      weekLabel: "This Week",
      academicHighlights: academicData.map((a: any) => ({
        learningArea: a.area,
        performance: a.level,
        teacherComment: `${studentName} is performing at ${a.level} level in ${a.area}. Keep up the good work!`,
      })),
      attendanceSummary: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        rate: attendanceRate,
      },
      behaviorNotes:
        discipline && discipline.length > 0
          ? ["Please discuss recent behavioral incidents with your child."]
          : ["No behavioral concerns this period."],
      upcomingEvents: [
        "Parent-teacher conference coming up",
        "End of term assessments approaching",
      ],
      teacherMessage: `Dear Parent/Guardian of ${studentName}, we hope this message finds you well. Your child has been working hard this term. We encourage you to continue supporting their learning at home. Please feel free to reach out if you have any questions.`,
      parentTips: [
        "Encourage daily reading for at least 20 minutes",
        "Discuss what your child learned in school each day",
        "Ensure homework is completed in a quiet environment",
      ],
      generatedAt: new Date().toISOString(),
    };

    return {
      summary,
      confidence: 0.7,
      warnings: ["Used template-based summary (AI generation was unavailable)"],
      generatedAt: new Date().toISOString(),
    };
  }
}
