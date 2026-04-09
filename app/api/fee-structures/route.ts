export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ─── Response Helpers ─────────────────────────────────────────────────────────

function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createFeeStructureSchema = z.object({
  name: z
    .string()
    .min(1, 'Fee name is required')
    .max(100, 'Fee name must be 100 characters or fewer')
    .trim(),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  fee_type: z.enum(
    ['tuition', 'boarding', 'transport', 'lunch', 'uniform', 'books', 'activity', 'examination', 'other'],
    {
      errorMap: () => ({
        message: 'Invalid fee type',
      }),
    }
  ),
  amount: z
    .number()
    .positive('Amount must be greater than zero')
    .max(10000000, 'Amount exceeds maximum allowed'),
  is_mandatory: z.boolean().default(true),
  is_recurring: z.boolean().default(true),
  frequency: z
    .enum(['once', 'term', 'year', 'month'], {
      errorMap: () => ({ message: 'Frequency must be once, term, year, or month' }),
    })
    .default('term'),
  due_day: z
    .number()
    .int()
    .min(1, 'Due day must be at least 1')
    .max(28, 'Due day must be at most 28')
    .optional()
    .nullable(),
  applies_to: z
    .enum(['all', 'grade', 'class'], {
      errorMap: () => ({ message: 'Applies to must be all, grade, or class' }),
    })
    .default('all'),
  grade_ids: z
    .array(z.string().uuid('Invalid grade ID'))
    .optional()
    .nullable(),
  class_ids: z
    .array(z.string().uuid('Invalid class ID'))
    .optional()
    .nullable(),
  academic_year_id: z.string().uuid('Invalid academic year ID').optional().nullable(),
  term_id: z.string().uuid('Invalid term ID').optional().nullable(),
  is_active: z.boolean().default(true),
});

// ─── Auth Helper ──────────────────────────────────────────────────────────────

interface AuthResult {
  userId: string;
  schoolId: string;
  roleName: string;
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  allowedRoles: string[]
): Promise<{ auth: AuthResult } | { error: NextResponse }> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: errorResponse('Unauthorized', 401) };
  }

  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user?.school_id) {
    return { error: errorResponse('Forbidden — no school associated', 403) };
  }

  const roleName = (user.roles as unknown as Record<string, string>)?.name ?? 'student';

  if (!allowedRoles.includes(roleName)) {
    return { error: errorResponse('Insufficient permissions', 403) };
  }

  return {
    auth: {
      userId: user.user_id,
      schoolId: user.school_id,
      roleName,
    },
  };
}

