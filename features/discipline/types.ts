// features/discipline/types.ts
// Type definitions for Discipline module

export type IncidentSeverity = "minor" | "moderate" | "major" | "critical";

export type IncidentType =
  | "misconduct"
  | "bullying"
  | "truancy"
  | "property_damage"
  | "academic_dishonesty"
  | "insubordination"
  | "fighting"
  | "substance_abuse"
  | "dress_code"
  | "late_coming"
  | "other";

export type ActionTaken =
  | "verbal_warning"
  | "written_warning"
  | "parent_notification"
  | "detention"
  | "suspension"
  | "counseling_referral"
  | "community_service"
  | "expulsion"
  | "other";

export type IncidentStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "escalated"
  | "closed";

export interface DisciplinaryRecord {
  id: string;
  student_id: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  date: string;
  time?: string;
  location?: string;
  witnesses?: string;
  action_taken: ActionTaken;
  action_details?: string;
  status: IncidentStatus;
  follow_up_date?: string;
  follow_up_notes?: string;
  parent_notified: boolean;
  parent_notified_date?: string;
  recorded_by: string;
  reviewed_by?: string;
  school_id: string;
  term: string;
  academic_year: string;
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
  reviewer?: {
    first_name: string;
    last_name: string;
  };
}

export interface DisciplineFilters {
  student_id?: string;
  class_id?: string;
  incident_type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  date_from?: string;
  date_to?: string;
  term?: string;
  academic_year?: string;
}

export interface DisciplineSummary {
  total_incidents: number;
  by_type: Record<IncidentType, number>;
  by_severity: Record<IncidentSeverity, number>;
  by_status: Record<IncidentStatus, number>;
  by_action: Record<ActionTaken, number>;
  by_month: Array<{
    month: string;
    count: number;
  }>;
  repeat_offenders: Array<{
    student_id: string;
    student_name: string;
    incident_count: number;
  }>;
}

export interface CreateDisciplineInput {
  student_id: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  date: string;
  time?: string;
  location?: string;
  witnesses?: string;
  action_taken: ActionTaken;
  action_details?: string;
  parent_notified: boolean;
  parent_notified_date?: string;
  term: string;
  academic_year: string;
}

export interface UpdateDisciplineInput {
  status?: IncidentStatus;
  action_taken?: ActionTaken;
  action_details?: string;
  follow_up_date?: string;
  follow_up_notes?: string;
  parent_notified?: boolean;
  parent_notified_date?: string;
  reviewed_by?: string;
}
