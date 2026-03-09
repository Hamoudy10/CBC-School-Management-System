// features/reports/services/reportCard.generator.ts
// CBC Report Card data assembler (collects all data for PDF generation)

import { createClient } from "@/lib/supabase/client";
import type { CBCReportCardData } from "../types";

const supabase = createClient();

export async function assembleReportCardData(
  studentId: string,
  term: string,
  academicYear: string,
  schoolId: string,
): Promise<{ success: boolean; data?: CBCReportCardData; message?: string }> {
  // 1. Fetch student info
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select(
      `
      student_id,
      admission_no,
      user:users(first_name, last_name, dob),
      user_profile:user_profiles(photo_url),
      current_class:classes(name)
    `,
    )
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .single();

  if (studentErr || !student) {
    return { success: false, message: "Student not found" };
  }

  // 2. Fetch school info
  const { data: school, error: schoolErr } = await supabase
    .from("schools")
    .select("name, address, contact_phone, contact_email, logo_url, motto")
    .eq("school_id", schoolId)
    .single();

  if (schoolErr || !school) {
    return { success: false, message: "School not found" };
  }

  // 3. Fetch assessments for this student, term, year
  const { data: assessments, error: assessErr } = await supabase
    .from("assessments")
    .select(
      `
      score,
      remarks,
      competency:competencies(
        competency_id,
        name,
        sub_strand:sub_strands(
          sub_strand_id,
          name,
          strand:strands(
            strand_id,
            name,
            learning_area:learning_areas(
              learning_area_id,
              name
            )
          )
        )
      ),
      performance_level:performance_levels(name, description)
    `,
    )
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .eq("school_id", schoolId);

  if (assessErr) {
    return {
      success: false,
      message: `Assessment fetch error: ${assessErr.message}`,
    };
  }

  // 4. Build CBC hierarchy from assessments
  const learningAreaMap = new Map<
    string,
    {
      name: string;
      strands: Map<
        string,
        {
          name: string;
          subStrands: Map<
            string,
            {
              name: string;
              scores: number[];
              levels: string[];
            }
          >;
        }
      >;
    }
  >();

  (assessments || []).forEach((a: any) => {
    const comp = a.competency;
    if (!comp?.sub_strand?.strand?.learning_area) return;

    const la = comp.sub_strand.strand.learning_area;
    const strand = comp.sub_strand.strand;
    const subStrand = comp.sub_strand;

    if (!learningAreaMap.has(la.learning_area_id)) {
      learningAreaMap.set(la.learning_area_id, {
        name: la.name,
        strands: new Map(),
      });
    }

    const laEntry = learningAreaMap.get(la.learning_area_id)!;

    if (!laEntry.strands.has(strand.strand_id)) {
      laEntry.strands.set(strand.strand_id, {
        name: strand.name,
        subStrands: new Map(),
      });
    }

    const strandEntry = laEntry.strands.get(strand.strand_id)!;

    if (!strandEntry.subStrands.has(subStrand.sub_strand_id)) {
      strandEntry.subStrands.set(subStrand.sub_strand_id, {
        name: subStrand.name,
        scores: [],
        levels: [],
      });
    }

    const ssEntry = strandEntry.subStrands.get(subStrand.sub_strand_id)!;
    ssEntry.scores.push(a.score);
    ssEntry.levels.push(a.performance_level?.name || "");
  });

  // Convert to report structure
  const scoreToLevel = (score: number): { level: string; label: string } => {
    if (score >= 3.5) return { level: "EE", label: "Exceeding Expectation" };
    if (score >= 2.5) return { level: "ME", label: "Meeting Expectation" };
    if (score >= 1.5) return { level: "AE", label: "Approaching Expectation" };
    return { level: "BE", label: "Below Expectation" };
  };

  const avg = (nums: number[]): number =>
    nums.length > 0
      ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100
      : 0;

  let allScores: number[] = [];
  const levelCounts = { exceeding: 0, meeting: 0, approaching: 0, below: 0 };

  const learningAreas = Array.from(learningAreaMap.values()).map((la) => {
    const laScores: number[] = [];

    const strands = Array.from(la.strands.values()).map((strand) => {
      const strandScores: number[] = [];

      const subStrands = Array.from(strand.subStrands.values()).map((ss) => {
        const ssAvg = avg(ss.scores);
        strandScores.push(...ss.scores);
        const ssLevel = scoreToLevel(ssAvg);

        return {
          name: ss.name,
          score: ssAvg,
          level: ssLevel.level,
          level_label: ssLevel.label,
        };
      });

      const strandAvg = avg(strandScores);
      laScores.push(...strandScores);

      return {
        name: strand.name,
        sub_strands: subStrands,
        average_score: strandAvg,
        level: scoreToLevel(strandAvg).level,
      };
    });

    const laAvg = avg(laScores);
    allScores.push(...laScores);
    const laLevel = scoreToLevel(laAvg);

    // Count levels for this LA
    if (laAvg >= 3.5) levelCounts.exceeding++;
    else if (laAvg >= 2.5) levelCounts.meeting++;
    else if (laAvg >= 1.5) levelCounts.approaching++;
    else levelCounts.below++;

    return {
      name: la.name,
      strands,
      average_score: laAvg,
      level: laLevel.level,
      level_label: laLevel.label,
    };
  });

  // 5. Fetch attendance
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .eq("term", term)
    .eq("academic_year", academicYear);

  const att = attendanceRecords || [];
  const totalDays = att.length;
  const presentDays = (att as any[]).filter((a) => a.status === "present").length;
  const absentDays = (att as any[]).filter((a) => a.status === "absent").length;
  const lateDays = (att as any[]).filter((a) => a.status === "late").length;

  // 6. Build final report card data
  const overallAvg = avg(allScores);
  const overallLevel = scoreToLevel(overallAvg);

  const studentUser = (student as any).user as any;
  const studentProfile = (student as any).user_profile as any;
  const currentClass = (student as any).current_class as any;

  const reportData: CBCReportCardData = {
    student: {
      student_id: (student as any).student_id,
      admission_no: (student as any).admission_no,
      name: `${studentUser.first_name} ${studentUser.last_name}`,
      class_name: currentClass?.name || "",
      term,
      academic_year: academicYear,
      date_of_birth: studentUser.dob || undefined,
      photo_url: studentProfile?.photo_url || undefined,
    },
    school: {
      name: (school as any).name,
      address: (school as any).address || "",
      logo_url: (school as any).logo_url || undefined,
      motto: (school as any).motto || undefined,
      contact_phone: (school as any).contact_phone || undefined,
      contact_email: (school as any).contact_email || undefined,
    },
    learning_areas: learningAreas,
    overall: {
      average_score: overallAvg,
      level: overallLevel.level,
      level_label: overallLevel.label,
      total_learning_areas: learningAreas.length,
      level_distribution: levelCounts,
    },
    attendance: {
      total_days: totalDays,
      present_days: presentDays,
      absent_days: absentDays,
      late_days: lateDays,
      attendance_rate:
        totalDays > 0
          ? Math.round(((presentDays + lateDays) / totalDays) * 100 * 10) / 10
          : 0,
    },
    behaviour_and_values: {
      items: [], // Populated from separate behaviour assessment if exists
    },
    remarks: {
      class_teacher: undefined,
      principal: undefined,
      parent_feedback: undefined,
    },
    dates: {
      report_generated: new Date().toISOString(),
    },
  };

  return { success: true, data: reportData };
}

