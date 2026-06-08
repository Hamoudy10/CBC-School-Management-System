export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import {
  successResponse,
  errorResponse,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

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

// ─── GET /api/fee-structures ──────────────────────────────────────────────────

export const GET = withPermission('finance', 'view', async (req: NextRequest, { user }) => {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

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
    }
  );
});

// ─── POST /api/fee-structures ─────────────────────────────────────────────────

export const POST = withPermission('finance', 'create', async (req: NextRequest, { user }) => {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;
  const userId = user.id;

  // 1. Parse and validate request body
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
    201
  );
});
