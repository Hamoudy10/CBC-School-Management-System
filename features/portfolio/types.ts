export interface PortfolioEntry {
  entryId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  className?: string;
  learningAreaId: string;
  learningAreaName?: string;
  strandId: string | null;
  strandName?: string;
  title: string;
  description: string | null;
  evidenceType: 'document' | 'image' | 'video' | 'link' | 'text';
  evidenceUrl: string | null;
  evidenceContent: string | null;
  submittedAt: string;
  status: 'submitted' | 'assessed' | 'returned';
  assessedScore: number | null;
  assessedLevel: string | null;
  teacherComment: string | null;
  assessedBy: string | null;
  assessedAt: string | null;
}

export interface PortfolioStats {
  total: number;
  submitted: number;
  assessed: number;
  returned: number;
  averageScore: number | null;
}
