// features/assessments/services/assessments.service.ts
export const dummyAssessmentService = {};

export const getAssessmentById = async (..._args: any[]): Promise<any> => null;
export const getStudentAssessmentsByYear = async (
  ..._args: any[]
): Promise<any[]> => [];
export const getStudentAssessmentsByLearningArea = async (
  ..._args: any[]
): Promise<any[]> => [];
export const listAssessments = async (..._args: any[]): Promise<any> => ({
  data: [],
  count: 0,
});
export const updateAssessment = async (..._args: any[]): Promise<any> => null;
export const bulkCreateAssessments = async (..._args: any[]): Promise<any> =>
  null;
export const createAssessment = async (..._args: any[]): Promise<any> => null;
export const deleteAssessment = async (..._args: any[]): Promise<any> => null;
