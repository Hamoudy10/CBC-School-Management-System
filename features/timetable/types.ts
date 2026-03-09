// features/timetable/types.ts
// ============================================================
// Timetable Module — TypeScript Definitions
// Maps to: timetable_slots table
// Covers: Weekly schedules, time slots, conflict detection
// ============================================================

// ============================================================
// Constants
// ============================================================

/** Days of the week (1 = Monday, 5 = Friday) */
export const DAYS_OF_WEEK = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
} as const;

export type DayOfWeek = keyof typeof DAYS_OF_WEEK;

/** Standard school time slots */
export const DEFAULT_TIME_SLOTS = [
  { start: '08:00', end: '08:40', label: 'Period 1' },
  { start: '08:40', end: '09:20', label: 'Period 2' },
  { start: '09:20', end: '10:00', label: 'Period 3' },
  { start: '10:00', end: '10:30', label: 'Break' },
  { start: '10:30', end: '11:10', label: 'Period 4' },
  { start: '11:10', end: '11:50', label: 'Period 5' },
  { start: '11:50', end: '12:30', label: 'Period 6' },
  { start: '12:30', end: '13:30', label: 'Lunch' },
  { start: '13:30', end: '14:10', label: 'Period 7' },
  { start: '14:10', end: '14:50', label: 'Period 8' },
  { start: '14:50', end: '15:30', label: 'Period 9' },
] as const;

// ============================================================
// Core Timetable Types
// ============================================================

/** Full timetable slot record — maps directly to timetable_slots table */
export interface TimetableSlot {
  slotId: string;
  schoolId: string;
  classId: string;
  learningAreaId: string;
  teacherId: string;
  academicYearId: string;
  termId: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  room: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Timetable slot with joined entity names for display */
export interface TimetableSlotWithDetails extends TimetableSlot {
  className: string;
  gradeName: string;
  learningAreaName: string;
  teacherName: string;
  teacherInitials: string;
  termName: string;
  academicYear: string;
}

/** Lightweight slot for grid display */
export interface TimetableGridSlot {
  slotId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  learningAreaName: string;
  learningAreaId: string;
  teacherName: string;
  teacherInitials: string;
  teacherId: string;
  room: string | null;
  className?: string;
  classId?: string;
}

// ============================================================
// Timetable View Types
// ============================================================

/** Class timetable — weekly view for a single class */
export interface ClassTimetable {
  classId: string;
  className: string;
  gradeName: string;
  academicYearId: string;
  termId: string;
  slots: TimetableGridSlot[];
}

/** Teacher timetable — weekly view for a single teacher */
export interface TeacherTimetable {
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  termId: string;
  slots: (TimetableGridSlot & { className: string; classId: string })[];
}

/** Master timetable — all classes for admin view */
export interface MasterTimetable {
  schoolId: string;
  academicYearId: string;
  termId: string;
  classes: {
    classId: string;
    className: string;
    gradeName: string;
    gradeOrder: number;
    slots: TimetableGridSlot[];
  }[];
}

// ============================================================
// Conflict Detection Types
// ============================================================

/** Types of scheduling conflicts */
export type ConflictType = 
  | 'teacher_double_booked'
  | 'class_double_booked'
  | 'room_double_booked';

/** Detected scheduling conflict */
export interface TimetableConflict {
  type: ConflictType;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  message: string;
  conflictingSlots: {
    slotId: string;
    className?: string;
    teacherName?: string;
    room?: string;
  }[];
}

/** Conflict check result */
export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: TimetableConflict[];
}

// ============================================================
// Filter & Query Types
// ============================================================

