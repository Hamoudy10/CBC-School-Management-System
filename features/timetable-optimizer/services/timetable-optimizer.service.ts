import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { TimetableOptimizerResult, TimetableSuggestion } from '../types';
import type { OptimizeTimetableInput } from '../validators/timetable-optimizer.schema';

const timetableOutputSchema = z.object({
  suggestions: z.array(z.object({
    day: z.string(),
    slots: z.array(z.object({
      period: z.number().int(),
      startTime: z.string(),
      endTime: z.string(),
      className: z.string(),
      subject: z.string(),
      teacherName: z.string(),
      room: z.string(),
    })),
  })),
  potentialConflicts: z.array(z.object({
    type: z.string(),
    description: z.string(),
  })),
});

export async function generateTimetableSuggestions(
  input: OptimizeTimetableInput,
  user: AuthUser,
): Promise<TimetableOptimizerResult> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  const { data: classes } = await supabase
    .from('classes')
    .select('class_id, name, stream')
    .in('class_id', input.classIds)
    .eq('school_id', schoolId);

  const { data: teacherSubjects } = await supabase
    .from('teacher_subjects')
    .select('*, staff!inner(user_id, users!inner(first_name, last_name)), learning_areas!inner(name)')
    .in('class_id', input.classIds)
    .eq('school_id', schoolId);

  const { data: bellTimes } = await supabase
    .from('bell_times')
    .select('*')
    .eq('school_id', schoolId)
    .order('period_order', { ascending: true });

  const existingTimetable = await supabase
    .from('timetable_slots')
    .select('*')
    .eq('school_id', schoolId)
    .eq('term_id', input.termId)
    .eq('academic_year_id', input.academicYearId);

  const context = {
    periodsPerDay: bellTimes?.length || 8,
    bellSchedule: (bellTimes || []).map((b: any) => ({
      period: b.period_order,
      start: b.start_time,
      end: b.end_time,
      isBreak: b.is_break || false,
    })),
    classes: (classes || []).map((c: any) => ({
      id: c.class_id,
      name: `${c.name} ${c.stream || ''}`.trim(),
    })),
    teachers: (teacherSubjects || []).map((ts: any) => ({
      name: `${ts.staff?.users?.first_name || ''} ${ts.staff?.users?.last_name || ''}`.trim(),
      subject: ts.learning_areas?.name || '',
      classIds: [ts.class_id],
    })),
    existingSlots: (existingTimetable.data || []).map((s: any) => ({
      day: s.day,
      period: s.period,
      teacher: s.teacher_name,
      class: s.class_name,
      subject: s.subject,
    })),
  };

  const prefs = input.preferences ?? {
    teacherMaxPeriodsPerDay: 6,
    maxConsecutivePeriods: 3,
    preferMorningCore: true,
    includeBreaks: true,
  };

  try {
    const ai = await generateGroqCompletion<z.infer<typeof timetableOutputSchema>>({
      system: `You are a school timetable optimization assistant for Kenyan CBC schools.
Generate a conflict-free weekly timetable (Monday-Friday) that:
1. Avoids teacher double-booking
2. Avoids room/class clashes
3. Distributes subjects evenly across the week
4. Places core subjects (Math, English, Science) in morning slots when possible
5. Respects the bell schedule
6. ${prefs.preferMorningCore ? 'Prioritizes core subjects in periods 1-3' : ''}
7. Limits consecutive periods to ${prefs.maxConsecutivePeriods}
8. Limits teachers to max ${prefs.teacherMaxPeriodsPerDay} periods per day
9. ${prefs.includeBreaks ? 'Includes break periods where they exist in bell schedule' : 'Schedules through break periods'}

Respond in JSON format with suggestions and any potential conflicts identified.`,
      prompt: `Generate an optimal timetable for this school:

Bell schedule: ${JSON.stringify(context.bellSchedule)}
Classes: ${JSON.stringify(context.classes)}
Teachers & subjects: ${JSON.stringify(context.teachers)}
${context.existingSlots.length > 0 ? `Already scheduled slots: ${JSON.stringify(context.existingSlots)}` : 'No existing slots.'}`,
      responseFormat: 'json',
      temperature: 0.3,
      responseSchema: timetableOutputSchema,
      requestLabel: 'timetable-optimizer.suggest',
      cache: { schoolId, classId: input.classIds[0] },
    });

    const parsed = timetableOutputSchema.parse(ai.data);

    return {
      suggestions: parsed.suggestions,
      conflicts: parsed.potentialConflicts,
      confidence: ai.confidence,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to generate timetable suggestions');
  }
}
