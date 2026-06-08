export interface AdaptiveHomeworkResult<T = any> {
  result: T;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}

export interface WorksheetOutput {
  title: string;
  studentName: string;
  grade: string;
  subject: string;
  strandName: string;
  subStrandName: string;
  totalQuestions: number;
  questions: {
    number: number;
    question: string;
    options?: string[];
    answer: string;
    explanation: string;
  }[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
}

export interface StudentWeakArea {
  strandId: string;
  strandName: string;
  subStrandId: string;
  subStrandName: string;
  averageScore: number;
  performanceLevel: string;
  competencyCount: number;
}
