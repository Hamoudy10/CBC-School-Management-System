// types/database.types.ts
// ============================================================
// Supabase Database Types
// Auto-generated via: npm run db:generate-types
// Manual placeholder until connected to actual Supabase project
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      academic_years: {
        Row: {
          academic_year_id: string;
          school_id: string;
          year: string;
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          academic_year_id?: string;
          school_id: string;
          year: string;
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          academic_year_id?: string;
          school_id?: string;
          year?: string;
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      assessments: {
        Row: {
          assessment_id: string;
          school_id: string;
          student_id: string;
          competency_id: string;
          learning_area_id: string;
          class_id: string;
          academic_year_id: string;
          term_id: string;
          score: number;
          level_id: string;
          remarks: string | null;
          assessment_date: string;
          assessed_by: string;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assessment_id?: string;
          school_id: string;
          student_id: string;
          competency_id: string;
          learning_area_id: string;
          class_id: string;
          academic_year_id: string;
          term_id: string;
          score: number;
          level_id: string;
          remarks?: string | null;
          assessment_date?: string;
          assessed_by: string;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assessment_id?: string;
          school_id?: string;
          student_id?: string;
          competency_id?: string;
          learning_area_id?: string;
          class_id?: string;
          academic_year_id?: string;
          term_id?: string;
          score?: number;
          level_id?: string;
          remarks?: string | null;
          assessment_date?: string;
          assessed_by?: string;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      attendance: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          class_id: string;
          term_id: string;
          date: string;
          status: "present" | "absent" | "late" | "excused";
          reason: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          class_id: string;
          term_id: string;
          date: string;
          status?: "present" | "absent" | "late" | "excused";
          reason?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          class_id?: string;
          term_id?: string;
          date?: string;
          status?: "present" | "absent" | "late" | "excused";
          reason?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          class_id: string;
          school_id: string;
          grade_id: string;
          name: string;
          stream: string | null;
          capacity: number | null;
          class_teacher_id: string | null;
          academic_year_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          class_id?: string;
          school_id: string;
          grade_id: string;
          name: string;
          stream?: string | null;
          capacity?: number | null;
          class_teacher_id?: string | null;
          academic_year_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          school_id?: string;
          grade_id?: string;
          name?: string;
          stream?: string | null;
          capacity?: number | null;
          class_teacher_id?: string | null;
          academic_year_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      competencies: {
        Row: {
          competency_id: string;
          school_id: string;
          sub_strand_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          competency_id?: string;
          school_id: string;
          sub_strand_id: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          competency_id?: string;
          school_id?: string;
          sub_strand_id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      fee_structures: {
        Row: {
          id: string;
          school_id: string;
          name: string;
          description: string | null;
          amount: number;
          academic_year_id: string;
          term_id: string | null;
          grade_id: string | null;
          is_mandatory: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          name: string;
          description?: string | null;
          amount: number;
          academic_year_id: string;
          term_id?: string | null;
          grade_id?: string | null;
          is_mandatory?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          name?: string;
          description?: string | null;
          amount?: number;
          academic_year_id?: string;
          term_id?: string | null;
          grade_id?: string | null;
          is_mandatory?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      grades: {
        Row: {
          grade_id: string;
          school_id: string;
          name: string;
          level_order: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          grade_id?: string;
          school_id: string;
          name: string;
          level_order: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          grade_id?: string;
          school_id?: string;
          name?: string;
          level_order?: number;
          description?: string | null;
          created_at?: string;
        };
      };
      learning_areas: {
        Row: {
          learning_area_id: string;
          school_id: string;
          name: string;
          description: string | null;
          is_core: boolean;
          applicable_grades: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          learning_area_id?: string;
          school_id: string;
          name: string;
          description?: string | null;
          is_core?: boolean;
          applicable_grades?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          learning_area_id?: string;
          school_id?: string;
          name?: string;
          description?: string | null;
          is_core?: boolean;
          applicable_grades?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          school_id: string;
          sender_id: string;
          receiver_id: string;
          subject: string;
          body: string;
          read_status: "unread" | "read";
          read_at: string | null;
          is_archived: boolean;
          parent_message_id: string | null;
          sent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          sender_id: string;
          receiver_id: string;
          subject: string;
          body: string;
          read_status?: "unread" | "read";
          read_at?: string | null;
          is_archived?: boolean;
          parent_message_id?: string | null;
          sent_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          sender_id?: string;
          receiver_id?: string;
          subject?: string;
          body?: string;
          read_status?: "unread" | "read";
          read_at?: string | null;
          is_archived?: boolean;
          parent_message_id?: string | null;
          sent_at?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          title: string;
          body: string;
          type: "info" | "warning" | "alert" | "success" | "system";
          read_status: "unread" | "read";
          read_at: string | null;
          action_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          title: string;
          body: string;
          type?: "info" | "warning" | "alert" | "success" | "system";
          read_status?: "unread" | "read";
          read_at?: string | null;
          action_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          type?: "info" | "warning" | "alert" | "success" | "system";
          read_status?: "unread" | "read";
          read_at?: string | null;
          action_url?: string | null;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          school_id: string;
          student_fee_id: string;
          amount_paid: number;
          payment_method:
            | "cash"
            | "bank_transfer"
            | "mpesa"
            | "cheque"
            | "other";
          transaction_id: string | null;
          receipt_number: string | null;
          payment_date: string;
          notes: string | null;
          recorded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_fee_id: string;
          amount_paid: number;
          payment_method:
            | "cash"
            | "bank_transfer"
            | "mpesa"
            | "cheque"
            | "other";
          transaction_id?: string | null;
          receipt_number?: string | null;
          payment_date?: string;
          notes?: string | null;
          recorded_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_fee_id?: string;
          amount_paid?: number;
          payment_method?:
            | "cash"
            | "bank_transfer"
            | "mpesa"
            | "cheque"
            | "other";
          transaction_id?: string | null;
          receipt_number?: string | null;
          payment_date?: string;
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
        };
      };
      performance_levels: {
        Row: {
          level_id: string;
          school_id: string;
          name: string;
          label: "below_expectation" | "approaching" | "meeting" | "exceeding";
          numeric_value: number;
          description: string | null;
          created_at: string;
        };
        Insert: {
          level_id?: string;
          school_id: string;
          name: string;
          label: "below_expectation" | "approaching" | "meeting" | "exceeding";
          numeric_value: number;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          level_id?: string;
          school_id?: string;
          name?: string;
          label?: "below_expectation" | "approaching" | "meeting" | "exceeding";
          numeric_value?: number;
          description?: string | null;
          created_at?: string;
        };
      };
      roles: {
        Row: {
          role_id: string;
          name: string;
          description: string | null;
          is_system_role: boolean;
          created_at: string;
        };
        Insert: {
          role_id?: string;
          name: string;
          description?: string | null;
          is_system_role?: boolean;
          created_at?: string;
        };
        Update: {
          role_id?: string;
          name?: string;
          description?: string | null;
          is_system_role?: boolean;
          created_at?: string;
        };
      };
      schools: {
        Row: {
          school_id: string;
          name: string;
          type: "primary" | "junior_secondary" | "academy" | "mixed";
          motto: string | null;
          address: string | null;
          county: string | null;
          sub_county: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          logo_url: string | null;
          registration_number: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          school_id?: string;
          name: string;
          type?: "primary" | "junior_secondary" | "academy" | "mixed";
          motto?: string | null;
          address?: string | null;
          county?: string | null;
          sub_county?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          logo_url?: string | null;
          registration_number?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school_id?: string;
          name?: string;
          type?: "primary" | "junior_secondary" | "academy" | "mixed";
          motto?: string | null;
          address?: string | null;
          county?: string | null;
          sub_county?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          logo_url?: string | null;
          registration_number?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      staff: {
        Row: {
          staff_id: string;
          school_id: string;
          user_id: string;
          tsc_number: string | null;
          position: string;
          employment_date: string | null;
          contract_type: string | null;
          qualification: string | null;
          status: "active" | "inactive" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          staff_id?: string;
          school_id: string;
          user_id: string;
          tsc_number?: string | null;
          position: string;
          employment_date?: string | null;
          contract_type?: string | null;
          qualification?: string | null;
          status?: "active" | "inactive" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          staff_id?: string;
          school_id?: string;
          user_id?: string;
          tsc_number?: string | null;
          position?: string;
          employment_date?: string | null;
          contract_type?: string | null;
          qualification?: string | null;
          status?: "active" | "inactive" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      strands: {
        Row: {
          strand_id: string;
          school_id: string;
          learning_area_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          strand_id?: string;
          school_id: string;
          learning_area_id: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          strand_id?: string;
          school_id?: string;
          learning_area_id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      student_classes: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          class_id: string;
          academic_year_id: string;
          status: "active" | "inactive" | "transferred";
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          class_id: string;
          academic_year_id: string;
          status?: "active" | "inactive" | "transferred";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          class_id?: string;
          academic_year_id?: string;
          status?: "active" | "inactive" | "transferred";
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      student_fees: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          fee_structure_id: string;
          amount_due: number;
          amount_paid: number;
          balance: number;
          due_date: string | null;
          status: "pending" | "partial" | "paid" | "overdue" | "waived";
          academic_year_id: string;
          term_id: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          fee_structure_id: string;
          amount_due: number;
          amount_paid?: number;
          due_date?: string | null;
          status?: "pending" | "partial" | "paid" | "overdue" | "waived";
          academic_year_id: string;
          term_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          fee_structure_id?: string;
          amount_due?: number;
          amount_paid?: number;
          due_date?: string | null;
          status?: "pending" | "partial" | "paid" | "overdue" | "waived";
          academic_year_id?: string;
          term_id?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
      };
      student_guardians: {
        Row: {
          id: string;
          school_id: string;
          student_id: string;
          guardian_user_id: string;
          relationship: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          student_id: string;
          guardian_user_id: string;
          relationship?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_id?: string;
          student_id?: string;
          guardian_user_id?: string;
          relationship?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      students: {
        Row: {
          student_id: string;
          school_id: string;
          user_id: string | null;
          admission_number: string;
          current_class_id: string | null;
          date_of_birth: string;
          gender: "male" | "female" | "other";
          first_name: string;
          last_name: string;
          middle_name: string | null;
          enrollment_date: string;
          status:
            | "active"
            | "transferred"
            | "graduated"
            | "withdrawn"
            | "suspended";
          photo_url: string | null;
          birth_certificate_no: string | null;
          nemis_number: string | null;
          has_special_needs: boolean;
          special_needs_details: string | null;
          medical_info: string | null;
          previous_school: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          student_id?: string;
          school_id: string;
          user_id?: string | null;
          admission_number: string;
          current_class_id?: string | null;
          date_of_birth: string;
          gender: "male" | "female" | "other";
          first_name: string;
          last_name: string;
          middle_name?: string | null;
          enrollment_date?: string;
          status?:
            | "active"
            | "transferred"
            | "graduated"
            | "withdrawn"
            | "suspended";
          photo_url?: string | null;
          birth_certificate_no?: string | null;
          nemis_number?: string | null;
          has_special_needs?: boolean;
          special_needs_details?: string | null;
          medical_info?: string | null;
          previous_school?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          student_id?: string;
          school_id?: string;
          user_id?: string | null;
          admission_number?: string;
          current_class_id?: string | null;
          date_of_birth?: string;
          gender?: "male" | "female" | "other";
          first_name?: string;
          last_name?: string;
          middle_name?: string | null;
          enrollment_date?: string;
          status?:
            | "active"
            | "transferred"
            | "graduated"
            | "withdrawn"
            | "suspended";
          photo_url?: string | null;
          birth_certificate_no?: string | null;
          nemis_number?: string | null;
          has_special_needs?: boolean;
          special_needs_details?: string | null;
          medical_info?: string | null;
          previous_school?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
      sub_strands: {
        Row: {
          sub_strand_id: string;
          school_id: string;
          strand_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          sub_strand_id?: string;
          school_id: string;
          strand_id: string;
          name: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          sub_strand_id?: string;
          school_id?: string;
          strand_id?: string;
          name?: string;
          description?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      terms: {
        Row: {
          term_id: string;
          school_id: string;
          academic_year_id: string;
          name: "Term 1" | "Term 2" | "Term 3";
          start_date: string;
          end_date: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          term_id?: string;
          school_id: string;
          academic_year_id: string;
          name: "Term 1" | "Term 2" | "Term 3";
          start_date: string;
          end_date: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          term_id?: string;
          school_id?: string;
          academic_year_id?: string;
          name?: "Term 1" | "Term 2" | "Term 3";
          start_date?: string;
          end_date?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          user_id: string;
          school_id: string | null;
          role_id: string;
          email: string;
          first_name: string;
          last_name: string;
          middle_name: string | null;
          phone: string | null;
          gender: "male" | "female" | "other" | null;
          status: "active" | "inactive" | "suspended" | "archived";
          email_verified: boolean;
          failed_login_attempts: number;
          locked_until: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          user_id: string;
          school_id?: string | null;
          role_id: string;
          email: string;
          first_name: string;
          last_name: string;
          middle_name?: string | null;
          phone?: string | null;
          gender?: "male" | "female" | "other" | null;
          status?: "active" | "inactive" | "suspended" | "archived";
          email_verified?: boolean;
          failed_login_attempts?: number;
          locked_until?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          user_id?: string;
          school_id?: string | null;
          role_id?: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          middle_name?: string | null;
          phone?: string | null;
          gender?: "male" | "female" | "other" | null;
          status?: "active" | "inactive" | "suspended" | "archived";
          email_verified?: boolean;
          failed_login_attempts?: number;
          locked_until?: string | null;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      attendance_status: "present" | "absent" | "late" | "excused";
      cbc_performance_level:
        | "below_expectation"
        | "approaching"
        | "meeting"
        | "exceeding";
      consent_status: "granted" | "denied" | "pending" | "withdrawn";
      enrollment_status:
        | "active"
        | "transferred"
        | "graduated"
        | "withdrawn"
        | "suspended";
      fee_status: "pending" | "partial" | "paid" | "overdue" | "waived";
      gender_type: "male" | "female" | "other";
      incident_severity: "minor" | "moderate" | "major" | "critical";
      notification_type: "info" | "warning" | "alert" | "success" | "system";
      payment_method: "cash" | "bank_transfer" | "mpesa" | "cheque" | "other";
      read_status: "unread" | "read";
      school_term: "Term 1" | "Term 2" | "Term 3";
      school_type: "primary" | "junior_secondary" | "academy" | "mixed";
      staff_position:
        | "principal"
        | "deputy_principal"
        | "class_teacher"
        | "subject_teacher"
        | "finance_officer"
        | "bursar"
        | "librarian"
        | "ict_admin"
        | "admin_staff"
        | "support_staff";
      user_status: "active" | "inactive" | "suspended" | "archived";
    };
  };
}

type TableDef = {
  Row: unknown;
  Insert: unknown;
  Update: unknown;
};

type EnsureRelationships<T> = T extends TableDef
  ? T & { Relationships: [] }
  : T;

type NormalizeTables<T> = {
  [K in keyof T]: EnsureRelationships<T[K]>;
};

export type AppDatabase = {
  public: Omit<Database["public"], "Tables"> & {
    Tables: NormalizeTables<Database["public"]["Tables"]>;
  };
};
