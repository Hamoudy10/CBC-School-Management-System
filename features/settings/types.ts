// features/settings/types.ts
// Type definitions for School Settings & Configuration module

export interface SchoolProfile {
  school_id: string;
  name: string;
  type: "primary" | "secondary" | "mixed" | "academy";
  address: string;
  county: string;
  sub_county?: string;
  contact_email: string;
  contact_phone: string;
  secondary_phone?: string;
  website?: string;
  logo_url?: string;
  motto?: string;
  mission?: string;
  vision?: string;
  registration_number?: string;
  established_year?: number;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface AcademicYear {
  id: string;
  year: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  school_id: string;
  created_at: string;
  updated_at: string;
}

export interface AcademicTerm {
  id: string;
  academic_year_id: string;
  name: "Term 1" | "Term 2" | "Term 3";
  start_date: string;
  end_date: string;
  is_active: boolean;
  school_id: string;
  created_at: string;
  updated_at: string;
}

export interface ClassInfo {
  class_id: string;
  name: string;
  grade_level: number;
  stream?: string;
  capacity: number;
  class_teacher_id?: string;
  academic_year: string;
  status: "active" | "inactive";
  school_id: string;
  created_at: string;
  updated_at: string;
  // Joined
  class_teacher?: {
    first_name: string;
    last_name: string;
  };
  student_count?: number;
}

export interface GradingScale {
  id: string;
  name: string;
  min_score: number;
  max_score: number;
  level_code: string;
  level_label: string;
  description: string;
  school_id: string;
}

export interface SchoolSettings {
  school_id: string;
  settings: {
    academic: {
      grading_system: "cbc_4point" | "percentage" | "letter_grade";
      allow_teacher_report_comments: boolean;
      require_principal_approval: boolean;
      attendance_threshold_warning: number;
      attendance_threshold_critical: number;
    };
    finance: {
      currency: string;
      currency_symbol: string;
      payment_reminder_days: number[];
      allow_partial_payments: boolean;
      generate_receipts: boolean;
      overdue_penalty_enabled: boolean;
      overdue_penalty_rate?: number;
    };
    communication: {
      allow_parent_messaging: boolean;
      allow_teacher_parent_messaging: boolean;
      announcement_approval_required: boolean;
      max_message_recipients: number;
    };
    general: {
      timezone: string;
      date_format: string;
      school_days: string[];
      term_dates_visible_to_parents: boolean;
      show_student_rankings: boolean;
    };
  };
}

export interface SystemConfig {
  academic_years: AcademicYear[];
  active_year: AcademicYear | null;
  active_term: AcademicTerm | null;
  terms: AcademicTerm[];
  classes: ClassInfo[];
  school: SchoolProfile;
  settings: SchoolSettings;
}
