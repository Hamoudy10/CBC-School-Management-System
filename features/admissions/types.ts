export interface AdmissionApplication {
  applicationId: string;
  schoolId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  gradeApplyingFor: string;
  previousSchool: string | null;
  parentName: string;
  parentPhone: string;
  parentEmail: string | null;
  parentIdNumber: string | null;
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected';
  notes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}
