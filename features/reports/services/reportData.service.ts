// features/reports/services/reportData.service.ts
// Gathers data required for all report types

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  TermReportData,
  SchoolInfo,
  StudentInfo,
  LearningAreaReport,
  ClassListData,
  FeeStatementData,
  AttendanceReportData,
} from "../types";

export class ReportDataService {
  // ── Get school info ──
  static async getSchoolInfo(schoolId: string): Promise<SchoolInfo> {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("schools")
      .select("name, address, contact_phone, contact_email, logo_url, motto")
      .eq("id", schoolId)
      .single();

    if (error || !data) throw new Error("School not found");
    return data as SchoolInfo;
  }

  // ── Get student info for reports ──
  static async getStudentInfo(
    schoolId: string,
    studentId: string,
  ): Promise<StudentInfo> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("students")
      .select(
        `
        first_name, last_name, admission_no, date_of_birth, gender,
        class:classes!students_current_class_id_fkey(name),
        parent:student_parents(
          parent:users(first_name, last_name, phone)
        )
      `,
      )
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .single();

    if (error || !data) throw new Error("Student not found");

    const parentInfo = (data.parent as any)?.[0]?.parent;

    return {
      name: `${data.first_name} ${data.last_name}`,
      admission_no: data.admission_no,
      class_name: (data.class as any)?.name || "",
      date_of_birth: data.date_of_birth,
      gender: data.gender,
      parent_name: parentInfo
        ? `${parentInfo.first_name} ${parentInfo.last_name}`
        : undefined,
      parent_phone: parentInfo?.phone,
    };
  }

  // ── Build term report card data ──
  static async buildTermReport(
    schoolId: string,
    studentId: string,
    term: string,
    academicYear: string,
    options?: {
      class_teacher_remarks?: string;
      principal_remarks?: string;
      next_term_opens?: string;
      closing_date?: string;
    },
  ): Promise<TermReportData> {
    const supabase = await createSupabaseServerClient();

    const [school, student] = await Promise.all([
      this.getSchoolInfo(schoolId),
      this.getStudentInfo(schoolId, studentId),
    ]);

    // Get all assessments for this student/term/year
    const { data: assessments, error } = await supabase
      .from("assessments")
      .select(
        `
        score,
        remarks,
        competency:competencies!inner(
          id, name,
          sub_strand:sub_strands!inner(
            id, name,
            strand:strands!inner(
              id, name,
              learning_area:learning_areas!inner(
                id, name
              )
            )
          )
        ),
        performance_level:performance_levels(name)
      `,
      )
      .eq("student_id", studentId)
      .eq("school_id", schoolId)
      .eq("term", term)
      .eq("academic_year", academicYear);

    if (error) throw new Error(error.message);

    // Build hierarchical structure
    const laMap = new Map<string, LearningAreaReport>();

    for (const assessment of assessments || []) {
      const comp = assessment.competency as any;
      const subStrand = comp.sub_strand;
      const strand = subStrand.strand;
      const la = strand.learning_area;
      const levelName = (assessment.performance_level as any)?.name || "N/A";

      // Learning area
      if (!laMap.has(la.id)) {
        laMap.set(la.id, {
          name: la.name,
          strands: [],
          overall_score: 0,
          overall_level: "",
        });
      }
      const laReport = laMap.get(la.id)!;

      // Find or create strand
      let strandReport = laReport.strands.find((s) => s.name === strand.name);
      if (!strandReport) {
        strandReport = {
          name: strand.name,
          sub_strands: [],
          average_score: 0,
          level: "",
        };
        laReport.strands.push(strandReport);
      }

      // Find or create sub-strand
      let subStrandReport = strandReport.sub_strands.find(
        (ss) => ss.name === subStrand.name,
      );
      if (!subStrandReport) {
        subStrandReport = {
          name: subStrand.name,
          competencies: [],
          average_score: 0,
          level: "",
        };
        strandReport.sub_strands.push(subStrandReport);
      }

      // Add competency
      subStrandReport.competencies.push({
        name: comp.name,
        score: assessment.score,
        level: levelName,
        remarks: assessment.remarks,
      });
    }

    // Calculate averages
    let totalScore = 0;
    let totalCompetencies = 0;
    let exceeding = 0,
      meeting = 0,
      approaching = 0,
      below = 0;

    for (const [, la] of laMap) {
      let laTotal = 0;
      let laCount = 0;

      for (const strand of la.strands) {
        let strandTotal = 0;
        let strandCount = 0;

        for (const sub of strand.sub_strands) {
          let subTotal = 0;
          for (const comp of sub.competencies) {
            subTotal += comp.score;
            totalScore += comp.score;
            totalCompetencies++;

            if (comp.score === 4) exceeding++;
            else if (comp.score === 3) meeting++;
            else if (comp.score === 2) approaching++;
            else below++;
          }
          sub.average_score =
            sub.competencies.length > 0
              ? Math.round((subTotal / sub.competencies.length) * 10) / 10
              : 0;
          sub.level = this.scoreToLevel(sub.average_score);
          strandTotal += subTotal;
          strandCount += sub.competencies.length;
        }

        strand.average_score =
          strandCount > 0
            ? Math.round((strandTotal / strandCount) * 10) / 10
            : 0;
        strand.level = this.scoreToLevel(strand.average_score);
        laTotal += strandTotal;
        laCount += strandCount;
      }

      la.overall_score =
        laCount > 0 ? Math.round((laTotal / laCount) * 10) / 10 : 0;
      la.overall_level = this.scoreToLevel(la.overall_score);
    }

    // Get attendance summary
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("status")
      .eq("student_id", studentId)
      .eq("school_id", schoolId);

    const attendance = attendanceData || [];
    const attendanceSummary = {
      total_days: attendance.length,
      present: attendance.filter((a) => a.status === "present").length,
      absent: attendance.filter((a) => a.status === "absent").length,
      late: attendance.filter((a) => a.status === "late").length,
      attendance_rate:
        attendance.length > 0
          ? Math.round(
              (attendance.filter(
                (a) => a.status === "present" || a.status === "late",
              ).length /
                attendance.length) *
                100,
            )
          : 0,
    };

    const overallAvg =
      totalCompetencies > 0 ? totalScore / totalCompetencies : 0;

    return {
      school,
      student,
      term,
      academic_year: academicYear,
      learning_areas: Array.from(laMap.values()),
      attendance_summary: attendanceSummary,
      overall_summary: {
        total_competencies: totalCompetencies,
        exceeding,
        meeting,
        approaching,
        below,
        overall_level: this.scoreToLevel(overallAvg),
      },
      class_teacher_remarks: options?.class_teacher_remarks,
      principal_remarks: options?.principal_remarks,
      next_term_opens: options?.next_term_opens,
      closing_date: options?.closing_date,
    };
  }

  // ── Build class list report data ──
  static async buildClassList(
    schoolId: string,
    classId: string,
    term: string,
    academicYear: string,
  ): Promise<ClassListData> {
    const supabase = await createSupabaseServerClient();
    const school = await this.getSchoolInfo(schoolId);

    // Get class details
    const { data: classData } = await supabase
      .from("classes")
      .select(
        `
        name,
        class_teacher:users!classes_class_teacher_id_fkey(first_name, last_name)
      `,
      )
      .eq("id", classId)
      .eq("school_id", schoolId)
      .single();

    if (!classData) throw new Error("Class not found");

    // Get students
    const { data: students } = await supabase
      .from("students")
      .select(
        `
        admission_no, first_name, last_name, gender, date_of_birth,
        parent:student_parents(
          parent:users(first_name, last_name, phone)
        )
      `,
      )
      .eq("school_id", schoolId)
      .eq("current_class_id", classId)
      .eq("status", "active")
      .order("first_name");

    const studentList = (students || []).map((s: any, idx: number) => {
      const parent = s.parent?.[0]?.parent;
      return {
        no: idx + 1,
        admission_no: s.admission_no,
        name: `${s.first_name} ${s.last_name}`,
        gender: s.gender || "N/A",
        date_of_birth: s.date_of_birth || "N/A",
        parent_name: parent
          ? `${parent.first_name} ${parent.last_name}`
          : "N/A",
        parent_phone: parent?.phone || "N/A",
      };
    });

    const teacher = classData.class_teacher as any;

    return {
      school,
      class_name: classData.name,
      term,
      academic_year: academicYear,
      class_teacher: teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : "N/A",
      students: studentList,
      total_boys: studentList.filter(
        (s) => s.gender === "male" || s.gender === "Male",
      ).length,
      total_girls: studentList.filter(
        (s) => s.gender === "female" || s.gender === "Female",
      ).length,
      total_students: studentList.length,
    };
  }

  // ── Build fee statement data ──
  static async buildFeeStatement(
    schoolId: string,
    studentId: string,
    academicYear: string,
  ): Promise<FeeStatementData> {
    const supabase = await createSupabaseServerClient();

    const [school, student] = await Promise.all([
      this.getSchoolInfo(schoolId),
      this.getStudentInfo(schoolId, studentId),
    ]);

    // Get student fees
    const { data: fees } = await supabase
      .from("student_fees")
      .select(
        `
        amount_due, status, due_date,
        fee_structure:fee_structures(name, amount)
      `,
      )
      .eq("student_id", studentId)
      .eq("school_id", schoolId);

    // Get payments
    const { data: payments } = await supabase
      .from("payments")
      .select(
        `
        amount_paid, payment_method, transaction_id, receipt_no, paid_at,
        student_fee:student_fees(
          fee_structure:fee_structures(name)
        )
      `,
      )
      .eq("school_id", schoolId)
      .eq("student_fee.student_id", studentId)
      .order("paid_at", { ascending: false });

    const feeList = (fees || []).map((f: any) => {
      const paid = (payments || [])
        .filter(
          (p: any) =>
            p.student_fee?.fee_structure?.name === f.fee_structure?.name,
        )
        .reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0);

      return {
        description: f.fee_structure?.name || "Unknown",
        amount_due: f.amount_due,
        amount_paid: paid,
        balance: f.amount_due - paid,
        status: f.status,
        due_date: f.due_date,
      };
    });

    const paymentList = (payments || []).map((p: any) => ({
      date: p.paid_at,
      receipt_no: p.receipt_no || p.transaction_id || "N/A",
      amount: p.amount_paid,
      method: p.payment_method,
    }));

    return {
      school,
      student,
      academic_year: academicYear,
      fees: feeList,
      payments: paymentList,
      total_due: feeList.reduce((s, f) => s + f.amount_due, 0),
      total_paid: feeList.reduce((s, f) => s + f.amount_paid, 0),
      total_balance: feeList.reduce((s, f) => s + f.balance, 0),
      generated_date: new Date().toISOString().split("T")[0],
    };
  }

  // ── Build attendance report data ──
  static async buildAttendanceReport(
    schoolId: string,
    classId: string,
    term: string,
    academicYear: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<AttendanceReportData> {
    const supabase = await createSupabaseServerClient();
    const school = await this.getSchoolInfo(schoolId);

    const { data: classData } = await supabase
      .from("classes")
      .select("name")
      .eq("id", classId)
      .eq("school_id", schoolId)
      .single();

    // Get students in class
    const { data: students } = await supabase
      .from("students")
      .select("id, admission_no, first_name, last_name")
      .eq("school_id", schoolId)
      .eq("current_class_id", classId)
      .eq("status", "active")
      .order("first_name");

    if (!students || students.length === 0) {
      return {
        school,
        class_name: classData?.name || "",
        period: { from: dateFrom, to: dateTo },
        term,
        academic_year: academicYear,
        students: [],
        class_average_rate: 0,
        total_school_days: 0,
        overall_attendance_rate: 0,
        report_period: { from: dateFrom, to: dateTo },
        school_summary: { total_students: 0, average_attendance_rate: 0, total_school_days: 0 },
        by_class: [],
        at_risk_students: [],
        trends: [],
      } as AttendanceReportData;
    }

    const studentIds = students.map((s) => s.id);

    const { data: records } = await supabase
      .from("attendance")
      .select("student_id, status, date")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .in("student_id", studentIds)
      .gte("date", dateFrom)
      .lte("date", dateTo);

    // Count unique dates for total school days
    const uniqueDates = new Set((records || []).map((r) => r.date));
    const totalDays = uniqueDates.size;

    // Group by student
    const studentMap = new Map<string, string[]>();
    for (const r of records || []) {
      const list = studentMap.get(r.student_id) || [];
      list.push(r.status);
      studentMap.set(r.student_id, list);
    }

    let totalRate = 0;
    const studentReports = students.map((s) => {
      const statuses = studentMap.get(s.id) || [];
      const present = statuses.filter((st) => st === "present").length;
      const absent = statuses.filter((st) => st === "absent").length;
      const late = statuses.filter((st) => st === "late").length;
      const excused = statuses.filter((st) => st === "excused").length;
      const total = statuses.length;
      const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      totalRate += rate;

      return {
        name: `${s.first_name} ${s.last_name}`,
        admission_no: s.admission_no,
        class_name: classData?.name || "",
        present,
        absent,
        late,
        total,
        attendance_rate: rate,
      };
    });

    return {
      school,
      class_name: classData?.name || "",
      period: { from: dateFrom, to: dateTo },
      term,
      academic_year: academicYear,
      students: studentReports,
      class_average_rate:
        studentReports.length > 0
          ? Math.round(totalRate / studentReports.length)
          : 0,
      total_school_days: totalDays,
      overall_attendance_rate:
        studentReports.length > 0
          ? Math.round(totalRate / studentReports.length)
          : 0,
      report_period: { from: dateFrom, to: dateTo },
      school_summary: { total_students: studentReports.length, average_attendance_rate: studentReports.length > 0 ? Math.round(totalRate / studentReports.length) : 0, total_school_days: totalDays },
      by_class: [],
      at_risk_students: studentReports.filter((s) => s.attendance_rate < 60).map((s) => ({
        student_name: s.name,
        admission_no: s.admission_no,
        class_name: s.class_name,
        attendance_rate: s.attendance_rate,
        absent_days: s.absent,
      })),
      trends: [],
    } as AttendanceReportData;
  }

  // ── Helper: score to CBC level ──
  private static scoreToLevel(score: number): string {
    if (score >= 3.5) return "Exceeding Expectation";
    if (score >= 2.5) return "Meeting Expectation";
    if (score >= 1.5) return "Approaching Expectation";
    return "Below Expectation";
  }
}
