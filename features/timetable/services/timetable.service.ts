// @ts-nocheck
// features/timetable/services/timetable.service.ts

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthUser } from '@/types/auth';
import {
  TimetableSlot,
  TimetableSlotWithDetails,
  CreateTimetableSlotInput,
  UpdateTimetableSlotInput,
  TimetableFilters,
  WeeklyTimetable,
  ConflictCheckResult,
  BulkCreateSlotsInput,
  TimetableSlotRow,
  mapRowToSlot,
  mapSlotToInsert,
  DAY_NAMES,
} from '../types';

// ─── Constants ───────────────────────────────────────────────
const DEFAULT_PAGE_SIZE = 50;

// ─── Error Classes ───────────────────────────────────────────
export class TimetableError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'TimetableError';
  }
}

export class ConflictError extends TimetableError {
  constructor(
    message: string,
    public conflicts: ConflictCheckResult[]
  ) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

// ─── Service Class ───────────────────────────────────────────
export class TimetableService {
  // ─── Get Single Slot ─────────────────────────────────────
  static async getSlotById(
    slotId: string,
    user: AuthUser
  ): Promise<TimetableSlotWithDetails | null> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        `
        *,
        class:classes(
          class_id,
          name,
          grade:grades(grade_id, name)
        ),
        learning_area:learning_areas(
          learning_area_id,
          name
        ),
        teacher:staff(
          staff_id,
          user:users(user_id, first_name, last_name, email)
        ),
        academic_year:academic_years(academic_year_id, year),
        term:terms(term_id, name)
      `
      )
      .eq('slot_id', slotId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new TimetableError(error.message, 'FETCH_ERROR', 500);
    }

