import {
  STUDENT_READ_ROLES,
  errorResponse,
  getCurrentAcademicContext,
  getStudentRequestContext,
  successResponse,
} from '@/app/api/students/_utils';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const context = await getStudentRequestContext(params.id, STUDENT_READ_ROLES);
  if ('error' in context) {
    return context.error;
  }

  const activeContext = await getCurrentAcademicContext(context.supabase, context.schoolId);
  if (!activeContext.term?.term_id) {
    return successResponse(
      {
        studentId: params.id,
        termId: '',
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        excusedDays: 0,
        attendanceRate: 0,
      },
      'No active term found',
    );
  }

  const { data, error } = await context.supabase
    .from('attendance')
    .select('status')
    .eq('student_id', params.id)
    .eq('term_id', activeContext.term.term_id);

  if (error) {
    return errorResponse(`Failed to fetch attendance summary: ${error.message}`, 500);
  }

  const records = data ?? [];
  const totalDays = records.length;
  const presentDays = records.filter((record: { status: string }) => record.status === 'present').length;
  const absentDays = records.filter((record: { status: string }) => record.status === 'absent').length;
  const lateDays = records.filter((record: { status: string }) => record.status === 'late').length;
  const excusedDays = records.filter((record: { status: string }) => record.status === 'excused').length;

  return successResponse(
    {
      studentId: params.id,
      termId: activeContext.term.term_id,
      totalDays,
      presentDays,
      absentDays,
      lateDays,
      excusedDays,
      attendanceRate: totalDays > 0 ? ((presentDays + lateDays) / totalDays) * 100 : 0,
    },
    'Attendance summary retrieved successfully',
  );
}
