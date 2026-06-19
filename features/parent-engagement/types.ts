export interface WeeklySummaryRequest {
  studentId: string;
  termId?: string;
  academicYearId?: string;
  language?: "en" | "sw" | "code-mix";
}

export interface WeeklySummary {
  studentName: string;
  className: string;
  term: string;
  weekLabel: string;
  academicHighlights: {
    learningArea: string;
    performance: string;
    teacherComment: string;
  }[];
  attendanceSummary: {
    present: number;
    absent: number;
    late: number;
    rate: number;
  };
  behaviorNotes: string[];
  upcomingEvents: string[];
  teacherMessage: string;
  parentTips: string[];
  generatedAt: string;
}

export interface WeeklySummaryResult {
  summary: WeeklySummary;
  confidence: number;
  warnings: string[];
  generatedAt: string;
}

export interface SentimentAnalysisRequest {
  messages: { id: string; text: string; sender: string; timestamp: string }[];
  scope?: "parent-teacher" | "general";
}

export interface SentimentResult {
  overallSentiment: "positive" | "neutral" | "negative" | "mixed";
  sentimentScore: number;
  messageLevel: {
    messageId: string;
    sentiment: "positive" | "neutral" | "negative";
    score: number;
    keyPhrases: string[];
    flaggedIssues?: string[];
  }[];
  trends: {
    direction: "improving" | "declining" | "stable";
    description: string;
  };
  recommendations: string[];
  requiresAttention: boolean;
}

export interface MeetingScheduleRequest {
  parentId: string;
  teacherId: string;
  studentId: string;
  preferredDates: string[];
  preferredTimes: string[];
  durationMinutes?: number;
  reason: string;
  urgency: "low" | "normal" | "high";
}

export interface TimeSlot {
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
}

export interface MeetingScheduleResult {
  parentName: string;
  teacherName: string;
  studentName: string;
  suggestedSlots: TimeSlot[];
  selectedSlot?: TimeSlot;
  meetingTitle: string;
  agenda: string[];
  preparationNotes: string[];
  confirmationMessage: string;
}