export async function assembleClassReportData(
  classId: string,
  term: string,
  academicYear: string,
  schoolId: string,
): Promise<{ success: boolean; data?: any; message?: string }> {
  // Get all students in class
  const { data: students, error: studentsErr } = await supabase
    .from("student_classes")
    .select(
      `
      student_id,
      student:students(
        student_id,
        admission_no,
        user:users(first_name, last_name)
      )
    `,
    )
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (studentsErr) {
    return { success: false, message: studentsErr.message };
  }

  const studentList = students || [];
  const studentReports: Array<{
    student_id: string;
    name: string;
    admission_no: string;
    average_score: number;
  }> = [];

  // Get assessments for all students
  for (const sc of studentList) {
    const st = (sc as any).student as any;
    const user = st?.user as any;

    const { data: assessments } = await supabase
      .from("assessments")
      .select("score")
      .eq("student_id", (sc as any).student_id)
      .eq("term", term)
      .eq("academic_year", academicYear)
      .eq("school_id", schoolId);

    const scores = (assessments || []).map((a: any) => a.score);
    const avgScore =
      scores.length > 0
        ? Math.round(
            (scores.reduce((s, n) => s + n, 0) / scores.length) * 100,
          ) / 100
        : 0;

    studentReports.push({
      student_id: (sc as any).student_id,
      name: user ? `${user.first_name} ${user.last_name}` : "Unknown",
      admission_no: st?.admission_no || "",
      average_score: avgScore,
    });
  }

  // Sort by average score descending
  studentReports.sort((a, b) => b.average_score - a.average_score);

  // Add rankings
  const rankings = studentReports.map((s, idx) => ({
    rank: idx + 1,
    student_name: s.name,
    admission_no: s.admission_no,
    average_score: s.average_score,
    level:
      s.average_score >= 3.5
        ? "EE"
        : s.average_score >= 2.5
          ? "ME"
          : s.average_score >= 1.5
            ? "AE"
            : "BE",
  }));

  // Overall class average
  const allAvgs = studentReports
    .map((s) => s.average_score)
    .filter((s) => s > 0);
  const classAvg =
    allAvgs.length > 0
      ? Math.round(
          (allAvgs.reduce((s, n) => s + n, 0) / allAvgs.length) * 100,
        ) / 100
      : 0;

  // Level distribution
  const distribution = {
    exceeding: allAvgs.filter((a) => a >= 3.5).length,
    meeting: allAvgs.filter((a) => a >= 2.5 && a < 3.5).length,
    approaching: allAvgs.filter((a) => a >= 1.5 && a < 2.5).length,
    below: allAvgs.filter((a) => a < 1.5).length,
  };

  // Get class info
  const { data: classInfo } = await supabase
    .from("classes")
    .select("name")
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .single();

  return {
    success: true,
    data: {
      class_id: classId,
      class_name: (classInfo as any)?.name || "",
      term,
      academic_year: academicYear,
      total_students: studentList.length,
      performance_summary: {
        average_score: classAvg,
        level_distribution: distribution,
      },
      student_rankings: rankings,
    },
  };
}
