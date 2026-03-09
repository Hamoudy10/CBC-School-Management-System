// features/reports/types.ts
// Type definitions for Reports & PDF Generation module

export type ReportType =
  | "student_report_card"
  | "class_report"
  | "attendance_report"
  | "finance_report"
  | "discipline_report"
  | "performance_analytics"
  | "fee_collection"
  | "defaulters_list"
  | "teacher_performance";

export type ReportFormat = "pdf" | "csv" | "json";

export type ReportStatus = "pending" | "generating" | "completed" | "failed";

export interface ReportRequest {
  id: string;
  report_type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  parameters: Record<string, unknown>;
  file_url?: string;
  error_message?: string;
  requested_by: string;
  school_id: string;
  created_at: string;
  completed_at?: string;
}

// CBC Report Card Structure
export interface CBCReportCardData {
  student: {
    student_id: string;
    admission_no: string;
    name: string;
    class_name: string;
    term: string;
    academic_year: string;
    date_of_birth?: string;
    photo_url?: string;
  };
  school: {
    name: string;
    address: string;
    logo_url?: string;
    motto?: string;
    contact_phone?: string;
    contact_email?: string;
  };
  learning_areas: Array<{
    name: string;
    strands: Array<{
      name: string;
      sub_strands: Array<{
        name: string;
        score: number;
        level: string;
        level_label: string;
      }>;
      average_score: number;
      level: string;
    }>;
    average_score: number;
    level: string;
    level_label: string;
    teacher_remarks?: string;
  }>;
  overall: {
    average_score: number;
    level: string;
    level_label: string;
    total_learning_areas: number;
    level_distribution: {
      exceeding: number;
      meeting: number;
      approaching: number;
      below: number;
    };
  };
  attendance: {
    total_days: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    attendance_rate: number;
  };
  behaviour_and_values: {
    items: Array<{
      name: string;
      rating: string;
    }>;
  };
  remarks: {
    class_teacher?: string;
    principal?: string;
    parent_feedback?: string;
  };
  dates: {
    opening_date?: string;
    closing_date?: string;
    next_term_opening?: string;
    report_generated: string;
  };
}

// Class Report Structure
export interface ClassReportData {
  class_id: string;
  class_name: string;
  term: string;
  academic_year: string;
  class_teacher: string;
  total_students: number;
  performance_summary: {
    average_score: number;
    level_distribution: {
      exceeding: number;
      meeting: number;
      approaching: number;
      below: number;
    };
  };
  learning_area_performance: Array<{
    name: string;
    average_score: number;
    level: string;
    highest_score: number;
    lowest_score: number;
  }>;
  student_rankings: Array<{
    rank: number;
    student_name: string;
    admission_no: string;
    average_score: number;
    level: string;
  }>;
  attendance_summary: {
    average_attendance_rate: number;
    below_80_percent: number;
  };
}

// Finance Report Structure
export interface FinanceReportData {
  school_name: string;
  report_period: string;
  academic_year: string;
  term: string;
  summary: {
    total_expected: number;
    total_collected: number;
    total_outstanding: number;
    collection_rate: number;
  };
  by_category: Array<{
    category: string;
    expected: number;
    collected: number;
    outstanding: number;
  }>;
  by_class: Array<{
    class_name: string;
    students: number;
    expected: number;
    collected: number;
    outstanding: number;
  }>;
  payment_methods: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  defaulters: Array<{
    student_name: string;
    admission_no: string;
    class_name: string;
    amount_due: number;
    days_overdue: number;
  }>;
}

// Attendance Report Structure
export interface AttendanceReportData {
  report_period: {
    from: string;
    to: string;
  };
  school_summary: {
    total_students: number;
    average_attendance_rate: number;
    total_school_days: number;
  };
  by_class: Array<{
    class_name: string;
    total_students: number;
    attendance_rate: number;
    at_risk_count: number;
  }>;
  at_risk_students: Array<{
    student_name: string;
    admission_no: string;
    class_name: string;
    attendance_rate: number;
    absent_days: number;
  }>;
  trends: Array<{
    week: string;
    attendance_rate: number;
  }>;
}
