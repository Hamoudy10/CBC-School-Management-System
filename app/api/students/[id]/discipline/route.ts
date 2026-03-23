import {
  STUDENT_READ_ROLES,
  errorResponse,
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

  const { data, error } = await context.supabase
    .from('disciplinary_records')
    .select('id, incident_date, incident_type, severity, description, action_taken')
    .eq('student_id', params.id)
    .order('incident_date', { ascending: false });

  if (error) {
    return errorResponse(`Failed to fetch discipline records: ${error.message}`, 500);
  }

  const records = (data ?? []).map((record: any) => ({
    id: record.id,
    incidentDate: record.incident_date,
    incidentType: record.incident_type,
    severity: record.severity,
    description: record.description,
    actionTaken: record.action_taken ?? '',
    status: 'open',
  }));

  return successResponse(records, 'Discipline records retrieved successfully');
}
