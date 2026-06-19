export interface GradingRequest {
  questions: GradingQuestion[];
  studentResponses: StudentResponse[];
  markingScheme?: MarkingCriterion[];
  subject: string;
  grade: string;
}

export interface GradingQuestion {
  number: number;
  prompt: string;
  type: "multiple_choice" | "short_answer" | "structured" | "essay";
  marks: number;
  options?: string[];
  correctAnswer?: string;
  expectedPoints?: string[];
}

export interface StudentResponse {
  studentId: string;
  studentName: string;
  answers: { questionNumber: number; response: string }[];
}

export interface MarkingCriterion {
  questionNumber: number;
  maxMarks: number;
  rubric: string[];
}

export interface GradedResponse {
  studentId: string;
  studentName: string;
  totalScore: number;
  maxTotalScore: number;
  percentage: number;
  performanceLevel: "exceeding" | "meeting" | "approaching" | "below_expectation";
  questionResults: {
    questionNumber: number;
    score: number;
    maxScore: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
  }[];
  overallFeedback: string;
}

export interface GradingResult {
  subject: string;
  grade: string;
  totalStudents: number;
  gradedResponses: GradedResponse[];
  classSummary: {
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    medianScore: number;
    levelDistribution: Record<string, number>;
  };
  confidence: number;
  warnings: string[];
  generatedAt: string;
}

export interface LessonPlanRequest {
  classId: string;
  learningAreaId: string;
  strandId?: string;
  subStrandId?: string;
  competencyId?: string;
  durationMinutes: number;
  pedagogicalApproach?: "learner-centered" | "teacher-directed" | "differentiated" | "inquiry-based";
  includeResources?: boolean;
  includeAssessment?: boolean;
}

export interface LessonPlanActivity {
  time: string;
  duration: number;
  activity: string;
  description: string;
  teacherRole: string;
  learnerRole: string;
  resources: string[];
}

export interface LessonPlan {
  title: string;
  grade: string;
  subject: string;
  strand: string;
  subStrand: string;
  competencies: string[];
  duration: number;
  learningOutcomes: string[];
  coreCompetencies: string[];
  values: string[];
  lessonMaterials: string[];
  activities: LessonPlanActivity[];
  assessmentMethods: string[];
  differentiationStrategies: string[];
  homeworkTask: string;
  teacherReflection: string;
}

export interface LessonPlanResult {
  lessonPlan: LessonPlan;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}
