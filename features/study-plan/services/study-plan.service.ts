import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { StudyPlanResult, GeneratedStudyPlan, StudySession } from '../types';
import type { GenerateStudyPlanInput } from '../validators/study-plan.schema';

const sessionSchema = z.object({
  day: z.number().int().min(1),
  topic: z.string().min(1),
  subject: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(180),
  activity: z.string().min(1),
  resources: z.array(z.string()),
});

const studyPlanOutputSchema = z.object({
  title: z.string().min(1),
  totalDays: z.number().int().min(1),
  totalStudyHours: z.number().min(1),
  sessions: z.array(sessionSchema).min(1),
  recommendations: z.array(z.string()),
});

export async function generateStudyPlan(
  input: GenerateStudyPlanInput,
  user: AuthUser,
): Promise<StudyPlanResult> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  const { data: classInfo } = await supabase
    .from('classes')
    .select('name, grade_level')
    .eq('class_id', input.classId)
    .single();

  const weakAreas: string[] = [];

  if (input.studentId) {
    const { data: aggregates } = await supabase
      .from('assessment_aggregates')
      .select('average_score, learning_areas!inner(name)')
      .eq('student_id', input.studentId)
      .eq('school_id', schoolId)
      .order('average_score', { ascending: true })
      .limit(5);

    if (aggregates) {
      weakAreas.push(...aggregates.map((a: any) => `${a.learning_areas.name} (${a.average_score}%)`));
    }

    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('student_id', input.studentId)
      .single();
    if (student) {
      weakAreas.unshift(`Student: ${student.first_name} ${student.last_name}`);
    }
  }

  const subjectsContext = input.subjects?.length
    ? `Focus subjects: ${input.subjects.join(', ')}`
    : 'All enrolled subjects';

  try {
    const ai = await generateGroqCompletion<z.infer<typeof studyPlanOutputSchema>>({
      system: `You are a CBC study plan / revision timetable generator for Kenyan schools.
Create a structured revision timetable that:
- Distributes study sessions across the available days
- Prioritizes weak areas identified by assessment data
- Includes varied activities (review notes, practice questions, group discussion, past papers)
- Suggests specific resources for each session
- Follows spaced repetition principles (review old topics before introducing new ones)
- Returns JSON only using the required schema

Each session should be realistic and achievable for the grade level.`,
      prompt: `Generate a study plan for the following:
Class: ${classInfo?.name ?? 'Unknown'} (${classInfo?.grade_level ?? 'N/A'})
Target Exam: ${input.targetExam}
Date Range: ${input.startDate} to ${input.endDate}
Hours per day: ${input.hoursPerDay}
${subjectsContext}
${weakAreas.length > 0 ? `Assessment context:\n${weakAreas.join('\n')}` : ''}

Generate a realistic, detailed revision timetable covering all ${input.subjects?.length ?? 'major'} subjects.`,
      responseFormat: 'json',
      temperature: 0.3,
      responseSchema: studyPlanOutputSchema,
      requestLabel: `study-plan.generate.${input.classId}`,
      cache: { schoolId },
    });

    const parsed = studyPlanOutputSchema.parse(ai.data);
    const startDate = new Date(input.startDate);

    const sessions: StudySession[] = parsed.sessions.map((s: any) => {
      const sessionDate = new Date(startDate);
      sessionDate.setDate(sessionDate.getDate() + (s.day - 1));
      return {
        day: s.day,
        date: sessionDate.toISOString().split('T')[0],
        topic: s.topic,
        subject: s.subject,
        durationMinutes: s.durationMinutes,
        activity: s.activity,
        resources: s.resources,
        completed: false,
      };
    });

    const plan: GeneratedStudyPlan = {
      title: parsed.title,
      startDate: input.startDate,
      endDate: input.endDate,
      targetExam: input.targetExam,
      totalDays: parsed.totalDays,
      totalStudyHours: parsed.totalStudyHours,
      sessions,
      recommendations: parsed.recommendations,
    };

    return {
      plan,
      confidence: ai.confidence,
      warnings: ai.warnings || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to generate study plan');
  }
}
