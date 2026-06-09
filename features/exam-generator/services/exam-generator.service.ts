import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { ExamGeneratorResult, GeneratedExam, BloomLevel, QuestionType } from '../types';
import type { GenerateExamInput } from '../validators/exam-generator.schema';

const questionSchema = z.object({
  type: z.enum(['multiple_choice', 'short_answer', 'structured', 'essay']),
  bloomLevel: z.enum(['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']),
  marks: z.number().int().min(1).max(20),
  prompt: z.string().min(5),
  options: z.array(z.string()).optional(),
  expectedAnswer: z.string().min(1),
});

const examOutputSchema = z.object({
  title: z.string().min(1),
  instructions: z.string().min(1),
  totalMarks: z.number().int().min(1),
  questions: z.array(questionSchema).min(1),
  markingScheme: z.array(z.object({
    questionNumber: z.number().int(),
    totalMarks: z.number().int(),
    expectedPoints: z.array(z.string()),
    rubric: z.string(),
  })).min(1),
});

export async function generateExam(
  input: GenerateExamInput,
  user: AuthUser,
): Promise<ExamGeneratorResult> {
  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId!;

  let cbcContext = '';
  if (input.learningAreaId) {
    const { data: strands } = await supabase
      .from('strands')
      .select('name, description, sub_strands!inner(name, competencies!inner(name, description))')
      .eq('learning_area_id', input.learningAreaId)
      .eq('school_id', schoolId);
    cbcContext = JSON.stringify(strands || [], null, 2);
  }

  const bloomDistribution = [
    `Remember: ${Math.round(10)}%`,
    `Understand: ${Math.round(20)}%`,
    `Apply: ${Math.round(30)}%`,
    `Analyze: ${Math.round(20)}%`,
    `Evaluate: ${Math.round(15)}%`,
    `Create: ${Math.round(5)}%`,
  ].join('\n');

  try {
    const ai = await generateGroqCompletion<z.infer<typeof examOutputSchema>>({
      system: `You are a CBC exam paper generator for Kenyan schools. Generate a complete exam paper with marking scheme.
The exam must:
- Follow KICD CBC assessment guidelines
- Include a balanced mix of question types: ${input.questionTypes.join(', ')}
- Distribute marks across Bloom's taxonomy levels appropriately for the grade
- Have clear, unambiguous question wording appropriate for the grade level
- Include a complete marking scheme with expected points and rubrics
- ${input.includeMarkingScheme ? 'Include detailed marking scheme' : 'Exclude marking scheme'}
- Return JSON only using the required schema

Difficulty distribution: Easy ${input.difficultyDistribution.easy}%, Medium ${input.difficultyDistribution.medium}%, Hard ${input.difficultyDistribution.hard}%

Suggested Bloom's distribution for this grade:
${bloomDistribution}`,
      prompt: `Generate a ${input.grade} ${input.subject} exam paper.
${input.strand ? `Strand: ${input.strand}` : ''}
${input.subStrand ? `Sub-strand: ${input.subStrand}` : ''}
Duration: ${input.durationMinutes} minutes
Total Marks: ${input.totalMarks}
Question types to include: ${input.questionTypes.join(', ')}

${cbcContext ? `CBC Competencies for this learning area:\n${cbcContext}` : ''}

Generate a well-balanced exam paper appropriate for ${input.grade} students in ${input.subject}.`,
      responseFormat: 'json',
      temperature: 0.2,
      responseSchema: examOutputSchema,
      requestLabel: `exam-generator.generate.${input.subject}.${input.grade}`,
      cache: { schoolId },
    });

    const parsed = examOutputSchema.parse(ai.data);
    const bloomCount: Record<string, number> = {};
    parsed.questions.forEach((q: any) => {
      bloomCount[q.bloomLevel] = (bloomCount[q.bloomLevel] || 0) + q.marks;
    });

    const exam: GeneratedExam = {
      title: parsed.title,
      subject: input.subject,
      grade: input.grade,
      instructions: parsed.instructions,
      durationMinutes: input.durationMinutes,
      totalMarks: parsed.totalMarks,
      questions: parsed.questions.map((q: any, i: number) => ({
        number: i + 1,
        type: q.type as QuestionType,
        bloomLevel: q.bloomLevel as BloomLevel,
        marks: q.marks,
        prompt: q.prompt,
        options: q.options,
        expectedAnswer: q.expectedAnswer,
      })),
      markingScheme: parsed.markingScheme.map((ms: any) => ({
        questionNumber: ms.questionNumber,
        totalMarks: ms.totalMarks,
        expectedPoints: ms.expectedPoints,
        rubric: ms.rubric,
      })),
      bloomTaxonomyBreakdown: bloomCount as Record<BloomLevel, number>,
    };

    return {
      exam,
      confidence: ai.confidence,
      warnings: ai.warnings || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to generate exam paper');
  }
}
