import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { StudentClusterResult, StudentCluster } from "../types";

const clusterSchema = z.object({
  clusters: z.array(
    z.object({
      clusterId: z.number(),
      label: z.string(),
      description: z.string(),
      studentIds: z.array(z.string()),
      commonTraits: z.array(
        z.object({ trait: z.string(), value: z.union([z.string(), z.number()]) })
      ),
      recommendedIntervention: z.string(),
    })
  ),
});

export async function generateStudentClusters(
  classId: string,
  clusterCount: number,
  schoolId: string,
  termId?: string,
  academicYearId?: string
): Promise<StudentClusterResult> {
  const supabase = await createSupabaseServerClient();

  const { data: classData } = await supabase
    .from("classes")
    .select("name")
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .single();

  const { data: students } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, users!inner(first_name, last_name)")
    .eq("current_class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (!students || students.length === 0) {
    throw new Error("No active students found");
  }

  const studentProfiles: any[] = [];

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
      .select("status")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId);

    const { data: discipline } = await supabase
      .from("disciplinary_records")
      .select("severity")
      .eq("student_id", student.student_id)
      .eq("school_id", schoolId);

    const scores = (aggregates || []).map((a: any) => a.average_score);
    const avgScore = scores.length > 0
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
      : 0;
    const presentCount = (attendance || []).filter(
      (a: any) => a.status === "present" || a.status === "late"
    ).length;
    const totalAttendance = (attendance || []).length;
    const attendanceRate = totalAttendance > 0 ? presentCount / totalAttendance : 1;
    const disciplineCount = (discipline || []).length;
    const majorIncidents = (discipline || []).filter(
      (d: any) => d.severity === "high" || d.severity === "severe"
    ).length;

    const usersArr = student.users as { first_name?: string; last_name?: string }[] | undefined;
    const studentName =
      `${usersArr?.[0]?.first_name ?? student.first_name} ${usersArr?.[0]?.last_name ?? student.last_name}`.trim();

    studentProfiles.push({
      studentId: student.student_id,
      name: studentName,
      averageScore: Math.round(avgScore * 100) / 100,
      attendanceRate: Math.round(attendanceRate * 100),
      disciplineCount,
      majorIncidents,
      assessmentCount: (aggregates || []).length,
    });
  }

  try {
    const ai = await generateGroqCompletion<z.infer<typeof clusterSchema>>({
      system: `You are an educational data analyst for Kenyan CBC schools.
Group students into ${clusterCount} distinct clusters based on their academic and behavioral profiles.
Each cluster should have a meaningful label and description.
Return JSON only.`,
      prompt: `Group these ${studentProfiles.length} students into ${clusterCount} clusters:

${JSON.stringify(studentProfiles, null, 2)}

For each cluster provide:
- label: short descriptive name (e.g., "High Achievers", "At Risk", "Needs Support")
- description: 1-2 sentence explanation
- studentIds: array of student IDs in this cluster
- commonTraits: shared characteristics
- recommendedIntervention: what approach works best

Rules:
- Each student must appear in exactly one cluster
- Clusters should be meaningfully different
- Base grouping on score patterns, attendance, and discipline holistically
- Consider CBC-specific factors`,
      responseFormat: "json",
      temperature: 0.3,
      responseSchema: clusterSchema,
      requestLabel: "predictive-analytics.student-clusters",
      cache: { schoolId, classId, ttlSeconds: 7200 },
    });

    const parsed = clusterSchema.parse(ai.data);

    const clusters: StudentCluster[] = parsed.clusters.map((c: any) => ({
      clusterId: c.clusterId,
      label: c.label,
      description: c.description,
      studentCount: c.studentIds.length,
      students: c.studentIds
        .map((sid: string) => {
          const profile = studentProfiles.find((p) => p.studentId === sid);
          return profile
            ? { studentId: sid, name: profile.name, averageScore: profile.averageScore }
            : null;
        })
        .filter(Boolean),
      commonTraits: c.commonTraits,
      recommendedIntervention: c.recommendedIntervention,
    }));

    return {
      classId,
      className: classData?.name ?? "",
      clusters,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.warn("AI clustering failed, using deterministic fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const highPerformers = studentProfiles.filter((p) => p.averageScore >= 3.0);
    const moderatePerformers = studentProfiles.filter(
      (p) => p.averageScore >= 2.0 && p.averageScore < 3.0
    );
    const atRisk = studentProfiles.filter((p) => p.averageScore < 2.0);
    const attendanceConcerns = studentProfiles.filter(
      (p) => p.attendanceRate < 80 && p.averageScore >= 2.0
    );

    const clusters: StudentCluster[] = [];

    if (highPerformers.length > 0) {
      clusters.push({
        clusterId: 1,
        label: "High Achievers",
        description: "Students consistently performing at Meeting or Exceeding levels.",
        studentCount: highPerformers.length,
        students: highPerformers.map((p) => ({
          studentId: p.studentId,
          name: p.name,
          averageScore: p.averageScore,
        })),
        commonTraits: [
          { trait: "Average Score", value: "3.0+" },
          { trait: "Attendance", value: `${Math.round(studentProfiles.find((s) => s.studentId === highPerformers[0]?.studentId)?.attendanceRate ?? 90)}%` },
        ],
        recommendedIntervention: "Enrichment activities and advanced competency development.",
      });
    }

    if (moderatePerformers.length > 0) {
      clusters.push({
        clusterId: 2,
        label: "On Track",
        description: "Students performing at Approaching to Meeting levels with consistent attendance.",
        studentCount: moderatePerformers.length,
        students: moderatePerformers.map((p) => ({
          studentId: p.studentId,
          name: p.name,
          averageScore: p.averageScore,
        })),
        commonTraits: [{ trait: "Average Score", value: "2.0-2.9" }],
        recommendedIntervention: "Targeted support in weaker competencies to reach Meeting level.",
      });
    }

    if (atRisk.length > 0) {
      clusters.push({
        clusterId: 3,
        label: "At Risk",
        description: "Students with low academic performance requiring intervention.",
        studentCount: atRisk.length,
        students: atRisk.map((p) => ({
          studentId: p.studentId,
          name: p.name,
          averageScore: p.averageScore,
        })),
        commonTraits: [{ trait: "Average Score", value: "< 2.0" }],
        recommendedIntervention: "Immediate academic support, individualized learning plans, parent engagement.",
      });
    }

    if (attendanceConcerns.length > 0) {
      clusters.push({
        clusterId: 4,
        label: "Attendance Risk",
        description: "Students with satisfactory scores but low attendance affecting consistency.",
        studentCount: attendanceConcerns.length,
        students: attendanceConcerns.map((p) => ({
          studentId: p.studentId,
          name: p.name,
          averageScore: p.averageScore,
        })),
        commonTraits: [{ trait: "Attendance", value: "< 80%" }],
        recommendedIntervention: "Attendance monitoring, parent outreach, identify barriers to attendance.",
      });
    }

    return {
      classId,
      className: classData?.name ?? "",
      clusters,
      generatedAt: new Date().toISOString(),
    };
  }
}
