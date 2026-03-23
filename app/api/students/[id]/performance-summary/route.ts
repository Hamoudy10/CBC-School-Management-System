import {
  STUDENT_READ_ROLES,
  errorResponse,
  getCurrentAcademicContext,
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

  const activeContext = await getCurrentAcademicContext(context.supabase, context.schoolId);
  if (!activeContext.academicYear?.academic_year_id || !activeContext.term?.term_id) {
    return successResponse(
      {
        studentId: params.id,
        academicYearId: '',
        termId: '',
        overallAverage: 0,
        overallLevel: 'below_expectation',
        learningAreas: [],
      },
      'No active academic context found',
    );
  }

  const { data, error } = await context.supabase
    .from('assessment_aggregates')
    .select(
      `
      learning_area_id,
      average_score,
      overall_level,
      learning_areas ( name )
    `,
    )
    .eq('student_id', params.id)
    .eq('academic_year_id', activeContext.academicYear.academic_year_id)
    .eq('term_id', activeContext.term.term_id);

  if (error) {
    return errorResponse(`Failed to fetch performance summary: ${error.message}`, 500);
  }

  const aggregates = data ?? [];
  const learningAreas = aggregates.map((aggregate: any) => ({
    learningAreaId: aggregate.learning_area_id,
    name: toArray(aggregate.learning_areas)[0]?.name ?? 'Unknown',
    averageScore: Number(aggregate.average_score ?? 0),
    level: aggregate.overall_level ?? 'below_expectation',
  }));

  const overallAverage =
    learningAreas.length > 0
      ? learningAreas.reduce((sum: number, area: any) => sum + area.averageScore, 0) /
        learningAreas.length
      : 0;

  const overallLevel =
    overallAverage >= 3.5
      ? 'exceeding'
      : overallAverage >= 2.5
        ? 'meeting'
        : overallAverage >= 1.5
          ? 'approaching'
          : 'below_expectation';

  return successResponse(
    {
      studentId: params.id,
      academicYearId: activeContext.academicYear.academic_year_id,
      termId: activeContext.term.term_id,
      overallAverage,
      overallLevel,
      learningAreas,
    },
    'Performance summary retrieved successfully',
  );
}