// ─── GET /api/fee-structures ──────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — finance and admin roles can view fee structures
  const readRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'finance_officer',
    'bursar',
    'ict_admin',
  ];

  const result = await authenticate(supabase, readRoles);
  if ('error' in result) {return result.error;}
  const { schoolId } = result.auth;

  // 2. Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') ?? '50', 10)));
  const feeType = searchParams.get('fee_type') ?? '';
  const isMandatory = searchParams.get('is_mandatory');
  const isRecurring = searchParams.get('is_recurring');
  const isActive = searchParams.get('is_active');
  const frequency = searchParams.get('frequency') ?? '';
  const academicYearId = searchParams.get('academic_year_id') ?? '';
  const termId = searchParams.get('term_id') ?? '';
  const search = searchParams.get('search')?.trim() ?? '';

  const offset = (page - 1) * pageSize;

  // 3. Build query
  let query = supabase
    .from('fee_structures')
    .select(
      `
      *,
      academic_years ( academic_year_id, name ),
      terms ( term_id, name )
    `,
      { count: 'exact' }
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  // 4. Apply filters
  if (feeType) {
    query = query.eq('fee_type', feeType);
  }

  if (isMandatory !== null && isMandatory !== '') {
    query = query.eq('is_mandatory', isMandatory === 'true');
  }

  if (isRecurring !== null && isRecurring !== '') {
    query = query.eq('is_recurring', isRecurring === 'true');
  }

  if (isActive !== null && isActive !== '') {
    query = query.eq('is_active', isActive === 'true');
  }

  if (frequency) {
    query = query.eq('frequency', frequency);
  }

  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId);
  }

  if (termId) {
    query = query.eq('term_id', termId);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // 5. Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  // 6. Execute query
  const { data: feeStructures, count, error } = await query;

  if (error) {
    return errorResponse(`Failed to fetch fee structures: ${error.message}`, 500);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 7. Calculate summary stats
  const { data: allFees } = await supabase
    .from('fee_structures')
    .select('amount, fee_type, is_mandatory, is_active')
    .eq('school_id', schoolId)
    .eq('is_active', true);

  const summary = {
    total_fee_structures: (allFees ?? []).length,
    total_mandatory_amount: (allFees ?? [])
      .filter((f) => f.is_mandatory)
      .reduce((sum, f) => sum + (typeof f.amount === 'number' ? f.amount : 0), 0),
    by_type: {} as Record<string, number>,
  };

  (allFees ?? []).forEach((f) => {
    const fType = f.fee_type as string;
    summary.by_type[fType] = (summary.by_type[fType] ?? 0) + 1;
  });

  return successResponse(
    {
      fee_structures: feeStructures ?? [],
      total: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      summary,
    },
    `Retrieved ${(feeStructures ?? []).length} fee structure(s)`
  );
}

// ─── POST /api/fee-structures ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — only finance and admin roles can create fee structures
  const writeRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'finance_officer',
    'bursar',
  ];

  const result = await authenticate(supabase, writeRoles);
  if ('error' in result) {return result.error;}
  const { schoolId, userId } = result.auth;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = createFeeStructureSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return NextResponse.json(
      { success: false, message: 'Validation failed', data: null, errors: fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 3. Check for duplicate fee name
  const { data: existingFee } = await supabase
    .from('fee_structures')
    .select('fee_structure_id')
    .eq('school_id', schoolId)
    .ilike('name', data.name)
    .maybeSingle();

  if (existingFee) {
    return errorResponse(`A fee structure with name "${data.name}" already exists`, 409);
  }

  // 4. Validate academic_year_id if provided
  if (data.academic_year_id) {
    const { data: validYear } = await supabase
      .from('academic_years')
      .select('academic_year_id')
      .eq('academic_year_id', data.academic_year_id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!validYear) {
      return errorResponse('Academic year not found or does not belong to this school', 400);
    }
  }

  // 5. Validate term_id if provided
  if (data.term_id) {
    const { data: validTerm } = await supabase
      .from('terms')
      .select('term_id')
      .eq('term_id', data.term_id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!validTerm) {
      return errorResponse('Term not found or does not belong to this school', 400);
    }
  }

  // 6. Validate grade_ids if applies_to is 'grade'
  if (data.applies_to === 'grade' && data.grade_ids && data.grade_ids.length > 0) {
    const { data: validGrades } = await supabase
      .from('grades')
      .select('grade_id')
      .eq('school_id', schoolId)
      .in('grade_id', data.grade_ids);

    const validGradeIds = (validGrades ?? []).map((g) => g.grade_id);
    const invalidGradeIds = data.grade_ids.filter((id) => !validGradeIds.includes(id));

    if (invalidGradeIds.length > 0) {
      return errorResponse(
        `${invalidGradeIds.length} grade(s) not found or do not belong to this school`,
        400
      );
    }
  }

  // 7. Validate class_ids if applies_to is 'class'
  if (data.applies_to === 'class' && data.class_ids && data.class_ids.length > 0) {
    const { data: validClasses } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .in('class_id', data.class_ids);

    const validClassIds = (validClasses ?? []).map((c) => c.class_id);
    const invalidClassIds = data.class_ids.filter((id) => !validClassIds.includes(id));

    if (invalidClassIds.length > 0) {
      return errorResponse(
        `${invalidClassIds.length} class(es) not found or do not belong to this school`,
        400
      );
    }
  }

  // 8. Insert fee structure
  const timestamp = new Date().toISOString();

  const { data: newFeeStructure, error: insertError } = await supabase
    .from('fee_structures')
    .insert({
      name: data.name,
      description: data.description ?? null,
      fee_type: data.fee_type,
      amount: data.amount,
      is_mandatory: data.is_mandatory,
      is_recurring: data.is_recurring,
      frequency: data.frequency,
      due_day: data.due_day ?? null,
      applies_to: data.applies_to,
      grade_ids: data.applies_to === 'grade' ? data.grade_ids : null,
      class_ids: data.applies_to === 'class' ? data.class_ids : null,
      academic_year_id: data.academic_year_id ?? null,
      term_id: data.term_id ?? null,
      is_active: data.is_active,
      school_id: schoolId,
      created_by: userId,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select(
      `
      *,
      academic_years ( academic_year_id, name ),
      terms ( term_id, name )
    `
    )
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return errorResponse('A fee structure with this name already exists', 409);
    }
    return errorResponse(`Failed to create fee structure: ${insertError.message}`, 500);
  }

  return successResponse(
    { fee_structure: newFeeStructure },
    'Fee structure created successfully',
    201
  );
}
