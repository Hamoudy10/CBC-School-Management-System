import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { AdaptiveHomeworkResult, WorksheetOutput, StudentWeakArea } from '../types';
import type { GenerateWorksheetInput } from '../validators/adaptive-homework.schema';

const worksheetOutputSchema = z.object({
  title: z.string(),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
    answer: z.string(),
    explanation: z.string(),
  })),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  estimatedMinutes: z.number().int().min(1).max(120),
});

async function getStudentWeakAreas(
  supabase: any,
  studentId: string,
  schoolId: string,
): Promise<StudentWeakArea[]> {
  const { data: aggregates } = await supabase
    .from('assessment_aggregates')
    .select('*, learning_areas!inner(name)')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .order('average_score', { ascending: true })
    .limit(5);

  if (!aggregates || aggregates.length === 0) {
    return [];
  }

  return aggregates.map((a: any) => ({
    strandId: '',
    strandName: a.learning_areas?.name || '',
    subStrandId: '',
    subStrandName: '',
    averageScore: a.average_score || 0,
    performanceLevel: a.overall_level || 'unknown',
    competencyCount: a.total_competencies || 0,
  }));
}

export async function generateWorksheet(
  input: GenerateWorksheetInput,
  user: AuthUser,
): Promise<AdaptiveHomeworkResult<WorksheetOutput>> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  const { data: student } = await supabase
    .from('students')
    .select('first_name, last_name, current_class_id')
    .eq('student_id', input.studentId)
    .eq('school_id', schoolId)
    .single();

  if (!student) {
    throw new Error('Student not found');
  }

  const { data: classData } = await supabase
    .from('classes')
    .select('name, grade_level')
    .eq('class_id', student.current_class_id)
    .eq('school_id', schoolId)
    .single();

  const gradeLevel = classData?.grade_level || 'unknown';
  const className = classData?.name || '';

  const weakAreas = await getStudentWeakAreas(supabase, input.studentId, schoolId);

  const performanceContext = weakAreas.length > 0
    ? `The student's weakest areas are:\n${weakAreas.map((w: StudentWeakArea) =>
        `- ${w.strandName} / ${w.subStrandName}: score ${w.averageScore.toFixed(1)} (${w.performanceLevel})`
      ).join('\n')}`
    : 'No prior assessment data available. Generate age-appropriate questions.';

  const difficultyInstruction = input.difficulty === 'auto' && weakAreas.length > 0
    ? `Focus on ${weakAreas[0].strandName} / ${weakAreas[0].subStrandName} at a level appropriate for their current score of ${weakAreas[0].averageScore.toFixed(1)}/4`
    : input.difficulty !== 'auto'
      ? `Generate ${input.difficulty}-difficulty questions`
      : 'Generate mixed-difficulty questions';

  try {
    const ai = await generateGroqCompletion<z.infer<typeof worksheetOutputSchema>>({
      system: `You are a CBC worksheet generator for Kenyan schools. Generate practice questions that help students master specific competencies.
Each worksheet must follow CBC assessment style: questions test understanding, not memorization.
Provide correct answers and brief explanations for each question.`,
      prompt: `Generate a worksheet for ${student.first_name} ${student.last_name} (Grade ${gradeLevel}).

${performanceContext}

${difficultyInstruction}

Generate ${input.questionCount} questions.`,
      responseFormat: 'json',
      temperature: 0.3,
      responseSchema: worksheetOutputSchema,
      requestLabel: 'adaptive-homework.generate',
      cache: { schoolId },
    });

    const parsed = worksheetOutputSchema.parse(ai.data);

    return {
      result: {
        title: parsed.title,
        studentName: `${student.first_name} ${student.last_name}`,
        grade: `Grade ${gradeLevel}`,
        subject: weakAreas[0]?.strandName || 'General',
        strandName: weakAreas[0]?.strandName || '',
        subStrandName: weakAreas[0]?.subStrandName || '',
        totalQuestions: parsed.questions.length,
        questions: parsed.questions.map((q: any, i: number) => ({ ...q, number: i + 1 })),
        difficulty: parsed.difficulty,
        estimatedMinutes: parsed.estimatedMinutes,
      },
      confidence: ai.confidence,
      warnings: ai.warnings || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to generate worksheet');
  }
}
