import {
  STUDENT_READ_ROLES,
  errorResponse,
  getStudentRequestContext,
  successResponse,
  toArray,
} from '@/app/api/students/_utils';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const context = await getStudentRequestContext(params.id, STUDENT_READ_ROLES);
  if ('error' in context) {
    return context.error;
  }

  const { data, error } = await context.supabase
    .from('student_classes')
    .select(
      `
      id,
      student_id,
      class_id,
      academic_year_id,
      term_id,
      status,
      created_at,
      classes (
        name,
        grades ( name )
      ),
      academic_years ( year ),
      terms ( name )
    `,
    )
    .eq('student_id', params.id)
    .order('created_at', { ascending: false });

  if (error) {
    return errorResponse(`Failed to fetch class history: ${error.message}`, 500);
  }

  const history = (data ?? []).map((record: any) => {
    const classRow = toArray(record.classes)[0];
    const yearRow = toArray(record.academic_years)[0];
    const termRow = toArray(record.terms)[0];

    return {
      id: record.id,
      studentId: record.student_id,
      classId: record.class_id,
      academicYearId: record.academic_year_id,
      termId: record.term_id,
      status: record.status,
      createdAt: record.created_at,
      className: classRow?.name ?? '',
      gradeName: toArray(classRow?.grades)[0]?.name ?? '',
      academicYear: yearRow?.year ?? '',
      termName: termRow?.name ?? '',
    };
  });

  return successResponse(history, 'Class history retrieved successfully');
}
