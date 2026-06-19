export type TrendDirection = "improving" | "declining" | "stable";

export interface PerformanceForecast {
  studentId: string;
  studentName: string;
  className: string;
  learningAreaId: string;
  learningAreaName: string;
  currentScore: number;
  predictedEndTermScore: number;
  predictedEndYearScore: number;
  confidenceInterval: { lower: number; upper: number };
  trend: TrendDirection;
  riskOfDecline: "low" | "medium" | "high";
  contributingFactors: string[];
}

export interface PerformanceForecastResult {
  classId: string;
  className: string;
  termId: string;
  academicYearId: string;
  forecasts: PerformanceForecast[];
  classSummary: {
    averageCurrentScore: number;
    averagePredictedScore: number;
    improvingCount: number;
    decliningCount: number;
    stableCount: number;
    atRiskCount: number;
  };
  generatedAt: string;
}

export interface SubjectRecommendation {
  studentId: string;
  studentName: string;
  currentLearningAreas: { id: string; name: string; score: number }[];
  recommendedLearningAreas: {
    learningAreaId: string;
    learningAreaName: string;
    matchScore: number;
    rationale: string;
    expectedPerformance: "strong" | "moderate" | "challenging";
  }[];
  careerPaths: { name: string; match: number; description: string }[];
  guidance: string;
}

export interface SubjectRecommendationResult {
  studentId: string;
  studentName: string;
  className: string;
  grade: string;
  recommendation: SubjectRecommendation;
  confidence: number;
  generatedAt: string;
}

export interface StudentCluster {
  clusterId: number;
  label: string;
  description: string;
  studentCount: number;
  students: { studentId: string; name: string; averageScore: number }[];
  commonTraits: { trait: string; value: string | number }[];
  recommendedIntervention: string;
}

export interface StudentClusterResult {
  classId: string;
  className: string;
  clusters: StudentCluster[];
  generatedAt: string;
}

export interface InterventionRecommendation {
  studentId: string;
  studentName: string;
  riskLevel: "low" | "medium" | "high";
  priority: number;
  interventions: {
    type: "academic" | "attendance" | "behavioral" | "social" | "financial";
    action: string;
    responsibleParty: "teacher" | "parent" | "counselor" | "admin" | "both";
    timeline: "immediate" | "this_week" | "this_month" | "this_term";
    expectedImpact: "high" | "medium" | "low";
  }[];
  notes: string;
}

export interface InterventionRecommendationResult {
  classId: string;
  className: string;
  recommendations: InterventionRecommendation[];
  summary: {
    totalStudents: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
  };
  generatedAt: string;
}

export interface PredictiveAnalyticsResult<T> {
  success: boolean;
  data: T;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}