/** Filters for listing timetable slots */
export interface TimetableFilters {
  classId?: string;
  teacherId?: string;
  learningAreaId?: string;
  dayOfWeek?: DayOfWeek;
  academicYearId: string;
  termId: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

/** Pagination wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================
// Bulk Operations Types
// ============================================================

/** Single slot for bulk creation */
export interface BulkSlotInput {
  classId: string;
  learningAreaId: string;
  teacherId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room?: string;
}

/** Bulk creation result */
export interface BulkCreateResult {
  success: boolean;
  totalCreated: number;
  totalFailed: number;
  results: {
    success: boolean;
    slotId?: string;
    error?: string;
    input: BulkSlotInput;
  }[];
  conflicts: TimetableConflict[];
}

// ============================================================
// Copy/Template Types
// ============================================================

/** Copy timetable options */
export interface CopyTimetableOptions {
  sourceTermId: string;
  targetTermId: string;
  classIds?: string[]; // If empty, copy all classes
  clearExisting: boolean;
}

/** Template slot (without term-specific IDs) */
export interface TimetableTemplate {
  name: string;
  description?: string;
  slots: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    periodLabel: string;
    isBreak: boolean;
  }[];
}

// ============================================================
// Statistics Types
// ============================================================

/** Timetable statistics for a class */
export interface ClassTimetableStats {
  classId: string;
  className: string;
  totalSlots: number;
  totalHours: number;
  subjectBreakdown: {
    learningAreaId: string;
    learningAreaName: string;
    slots: number;
    hours: number;
  }[];
  teacherBreakdown: {
    teacherId: string;
    teacherName: string;
    slots: number;
  }[];
}

/** Teacher workload statistics */
export interface TeacherWorkloadStats {
  teacherId: string;
  teacherName: string;
  totalSlots: number;
  totalHours: number;
  classBreakdown: {
    classId: string;
    className: string;
    slots: number;
  }[];
  dailyBreakdown: Record<DayOfWeek, number>;
}

// ============================================================
// UI Helper Types
// ============================================================

/** Time slot for grid rendering */
export interface TimeSlotCell {
  startTime: string;
  endTime: string;
  label: string;
  isBreak: boolean;
  duration: number; // in minutes
}

/** Grid cell data */
export interface GridCell {
  dayOfWeek: DayOfWeek;
  timeSlot: TimeSlotCell;
  slot: TimetableGridSlot | null;
  isConflict: boolean;
}

/** Drag and drop payload */
export interface DragDropPayload {
  slotId?: string;
  learningAreaId: string;
  teacherId: string;
  sourceDayOfWeek?: DayOfWeek;
  sourceStartTime?: string;
  targetDayOfWeek: DayOfWeek;
  targetStartTime: string;
  targetEndTime: string;
}

// ============================================================
// Display Label Maps
// ============================================================

export const DAY_LABELS: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  teacher_double_booked: 'Teacher Double-Booked',
  class_double_booked: 'Class Double-Booked',
  room_double_booked: 'Room Double-Booked',
};

export const DAY_NAMES = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
} as const;

export interface CreateTimetableSlotInput {
  classId: string;
  teacherId: string;
  learningAreaId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  termId: string;
  academicYearId: string;
  room?: string;
}

export interface UpdateTimetableSlotInput {
  classId?: string;
  teacherId?: string;
  learningAreaId?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  room?: string;
  isActive?: boolean;
}

export interface BulkCreateSlotsInput {
  slots: CreateTimetableSlotInput[];
}

export interface WeeklyTimetable {
  monday: TimetableSlotWithDetails[];
  tuesday: TimetableSlotWithDetails[];
  wednesday: TimetableSlotWithDetails[];
  thursday: TimetableSlotWithDetails[];
  friday: TimetableSlotWithDetails[];
}

export interface TimetableSlotRow {
  slot_id: string;
  school_id: string;
  class_id: string;
  learning_area_id: string;
  teacher_id: string;
  academic_year_id: string;
  term_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
  created_at: string;
}

export function mapRowToSlot(row: any): TimetableSlot {
  return {
    slotId: row.slot_id,
    schoolId: row.school_id,
    classId: row.class_id,
    learningAreaId: row.learning_area_id,
    teacherId: row.teacher_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    dayOfWeek: row.day_of_week as any,
    startTime: row.start_time,
    endTime: row.end_time,
    room: row.room,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export function mapSlotToInsert(
  input: CreateTimetableSlotInput,
  schoolId: string
): any {
  return {
    school_id: schoolId,
    class_id: input.classId,
    teacher_id: input.teacherId,
    learning_area_id: input.learningAreaId,
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    term_id: input.termId,
    academic_year_id: input.academicYearId,
    room: input.room,
    is_active: true,
  };
}