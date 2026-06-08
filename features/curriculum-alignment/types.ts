export interface AlignmentCheckResult {
  overallScore: number;
  alignedCompetencies: { name: string; strand: string; coverage: 'full' | 'partial' | 'none' }[];
  missingCompetencies: string[];
  suggestions: string[];
  confidence: number;
}

export interface LessonPlanInput {
  title: string;
  subject: string;
  grade: string;
  duration: string;
  objectives: string[];
  activities: string[];
  assessmentMethods: string[];
  materials: string[];
}
