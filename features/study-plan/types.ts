export interface StudySession {
  day: number;
  date?: string;
  topic: string;
  subject: string;
  durationMinutes: number;
  activity: string;
  resources: string[];
  completed: boolean;
}

export interface GeneratedStudyPlan {
  title: string;
  startDate: string;
  endDate: string;
  targetExam: string;
  totalDays: number;
  totalStudyHours: number;
  sessions: StudySession[];
  recommendations: string[];
}

export interface StudyPlanResult {
  plan: GeneratedStudyPlan;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}
