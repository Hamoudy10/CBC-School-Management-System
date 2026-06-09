export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const GET = withAuth(async (_request: NextRequest, { user }) => {
  if (user.role !== 'parent') {
    return errorResponse('Only parents can access this endpoint', 403);
  }

  const supabase = await createSupabaseServerClient();

  const { data: guardians } = await supabase
    .from('student_guardians')
    .select('student_id, relationship, is_primary_contact')
    .eq('guardian_user_id', user.id);

  if (!guardians || guardians.length === 0) {
    return successResponse({ students: [], message: 'No linked students found' });
  }

  const studentIds = guardians.map((g) => g.student_id);

  const { data: students } = await supabase
    .from('students')
    .select(`
      student_id, first_name, last_name, admission_number, status,
      classes(name, grade_level, stream)
    `)
    .in('student_id', studentIds);

  const enriched: any[] = [];
  for (const student of students ?? []) {
    const [aggregates, attendance, fees] = await Promise.all([
      supabase
        .from('assessment_aggregates')
        .select('average_score, overall_level, total_competencies, learning_areas(name)')
        .eq('student_id', student.student_id)
        .order('computed_at', { ascending: false })
        .limit(10),
      supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', student.student_id)
        .gte('date', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]),
      supabase
        .from('fee_payments')
        .select('amount, paid_at')
        .eq('student_id', student.student_id)
        .order('paid_at', { ascending: false })
        .limit(5),
    ]);

    const totalDays = attendance.data?.length ?? 0;
    const presentDays = attendance.data?.filter((a) => a.status === 'present').length ?? 0;

    enriched.push({
      studentId: student.student_id,
      firstName: student.first_name,
      lastName: student.last_name,
      admissionNumber: student.admission_number,
      status: student.status,
      className: (student.classes as any)?.name ?? '',
      gradeLevel: (student.classes as any)?.grade_level ?? '',
      performance: (aggregates.data ?? []).map((a: any) => ({
        learningArea: (a.learning_areas as any)?.name ?? 'Unknown',
        averageScore: a.average_score,
        overallLevel: a.overall_level,
        totalCompetencies: a.total_competencies,
      })),
      attendance: {
        totalDays,
        presentDays,
        absentDays: totalDays - presentDays,
        attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
      },
      recentPayments: (fees.data ?? []).map((p: any) => ({
        amount: p.amount,
        paidAt: p.paid_at,
      })),
      guardian: guardians.find((g) => g.student_id === student.student_id),
    });
  }

  return successResponse({ students: enriched });
});
