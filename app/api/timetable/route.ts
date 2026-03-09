// @ts-nocheck
// app/api/timetable/route.ts

import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/api/response';
import {
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
} from '@/features/timetable/validators/timetable.schema';
import {
  getTimetableSlots,
  createTimetableSlot,
  updateTimetableSlot,
  deleteTimetableSlot,
} from '@/features/timetable/services/timetable.service';
import type { TimetableFilters } from '@/features/timetable/types';

// Helper: extract user with school context
async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user?.school_id) return null;

  return {
    userId: user.user_id as string,
    schoolId: user.school_id as string,
    roleName: ((user.roles as Record<string, string>)?.name ?? 'student') as string,
  };
}

// GET /api/timetable — Fetch timetable slots with optional filters
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const authUser = await getAuthenticatedUser(supabase);
    if (!authUser) return errorResponse('Unauthorized', 401);

    const { searchParams } = new URL(req.url);
    const filters: TimetableFilters = {};

    const classId = searchParams.get('class_id');
    const teacherId = searchParams.get('teacher_id');
    const dayOfWeek = searchParams.get('day_of_week');
    const learningAreaId = searchParams.get('learning_area_id');
    const termId = searchParams.get('term_id');

    if (classId) filters.classId = classId;
    if (teacherId) filters.teacherId = teacherId;
    if (dayOfWeek) filters.dayOfWeek = dayOfWeek as TimetableFilters['dayOfWeek'];
    if (learningAreaId) filters.learningAreaId = learningAreaId;
    if (termId) filters.termId = termId;

    // Teacher role: default to their own timetable
    if (
      ['teacher', 'class_teacher', 'subject_teacher'].includes(authUser.roleName) &&
      !filters.teacherId &&
      !filters.classId
    ) {
      // Fetch staff record for this user
      const { data: staff } = await supabase
        .from('staff')
        .select('staff_id')
        .eq('user_id', authUser.userId)
        .eq('school_id', authUser.schoolId)
        .maybeSingle();

      if (staff) {
        filters.teacherId = staff.staff_id;
      }
    }

    // Student/Parent: default to their class timetable
    if (authUser.roleName === 'student' && !filters.classId) {
      const { data: student } = await supabase
        .from('students')
        .select('current_class_id')
        .eq('user_id', authUser.userId)
        .eq('school_id', authUser.schoolId)
        .maybeSingle();

      if (student?.current_class_id) {
        filters.classId = student.current_class_id;
      }
    }

    const slots = await getTimetableSlots(authUser.schoolId, filters);

    return successResponse(slots, 'Timetable retrieved', 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}

// POST /api/timetable — Create a new timetable slot
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const authUser = await getAuthenticatedUser(supabase);
    if (!authUser) return errorResponse('Unauthorized', 401);

    const allowedRoles = [
      'super_admin',
      'school_admin',
      'principal',
      'deputy_principal',
      'ict_admin',
    ];
    if (!allowedRoles.includes(authUser.roleName)) {
      return errorResponse('Insufficient permissions', 403);
    }

    const body = await req.json();
    const validation = createTimetableSlotSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return errorResponse(`Validation failed: ${errors}`, 400);
    }

    // Get active academic year and term
    const { data: activeYear } = await supabase
      .from('academic_years')
      .select('academic_year_id')
      .eq('school_id', authUser.schoolId)
      .eq('is_active', true)
      .maybeSingle();

    const { data: activeTerm } = await supabase
      .from('terms')
      .select('term_id')
      .eq('school_id', authUser.schoolId)
      .eq('is_active', true)
      .maybeSingle();

    if (!activeYear || !activeTerm) {
      return errorResponse(
        'No active academic year or term. Please configure the academic calendar first.',
        400
      );
    }

    const slot = await createTimetableSlot(
      authUser.schoolId,
      activeTerm.term_id,
      activeYear.academic_year_id,
      validation.data
    );

    return successResponse(slot, 'Timetable slot created', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    // Conflict errors from checkConflicts
    if (message.includes('already assigned') || message.includes('already booked') || message.includes('already has a lesson')) {
      return errorResponse(message, 409);
    }
    return errorResponse(message, 500);
  }
}

// PATCH /api/timetable — Update an existing timetable slot
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const authUser = await getAuthenticatedUser(supabase);
    if (!authUser) return errorResponse('Unauthorized', 401);

    const allowedRoles = [
      'super_admin',
      'school_admin',
      'principal',
      'deputy_principal',
      'ict_admin',
    ];
    if (!allowedRoles.includes(authUser.roleName)) {
      return errorResponse('Insufficient permissions', 403);
    }

    const body = await req.json();
    const validation = updateTimetableSlotSchema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return errorResponse(`Validation failed: ${errors}`, 400);
    }

    const slot = await updateTimetableSlot(authUser.schoolId, validation.data);

    return successResponse(slot, 'Timetable slot updated', 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message.includes('not found')) {
      return errorResponse(message, 404);
    }
    if (message.includes('already assigned') || message.includes('already booked') || message.includes('already has a lesson')) {
      return errorResponse(message, 409);
    }
    return errorResponse(message, 500);
  }
}

// DELETE /api/timetable — Soft delete a timetable slot
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const authUser = await getAuthenticatedUser(supabase);
    if (!authUser) return errorResponse('Unauthorized', 401);

    const allowedRoles = [
      'super_admin',
      'school_admin',
      'principal',
      'deputy_principal',
      'ict_admin',
    ];
    if (!allowedRoles.includes(authUser.roleName)) {
      return errorResponse('Insufficient permissions', 403);
    }

    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get('slot_id');

    if (!slotId) {
      return errorResponse('slot_id query parameter is required', 400);
    }

    await deleteTimetableSlot(authUser.schoolId, slotId);

    return successResponse(null, 'Timetable slot deleted', 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}
