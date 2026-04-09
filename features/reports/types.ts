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

// ── Report Data Service Types (used by reportData.service.ts & pdfGenerator.service.ts) ──

export interface SchoolInfo {
  name: string;
  address?: string;
  contact_phone?: string;
  contact_email?: string;
  logo_url?: string;
  motto?: string;
}

export interface StudentInfo {
  name: string;
  admission_no: string;
  class_name: string;
  date_of_birth?: string;
  gender?: string;
  parent_name?: string;
  parent_phone?: string;
}

export interface LearningAreaReport {
  name: string;
  strands: Array<{
    name: string;
    sub_strands: Array<{
      name: string;
      competencies: Array<{
        name: string;
        score: number;
        level: string;
        remarks?: string | null;
      }>;
      average_score: number;
      level: string;
    }>;
    average_score: number;
    level: string;
  }>;
  overall_score: number;
  overall_level: string;
}

export interface TermReportData {
  school: SchoolInfo;
  student: StudentInfo;
  term: string;
  academic_year: string;
  learning_areas: LearningAreaReport[];
  attendance_summary: {
    total_days: number;
    present: number;
    absent: number;
    late: number;
    attendance_rate: number;
  };
  overall_summary: {
    total_competencies: number;
    exceeding: number;
    meeting: number;
    approaching: number;
    below: number;
    overall_level: string;
  };
  class_teacher_remarks?: string;
  principal_remarks?: string;
  next_term_opens?: string;
  closing_date?: string;
}

export interface ClassListData {
  school: SchoolInfo;
  class_name: string;
  term: string;
  academic_year: string;
  class_teacher: string;
  students: Array<{
    no: number;
    admission_no: string;
    name: string;
    gender: string;
    date_of_birth: string;
    parent_name: string;
    parent_phone: string;
  }>;
  total_boys: number;
  total_girls: number;
  total_students: number;
}

export interface FeeStatementData {
  school: SchoolInfo;
  student: StudentInfo;
  academic_year: string;
  fees: Array<{
    description: string;
    amount_due: number;
    amount_paid: number;
    balance: number;
    status: string;
    due_date: string;
  }>;
  payments: Array<{
    date: string;
    receipt_no: string;
    amount: number;
    method: string;
  }>;
  total_due: number;
  total_paid: number;
  total_balance: number;
  generated_date: string;
}

export interface AttendanceReportData {
  school: SchoolInfo;
  class_name?: string;
  term: string;
  academic_year: string;
  period: { from: string; to: string };
  students: Array<{
    admission_no: string;
    name: string;
    class_name: string;
    present: number;
    absent: number;
    late: number;
    total: number;
    attendance_rate: number;
  }>;
  total_school_days: number;
  class_average_rate: number;
  overall_attendance_rate: number;
}

// ── Original Report Types ──

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
