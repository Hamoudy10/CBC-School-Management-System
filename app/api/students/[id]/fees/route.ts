import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ─── Response Helpers ─────────────────────────────────────────────────────────

function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Auth Helper ──────────────────────────────────────────────────────────────

interface AuthResult {
  userId: string;
  schoolId: string;
  roleName: string;
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
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

  return {
    auth: {
      userId: user.user_id,
      schoolId: user.school_id,
      roleName,
    },
  };
}

// ─── Param Validation ─────────────────────────────────────────────────────────

interface RouteContext {
  params: { id: string };
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateStudentId(id: string): NextResponse | null {
  if (!id || !uuidRegex.test(id)) {
    return errorResponse('Invalid student ID format', 400);
  }
  return null;
}

// ─── GET /api/students/[id]/fees ──────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth
  const result = await authenticate(supabase);
  if ('error' in result) {return result.error;}
  const { schoolId, roleName, userId } = result.auth;

  // 2. Validate ID
  const idError = validateStudentId(params.id);
  if (idError) {return idError;}

  const studentId = params.id;

  // 3. Role check — finance roles, admin, teachers, and parents (scoped)
  const allowedRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'finance_officer',
    'bursar',
    'teacher',
    'class_teacher',
    'ict_admin',
    'parent',
    'student',
  ];

  if (!allowedRoles.includes(roleName)) {
    return errorResponse('Insufficient permissions', 403);
  }

  // 4. Parent scoping — verify they are linked to this student
  if (roleName === 'parent') {
    const { data: guardianLink } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!guardianLink) {
      return errorResponse('You do not have access to this student\'s fee records', 403);
    }
  }

  // 5. Student scoping — can only view their own fees
  if (roleName === 'student') {
    const { data: studentRecord } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!studentRecord) {
      return errorResponse('You can only view your own fee records', 403);
    }
  }

  // 6. Verify student exists and belongs to this school
  const { data: student } = await supabase
    .from('students')
    .select('student_id, first_name, last_name, admission_number, current_class_id')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!student) {
    return errorResponse('Student not found', 404);
  }

  // 7. Parse query params for filtering
  const { searchParams } = new URL(req.url);
  const termId = searchParams.get('term_id') ?? '';
  const academicYearId = searchParams.get('academic_year_id') ?? '';
  const status = searchParams.get('status') ?? ''; // 'paid', 'partial', 'unpaid', 'overdue'
  const includePayments = searchParams.get('include_payments') === 'true';

  // 8. Fetch student fees with fee structure details
  let feesQuery = supabase
    .from('student_fees')
    .select(
      `
      student_fee_id,
      student_id,
      fee_structure_id,
      amount,
      paid_amount,
      balance,
      due_date,
      status,
      term_id,
      academic_year_id,
      created_at,
      updated_at,
      fee_structures (
        fee_structure_id,
        name,
        description,
        fee_type,
        amount as structure_amount,
        is_mandatory,
        is_recurring
      ),
      terms (
        term_id,
        name
      ),
      academic_years (
        academic_year_id,
        name
      )
    `
    )
    .eq('student_id', studentId)
    .order('due_date', { ascending: true });

  // 9. Apply filters
  if (termId) {
    feesQuery = feesQuery.eq('term_id', termId);
  }

  if (academicYearId) {
    feesQuery = feesQuery.eq('academic_year_id', academicYearId);
  }

  if (status) {
    feesQuery = feesQuery.eq('status', status);
  }

  const { data: fees, error: feesError } = await feesQuery as any;

  if (feesError) {
    return errorResponse(`Failed to fetch student fees: ${feesError.message}`, 500);
  }

  const feesList = (fees ?? []) as any[];

  // 10. If include_payments, fetch payment history for each fee
  const paymentsMap: Map<string, Array<Record<string, unknown>>> = new Map();

  if (includePayments && feesList.length > 0) {
    const studentFeeIds = feesList.map((f) => f.student_fee_id);

    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select(
        `
        payment_id,
        student_fee_id,
        amount,
        payment_method,
        payment_reference,
        payment_date,
        received_by,
        notes,
        created_at,
        users:received_by (
          user_id,
          email
        )
      `
      )
      .in('student_fee_id', studentFeeIds)
      .order('payment_date', { ascending: false });

    if (paymentsError) {
      console.error('Failed to fetch payments:', paymentsError.message);
      // Continue without payments rather than failing the whole request
    } else {
      (payments ?? []).forEach((payment) => {
        const feeId = payment.student_fee_id as string;
        const existing = paymentsMap.get(feeId) ?? [];
        existing.push({
          payment_id: payment.payment_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_reference: payment.payment_reference,
          payment_date: payment.payment_date,
          notes: payment.notes,
          received_by_email:
            (payment.users as unknown as Record<string, unknown> | null)?.email ?? null,
          created_at: payment.created_at,
        });
        paymentsMap.set(feeId, existing);
      });
    }
  }

  // 11. Transform fees with optional payments
  const feesWithDetails = feesList.map((fee) => {
    const feeStructure = fee.fee_structures as Record<string, unknown> | null;
    const term = fee.terms as Record<string, unknown> | null;
    const academicYear = fee.academic_years as Record<string, unknown> | null;

    // Calculate status if not already set
    let computedStatus = fee.status;
    if (!computedStatus) {
      const balance = typeof fee.balance === 'number' ? fee.balance : 0;
      const paidAmount = typeof fee.paid_amount === 'number' ? fee.paid_amount : 0;
      const amount = typeof fee.amount === 'number' ? fee.amount : 0;

      if (balance <= 0) {
        computedStatus = 'paid';
      } else if (paidAmount > 0) {
        computedStatus = 'partial';
      } else if (fee.due_date && new Date(fee.due_date) < new Date()) {
        computedStatus = 'overdue';
      } else {
        computedStatus = 'unpaid';
      }
    }

    // Check if overdue
    const isOverdue =
      fee.due_date &&
      new Date(fee.due_date) < new Date() &&
      (typeof fee.balance === 'number' ? fee.balance : 0) > 0;

    const result: Record<string, unknown> = {
      student_fee_id: fee.student_fee_id,
      fee_structure_id: fee.fee_structure_id,
      fee_name: feeStructure?.name ?? 'Unknown Fee',
      fee_description: feeStructure?.description ?? null,
      fee_type: feeStructure?.fee_type ?? 'other',
      is_mandatory: feeStructure?.is_mandatory ?? false,
      is_recurring: feeStructure?.is_recurring ?? false,
      amount: fee.amount,
      paid_amount: fee.paid_amount,
      balance: fee.balance,
      due_date: fee.due_date,
      status: computedStatus,
      is_overdue: isOverdue,
      term_id: fee.term_id,
      term_name: term?.name ?? null,
      academic_year_id: fee.academic_year_id,
      academic_year_name: academicYear?.name ?? null,
      created_at: fee.created_at,
      updated_at: fee.updated_at,
    };

    if (includePayments) {
      result.payments = paymentsMap.get(fee.student_fee_id) ?? [];
    }

    return result;
  });

  // 12. Calculate summary totals
  const summary = {
    total_fees: feesList.reduce(
      (sum, f) => sum + (typeof f.amount === 'number' ? f.amount : 0),
      0
    ),
    total_paid: feesList.reduce(
      (sum, f) => sum + (typeof f.paid_amount === 'number' ? f.paid_amount : 0),
      0
    ),
    total_balance: feesList.reduce(
      (sum, f) => sum + (typeof f.balance === 'number' ? f.balance : 0),
      0
    ),
    fee_count: feesList.length,
    paid_count: feesList.filter(
      (f) => (typeof f.balance === 'number' ? f.balance : 0) <= 0
    ).length,
    partial_count: feesList.filter(
      (f) =>
        (typeof f.paid_amount === 'number' ? f.paid_amount : 0) > 0 &&
        (typeof f.balance === 'number' ? f.balance : 0) > 0
    ).length,
    unpaid_count: feesList.filter(
      (f) =>
        (typeof f.paid_amount === 'number' ? f.paid_amount : 0) === 0 &&
        (typeof f.balance === 'number' ? f.balance : 0) > 0
    ).length,
    overdue_count: feesList.filter(
      (f) =>
        f.due_date &&
        new Date(f.due_date) < new Date() &&
        (typeof f.balance === 'number' ? f.balance : 0) > 0
    ).length,
  };

  // 13. Group fees by type for easier display
  const feesByType: Record<string, Array<Record<string, unknown>>> = {};
  feesWithDetails.forEach((fee) => {
    const feeType = (fee.fee_type as string) ?? 'other';
    if (!feesByType[feeType]) {
      feesByType[feeType] = [];
    }
    feesByType[feeType].push(fee);
  });

  // 14. Get available terms and academic years for filter dropdowns
  const { data: availableTerms } = await supabase
    .from('student_fees')
    .select('term_id, terms ( term_id, name )')
    .eq('student_id', studentId)
    .not('term_id', 'is', null);

  const uniqueTerms = new Map<string, { term_id: string; name: string }>();
  (availableTerms ?? []).forEach((f) => {
    const term = f.terms as unknown as Record<string, string> | null;
    if (term?.term_id) {
      uniqueTerms.set(term.term_id, { term_id: term.term_id, name: term.name });
    }
  });

  const { data: availableYears } = await supabase
    .from('student_fees')
    .select('academic_year_id, academic_years ( academic_year_id, name )')
    .eq('student_id', studentId)
    .not('academic_year_id', 'is', null);

  const uniqueYears = new Map<string, { academic_year_id: string; name: string }>();
  (availableYears ?? []).forEach((f) => {
    const year = f.academic_years as unknown as Record<string, string> | null;
    if (year?.academic_year_id) {
      uniqueYears.set(year.academic_year_id, {
        academic_year_id: year.academic_year_id,
        name: year.name,
      });
    }
  });

  // 15. Compose response
  return successResponse(
    {
      student: {
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`,
        admission_number: student.admission_number,
      },
      summary,
      fees: feesWithDetails,
      fees_by_type: feesByType,
      filters: {
        terms: Array.from(uniqueTerms.values()),
        academic_years: Array.from(uniqueYears.values()),
      },
    },
    `Retrieved ${feesList.length} fee record(s) for student`
  );
}
