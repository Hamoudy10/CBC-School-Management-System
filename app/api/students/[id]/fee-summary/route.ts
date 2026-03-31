import {
  STUDENT_FINANCE_ROLES,
  errorResponse,
  getCurrentAcademicContext,
  getStudentRequestContext,
  successResponse,
} from '@/app/api/students/_utils';
import { getCurrentFinanceSnapshot } from '@/lib/finance/currentObligations';

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

  let financeSummary;
  try {
    const snapshot = await getCurrentFinanceSnapshot({
      supabase: context.supabase,
      schoolId: context.schoolId!,
      academicYearId: activeContext.academicYear.academic_year_id,
      termId: activeContext.term?.term_id,
      studentId: params.id,
      includeInactive: true,
    });
    financeSummary = snapshot.students[0];
  } catch (error) {
    return errorResponse(
      `Failed to fetch fee summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
    );
  }

  return successResponse(
    {
      studentId: params.id,
      academicYearId: activeContext.academicYear.academic_year_id,
      termId: activeContext.term?.term_id ?? undefined,
      totalDue: financeSummary?.totalDue ?? 0,
      totalPaid: financeSummary?.totalPaid ?? 0,
      balance: financeSummary?.balance ?? 0,
      status: financeSummary?.status ?? 'pending',
    },
    'Fee summary retrieved successfully',
  );
}
