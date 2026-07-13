export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type BaseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: Record<string, BaseTable> & {
      admission_applications: {
        Row: {
          application_id: string;
          school_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
          grade_applying_for: string;
          previous_school: string | null;
          parent_name: string;
          parent_phone: string;
          parent_email: string | null;
          parent_id_number: string | null;
          status: string;
          notes: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
        };
        Insert: {
          application_id?: string;
          school_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string;
          gender: string;
          grade_applying_for: string;
          previous_school?: string | null;
          parent_name: string;
          parent_phone: string;
          parent_email?: string | null;
          parent_id_number?: string | null;
          status?: string;
          notes?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Update: {
          application_id?: string;
          school_id?: string;
          first_name?: string;
          last_name?: string;
          date_of_birth?: string;
          gender?: string;
          grade_applying_for?: string;
          previous_school?: string | null;
          parent_name?: string;
          parent_phone?: string;
          parent_email?: string | null;
          parent_id_number?: string | null;
          status?: string;
          notes?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admission_applications_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      schools: {
        Row: {
          school_id: string;
          name: string;
          address: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          logo_url: string | null;
          motto: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          school_id?: string;
          name: string;
          address?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          logo_url?: string | null;
          motto?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school_id?: string;
          name?: string;
          address?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          logo_url?: string | null;
          motto?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_inventory: {
        Row: {
          item_id: string;
          school_id: string;
          name: string;
          category: string;
          quantity: number;
          condition: string | null;
          location: string | null;
          assigned_to: string | null;
          notes: string | null;
        };
        Insert: {
          item_id?: string;
          school_id: string;
          name: string;
          category?: string;
          quantity?: number;
          condition?: string | null;
          location?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
        };
        Update: {
          item_id?: string;
          school_id?: string;
          name?: string;
          category?: string;
          quantity?: number;
          condition?: string | null;
          location?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "school_inventory_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      users: {
        Row: {
          user_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          role: string;
          school_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          role: string;
          school_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          first_name?: string;
          last_name?: string;
          email?: string | null;
          phone?: string | null;
          role?: string;
          school_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      students: {
        Row: {
          student_id: string;
          admission_number: string;
          first_name: string;
          last_name: string;
          middle_name: string | null;
          gender: string | null;
          date_of_birth: string | null;
          current_class_id: string | null;
          status: string;
          enrollment_date: string | null;
          school_id: string | null;
          has_special_needs: boolean;
          special_needs_details: string | null;
          medical_info: string | null;
          nemis_number: string | null;
          birth_certificate_no: string | null;
          previous_school: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          student_id?: string;
          admission_number: string;
          first_name: string;
          last_name: string;
          middle_name?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          current_class_id?: string | null;
          status?: string;
          enrollment_date?: string | null;
          school_id?: string | null;
          has_special_needs?: boolean;
          special_needs_details?: string | null;
          medical_info?: string | null;
          nemis_number?: string | null;
          birth_certificate_no?: string | null;
          previous_school?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          admission_number?: string;
          first_name?: string;
          last_name?: string;
          middle_name?: string | null;
          gender?: string | null;
          date_of_birth?: string | null;
          current_class_id?: string | null;
          status?: string;
          enrollment_date?: string | null;
          school_id?: string | null;
          has_special_needs?: boolean;
          special_needs_details?: string | null;
          medical_info?: string | null;
          nemis_number?: string | null;
          birth_certificate_no?: string | null;
          previous_school?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "students_current_class_id_fkey";
            columns: ["current_class_id"];
            referencedRelation: "classes";
            referencedColumns: ["class_id"];
          },
        ];
      };
      staff: {
        Row: {
          staff_id: string;
          user_id: string;
          tsc_number: string | null;
          position: string | null;
          employment_date: string | null;
          contract_type: string | null;
          qualification: string | null;
          status: string;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          staff_id?: string;
          user_id: string;
          tsc_number?: string | null;
          position?: string | null;
          employment_date?: string | null;
          contract_type?: string | null;
          qualification?: string | null;
          status?: string;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          staff_id?: string;
          user_id?: string;
          tsc_number?: string | null;
          position?: string | null;
          employment_date?: string | null;
          contract_type?: string | null;
          qualification?: string | null;
          status?: string;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "staff_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
        ];
      };
      classes: {
        Row: {
          class_id: string;
          name: string;
          stream: string | null;
          capacity: number | null;
          class_teacher_id: string | null;
          grade_id: string | null;
          academic_year_id: string | null;
          is_active: boolean;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          class_id?: string;
          name: string;
          stream?: string | null;
          capacity?: number | null;
          class_teacher_id?: string | null;
          grade_id?: string | null;
          academic_year_id?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          name?: string;
          stream?: string | null;
          capacity?: number | null;
          class_teacher_id?: string | null;
          grade_id?: string | null;
          academic_year_id?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "classes_academic_year_id_fkey";
            columns: ["academic_year_id"];
            referencedRelation: "academic_years";
            referencedColumns: ["academic_year_id"];
          },
        ];
      };
      attendance: {
        Row: {
          id: string;
          student_id: string;
          class_id: string | null;
          term_id: string | null;
          date: string;
          status: string;
          reason: string | null;
          arrival_time: string | null;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id?: string | null;
          term_id?: string | null;
          date: string;
          status: string;
          reason?: string | null;
          arrival_time?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          class_id?: string | null;
          term_id?: string | null;
          date?: string;
          status?: string;
          reason?: string | null;
          arrival_time?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "attendance_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      student_fees: {
        Row: {
          id: string;
          student_id: string;
          fee_structure_id: string | null;
          amount_due: number;
          amount_paid: number;
          balance: number;
          due_date: string | null;
          status: string;
          academic_year_id: string | null;
          term_id: string | null;
          invoice_number: string | null;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          fee_structure_id?: string | null;
          amount_due: number;
          amount_paid?: number;
          balance?: number;
          due_date?: string | null;
          status?: string;
          academic_year_id?: string | null;
          term_id?: string | null;
          invoice_number?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          fee_structure_id?: string | null;
          amount_due?: number;
          amount_paid?: number;
          balance?: number;
          due_date?: string | null;
          status?: string;
          academic_year_id?: string | null;
          term_id?: string | null;
          invoice_number?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_fees_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_fees_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          student_fee_id: string | null;
          amount_paid: number;
          payment_method: string | null;
          transaction_id: string | null;
          receipt_number: string | null;
          payment_date: string | null;
          notes: string | null;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_fee_id?: string | null;
          amount_paid: number;
          payment_method?: string | null;
          transaction_id?: string | null;
          receipt_number?: string | null;
          payment_date?: string | null;
          notes?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_fee_id?: string | null;
          amount_paid?: number;
          payment_method?: string | null;
          transaction_id?: string | null;
          receipt_number?: string | null;
          payment_date?: string | null;
          notes?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_student_fee_id_fkey";
            columns: ["student_fee_id"];
            referencedRelation: "student_fees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      student_guardians: {
        Row: {
          id: string;
          student_id: string;
          guardian_id: string;
          guardian_user_id: string | null;
          relationship: string | null;
          is_primary_contact: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          guardian_id: string;
          guardian_user_id?: string | null;
          relationship?: string | null;
          is_primary_contact?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          guardian_id?: string;
          guardian_user_id?: string | null;
          relationship?: string | null;
          is_primary_contact?: boolean | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_guardians_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["student_id"];
          },
        ];
      };
      fee_structures: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          amount: number;
          academic_year_id: string | null;
          term_id: string | null;
          grade_id: string | null;
          is_mandatory: boolean;
          is_active: boolean;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          amount: number;
          academic_year_id?: string | null;
          term_id?: string | null;
          grade_id?: string | null;
          is_mandatory?: boolean;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          amount?: number;
          academic_year_id?: string | null;
          term_id?: string | null;
          grade_id?: string | null;
          is_mandatory?: boolean;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_structures_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      academic_years: {
        Row: {
          academic_year_id: string;
          year: string;
          name: string | null;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
          school_id: string | null;
          created_at: string;
        };
        Insert: {
          academic_year_id?: string;
          year: string;
          name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Update: {
          academic_year_id?: string;
          year?: string;
          name?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      terms: {
        Row: {
          term_id: string;
          academic_year_id: string | null;
          name: string;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
          school_id: string | null;
          created_at: string;
        };
        Insert: {
          term_id?: string;
          academic_year_id?: string | null;
          name: string;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Update: {
          term_id?: string;
          academic_year_id?: string | null;
          name?: string;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey";
            columns: ["academic_year_id"];
            referencedRelation: "academic_years";
            referencedColumns: ["academic_year_id"];
          },
          {
            foreignKeyName: "terms_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      learning_areas: {
        Row: {
          learning_area_id: string;
          name: string;
          code: string | null;
          description: string | null;
          is_active: boolean;
          school_id: string | null;
          created_at: string;
        };
        Insert: {
          learning_area_id?: string;
          name: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Update: {
          learning_area_id?: string;
          name?: string;
          code?: string | null;
          description?: string | null;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_areas_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      assessment_aggregates: {
        Row: {
          id: string;
          student_id: string;
          learning_area_id: string;
          class_id: string | null;
          academic_year_id: string | null;
          term_id: string | null;
          total_competencies: number;
          average_score: number;
          overall_level: string;
          exceeding_count: number;
          meeting_count: number;
          approaching_count: number;
          below_expectation_count: number;
          computed_at: string;
          school_id: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          learning_area_id: string;
          class_id?: string | null;
          academic_year_id?: string | null;
          term_id?: string | null;
          total_competencies?: number;
          average_score?: number;
          overall_level?: string;
          exceeding_count?: number;
          meeting_count?: number;
          approaching_count?: number;
          below_expectation_count?: number;
          computed_at?: string;
          school_id?: string | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          learning_area_id?: string;
          class_id?: string | null;
          academic_year_id?: string | null;
          term_id?: string | null;
          total_competencies?: number;
          average_score?: number;
          overall_level?: string;
          exceeding_count?: number;
          meeting_count?: number;
          approaching_count?: number;
          below_expectation_count?: number;
          computed_at?: string;
          school_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_aggregates_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "assessment_aggregates_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      disciplinary_records: {
        Row: {
          id: string;
          student_id: string;
          incident_date: string;
          incident_type: string;
          severity: string;
          description: string | null;
          action_taken: string | null;
          status: string;
          location: string | null;
          parent_notified: boolean;
          school_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          incident_date: string;
          incident_type: string;
          severity: string;
          description?: string | null;
          action_taken?: string | null;
          status?: string;
          location?: string | null;
          parent_notified?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          incident_date?: string;
          incident_type?: string;
          severity?: string;
          description?: string | null;
          action_taken?: string | null;
          status?: string;
          location?: string | null;
          parent_notified?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disciplinary_records_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "disciplinary_records_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      subjects: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          learning_area_id: string | null;
          school_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          learning_area_id?: string | null;
          school_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string | null;
          learning_area_id?: string | null;
          school_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      student_subjects: {
        Row: {
          id: string;
          student_id: string;
          subject_id: string;
          teacher_id: string | null;
          academic_year_id: string | null;
          term_id: string | null;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject_id: string;
          teacher_id?: string | null;
          academic_year_id?: string | null;
          term_id?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          subject_id?: string;
          teacher_id?: string | null;
          academic_year_id?: string | null;
          term_id?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_subjects_student_id_fkey";
            columns: ["student_id"];
            referencedRelation: "students";
            referencedColumns: ["student_id"];
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey";
            columns: ["subject_id"];
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_subjects_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      grading_scales: {
        Row: {
          id: string;
          name: string;
          min_score: number;
          max_score: number;
          grade: string;
          description: string | null;
          school_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          min_score: number;
          max_score: number;
          grade: string;
          description?: string | null;
          school_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          min_score?: number;
          max_score?: number;
          grade?: string;
          description?: string | null;
          school_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grading_scales_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      promotion_rules: {
        Row: {
          id: string;
          name: string;
          from_grade_id: string | null;
          to_grade_id: string | null;
          min_average_score: number;
          conditions: Json;
          school_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          from_grade_id?: string | null;
          to_grade_id?: string | null;
          min_average_score?: number;
          conditions?: Json;
          school_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          from_grade_id?: string | null;
          to_grade_id?: string | null;
          min_average_score?: number;
          conditions?: Json;
          school_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_rules_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      staff_leaves: {
        Row: {
          leave_id: string;
          staff_id: string;
          leave_type: string;
          start_date: string;
          end_date: string;
          reason: string | null;
          status: string;
          approved_by: string | null;
          school_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          leave_id?: string;
          staff_id: string;
          leave_type: string;
          start_date: string;
          end_date: string;
          reason?: string | null;
          status?: string;
          approved_by?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          leave_id?: string;
          staff_id?: string;
          leave_type?: string;
          start_date?: string;
          end_date?: string;
          reason?: string | null;
          status?: string;
          approved_by?: string | null;
          school_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_leaves_staff_id_fkey";
            columns: ["staff_id"];
            referencedRelation: "staff";
            referencedColumns: ["staff_id"];
          },
          {
            foreignKeyName: "staff_leaves_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      teacher_subjects: {
        Row: {
          id: string;
          teacher_id: string;
          learning_area_id: string;
          class_id: string;
          academic_year_id: string;
          term_id: string;
          is_active: boolean;
          school_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          teacher_id: string;
          learning_area_id: string;
          class_id: string;
          academic_year_id: string;
          term_id: string;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          teacher_id?: string;
          learning_area_id?: string;
          class_id?: string;
          academic_year_id?: string;
          term_id?: string;
          is_active?: boolean;
          school_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_subjects_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      broadcast_messages: {
        Row: {
          id: string;
          school_id: string;
          created_by: string;
          subject: string;
          body: string;
          priority: string;
          category: string;
          target_roles: string[];
          target_classes: string[];
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          school_id: string;
          created_by: string;
          subject: string;
          body: string;
          priority?: string;
          category?: string;
          target_roles?: string[];
          target_classes?: string[];
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          school_id?: string;
          created_by?: string;
          subject?: string;
          body?: string;
          priority?: string;
          category?: string;
          target_roles?: string[];
          target_classes?: string[];
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "broadcast_messages_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
          {
            foreignKeyName: "broadcast_messages_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string | null;
          subject: string;
          body: string;
          priority: string;
          category: string | null;
          school_id: string;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id?: string | null;
          subject: string;
          body: string;
          priority?: string;
          category?: string | null;
          school_id: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          sender_id?: string;
          receiver_id?: string | null;
          subject?: string;
          body?: string;
          priority?: string;
          category?: string | null;
          school_id?: string;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "messages_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
      message_recipients: {
        Row: {
          id: string;
          message_id: string;
          recipient_id: string;
          recipient_type: string;
          read_status: boolean;
          read_at: string | null;
          deleted: boolean;
          school_id: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          recipient_id: string;
          recipient_type: string;
          read_status?: boolean;
          read_at?: string | null;
          deleted?: boolean;
          school_id: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          recipient_id?: string;
          recipient_type?: string;
          read_status?: boolean;
          read_at?: string | null;
          deleted?: boolean;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_recipients_recipient_id_fkey";
            columns: ["recipient_id"];
            referencedRelation: "users";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "message_recipients_school_id_fkey";
            columns: ["school_id"];
            referencedRelation: "schools";
            referencedColumns: ["school_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
