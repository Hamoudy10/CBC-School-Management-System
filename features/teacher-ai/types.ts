export type TeacherAIStudentOption = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
};

export type ReportCommentResult = {
  comment: string;
  performanceSummary: string;
  behaviorSummary: string;
  nextSteps: string[];
};

export type MarkEntrySuggestionResult = {
  grade: "A" | "B" | "C" | "D" | "E";
  performanceLevel:
    | "exceeding_expectation"
    | "meeting_expectation"
    | "approaching_expectation"
    | "below_expectation";
  scoreOnCbcScale: 1 | 2 | 3 | 4;
  comment: string;
  rationale: string;
};

export type ClassroomInsightItem = {
  studentId: string;
  name: string;
  reasons: string[];
};

export type ClassroomInsightsResult = {
  weakStudents: ClassroomInsightItem[];
  strongPerformers: ClassroomInsightItem[];
  attentionNeeded: ClassroomInsightItem[];
  classSummary: string;
};

export type TeacherAICopilotResult<T> = {
  result: T;
  confidence: number;
  warnings: string[];
  generatedAt: string;
};
