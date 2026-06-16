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
        .from('attendance')
        .select('status')
        .eq('student_id', student.student_id)
        .gte('date', new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0]),
      supabase
        .from('student_fees')
        .select('id, amount_due, amount_paid, balance, status')
        .eq('student_id', student.student_id)
        .eq('school_id', user.schoolId),
    ]);

    // Fetch payments through student_fees join
    const feeIds = (fees.data ?? []).map((sf: any) => sf.id);
    let recentPayments: any[] = [];
    if (feeIds.length > 0) {
      const { data: paymentRows } = await supabase
        .from('payments')
        .select('amount_paid, payment_date, receipt_number, payment_method')
        .in('student_fee_id', feeIds)
        .order('payment_date', { ascending: false })
        .limit(5);
      recentPayments = paymentRows ?? [];
    }

    const attendanceData = attendance.data ?? [];
    const totalDays = attendanceData.length;
    const presentDays = attendanceData.filter((a: any) => a.status === 'present').length ?? 0;

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
      recentPayments: recentPayments.map((p: any) => ({
        amount: p.amount_paid,
        paidAt: p.payment_date,
        receiptNumber: p.receipt_number,
        paymentMethod: p.payment_method,
      })),
      guardian: guardians.find((g) => g.student_id === student.student_id),
    });
  }

  return successResponse({ students: enriched });
});
