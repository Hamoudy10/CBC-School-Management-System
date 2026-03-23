import {
  STUDENT_FINANCE_ROLES,
  errorResponse,
  getCurrentAcademicContext,
  getStudentRequestContext,
  successResponse,
} from '@/app/api/students/_utils';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const context = await getStudentRequestContext(params.id, STUDENT_FINANCE_ROLES);
  if ('error' in context) {
    return context.error;
  }

  const activeContext = await getCurrentAcademicContext(context.supabase, context.schoolId);
  if (!activeContext.academicYear?.academic_year_id) {
    return successResponse(
      {
        studentId: params.id,
        academicYearId: '',
        totalDue: 0,
        totalPaid: 0,
        balance: 0,
        status: 'pending',
      },
      'No active academic year found',
    );
  }

  let query = context.supabase
    .from('student_fees')
    .select('amount_due, amount_paid, balance, status')
    .eq('student_id', params.id)
    .eq('academic_year_id', activeContext.academicYear.academic_year_id);

  if (activeContext.term?.term_id) {
    query = query.eq('term_id', activeContext.term.term_id);
  }

  const { data, error } = await query;
  if (error) {
    return errorResponse(`Failed to fetch fee summary: ${error.message}`, 500);
  }

  const fees = data ?? [];
  const totalDue = fees.reduce((sum: number, fee: any) => sum + Number(fee.amount_due ?? 0), 0);
  const totalPaid = fees.reduce((sum: number, fee: any) => sum + Number(fee.amount_paid ?? 0), 0);
  const balance = fees.reduce((sum: number, fee: any) => sum + Number(fee.balance ?? 0), 0);

  const status =
    balance <= 0
      ? 'paid'
      : totalPaid > 0
        ? 'partial'
        : fees.some((fee: any) => fee.status === 'overdue')
          ? 'overdue'
          : 'pending';

  return successResponse(
    {
      studentId: params.id,
      academicYearId: activeContext.academicYear.academic_year_id,
      termId: activeContext.term?.term_id ?? undefined,
      totalDue,
      totalPaid,
      balance,
      status,
    },
    'Fee summary retrieved successfully',
  );
}
