export type QuestionType = 'multiple_choice' | 'short_answer' | 'structured' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface ExamQuestion {
  number: number;
  type: QuestionType;
  bloomLevel: BloomLevel;
  marks: number;
  prompt: string;
  options?: string[];
  expectedAnswer: string;
}

export interface MarkingSchemeItem {
  questionNumber: number;
  totalMarks: number;
  expectedPoints: string[];
  rubric: string;
}

export interface GeneratedExam {
  title: string;
  subject: string;
  grade: string;
  instructions: string;
  durationMinutes: number;
  totalMarks: number;
  questions: ExamQuestion[];
  markingScheme: MarkingSchemeItem[];
  bloomTaxonomyBreakdown: Record<BloomLevel, number>;
}

export interface ExamGeneratorResult {
  exam: GeneratedExam;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}
