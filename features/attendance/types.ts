// features/attendance/types.ts
// Type definitions for Attendance module

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  remarks: string | null;
  term: string;
  academic_year: string;
  recorded_by: string;
  school_id: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  student?: {
    student_id: string;
    admission_no: string;
    user: {
      first_name: string;
      last_name: string;
    };
  };
  recorder?: {
    first_name: string;
    last_name: string;
  };
}

export interface AttendanceFilters {
  student_id?: string;
  class_id?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  status?: AttendanceStatus;
  term?: string;
  academic_year?: string;
}

export interface BulkAttendanceEntry {
  class_id: string;
  date: string;
  term: string;
  academic_year: string;
  entries: Array<{
    student_id: string;
    status: AttendanceStatus;
    remarks?: string;
  }>;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
}

export interface StudentAttendanceSummary {
  student_id: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  late_days: number;
  excused_days: number;
  attendance_rate: number;
  monthly_breakdown: Array<{
    month: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    attendance_rate: number;
  }>;
  consecutive_absences: Array<{
    start_date: string;
    end_date: string;
    days: number;
  }>;
}

export interface ClassAttendanceSummary {
  class_id: string;
  date_from: string;
  date_to: string;
  total_students: number;
  school_days: number;
  overall_stats: AttendanceStats;
  daily_breakdown: DailyAttendanceReport[];
  student_summaries: Array<{
    student_id: string;
    total_days: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    attendance_rate: number;
  }>;
  at_risk_students: Array<{
    student_id: string;
    attendance_rate: number;
  }>;
}

export interface DailyAttendanceReport {
  date: string;
  total_students: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_rate: number;
}