    return this.mapRowToSlotWithDetails(data);
  }

  // ─── Get Timetable for Class ─────────────────────────────
  static async getClassTimetable(
    classId: string,
    termId: string,
    academicYearId: string,
    user: AuthUser
  ): Promise<WeeklyTimetable> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        `
        *,
        learning_area:learning_areas(learning_area_id, name),
        teacher:staff(
          staff_id,
          user:users(user_id, first_name, last_name)
        )
      `
      )
      .eq('class_id', classId)
      .eq('term_id', termId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw new TimetableError((error as any).message, 'FETCH_ERROR', 500);
    }

    return this.organizeByDay(data as any[] || []);
  }

  // ─── Get Timetable for Teacher ───────────────────────────
  static async getTeacherTimetable(
    teacherId: string,
    termId: string,
    academicYearId: string,
    user: AuthUser
  ): Promise<WeeklyTimetable> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('timetable_slots')
      .select(
        `
        *,
        class:classes(class_id, name, grade:grades(name)),
        learning_area:learning_areas(learning_area_id, name)
      `
      )
      .eq('teacher_id', teacherId)
      .eq('term_id', termId)
      .eq('academic_year_id', academicYearId)
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw new TimetableError((error as any).message, 'FETCH_ERROR', 500);
    }

    return this.organizeByDay(data as any[] || []);
  }

  // ─── Get All Slots with Filters ──────────────────────────
  static async getSlots(
    filters: TimetableFilters,
    user: AuthUser
  ): Promise<{ data: TimetableSlotWithDetails[]; total: number }> {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from('timetable_slots')
      .select(
        `
        *,
        class:classes(class_id, name, grade:grades(grade_id, name)),
        learning_area:learning_areas(learning_area_id, name),
        teacher:staff(staff_id, user:users(user_id, first_name, last_name)),
        academic_year:academic_years(academic_year_id, year),
        term:terms(term_id, name)
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (filters.classId) {
      query = query.eq('class_id', filters.classId);
    }
    if (filters.teacherId) {
      query = query.eq('teacher_id', filters.teacherId);
    }
    if (filters.learningAreaId) {
      query = query.eq('learning_area_id', filters.learningAreaId);
    }
    if (filters.termId) {
      query = query.eq('term_id', filters.termId);
    }
    if (filters.academicYearId) {
      query = query.eq('academic_year_id', filters.academicYearId);
    }
    if (filters.dayOfWeek !== undefined) {
      query = query.eq('day_of_week', filters.dayOfWeek);
    }
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    // School scoping (RLS handles this, but explicit for clarity)
    if (user.schoolId && user.role !== 'super_admin') {
      query = query.eq('school_id', user.schoolId);
    }

    query = query
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    // Pagination
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw new TimetableError((error as any).message, 'FETCH_ERROR', 500);
    }

    return {
      data: (data as any[] || []).map((row) => (this as any).mapRowToSlotWithDetails(row)),
      total: count ?? 0,
    };
  }

  // ─── Create Slot ─────────────────────────────────────────
  static async createSlot(
    input: CreateTimetableSlotInput,
    user: AuthUser
  ): Promise<TimetableSlotWithDetails> {
    const supabase = await createSupabaseServerClient();

    // Validate school context
    if (!user.schoolId && user.role !== 'super_admin') {
      throw new TimetableError('School context required', 'NO_SCHOOL', 403);
    }

    const schoolId = user.schoolId!;

    // Check for conflicts
    const conflicts = await this.checkConflicts(input, schoolId);
    if (conflicts.length > 0) {
      throw new ConflictError('Scheduling conflict detected', conflicts);
    }

    // Validate time range
    if (input.startTime >= input.endTime) {
      throw new TimetableError(
        'End time must be after start time',
        'INVALID_TIME',
        400
      );
    }

    const insertData = mapSlotToInsert(input, schoolId);

    const { data, error } = await supabase
      .from('timetable_slots')
      .insert(insertData)
      .select(
        `
        *,
        class:classes(class_id, name, grade:grades(grade_id, name)),
        learning_area:learning_areas(learning_area_id, name),
        teacher:staff(staff_id, user:users(user_id, first_name, last_name)),
        academic_year:academic_years(academic_year_id, year),
        term:terms(term_id, name)
      `
      )
      .single();

    if (error) {
      // Handle unique constraint violations
      if (error.code === '23505') {
        throw new TimetableError(
          'A slot already exists at this time',
          'DUPLICATE',
          409
        );
      }
      throw new TimetableError(error.message, 'CREATE_ERROR', 500);
    }

    return this.mapRowToSlotWithDetails(data);
  }

  // ─── Update Slot ─────────────────────────────────────────
  static async updateSlot(
    slotId: string,
    input: UpdateTimetableSlotInput,
    user: AuthUser
  ): Promise<TimetableSlotWithDetails> {
    const supabase = await createSupabaseServerClient();

    // Fetch existing slot
    const existing = await this.getSlotById(slotId, user);
    if (!existing) {
      throw new TimetableError('Slot not found', 'NOT_FOUND', 404);
    }

    // If time/day/teacher/class changed, check conflicts
    const needsConflictCheck =
      input.dayOfWeek !== undefined ||
      input.startTime !== undefined ||
      input.endTime !== undefined ||
      input.teacherId !== undefined ||
      input.classId !== undefined;

    if (needsConflictCheck) {
      const checkInput: CreateTimetableSlotInput = {
        classId: input.classId ?? existing.classId,
        teacherId: input.teacherId ?? existing.teacherId,
        learningAreaId: input.learningAreaId ?? existing.learningAreaId,
        dayOfWeek: input.dayOfWeek ?? existing.dayOfWeek,
        startTime: input.startTime ?? existing.startTime,
        endTime: input.endTime ?? existing.endTime,
        termId: existing.termId,
        academicYearId: existing.academicYearId,
        room: input.room ?? existing.room ?? undefined,
      };

      const conflicts = await this.checkConflicts(
        checkInput,
        existing.schoolId,
        slotId // Exclude current slot
      );

      if (conflicts.length > 0) {
        throw new ConflictError('Scheduling conflict detected', conflicts);
      }
    }

    // Validate time if provided
    const startTime = input.startTime ?? existing.startTime;
    const endTime = input.endTime ?? existing.endTime;
    if (startTime >= endTime) {
      throw new TimetableError(
        'End time must be after start time',
        'INVALID_TIME',
        400
      );
    }

    const updateData: Record<string, unknown> = {};
    if (input.classId !== undefined) updateData.class_id = input.classId;
    if (input.teacherId !== undefined) updateData.teacher_id = input.teacherId;
    if (input.learningAreaId !== undefined)
      updateData.learning_area_id = input.learningAreaId;
    if (input.dayOfWeek !== undefined) updateData.day_of_week = input.dayOfWeek;
    if (input.startTime !== undefined) updateData.start_time = input.startTime;
    if (input.endTime !== undefined) updateData.end_time = input.endTime;
    if (input.room !== undefined) updateData.room = input.room;
    if (input.isActive !== undefined) updateData.is_active = input.isActive;

    const { data, error } = await (supabase as any).from('timetable_slots')
      .update(updateData)
      .eq('slot_id', slotId)
      .select(
        `
        *,
        class:classes(class_id, name, grade:grades(grade_id, name)),
        learning_area:learning_areas(learning_area_id, name),
        teacher:staff(staff_id, user:users(user_id, first_name, last_name)),
        academic_year:academic_years(academic_year_id, year),
        term:terms(term_id, name)
      `
      )
      .single() as { data: any; error: any };

    if (error) {
      throw new TimetableError(error.message, 'UPDATE_ERROR', 500);
    }

    return this.mapRowToSlotWithDetails(data);
  }

  // ─── Delete Slot ─────────────────────────────────────────
  static async deleteSlot(slotId: string, user: AuthUser): Promise<void> {
    const supabase = await createSupabaseServerClient();

    const existing = await this.getSlotById(slotId, user);
    if (!existing) {
      throw new TimetableError('Slot not found', 'NOT_FOUND', 404);
    }

    const { error } = await supabase
      .from('timetable_slots')
      .delete()
      .eq('slot_id', slotId);

    if (error) {
      throw new TimetableError(error.message, 'DELETE_ERROR', 500);
    }
  }

  // ─── Bulk Create Slots ───────────────────────────────────
  static async bulkCreateSlots(
    input: BulkCreateSlotsInput,
    user: AuthUser
  ): Promise<{ created: number; conflicts: ConflictCheckResult[] }> {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId && user.role !== 'super_admin') {
      throw new TimetableError('School context required', 'NO_SCHOOL', 403);
    }

    const schoolId = user.schoolId!;
    const allConflicts: ConflictCheckResult[] = [];
    const validSlots: CreateTimetableSlotInput[] = [];

    // Check each slot for conflicts
    for (const slot of input.slots) {
      const conflicts = await this.checkConflicts(slot, schoolId);
      if (conflicts.length > 0) {
        allConflicts.push(...conflicts);
      } else {
        validSlots.push(slot);
      }
    }

    if (validSlots.length === 0) {
      return { created: 0, conflicts: allConflicts };
    }

    // Insert valid slots
    const insertData = validSlots.map((slot) => mapSlotToInsert(slot, schoolId));

    const { data, error } = await supabase
      .from('timetable_slots')
      .insert(insertData)
      .select('slot_id');

    if (error) {
      throw new TimetableError(error.message, 'BULK_CREATE_ERROR', 500);
    }

    return {
      created: data?.length ?? 0,
      conflicts: allConflicts,
    };
  }

  // ─── Check Conflicts ─────────────────────────────────────
  static async checkConflicts(
    input: CreateTimetableSlotInput,
    schoolId: string,
    excludeSlotId?: string
  ): Promise<ConflictCheckResult[]> {
    const supabase = await createSupabaseServerClient();
    const conflicts: ConflictCheckResult[] = [];

    // Build base query for teacher conflicts
    let teacherQuery = supabase
      .from('timetable_slots')
      .select('slot_id, start_time, end_time, class_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', input.teacherId)
      .eq('day_of_week', input.dayOfWeek)
      .eq('term_id', input.termId)
      .eq('academic_year_id', input.academicYearId)
      .eq('is_active', true);

    if (excludeSlotId) {
      teacherQuery = teacherQuery.neq('slot_id', excludeSlotId);
    }

    const { data: teacherSlots, error: teacherError } = (await teacherQuery) as { data: any[] | null; error: any };

    if (teacherError) {
      throw new TimetableError(teacherError.message, 'CONFLICT_CHECK_ERROR', 500);
    }

    // Check for time overlaps with teacher's slots
    for (const slot of teacherSlots || []) {
      if (this.timesOverlap(input.startTime, input.endTime, slot.start_time, slot.end_time)) {
        conflicts.push({
          type: 'teacher',
          slotId: slot.slot_id,
          message: `Teacher is already scheduled from ${slot.start_time} to ${slot.end_time}`,
          dayOfWeek: input.dayOfWeek,
          startTime: slot.start_time,
          endTime: slot.end_time,
        });
      }
    }

    // Build base query for class conflicts
    let classQuery = supabase
      .from('timetable_slots')
      .select('slot_id, start_time, end_time, teacher_id')
      .eq('school_id', schoolId)
      .eq('class_id', input.classId)
      .eq('day_of_week', input.dayOfWeek)
      .eq('term_id', input.termId)
      .eq('academic_year_id', input.academicYearId)
      .eq('is_active', true);

    if (excludeSlotId) {
      classQuery = classQuery.neq('slot_id', excludeSlotId);
    }

    const { data: classSlots, error: classError } = (await classQuery) as { data: any[] | null; error: any };

    if (classError) {
      throw new TimetableError(classError.message, 'CONFLICT_CHECK_ERROR', 500);
    }

    // Check for time overlaps with class slots
    for (const slot of classSlots || []) {
      if (this.timesOverlap(input.startTime, input.endTime, slot.start_time, slot.end_time)) {
        conflicts.push({
          type: 'class',
          slotId: slot.slot_id,
          message: `Class is already scheduled from ${slot.start_time} to ${slot.end_time}`,
          dayOfWeek: input.dayOfWeek,
          startTime: slot.start_time,
          endTime: slot.end_time,
        });
      }
    }

    // Check room conflicts (if room specified)
    if (input.room) {
      let roomQuery = supabase
        .from('timetable_slots')
        .select('slot_id, start_time, end_time, class_id')
        .eq('school_id', schoolId)
        .eq('room', input.room)
        .eq('day_of_week', input.dayOfWeek)
        .eq('term_id', input.termId)
        .eq('academic_year_id', input.academicYearId)
        .eq('is_active', true);

      if (excludeSlotId) {
        roomQuery = roomQuery.neq('slot_id', excludeSlotId);
      }

      const { data: roomSlots, error: roomError } = (await roomQuery) as { data: any[] | null; error: any };

      if (roomError) {
        throw new TimetableError(roomError.message, 'CONFLICT_CHECK_ERROR', 500);
      }

      for (const slot of roomSlots || []) {
        if (this.timesOverlap(input.startTime, input.endTime, slot.start_time, slot.end_time)) {
          conflicts.push({
            type: 'room',
            slotId: slot.slot_id,
            message: `Room "${input.room}" is already booked from ${slot.start_time} to ${slot.end_time}`,
            dayOfWeek: input.dayOfWeek,
            startTime: slot.start_time,
            endTime: slot.end_time,
          });
        }
      }
    }

    return conflicts;
  }

  // ─── Copy Timetable ──────────────────────────────────────
  static async copyTimetable(
    sourceTermId: string,
    targetTermId: string,
    targetAcademicYearId: string,
    user: AuthUser
  ): Promise<{ copied: number }> {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId && user.role !== 'super_admin') {
      throw new TimetableError('School context required', 'NO_SCHOOL', 403);
    }

    // Fetch source slots
    const { data: sourceSlots, error: fetchError } = await supabase
      .from('timetable_slots')
      .select('*')
      .eq('school_id', user.schoolId)
      .eq('term_id', sourceTermId)
      .eq('is_active', true);

    if (fetchError) {
      throw new TimetableError(fetchError.message, 'FETCH_ERROR', 500);
    }

    if (!sourceSlots || sourceSlots.length === 0) {
      return { copied: 0 };
    }

    // Create new slots for target term
    const newSlots = sourceSlots.map((slot) => ({
      school_id: slot.school_id,
      class_id: slot.class_id,
      learning_area_id: slot.learning_area_id,
      teacher_id: slot.teacher_id,
      academic_year_id: targetAcademicYearId,
      term_id: targetTermId,
      day_of_week: slot.day_of_week,
      start_time: slot.start_time,
      end_time: slot.end_time,
      room: slot.room,
      is_active: true,
    }));

    const { data: results, error: bulkError } = (await supabase
      .from('timetable_slots')
      .insert(newSlots as any[])
      .select()) as { data: any[] | null; error: any };

    if (bulkError) {
      throw new TimetableError(bulkError.message, 'COPY_ERROR', 500);
    }

    return { copied: results?.length ?? 0 };
  }

  // ─── Deactivate All Slots for Term ───────────────────────
  static async deactivateTermSlots(
    termId: string,
    user: AuthUser
  ): Promise<{ deactivated: number }> {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId && user.role !== 'super_admin') {
      throw new TimetableError('School context required', 'NO_SCHOOL', 403);
    }

    const { data, error } = await supabase
      .from('timetable_slots')
      .update({ is_active: false })
      .eq('school_id', user.schoolId)
      .eq('term_id', termId)
      .eq('is_active', true)
      .select('slot_id');

    if (error) {
      throw new TimetableError(error.message, 'DEACTIVATE_ERROR', 500);
    }

    return { deactivated: data?.length ?? 0 };
  }

  // ─── Helper: Check Time Overlap ──────────────────────────
  private static timesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    // Convert to minutes for comparison
    const toMinutes = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    // Overlap exists if one starts before the other ends
    return s1 < e2 && s2 < e1;
  }

  // ─── Helper: Organize Slots by Day ───────────────────────
  private static organizeByDay(slots: any[]): WeeklyTimetable {
    const timetable: WeeklyTimetable = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
    };

    const dayMap: Record<number, keyof WeeklyTimetable> = {
      1: 'monday',
      2: 'tuesday',
      3: 'wednesday',
      4: 'thursday',
      5: 'friday',
    };

    for (const slot of slots) {
      const day = dayMap[slot.day_of_week];
      if (day) {
        timetable[day].push(this.mapRowToSlotWithDetails(slot));
      }
    }

    return timetable;
  }

  // ─── Helper: Map Row to SlotWithDetails ──────────────────
  private static mapRowToSlotWithDetails(row: any): TimetableSlotWithDetails {
    return {
      slotId: row.slot_id,
      schoolId: row.school_id,
      classId: row.class_id,
      learningAreaId: row.learning_area_id,
      teacherId: row.teacher_id,
      academicYearId: row.academic_year_id,
      termId: row.term_id,
      dayOfWeek: row.day_of_week,
      dayName: DAY_NAMES[row.day_of_week as keyof typeof DAY_NAMES] ?? '',
      startTime: row.start_time,
      endTime: row.end_time,
      room: row.room,
      isActive: row.is_active,
      createdAt: row.created_at,
      // Joined relations
      className: row.class?.name ?? '',
      gradeName: row.class?.grade?.name ?? '',
      learningAreaName: row.learning_area?.name ?? '',
      teacherName: row.teacher?.user
        ? `${row.teacher.user.first_name} ${row.teacher.user.last_name}`
        : '',
      academicYear: row.academic_year?.year ?? '',
      termName: row.term?.name ?? '',
    };
  }
}

// ─── Export Singleton Methods ────────────────────────────────
export const timetableService = {
  getSlotById: TimetableService.getSlotById.bind(TimetableService),
  getClassTimetable: TimetableService.getClassTimetable.bind(TimetableService),
  getTeacherTimetable: TimetableService.getTeacherTimetable.bind(TimetableService),
  getSlots: TimetableService.getSlots.bind(TimetableService),
  createSlot: TimetableService.createSlot.bind(TimetableService),
  updateSlot: TimetableService.updateSlot.bind(TimetableService),
  deleteSlot: TimetableService.deleteSlot.bind(TimetableService),
  bulkCreateSlots: TimetableService.bulkCreateSlots.bind(TimetableService),
  checkConflicts: TimetableService.checkConflicts.bind(TimetableService),
  copyTimetable: TimetableService.copyTimetable.bind(TimetableService),
  deactivateTermSlots: TimetableService.deactivateTermSlots.bind(TimetableService),
};

export const getTimetableSlots = timetableService.getSlots;
export const createTimetableSlot = timetableService.createSlot;
export const updateTimetableSlot = timetableService.updateSlot;
export const deleteTimetableSlot = timetableService.deleteSlot;
