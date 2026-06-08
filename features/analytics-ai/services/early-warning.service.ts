import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { AuthUser } from '@/types/auth';

const earlyWarningOutputSchema = z.object({
  studentId: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskScore: z.number().min(0).max(100),
  signals: z.array(z.object({
    category: z.enum(['attendance', 'academic', 'discipline', 'finance', 'social']),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
    trend: z.enum(['improving', 'stable', 'declining']),
  })),
  recommendedActions: z.array(z.string()),
});

interface EarlyWarningInput {
  classId?: string;
  studentId?: string;
}

interface EarlyWarningResult {
  studentId: string;
  studentName: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  signals: { category: string; severity: string; description: string; trend: string }[];
  recommendedActions: string[];
  confidence: number;
}

async function collectStudentSignals(
  supabase: any,
  studentId: string,
  schoolId: string,
): Promise<Record<string, any>> {
  const [attendance, assessments, discipline, fees] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('status, date')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('date', { ascending: false })
      .limit(60),
    supabase
      .from('assessment_aggregates')
      .select('average_score, overall_level, computed_at')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('computed_at', { ascending: false })
      .limit(10),
    supabase
      .from('disciplinary_records')
      .select('incident_type, severity, created_at')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('student_fees')
      .select('amount_due, status, due_date')
      .eq('student_id', studentId)
      .eq('school_id', schoolId),
  ]);

  const attendanceRecords = attendance.data || [];
  const totalDays = attendanceRecords.length;
  const absences = attendanceRecords.filter((r: any) => r.status === 'Absent').length;
  const attendanceRate = totalDays > 0 ? ((totalDays - absences) / totalDays) * 100 : 100;

  const assessmentScores = (assessments.data || []).map((a: any) => Number(a.average_score || 0));
  const avgScore = assessmentScores.length > 0
    ? assessmentScores.reduce((s: number, v: number) => s + v, 0) / assessmentScores.length
    : 3;
  const scoreTrend = assessmentScores.length >= 2
    ? assessmentScores[0] - assessmentScores[assessmentScores.length - 1]
    : 0;

  const disciplineIncidents = discipline.data || [];
  const recentIncidents = disciplineIncidents.filter(
    (r: any) => r.severity === 'high' || r.severity === 'medium',
  ).length;

  const overdueFees = (fees.data || []).filter((f: any) => f.status === 'overdue').length;
  const totalDue = (fees.data || []).reduce((s: number, f: any) => s + Number(f.amount_due || 0), 0);

  return {
    attendanceRate,
    absences,
    totalDays,
    averageScore: avgScore,
    scoreTrend,
    disciplineIncidents: recentIncidents,
    overdueFees,
    totalDue,
    recentAssessments: assessments.data || [],
    recentDiscipline: disciplineIncidents,
  };
}

export async function checkEarlyWarning(
  input: EarlyWarningInput,
  user: AuthUser,
): Promise<EarlyWarningResult | EarlyWarningResult[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  let query = supabase
    .from('students')
    .select('student_id, first_name, last_name')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  if (input.classId) {
    query = query.eq('current_class_id', input.classId);
  }

  if (input.studentId) {
    query = query.eq('student_id', input.studentId);
  }

  const { data: students } = await query.limit(30);

  if (!students || students.length === 0) {
    throw new Error('No students found');
  }

  const results: EarlyWarningResult[] = [];

  for (const student of students) {
    const signals = await collectStudentSignals(supabase, student.student_id, schoolId);

    try {
      const ai = await generateGroqCompletion<z.infer<typeof earlyWarningOutputSchema>>({
        system: `You are an early warning system for a Kenyan CBC school. You identify at-risk students by analyzing multiple signals:
- Attendance rate (below 80% is concerning)
- Academic performance trend (declining scores)
- Discipline incidents (recent high-severity incidents)
- Financial indicators (overdue fees causing stress)
- Social/behavioral patterns

Provide a risk assessment with specific recommended actions for teachers and administrators.`,
        prompt: `Student: ${student.first_name} ${student.last_name}
School ID: ${schoolId}

Collected Signals:
${JSON.stringify(signals, null, 2)}

Analyze these signals and determine the student's risk level. Provide specific, actionable recommendations.`,
        responseFormat: 'json',
        temperature: 0.2,
        responseSchema: earlyWarningOutputSchema,
        requestLabel: `analytics-ai.early-warning.${student.student_id}`,
        cache: { schoolId },
      });

      const parsed = earlyWarningOutputSchema.parse(ai.data);
      results.push({
        studentId: student.student_id,
        studentName: `${student.first_name} ${student.last_name}`,
        riskLevel: parsed.riskLevel,
        riskScore: parsed.riskScore,
        signals: parsed.signals,
        recommendedActions: parsed.recommendedActions,
        confidence: ai.confidence,
      });
    } catch {
      logger.error('Early warning analysis failed', {
        source: 'early-warning.service',
        studentId: student.student_id,
        schoolId,
      });
      results.push({
        studentId: student.student_id,
        studentName: `${student.first_name} ${student.last_name}`,
        riskLevel: 'low',
        riskScore: 0,
        signals: [],
        recommendedActions: ['Unable to analyze - system error'],
        confidence: 0,
      });
    }
  }

  if (input.studentId) {
    return results[0];
  }

  return results;
}
