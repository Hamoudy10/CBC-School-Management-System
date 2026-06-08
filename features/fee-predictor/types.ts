export interface FeePredictionResult {
  studentId: string;
  studentName: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  factors: { name: string; impact: 'positive' | 'negative'; description: string }[];
  recommendations: { action: string; priority: 'immediate' | 'soon' | 'monitor'; expectedImpact: string }[];
  optimalReminderDay: number;
  confidence: number;
}

export interface PaymentPattern {
  totalPayments: number;
  averageAmount: number;
  paymentFrequency: number;
  preferredMethod: string;
  averageDaysLate: number;
  onTimeRate: number;
  lastPaymentDate: string | null;
  recentGapDays: number | null;
}

export interface FeePredictionSummary {
  totalStudents: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  totalProjectedCollections: number;
  atRiskAmount: number;
}
