// features/reports/index.ts
// Barrel export for reports module

import { z } from "zod";
import {
  createReportRequest,
  getReportRequests,
  generateStudentReportCard,
  generateClassReport,
  generateClassReportCards,
} from "./services/reports.service";

export * from "./types";
export * from "./validators/report.schema";
export * from "./services/reports.service";
export * from "./services/reportCard.generator";
export * from "./services/pdf.service";

export const termReportRequestSchema = z.object({
  student_id: z.string().uuid(),
  term: z.enum(["Term 1", "Term 2", "Term 3"]),
  academic_year: z.string().regex(/^\d{4}$/),
  class_teacher_remarks: z.string().max(2000).optional(),
  principal_remarks: z.string().max(2000).optional(),
  next_term_opens: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  closing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ReportsService = {
  async generateTermReport(
    schoolId: string,
    studentId: string,
    term: string,
    academicYear: string,
    requestedBy: string,
    _meta?: Record<string, unknown>,
  ) {
    return generateStudentReportCard(
      studentId,
      term,
      academicYear,
      schoolId,
      requestedBy,
    );
  },
  async listReports(schoolId: string, params: any) {
    const result = await getReportRequests(
      schoolId,
      {
        report_type: params?.report_type,
        status: params?.status,
      },
      params?.page ?? 1,
      params?.page_size ?? params?.pageSize ?? 20,
    );

    return {
      data: result.data ?? [],
      total: result.total ?? 0,
      success: result.success,
      message: result.message,
    };
  },
  async generateClassList(
    schoolId: string,
    classId: string,
    term: string,
    academicYear: string,
  ) {
    const request = await createReportRequest(
      "class_report",
      { class_id: classId, term, academic_year: academicYear, subtype: "class_list" },
      "system",
      schoolId,
      "pdf",
    );

    return {
      success: request.success,
      message: request.message,
      request_id: request.id,
    };
  },
  async generateAttendanceReport(
    schoolId: string,
    classId: string,
    term: string,
    academicYear: string,
    dateFrom: string,
    dateTo: string,
  ) {
    const request = await createReportRequest(
      "attendance_report",
      {
        class_id: classId,
        term,
        academic_year: academicYear,
        date_from: dateFrom,
        date_to: dateTo,
      },
      "system",
      schoolId,
      "pdf",
    );

    return {
      success: request.success,
      message: request.message,
      request_id: request.id,
    };
  },
  async generateFeeStatement(
    schoolId: string,
    studentId: string,
    academicYear: string,
  ) {
    const request = await createReportRequest(
      "fee_collection",
      { student_id: studentId, academic_year: academicYear, subtype: "fee_statement" },
      "system",
      schoolId,
      "pdf",
    );

    return {
      success: request.success,
      message: request.message,
      request_id: request.id,
    };
  },
  async generateClassReportCards(
    schoolId: string,
    classId: string,
    term: string,
    academicYear: string,
    requestedBy: string,
  ) {
    return generateClassReportCards(
      classId,
      term,
      academicYear,
      schoolId,
      requestedBy,
    );
  },
  async generateClassReport(
    schoolId: string,
    classId: string,
    term: string,
    academicYear: string,
  ) {
    return generateClassReport(classId, term, academicYear, schoolId);
  },
};
