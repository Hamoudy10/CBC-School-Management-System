import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { MeetingScheduleResult, TimeSlot } from "../types";

const meetingPlanSchema = z.object({
  suggestedSlots: z.array(
    z.object({
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
    })
  ),
  meetingTitle: z.string(),
  agenda: z.array(z.string()),
  preparationNotes: z.array(z.string()),
  confirmationMessage: z.string(),
});

export async function scheduleParentTeacherMeeting(
  parentId: string,
  teacherId: string,
  studentId: string,
  preferredDates: string[],
  preferredTimes: string[],
  durationMinutes: number,
  reason: string,
  urgency: string,
  schoolId: string
): Promise<MeetingScheduleResult> {
  const supabase = await createSupabaseServerClient();

  const [parentData, teacherData, studentData] = await Promise.all([
    supabase
      .from("users")
      .select("first_name, last_name")
      .eq("user_id", parentId)
      .single(),
    supabase
      .from("users")
      .select("first_name, last_name")
      .eq("user_id", teacherId)
      .single(),
    supabase
      .from("students")
      .select("first_name, last_name")
      .eq("student_id", studentId)
      .single(),
  ]);

  const parentName = `${(parentData.data as any)?.first_name ?? ""} ${(parentData.data as any)?.last_name ?? ""}`.trim();
  const teacherName = `${(teacherData.data as any)?.first_name ?? ""} ${(teacherData.data as any)?.last_name ?? ""}`.trim();
  const studentName = `${(studentData.data as any)?.first_name ?? ""} ${(studentData.data as any)?.last_name ?? ""}`.trim();

  try {
    const ai = await generateGroqCompletion<z.infer<typeof meetingPlanSchema>>({
      system: `You are a parent-teacher meeting scheduler for a Kenyan CBC school.
Suggest optimal meeting times based on parent preferences and typical school availability.
Generate clear agendas and preparation guidance.
Return JSON only.`,
      prompt: `Schedule a parent-teacher meeting:

Parent: ${parentName}
Teacher: ${teacherName}
Student: ${studentName}
Reason: ${reason}
Urgency: ${urgency}
Duration: ${durationMinutes} minutes
Preferred Dates: ${preferredDates.join(", ")}
Preferred Times: ${preferredTimes.join(", ")}

Generate:
1. suggestedSlots: 3-4 specific time slots that match preferences, with date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM)
2. meetingTitle: clear title for the meeting
3. agenda: 3-5 specific discussion points based on the reason
4. preparationNotes: what both parties should prepare
5. confirmationMessage: warm message confirming the arrangement

Rules:
- Slots should be on preferred dates at preferred times
- Each slot should be ${durationMinutes} minutes long
- Agenda items should be specific to the reason given
- Preparation notes should be practical for both parent and teacher
- Confirmation message should be warm and professional
- For high urgency, suggest the soonest available slot`,
      responseFormat: "json",
      temperature: 0.3,
      responseSchema: meetingPlanSchema,
      requestLabel: "parent-engagement.schedule-meeting",
      cache: false,
    });

    const parsed = meetingPlanSchema.parse(ai.data);

    const suggestedSlots: TimeSlot[] = parsed.suggestedSlots.map((s: any) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      available: true,
    }));

    const firstSlot = suggestedSlots.length > 0 ? suggestedSlots[0] : undefined;

    return {
      parentName,
      teacherName,
      studentName,
      suggestedSlots,
      selectedSlot: firstSlot,
      meetingTitle: parsed.meetingTitle,
      agenda: parsed.agenda,
      preparationNotes: parsed.preparationNotes,
      confirmationMessage: parsed.confirmationMessage,
    };
  } catch (error) {
    logger.warn("AI meeting scheduler failed, using template fallback", {
      error: error instanceof Error ? error.message : "Unknown",
    });

    const suggestedSlots: TimeSlot[] = preferredDates.slice(0, 3).flatMap((date) =>
      preferredTimes.slice(0, 2).map((time) => {
        const [h, m] = time.split(":").map(Number);
        const endH = h + Math.floor((m + durationMinutes) / 60);
        const endM = (m + durationMinutes) % 60;
        return {
          date,
          startTime: time,
          endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
          available: true,
        };
      })
    ).slice(0, 4);

    return {
      parentName,
      teacherName,
      studentName,
      suggestedSlots,
      selectedSlot: suggestedSlots[0],
      meetingTitle: `Parent-Teacher Meeting: ${studentName}'s Progress Discussion`,
      agenda: [
        `Review ${studentName}'s academic progress`,
        "Discuss areas for improvement and support strategies",
        "Address specific concerns raised",
        "Plan collaborative home-school support approach",
        "Set goals for the upcoming period",
      ],
      preparationNotes: [
        "Please bring any relevant documents or work samples",
        "Prepare specific questions or concerns you'd like to discuss",
        "Review your child's recent report card and assessment results",
        "Think about what support strategies work best at home",
      ],
      confirmationMessage: `Dear ${parentName}, a parent-teacher meeting has been scheduled regarding ${studentName}'s progress. We look forward to working together to support your child's learning journey. Please confirm your preferred time slot.`,
    };
  }
}
