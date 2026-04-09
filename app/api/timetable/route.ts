export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withPermission } from '@/lib/api/withAuth';
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import {
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
} from '@/features/timetable/validators/timetable.schema';
import {
  ConflictError,
  TimetableError,
  createTimetableSlot,
  deleteTimetableSlot,
  getTimetableSlots,
  updateTimetableSlot,
} from '@/features/timetable/services/timetable.service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/types/auth';
import type { TimetableFilters } from '@/features/timetable/types';

type TimetableContext = {
  academicYearId: string;
  termId: string;
};

async function getActiveContext(user: AuthUser): Promise<TimetableContext | null> {
  if (!user.schoolId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: activeYear, error: yearError }, { data: activeTerm, error: termError }] =
    await Promise.all([
      supabase
        .from('academic_years')
        .select('academic_year_id')
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .maybeSingle(),
      supabase
        .from('terms')
        .select('term_id')
        .eq('school_id', user.schoolId)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

  if (yearError) {
    throw new TimetableError(yearError.message, 'ACTIVE_YEAR_ERROR', 500);
  }

  if (termError) {
    throw new TimetableError(termError.message, 'ACTIVE_TERM_ERROR', 500);
  }

  if (!activeYear?.academic_year_id || !activeTerm?.term_id) {
    return null;
  }

  return {
    academicYearId: activeYear.academic_year_id,
    termId: activeTerm.term_id,
  };
}

async function getUserTeacherId(user: AuthUser): Promise<string | null> {
  if (!user.schoolId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id')
    .eq('school_id', user.schoolId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new TimetableError(error.message, 'STAFF_LOOKUP_ERROR', 500);
  }

  return data?.staff_id ?? null;
}

async function getUserStudentClassId(user: AuthUser): Promise<string | null> {
  if (!user.schoolId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('current_class_id')
    .eq('school_id', user.schoolId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new TimetableError(error.message, 'STUDENT_LOOKUP_ERROR', 500);
  }

  return data?.current_class_id ?? null;
}

function mapFilters(searchParams: URLSearchParams, context: TimetableContext): TimetableFilters {
  const filters: TimetableFilters = {
    academicYearId:
      searchParams.get('academic_year_id') ??
      searchParams.get('academicYearId') ??
      context.academicYearId,
    termId: searchParams.get('term_id') ?? searchParams.get('termId') ?? context.termId,
    page: Number(searchParams.get('page') ?? '1'),
    limit: Number(searchParams.get('limit') ?? searchParams.get('pageSize') ?? '200'),
    isActive: searchParams.has('is_active')
      ? searchParams.get('is_active') === 'true'
      : searchParams.has('isActive')
        ? searchParams.get('isActive') === 'true'
        : true,
  };

  const classId = searchParams.get('class_id') ?? searchParams.get('classId');
  const teacherId = searchParams.get('teacher_id') ?? searchParams.get('teacherId');
  const learningAreaId =
    searchParams.get('learning_area_id') ?? searchParams.get('learningAreaId');
  const dayOfWeek = searchParams.get('day_of_week') ?? searchParams.get('dayOfWeek');

  if (classId) {
    filters.classId = classId;
  }

  if (teacherId) {
    filters.teacherId = teacherId;
  }

  if (learningAreaId) {
    filters.learningAreaId = learningAreaId;
  }

  if (dayOfWeek) {
    filters.dayOfWeek = Number(dayOfWeek) as TimetableFilters['dayOfWeek'];
  }

  return filters;
}

function handleTimetableError(error: unknown) {
  if (error instanceof ConflictError) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error.message,
        conflicts: error.conflicts,
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof TimetableError) {
    return errorResponse(error.message, error.statusCode);
  }

  return errorResponse(
    error instanceof Error ? error.message : 'Failed to process timetable request',
    500
  );
}

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    const context = await getActiveContext(user);
    if (!context) {
      return errorResponse(
        'No active academic year or term. Please configure the academic calendar first.',
        400
      );
    }

    const filters = mapFilters(new URL(request.url).searchParams, context);

    if (
      ['teacher', 'class_teacher', 'subject_teacher'].includes(user.role) &&
      !filters.teacherId &&
      !filters.classId
    ) {
      const teacherId = await getUserTeacherId(user);
      if (teacherId) {
        filters.teacherId = teacherId;
      }
    }

    if (user.role === 'student' && !filters.classId) {
      const classId = await getUserStudentClassId(user);
      if (classId) {
        filters.classId = classId;
      }
    }

    const result = await getTimetableSlots(filters, user);
    return successResponse(result.data, {
      page: filters.page,
      pageSize: filters.limit,
      total: result.total,
      totalPages:
        filters.limit && filters.limit > 0
          ? Math.max(1, Math.ceil(result.total / filters.limit))
          : 1,
    });
  } catch (error) {
    return handleTimetableError(error);
  }
});

export const POST = withPermission('timetable', 'create', async (request, { user }) => {
  try {
    const validation = await validateBody(request, createTimetableSlotSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const context = await getActiveContext(user);
    if (!context) {
      return errorResponse(
        'No active academic year or term. Please configure the academic calendar first.',
        400
      );
    }

    const slot = await createTimetableSlot(
      {
        ...validation.data,
        academicYearId: context.academicYearId,
        termId: context.termId,
      },
      user
    );

    return NextResponse.json(
      {
        success: true,
        data: slot,
        error: null,
        message: 'Timetable slot created',
      },
      { status: 201 }
    );
  } catch (error) {
    return handleTimetableError(error);
  }
});

export const PATCH = withPermission('timetable', 'update', async (request, { user }) => {
  try {
    const body = await request.json();
    const slotId = body.slotId ?? body.slot_id;

    if (!slotId || typeof slotId !== 'string') {
      return errorResponse('slotId is required', 400);
    }

    const validation = validateBody(
      Object.fromEntries(
        Object.entries(body).filter(([key]) => !['slotId', 'slot_id'].includes(key))
      ),
      updateTimetableSlotSchema
    );

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const slot = await updateTimetableSlot(slotId, validation.data, user);
    return successResponse(slot);
  } catch (error) {
    return handleTimetableError(error);
  }
});

export const DELETE = withPermission('timetable', 'delete', async (request, { user }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const slotId = searchParams.get('slot_id') ?? searchParams.get('slotId');

    if (!slotId) {
      return errorResponse('slot_id query parameter is required', 400);
    }

    await deleteTimetableSlot(slotId, user);
    return successResponse({ deleted: true });
  } catch (error) {
    return handleTimetableError(error);
  }
});
