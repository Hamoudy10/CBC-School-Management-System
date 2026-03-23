export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  term_id: string;
  date: string;
  status: AttendanceStatus | null;
  reason: string | null;
  arrival_time?: string | null;
  recorded_by: string;
  school_id: string;
  created_at: string;
  updated_at: string;
  student?: {
    student_id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    photo_url?: string | null;
  } | null;
  class?: {
    class_id: string;
    name: string;
    stream?: string | null;
  } | null;
  recorder?: {
    user_id: string;
    first_name: string;
    last_name: string;
  } | null;
  term?: {
    term_id: string;
    name: string;
    academic_year_id: string;
  } | null;
}

export interface AttendanceFilters {
  student_id?: string;
  class_id?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  status?: AttendanceStatus;
  term_id?: string;
  term?: string;
  academic_year_id?: string;
  academic_year?: string;
}

export interface BulkAttendanceEntry {
  class_id: string;
  date: string;
  term_id?: string | null;
  entries: Array<{
    student_id: string;
    status: AttendanceStatus;
    reason?: string | null;
    arrival_time?: string | null;
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

export interface SchoolClassAttendanceSummary {
  classId: string;
  className: string;
  gradeName: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number;
  recorded: boolean;
}

export interface DailySchoolAttendance {
  date: string;
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
  classes: SchoolClassAttendanceSummary[];
}
