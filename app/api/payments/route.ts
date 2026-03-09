// @ts-nocheck
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

const createPaymentSchema = z.object({
  student_fee_id: z.string().uuid('Invalid student fee ID'),
  amount: z
    .number()
    .positive('Payment amount must be greater than zero')
    .max(10000000, 'Payment amount exceeds maximum allowed'),
  payment_method: z.enum(
    ['cash', 'mpesa', 'bank_transfer', 'cheque', 'card', 'other'],
    {
      errorMap: () => ({
        message: 'Payment method must be cash, mpesa, bank_transfer, cheque, card, or other',
      }),
    }
  ),
  payment_reference: z
    .string()
    .max(100, 'Payment reference must be 100 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  payment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Payment date must be in YYYY-MM-DD format')
    .optional(),
  notes: z
    .string()
    .max(500, 'Notes must be 500 characters or fewer')
    .trim()
    .optional()
    .nullable(),
});

const bulkPaymentSchema = z.object({
  payments: z
    .array(createPaymentSchema)
    .min(1, 'At least one payment is required')
    .max(50, 'Maximum 50 payments per request'),
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

  const roleName = (user.roles as Record<string, string>)?.name ?? 'student';

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

// ─── GET /api/payments ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — finance and admin roles can view payments
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
  if ('error' in result) return result.error;
  const { schoolId } = result.auth;

  // 2. Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') ?? '20', 10)));
  const studentId = searchParams.get('student_id') ?? '';
  const paymentMethod = searchParams.get('payment_method') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const search = searchParams.get('search')?.trim() ?? '';

  const offset = (page - 1) * pageSize;

  // 3. Build query
  let query = supabase
    .from('payments')
    .select(
      `
      payment_id,
      student_fee_id,
      amount,
      payment_method,
      payment_reference,
      payment_date,
      notes,
      received_by,
      created_at,
      student_fees (
        student_id,
        amount as fee_amount,
        students (
          student_id,
          first_name,
          last_name,
          admission_number
        ),
        fee_structures (
          name,
          fee_type
        )
      ),
      users:received_by (
        user_id,
        email
      )
    `,
      { count: 'exact' }
    )
    .eq('school_id', schoolId)
    .order('payment_date', { ascending: false });

  // 4. Apply filters
  if (studentId) {
    // Need to filter via student_fees relation
    const { data: studentFeeIds } = await supabase
      .from('student_fees')
      .select('student_fee_id')
      .eq('student_id', studentId);

    const feeIds = (studentFeeIds ?? []).map((f) => f.student_fee_id);
    if (feeIds.length === 0) {
      return successResponse(
        { payments: [], total: 0, page, page_size: pageSize, total_pages: 0 },
        'No payments found for this student'
      );
    }
    query = query.in('student_fee_id', feeIds);
  }

  if (paymentMethod) {
    query = query.eq('payment_method', paymentMethod);
  }

  if (dateFrom) {
    query = query.gte('payment_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('payment_date', dateTo);
  }

  if (search) {
    query = query.ilike('payment_reference', `%${search}%`);
  }

  // 5. Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  // 6. Execute query
  const { data: payments, count, error } = await query;

  if (error) {
    return errorResponse(`Failed to fetch payments: ${error.message}`, 500);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 7. Transform response
  const transformedPayments = (payments ?? []).map((payment) => {
    const studentFee = payment.student_fees as Record<string, unknown> | null;
    const student = studentFee?.students as Record<string, unknown> | null;
    const feeStructure = studentFee?.fee_structures as Record<string, unknown> | null;
    const receiver = payment.users as Record<string, unknown> | null;

    return {
      payment_id: payment.payment_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_reference: payment.payment_reference,
      payment_date: payment.payment_date,
      notes: payment.notes,
      created_at: payment.created_at,
      student: student
        ? {
            student_id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            admission_number: student.admission_number,
          }
        : null,
      fee: feeStructure
        ? {
            name: feeStructure.name,
            fee_type: feeStructure.fee_type,
            total_amount: studentFee?.fee_amount,
          }
        : null,
      received_by: receiver?.email ?? null,
    };
  });

  return successResponse(
    {
      payments: transformedPayments,
      total: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    },
    `Retrieved ${transformedPayments.length} payment(s)`
  );
}

// ─── POST /api/payments ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — finance roles can record payments
  const writeRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'finance_officer',
    'bursar',
  ];

  const result = await authenticate(supabase, writeRoles);
  if ('error' in result) return result.error;
  const { schoolId, userId } = result.auth;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  // Check if it's a bulk payment or single payment
  const isBulk = Array.isArray((body as Record<string, unknown>)?.payments);

  if (isBulk) {
    // Bulk payment processing
    const parsed = bulkPaymentSchema.safeParse(body);
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

    const { payments } = parsed.data;
    const results: Array<{ success: boolean; payment_id?: string; error?: string; index: number }> = [];

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i];
      const processResult = await processPayment(supabase, payment, schoolId, userId);
      results.push({ ...processResult, index: i });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return successResponse(
      { results, success_count: successCount, fail_count: failCount },
      `Processed ${successCount} payment(s) successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
      failCount > 0 ? 207 : 201
    );
  } else {
    // Single payment processing
    const parsed = createPaymentSchema.safeParse(body);
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

    const processResult = await processPayment(supabase, parsed.data, schoolId, userId);

    if (!processResult.success) {
      return errorResponse(processResult.error ?? 'Payment processing failed', 400);
    }

    // Fetch the created payment with relations for response
    const { data: createdPayment } = await supabase
      .from('payments')
      .select(
        `
        payment_id,
        amount,
        payment_method,
        payment_reference,
        payment_date,
        notes,
        created_at,
        student_fees (
          student_id,
          amount,
          paid_amount,
          balance,
          students ( first_name, last_name, admission_number ),
          fee_structures ( name, fee_type )
        )
      `
      )
      .eq('payment_id', processResult.payment_id)
      .single();

    return successResponse(
      { payment: createdPayment },
      'Payment recorded successfully',
      201
    );
  }
}

// ─── Payment Processing Helper ────────────────────────────────────────────────

interface PaymentInput {
  student_fee_id: string;
  amount: number;
  payment_method: 'cash' | 'mpesa' | 'bank_transfer' | 'cheque' | 'card' | 'other';
  payment_reference?: string | null;
  payment_date?: string;
  notes?: string | null;
}

async function processPayment(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payment: PaymentInput,
  schoolId: string,
  userId: string
): Promise<{ success: boolean; payment_id?: string; error?: string }> {
  // 1. Verify student_fee exists and get current balance
  const { data: studentFee, error: feeError } = await supabase
    .from('student_fees')
    .select(
      `
      student_fee_id,
      student_id,
      amount,
      paid_amount,
      balance,
      students ( school_id )
    `
    )
    .eq('student_fee_id', payment.student_fee_id)
    .maybeSingle();

  if (feeError) {
    return { success: false, error: `Failed to verify fee: ${feeError.message}` };
  }

  if (!studentFee) {
    return { success: false, error: 'Student fee record not found' };
  }

  // 2. Verify the student belongs to this school
  const studentSchoolId = (studentFee.students as Record<string, unknown> | null)?.school_id;
  if (studentSchoolId !== schoolId) {
    return { success: false, error: 'Student fee does not belong to this school' };
  }

  // 3. Validate payment amount against balance
  const currentBalance = typeof studentFee.balance === 'number' ? studentFee.balance : 0;

  if (currentBalance <= 0) {
    return { success: false, error: 'This fee has already been fully paid' };
  }

  if (payment.amount > currentBalance) {
    return {
      success: false,
      error: `Payment amount (${payment.amount}) exceeds outstanding balance (${currentBalance})`,
    };
  }

  // 4. Validate payment date is not in the future
  const paymentDate = payment.payment_date ?? new Date().toISOString().split('T')[0];
  if (new Date(paymentDate) > new Date()) {
    return { success: false, error: 'Payment date cannot be in the future' };
  }

  // 5. Check for duplicate payment reference (if provided)
  if (payment.payment_reference) {
    const { data: existingRef } = await supabase
      .from('payments')
      .select('payment_id')
      .eq('school_id', schoolId)
      .eq('payment_reference', payment.payment_reference)
      .maybeSingle();

    if (existingRef) {
      return {
        success: false,
        error: `Payment reference "${payment.payment_reference}" already exists`,
      };
    }
  }

  // 6. Insert payment record
  const { data: newPayment, error: insertError } = await supabase
    .from('payments')
    .insert({
      student_fee_id: payment.student_fee_id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_reference: payment.payment_reference ?? null,
      payment_date: paymentDate,
      notes: payment.notes ?? null,
      received_by: userId,
      school_id: schoolId,
      created_at: new Date().toISOString(),
    })
    .select('payment_id')
    .single();

  if (insertError) {
    return { success: false, error: `Failed to record payment: ${insertError.message}` };
  }

  // 7. Update student_fees (the DB trigger should handle this, but we do it explicitly for safety)
  const newPaidAmount = (typeof studentFee.paid_amount === 'number' ? studentFee.paid_amount : 0) + payment.amount;
  const newBalance = (typeof studentFee.amount === 'number' ? studentFee.amount : 0) - newPaidAmount;

  // Determine new status
  let newStatus = 'partial';
  if (newBalance <= 0) {
    newStatus = 'paid';
  } else if (newPaidAmount === 0) {
    newStatus = 'unpaid';
  }

  const { error: updateError } = await supabase
    .from('student_fees')
    .update({
      paid_amount: newPaidAmount,
      balance: Math.max(0, newBalance),
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('student_fee_id', payment.student_fee_id);

  if (updateError) {
    // Payment was recorded but balance update failed — log for manual review
    console.error('Failed to update student_fees balance:', updateError.message);
    // Don't fail the request since the payment was recorded
  }

  return { success: true, payment_id: newPayment.payment_id };
}
