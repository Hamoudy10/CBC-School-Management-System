import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { AlignmentCheckResult } from '../types';
import type { CheckAlignmentInput } from '../validators/curriculum-alignment.schema';

const alignmentOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  alignedCompetencies: z.array(z.object({
    name: z.string(),
    strand: z.string(),
    coverage: z.enum(['full', 'partial', 'none']),
  })),
  missingCompetencies: z.array(z.string()),
  suggestions: z.array(z.string()).min(1),
});

export async function checkCbcAlignment(
  input: CheckAlignmentInput,
  user: AuthUser,
): Promise<AlignmentCheckResult> {
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

  try {
    const ai = await generateGroqCompletion<z.infer<typeof alignmentOutputSchema>>({
      system: `You are a CBC curriculum alignment expert for Kenyan schools.
Analyze the provided lesson plan and compare it against the official CBC competencies.
Score how well the lesson plan aligns with CBC standards (0-100).
Identify which competencies are addressed and which are missing.
Provide specific, actionable suggestions to improve alignment.
Consider: learning objectives, teaching activities, assessment methods, and materials.`,
      prompt: `Lesson Plan:
Title: ${input.lessonPlan.title}
Subject: ${input.lessonPlan.subject}
Grade: ${input.lessonPlan.grade}
Duration: ${input.lessonPlan.duration}

Objectives:
${input.lessonPlan.objectives.map((o: string) => `- ${o}`).join('\n')}

Activities:
${input.lessonPlan.activities.map((a: string) => `- ${a}`).join('\n')}

Assessment Methods:
${input.lessonPlan.assessmentMethods.map((m: string) => `- ${m}`).join('\n')}

Materials:
${(input.lessonPlan.materials || []).map((m: string) => `- ${m}`).join('\n')}

${cbcContext ? `CBC Competencies for this learning area:\n${cbcContext}` : 'No specific CBC competencies provided. Align against general CBC principles.'}`,
      responseFormat: 'json',
      temperature: 0.2,
      responseSchema: alignmentOutputSchema,
      requestLabel: 'curriculum-alignment.check',
      cache: { schoolId },
    });

    const parsed = alignmentOutputSchema.parse(ai.data);

    return {
      overallScore: parsed.overallScore,
      alignedCompetencies: parsed.alignedCompetencies,
      missingCompetencies: parsed.missingCompetencies,
      suggestions: parsed.suggestions,
      confidence: ai.confidence,
    };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to check curriculum alignment');
  }
}
