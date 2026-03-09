// features/assessments/types.ts
// ============================================================
// Type definitions for Assessment & CBC Reporting module
// Covers: performance levels, assessments, templates,
//         report cards, analytics, trends
// ============================================================

// ============================================================
// Performance Level (CBC 4-point scale)
// ============================================================
export type PerformanceLevelLabel =
  | "below_expectation"
  | "approaching"
  | "meeting"
  | "exceeding";

export interface PerformanceLevel {
  levelId: string;
  schoolId: string;
  name: string;
  label: PerformanceLevelLabel;
  numericValue: number; // 1, 2, 3, 4
  description: string | null;
  createdAt: string;
}

export interface CreatePerformanceLevelPayload {
  name: string;
  label: PerformanceLevelLabel;
  numericValue: number;
  description?: string;
}

// ============================================================
// Assessment Template (predefined items per competency)
// ============================================================
export interface AssessmentTemplate {
  templateId: string;
  schoolId: string;
  competencyId: string;
  competencyName?: string;
  learningAreaId?: string;
  learningAreaName?: string;
  name: string;
  description: string | null;
  maxScore: number;
  assessmentType: "observation" | "test" | "project" | "practical" | "other";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentTemplatePayload {
  competencyId: string;
  name: string;
  description?: string;
  maxScore?: number;
  assessmentType?: "observation" | "test" | "project" | "practical" | "other";
}

export interface UpdateAssessmentTemplatePayload {
  name?: string;
  description?: string;
  maxScore?: number;
  assessmentType?: "observation" | "test" | "project" | "practical" | "other";
  isActive?: boolean;
}

// ============================================================
// Assessment (individual student assessment record)
// ============================================================
export interface Assessment {
  assessmentId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  studentAdmissionNo?: string;
  competencyId: string;
  competencyName?: string;
  learningAreaId: string;
  learningAreaName?: string;
  classId: string;
  className?: string;
  academicYearId: string;
  academicYear?: string;
  termId: string;
  termName?: string;
  score: number;
  levelId: string;
  levelName?: string;
  levelLabel?: PerformanceLevelLabel;
  remarks: string | null;
  assessmentDate: string;
  assessedBy: string;
  assessedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssessmentPayload {
  studentId: string;
  competencyId: string;
  learningAreaId: string;
  classId: string;
  academicYearId: string;
  termId: string;
  score: number;
  remarks?: string;
  assessmentDate?: string;
}

export interface UpdateAssessmentPayload {
  score?: number;
  remarks?: string;
  assessmentDate?: string;
}

export interface BulkAssessmentPayload {
  classId: string;
  competencyId: string;
  learningAreaId: string;
  academicYearId: string;
  termId: string;
  assessments: {
    studentId: string;
    score: number;
    remarks?: string;
  }[];
}

// ============================================================
// Assessment Aggregate (precomputed per student/learning area/term)
// ============================================================
export interface AssessmentAggregate {
  id: string;
  schoolId: string;
  studentId: string;
  learningAreaId: string;
  learningAreaName?: string;
  classId: string;
  academicYearId: string;
  termId: string;
  totalCompetencies: number;
  averageScore: number;
  overallLevel: PerformanceLevelLabel;
  exceedingCount: number;
  meetingCount: number;
  approachingCount: number;
  belowExpectationCount: number;
  computedAt: string;
}

// ============================================================
// Report Card
// ============================================================
export interface ReportCard {
  reportId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  studentAdmissionNo?: string;
  classId: string;
  className?: string;
  academicYearId: string;
  academicYear?: string;
  termId: string;
  termName?: string;
  reportType: "term" | "yearly";
  overallAverage: number | null;
  overallLevel: PerformanceLevelLabel | null;
  classTeacherRemarks: string | null;
  principalRemarks: string | null;
  analyticsJson: ReportAnalytics | null;
  pdfUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  generatedAt: string;
  generatedBy: string | null;
}

export interface ReportAnalytics {
  learningAreas: LearningAreaSummary[];
  overallSummary: {
    totalCompetencies: number;
    assessedCompetencies: number;
    averageScore: number;
    overallLevel: PerformanceLevelLabel;
    levelDistribution: {
      exceeding: number;
      meeting: number;
      approaching: number;
      belowExpectation: number;
    };
  };
  attendance?: AttendanceSummary;
  trends?: TrendData[];
  competencyBreakdown?: CompetencyBreakdown[];
}

export interface LearningAreaSummary {
  learningAreaId: string;
  learningAreaName: string;
  averageScore: number;
  level: PerformanceLevelLabel;
  competencyCount: number;
  strandSummaries: StrandSummary[];
}

export interface StrandSummary {
  strandId: string;
  strandName: string;
  averageScore: number;
  level: PerformanceLevelLabel;
  subStrandSummaries: SubStrandSummary[];
}

export interface SubStrandSummary {
  subStrandId: string;
  subStrandName: string;
  averageScore: number;
  level: PerformanceLevelLabel;
  competencies: CompetencyScore[];
}

export interface CompetencyScore {
  competencyId: string;
  competencyName: string;
  score: number;
  level: PerformanceLevelLabel;
  remarks: string | null;
}

export interface CompetencyBreakdown {
  competencyId: string;
  competencyName: string;
  learningAreaName: string;
  score: number;
  level: PerformanceLevelLabel;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendancePercentage: number;
}

// ============================================================
// Analytics & Trends
// ============================================================
export interface StudentAnalytics {
  id: string;
  schoolId: string;
  studentId: string;
  learningAreaId: string;
  learningAreaName?: string;
  termId: string;
  termName?: string;
  academicYearId: string;
  academicYear?: string;
  averageScore: number;
  performanceLevel: PerformanceLevelLabel;
  trend: TrendDirection;
  previousScore: number | null;
  scoreChange: number | null;
  computedAt: string;
}

export type TrendDirection = "improving" | "stable" | "declining";

export interface TrendData {
  learningAreaId: string;
  learningAreaName: string;
  terms: {
    termId: string;
    termName: string;
    academicYear: string;
    averageScore: number;
    level: PerformanceLevelLabel;
  }[];
  trend: TrendDirection;
  percentageChange: number;
}

export interface ClassPerformanceSummary {
  classId: string;
  className: string;
  totalStudents: number;
  averageScore: number;
  levelDistribution: {
    exceeding: number;
    meeting: number;
    approaching: number;
    belowExpectation: number;
  };
  topPerformers: {
    studentId: string;
    studentName: string;
    averageScore: number;
  }[];
  needsSupport: {
    studentId: string;
    studentName: string;
    averageScore: number;
  }[];
}

export interface LearningAreaAnalytics {
  learningAreaId: string;
  learningAreaName: string;
  classAverage: number;
  studentCount: number;
  levelDistribution: {
    exceeding: number;
    meeting: number;
    approaching: number;
    belowExpectation: number;
  };
  strandPerformance: {
    strandId: string;
    strandName: string;
    averageScore: number;
  }[];
}

// ============================================================
// Report Generation Payload
// ============================================================
export interface GenerateReportCardPayload {
  studentId: string;
  classId: string;
  academicYearId: string;
  termId: string;
  reportType: "term" | "yearly";
  classTeacherRemarks?: string;
  principalRemarks?: string;
}

export interface PublishReportCardsPayload {
  classId: string;
  academicYearId: string;
  termId: string;
  reportType: "term" | "yearly";
}

// ============================================================
// Filters
// ============================================================
export interface AssessmentFilters {
  studentId?: string;
  classId?: string;
  learningAreaId?: string;
  competencyId?: string;
  academicYearId?: string;
  termId?: string;
  assessedBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface ReportCardFilters {
  studentId?: string;
  classId?: string;
  academicYearId?: string;
  termId?: string;
  reportType?: "term" | "yearly";
  isPublished?: boolean;
  page?: number;
  pageSize?: number;
}

export interface AnalyticsFilters {
  classId?: string;
  learningAreaId?: string;
  academicYearId?: string;
  termId?: string;
}
