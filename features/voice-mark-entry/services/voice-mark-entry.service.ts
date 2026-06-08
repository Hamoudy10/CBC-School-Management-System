import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { AuthUser } from '@/types/auth';
import type { VoiceMarkEntryResult } from '../types';
import type { RecordAssessmentInput } from '../validators/voice-mark-entry.schema';

const parsedAssessmentSchema = z.object({
  studentName: z.string(),
  subject: z.string(),
  strand: z.string(),
  score: z.number().min(1).max(4),
  remarks: z.string().optional(),
});

export async function parseVoiceAssessment(
  input: RecordAssessmentInput,
  user: AuthUser,
): Promise<VoiceMarkEntryResult> {
  const supabase = await createSupabaseServerClient();

  const { data: school } = await supabase
    .from('schools')
    .select('name')
    .eq('id', user.schoolId)
    .single();

  try {
    const ai = await generateGroqCompletion<z.infer<typeof parsedAssessmentSchema>>({
      system: `You are a CBC assessment mark entry assistant. 
Extract the student name, subject/learning area, strand, and score (1-4 CBC scale) from the teacher's dictated text.
The CBC scale is: 1=Below Expectations, 2=Approaching Expectations, 3=Meeting Expectations, 4=Exceeding Expectations.
If the score is spoken as a word, convert it: "one"/"exceeding"=4, "three"/"meeting"=3, "two"/"approaching"=2, "below"/"one"=1.
Respond only with the parsed JSON.`,
      prompt: `School: ${school?.name || 'Unknown'}
Teacher dictation: "${input.transcribedText}"

Extract the assessment data from this dictation.`,
      responseFormat: 'json',
      temperature: 0.1,
      responseSchema: parsedAssessmentSchema,
      requestLabel: 'voice-mark-entry.parse',
      cache: false,
    });

    const parsed = parsedAssessmentSchema.parse(ai.data);

    if (input.studentId && input.competencyId) {
      await supabase.from('assessments').insert({
        school_id: user.schoolId,
        student_id: input.studentId,
        competency_id: input.competencyId,
        score: parsed.score,
        remarks: parsed.remarks || null,
        assessment_date: new Date().toISOString().split('T')[0],
        assessed_by: user.id,
      });
    }

    return {
      transcribedText: input.transcribedText,
      confidence: ai.confidence,
      parsedAssessment: parsed,
      warnings: ai.warnings || [],
    };
  } catch (error) {
    return {
      transcribedText: input.transcribedText,
      confidence: 0,
      parsedAssessment: null,
      warnings: [error instanceof Error ? error.message : 'Failed to parse assessment'],
    };
  }
}
