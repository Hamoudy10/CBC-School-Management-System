import {
  STUDENT_READ_ROLES,
  errorResponse,
  getStudentRequestContext,
  successResponse,
} from '@/app/api/students/_utils';

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const context = await getStudentRequestContext(params.id, STUDENT_READ_ROLES);
  if ('error' in context) {
    return context.error;
  }

  const limit = Math.min(
    50,
    Math.max(1, Number(new URL(req.url).searchParams.get('limit') ?? '20')),
  );

  const { data, error } = await context.supabase
    .from('attendance')
    .select('date, status, reason')
    .eq('student_id', params.id)
    .order('date', { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(`Failed to fetch attendance records: ${error.message}`, 500);
  }

  return successResponse(data ?? [], 'Attendance records retrieved successfully');
}
