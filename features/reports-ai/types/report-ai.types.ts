export interface AIReportGenerationRequest {
  student_id: string;
  term_id: string;
  academic_year: string;
  school_id: string;
  include_parent_summary?: boolean;
  include_insights?: boolean;
  language?: 'en' | 'sw' | 'code-mix';
}

export interface AIReportGenerationResponse {
  success: boolean;
  data: {
    report_id: string;
    generated_at: string;
    pdf_url?: string;
    insights?: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    };
    parent_summary?: string;
    ai_confidence: number;
    processing_time: number;
  };
  error?: string;
}

export interface ParentFriendlyTranslationRequest {
  technical_term: string;
  context: {
    subject?: string;
    grade?: string;
    performance_level?: string;
    learning_area?: string;
  };
  target_language: 'simple-en' | 'swahili' | 'parent-focused';
}

export interface ParentFriendlyTranslationResponse {
  original_term: string;
  translated_text: string;
  explanation: string;
  confidence: number;
  alternatives?: string[];
}

export interface ReportInsights {
  student_id: string;
  term_id: string;
  academic_year: string;
  strengths: Array<{
    competency: string;
    level: string;
    description: string;
  }>;
  weaknesses: Array<{
    competency: string;
    level: string;
    description: string;
    improvement_actions: string[];
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    category: 'academic' | 'social' | 'behavioral' | 'attendance';
    action: string;
    timeline: string;
    responsible_party: 'teacher' | 'parent' | 'both';
  }>;
  overall_performance: 'excellent' | 'good' | 'average' | 'needs_improvement' | 'concerning';
}

export interface AIReportComment {
  competency_code: string;
  competency_name: string;
  score: number;
  level: string;
  comment: string;
  parent_friendly_version?: string;
}

export interface CBCReportData {
  student_info: {
    id: string;
    name: string;
    admission_number: string;
    class: string;
    class_teacher: string;
    term: string;
    year: string;
    school_name: string;
  };
  learning_areas: Array<{
    code: string;
    name: string;
    score: number;
    level: string;
    comment: string;
    parent_comment?: string;
    competencies: Array<{
      code: string;
      name: string;
      score: number;
      level: string;
      comment: string;
      parent_comment?: string;
    }>;
  }>;
  summary: {
    total_subjects: number;
    average_score: number;
    overall_level: string;
    attendance_percentage: number;
    total_days_present: number;
    total_days_absent: number;
  };
  insights?: ReportInsights;
  parent_summary?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  type: 'student' | 'class' | 'subject' | 'term';
  format: 'pdf' | 'html' | 'email';
  sections: Array<{
    id: string;
    name: string;
    enabled: boolean;
    order: number;
  }>;
  branding?: {
    school_logo?: string;
    header_text?: string;
    footer_text?: string;
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}