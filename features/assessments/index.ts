// features/assessments/index.ts
// ============================================================
// Public API for Assessments & Reporting feature module
// All external access goes through this barrel file
// ============================================================

// Types
export type {
  PerformanceLevel,
  PerformanceLevelLabel,
  AssessmentTemplate,
  Assessment,
  AssessmentAggregate,
  ReportCard,
  ReportAnalytics,
  LearningAreaSummary,
  StrandSummary,
  SubStrandSummary,
  CompetencyScore,
  CompetencyBreakdown,
  AttendanceSummary,
  StudentAnalytics,
  TrendDirection,
  TrendData,
  ClassPerformanceSummary,
  LearningAreaAnalytics,
  CreateAssessmentPayload,
  UpdateAssessmentPayload,
  BulkAssessmentPayload,
  CreateAssessmentTemplatePayload,
  UpdateAssessmentTemplatePayload,
  CreatePerformanceLevelPayload,
  GenerateReportCardPayload,
  PublishReportCardsPayload,
  AssessmentFilters,
  ReportCardFilters,
  AnalyticsFilters,
} from "./types";

// Validators
export {
  createPerformanceLevelSchema,
  createAssessmentTemplateSchema,
  updateAssessmentTemplateSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  bulkAssessmentSchema,
  generateReportCardSchema,
  publishReportCardsSchema,
  updateReportCardRemarksSchema,
  assessmentFiltersSchema,
  reportCardFiltersSchema,
  analyticsFiltersSchema,
} from "./validators/assessment.schema";

// Services — Performance Levels
export {
  listPerformanceLevels,
  getPerformanceLevelById,
  getPerformanceLevelByLabel,
  getLevelIdForScore,
  seedDefaultPerformanceLevels,
  mapScoreToLevel,
  mapScoreToNumericLevel,
  getLevelDisplayName,
  getLevelColor,
} from "./services/performanceLevels.service";

// Services — Assessment Templates
export {
  listAssessmentTemplates,
  getAssessmentTemplateById,
  createAssessmentTemplate,
  updateAssessmentTemplate,
  deleteAssessmentTemplate,
} from "./services/assessmentTemplates.service";

// Services — Assessments (Core CRUD)
export {
  listAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  bulkCreateAssessments,
  getStudentAssessmentsByLearningArea,
  deleteAssessment,
} from "./services/assessments.service";

// Services — Aggregation
export {
  getStudentAggregates,
  calculateLearningAreaSummary,
  calculateAllLearningAreaSummaries,
  calculateYearlySummary,
  calculateOverallStudentPerformance,
} from "./services/aggregation.service";

// Services — Report Cards
export {
  listReportCards,
  getReportCardById,
  generateReportCard,
  generateClassReportCards,
  updateReportCardRemarks,
  publishReportCards,
  unpublishReportCard,
  updateReportCardPdfUrl,
} from "./services/reportCards.service";

// Services — Attendance Helper
export { getStudentAttendanceSummary } from "./services/attendance.helper";

// Services — Analytics & Trends
export {
  determineTrend,
  calculateStudentTrends,
  getClassPerformanceSummary,
  getLearningAreaAnalytics,
  getTeacherPerformanceSummary,
  getSchoolPerformanceDashboard,
} from "./services/analytics.service";
