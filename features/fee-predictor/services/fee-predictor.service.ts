import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import type { AuthUser } from '@/types/auth';
import type { FeePredictionResult, PaymentPattern } from '../types';
import type { AnalyzeFeeRiskInput } from '../validators/fee-predictor.schema';

const predictionOutputSchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']),
  riskScore: z.number().min(0).max(100),
  factors: z.array(z.object({
    name: z.string(),
    impact: z.enum(['positive', 'negative']),
    description: z.string(),
  })),
  recommendations: z.array(z.object({
    action: z.string(),
    priority: z.enum(['immediate', 'soon', 'monitor']),
    expectedImpact: z.string(),
  })),
  optimalReminderDay: z.number().int().min(1).max(28),
});

async function getPaymentPatterns(
  supabase: any,
  studentId: string,
  schoolId: string,
): Promise<PaymentPattern> {
  // Fetch student_fees for this student, then payments through student_fee_id
  const { data: studentFeeRows } = await supabase
    .from('student_fees')
    .select('id')
    .eq('student_id', studentId)
    .eq('school_id', schoolId);

  const feeIds = (studentFeeRows ?? []).map((sf: any) => sf.id);
  if (feeIds.length === 0) {
    return {
      totalPayments: 0,
      averageAmount: 0,
      paymentFrequency: 0,
      preferredMethod: 'unknown',
      averageDaysLate: 0,
      onTimeRate: 0,
      lastPaymentDate: null,
      recentGapDays: null,
    };
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('amount_paid, payment_method, payment_date')
    .in('student_fee_id', feeIds)
    .order('payment_date', { ascending: false });

  if (!payments || payments.length === 0) {
    return {
      totalPayments: 0,
      averageAmount: 0,
      paymentFrequency: 0,
      preferredMethod: 'unknown',
      averageDaysLate: 0,
      onTimeRate: 0,
      lastPaymentDate: null,
      recentGapDays: null,
    };
  }

  const totalPayments = payments.length;
  const averageAmount = payments.reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0) / totalPayments;

  const methodCounts: Record<string, number> = {};
  payments.forEach((p: any) => {
    const method = p.payment_method || 'unknown';
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });
  const preferredMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

  return {
    totalPayments,
    averageAmount,
    paymentFrequency: totalPayments,
    preferredMethod,
    averageDaysLate: 0,
    onTimeRate: 0.5,
    lastPaymentDate: payments[0]?.payment_date || null,
    recentGapDays: null,
  };
}

export async function analyzeFeeRisk(
  input: AnalyzeFeeRiskInput,
  user: AuthUser,
): Promise<FeePredictionResult | FeePredictionResult[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  const { data: students } = await supabase
    .from('students')
    .select('student_id, first_name, last_name, admission_number')
    .eq('school_id', schoolId)
    .eq('status', 'active');

  if (!students || students.length === 0) {
    throw new Error('No active students found');
  }

  const targetStudents = input.studentId
    ? students.filter((s: any) => s.student_id === input.studentId)
    : students.slice(0, 20);

  const results: FeePredictionResult[] = [];

  for (const student of targetStudents) {
    const patterns = await getPaymentPatterns(supabase, student.student_id, schoolId);

    const { data: feeBalance } = await supabase
      .from('student_fees')
      .select('amount_due, status')
      .eq('student_id', student.student_id)
      .eq('school_id', schoolId);

    const totalDue = (feeBalance || []).reduce((s: number, f: any) => s + Number(f.amount_due || 0), 0);
    const overdueCount = (feeBalance || []).filter((f: any) => f.status === 'overdue' || f.status === 'pending').length;

    try {
      const ai = await generateGroqCompletion<z.infer<typeof predictionOutputSchema>>({
        system: `You are a school fee collection analyst for Kenyan schools. Analyze payment patterns and predict fee collection risk.
Consider: payment history, current balance, overdue items, payment frequency, and time since last payment.
Provide actionable recommendations for improving collection.`,
        prompt: `Student: ${student.first_name} ${student.last_name} (${student.admission_number})
Total Due: KES ${totalDue}
Overdue Items: ${overdueCount}
Payment Pattern: ${JSON.stringify(patterns)}

Analyze the fee payment risk and provide recommendations.`,
        responseFormat: 'json',
        temperature: 0.2,
        responseSchema: predictionOutputSchema,
        requestLabel: `fee-predictor.analyze.${student.student_id}`,
        cache: { schoolId },
      });

      const parsed = predictionOutputSchema.parse(ai.data);
      results.push({
        studentId: student.student_id,
        studentName: `${student.first_name} ${student.last_name}`,
        riskLevel: parsed.riskLevel,
        riskScore: parsed.riskScore,
        factors: parsed.factors,
        recommendations: parsed.recommendations,
        optimalReminderDay: parsed.optimalReminderDay,
        confidence: ai.confidence,
      });
    } catch {
      logger.error('Fee prediction failed for student', {
        source: 'fee-predictor.service',
        studentId: student.student_id,
        schoolId,
      });
      continue;
    }
  }

  if (input.studentId) {
    return results[0];
  }

  return results;
}
