export interface TimetableSuggestion {
  day: string;
  slots: {
    period: number;
    startTime: string;
    endTime: string;
    className: string;
    subject: string;
    teacherName: string;
    room: string;
  }[];
}

export interface OptimizationConstraints {
  teacherMaxPeriodsPerDay: number;
  maxConsecutivePeriods: number;
  preferMorningCore: boolean;
  avoidTeacherClashes: boolean;
  avoidRoomClashes: boolean;
  includeBreaks: boolean;
}

export interface TimetableOptimizerResult {
  suggestions: TimetableSuggestion[];
  conflicts: { type: string; description: string }[];
  confidence: number;
}
