export type RiskLevel = "low" | "medium" | "high";

export type DropoutRiskStudent = {
  studentId: string;
  name: string;
  attendanceRate: number;
  averageScore: number;
  previousAverageScore: number;
  trendDelta: number;
  disciplineCount: number;
  majorIncidents: number;
  riskLevel: RiskLevel;
  reason: string[];
  recommendation: string[];
};

export type DropoutRiskResult = {
  classId: string;
  className: string;
  lookbackDays: number;
  evaluatedStudents: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  summary: string;
  students: DropoutRiskStudent[];
};

export type TrendDirection = "improving" | "declining" | "stable";

export type PerformanceTimelinePoint = {
  periodLabel: string;
  averageScore: number;
  sampleSize: number;
};

export type SubjectTrendItem = {
  learningAreaId: string;
  learningAreaName: string;
  averageScore: number;
  previousAverageScore: number;
  trendDelta: number;
  trendDirection: TrendDirection;
  sampleSize: number;
};

export type TeacherComparisonItem = {
  teacherId: string;
  teacherName: string;
  learningAreaId: string;
  learningAreaName: string;
  averageScore: number;
  assessmentCount: number;
  relativeToClassAverage: number;
  evidenceMode: "direct_assessed_by" | "assignment_proxy";
  insight?: string;
};

export type ClassPerformanceInsights = {
  summary: string;
  highlights: string[];
  recommendations: string[];
};

export type ClassPerformanceResult = {
  classId: string;
  className: string;
  lookbackDays: number;
  overallAverageScore: number;
  timeline: PerformanceTimelinePoint[];
  subjectTrends: SubjectTrendItem[];
  teacherComparison: TeacherComparisonItem[];
  insights: ClassPerformanceInsights;
};

export type SchoolHealthSubject = {
  learningAreaId: string;
  learningAreaName: string;
  averageScore: number;
  sampleSize: number;
};

export type SchoolHealthClassTrend = {
  classId: string;
  className: string;
  averageScore: number;
  previousAverageScore: number;
  trendDelta: number;
  trendDirection: TrendDirection;
  sampleSize: number;
  attendanceRate: number | null;
};

export type SchoolHealthResult = {
  lookbackDays: number;
  overallAverageScore: number;
  weakestSubject: SchoolHealthSubject | null;
  decliningClasses: SchoolHealthClassTrend[];
  improvingClasses: SchoolHealthClassTrend[];
  summary: string;
  priorityActions: string[];
  watchList: string[];
};

export type AnalyticsAIResult<T> = {
  result: T;
  confidence: number;
  warnings: string[];
  generatedAt: string;
};
