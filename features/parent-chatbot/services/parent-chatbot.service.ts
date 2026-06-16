import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateGroqCompletion } from '@/lib/ai/groq.client';
import { z } from 'zod';
import type { ChatbotQueryResult, ChatbotSession } from '../types';
import type { ChatbotWebhookInput } from '../validators/parent-chatbot.schema';

const chatbotReplySchema = z.object({
  reply: z.string(),
  requiresHuman: z.boolean(),
  dataNeeded: z.object({
    performance: z.boolean(),
    fees: z.boolean(),
    attendance: z.boolean(),
    discipline: z.boolean(),
    events: z.boolean(),
  }),
});

async function getParentSession(supabase: any, phoneNumber: string, channel: string): Promise<ChatbotSession | null> {
  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, first_name, last_name')
    .eq('phone', phoneNumber)
    .maybeSingle();

  if (!user) { return null; }

  const { data: guardians } = await supabase
    .from('student_guardians')
    .select('student_id, students!inner(first_name, last_name)')
    .eq('guardian_user_id', user.user_id);

    const studentIds = (guardians || []).map((g: any) => g.student_id);

  return {
    sessionId: crypto.randomUUID(),
    parentUserId: user.user_id,
    parentPhone: phoneNumber,
    schoolId: user.school_id,
    messages: [],
    context: { studentIds },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function queryStudentData(
  supabase: any,
  studentId: string,
  schoolId: string,
): Promise<Record<string, any>> {
  const [performance, fees, attendance, discipline] = await Promise.all([
    supabase
      .from('assessment_aggregates')
      .select('*, learning_areas(name)')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('computed_at', { ascending: false })
      .limit(10),
    supabase
      .from('student_fees')
      .select('*, fee_structures(name, amount)')
      .eq('student_id', studentId)
      .eq('school_id', schoolId),
    supabase
      .from('attendance')
      .select('status, date')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('date', { ascending: false })
      .limit(30),
    supabase
      .from('disciplinary_records')
      .select('incident_type, description, created_at')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    performance: performance.data || [],
    fees: fees.data || [],
    attendance: attendance.data || [],
    discipline: discipline.data || [],
  };
}

export async function handleChatbotQuery(
  input: ChatbotWebhookInput,
): Promise<ChatbotQueryResult> {
  const supabase = await createSupabaseServerClient();
  const session = await getParentSession(supabase, input.from, input.channel);

  if (!session || session.context.studentIds.length === 0) {
    return {
      reply: "Hello! I couldn't find your parent account linked to this phone number. Please contact the school to link your phone number to your child's record.",
      confidence: 0.9,
      requiresHuman: false,
      dataQueried: {},
      warnings: ['Unregistered phone number'],
    };
  }

  const studentData = await queryStudentData(supabase, session.context.studentIds[0], session.schoolId!);

  try {
    const ai = await generateGroqCompletion<z.infer<typeof chatbotReplySchema>>({
      system: `You are a helpful parent assistant for a Kenyan CBC school. You answer parents' questions about their children.
You have access to the child's performance data, fee balances, attendance, and discipline records.
Provide clear, concise answers in plain language. Avoid educational jargon.
If the question requires action from the school (fee complaints, urgent issues), set requiresHuman to true.`,
      prompt: `Parent question: "${input.text}"

Student data:
${JSON.stringify(studentData, null, 2)}

Previous conversation context: ${JSON.stringify(session.messages.slice(-3))}

Respond naturally as a helpful school assistant.`,
      responseFormat: 'json',
      temperature: 0.3,
      responseSchema: chatbotReplySchema,
      requestLabel: 'parent-chatbot.query',
      cache: false,
    });

    const parsed = chatbotReplySchema.parse(ai.data);

    return {
      reply: parsed.reply,
      confidence: ai.confidence,
      requiresHuman: parsed.requiresHuman,
      dataQueried: {
        studentPerformance: parsed.dataNeeded.performance,
        feeBalance: parsed.dataNeeded.fees,
        attendance: parsed.dataNeeded.attendance,
        discipline: parsed.dataNeeded.discipline,
        upcomingEvents: parsed.dataNeeded.events,
      },
      warnings: ai.warnings || [],
    };
  } catch (error) {
    return {
      reply: 'I encountered an error processing your request. Please try again or contact the school directly.',
      confidence: 0,
      requiresHuman: true,
      dataQueried: {},
      warnings: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
