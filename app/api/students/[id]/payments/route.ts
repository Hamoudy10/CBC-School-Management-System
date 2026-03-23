import {
  STUDENT_FINANCE_ROLES,
  errorResponse,
  getStudentRequestContext,
  successResponse,
  toArray,
} from '@/app/api/students/_utils';

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const context = await getStudentRequestContext(params.id, STUDENT_FINANCE_ROLES);
  if ('error' in context) {
    return context.error;
  }

  const limit = Math.min(
    50,
    Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? '20')),
  );

  const { data: feeIds, error: feeError } = await context.supabase
    .from('student_fees')
    .select('id')
    .eq('student_id', params.id);

  if (feeError) {
    return errorResponse(`Failed to resolve student fee records: ${feeError.message}`, 500);
  }

  const ids = (feeIds ?? []).map((record: { id: string }) => record.id);
  if (ids.length === 0) {
    return successResponse([], 'No payments found');
  }

  const { data, error } = await context.supabase
    .from('payments')
    .select(
      `
      id,
      amount_paid,
      payment_date,
      payment_method,
      receipt_number,
      student_fees (
        fee_structures ( name )
      )
    `,
    )
    .in('student_fee_id', ids)
    .order('payment_date', { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(`Failed to fetch payments: ${error.message}`, 500);
  }

  const payments = (data ?? []).map((payment: any) => ({
    id: payment.id,
    amount: Number(payment.amount_paid ?? 0),
    paymentDate: payment.payment_date,
    paymentMethod: payment.payment_method,
    receiptNumber: payment.receipt_number ?? '',
    feeName: toArray(toArray(payment.student_fees)[0]?.fee_structures)[0]?.name ?? 'Fee payment',
  }));

  return successResponse(payments, 'Payments retrieved successfully');
}
