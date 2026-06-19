import { z } from "zod";

const uuidField = z.string().uuid("Invalid UUID format");

export const weeklySummaryRequestSchema = z.object({
  studentId: uuidField,
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  language: z.enum(["en", "sw", "code-mix"]).default("en"),
  channel: z.enum(["sms", "whatsapp", "email", "in_app"]).default("whatsapp"),
});

export const sentimentAnalysisRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string(),
        text: z.string().min(1),
        sender: z.string(),
        timestamp: z.string(),
      })
    )
    .min(1)
    .max(100),
  scope: z.enum(["parent-teacher", "general"]).default("parent-teacher"),
});

export const meetingScheduleRequestSchema = z.object({
  parentId: uuidField,
  teacherId: uuidField,
  studentId: uuidField,
  preferredDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  preferredTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  durationMinutes: z.number().int().min(15).max(120).default(30),
  reason: z.string().min(5).max(500),
  urgency: z.enum(["low", "normal", "high"]).default("normal"),
});

export type WeeklySummaryInput = z.infer<typeof weeklySummaryRequestSchema>;
export type SentimentAnalysisInput = z.infer<typeof sentimentAnalysisRequestSchema>;
export type MeetingScheduleInput = z.infer<typeof meetingScheduleRequestSchema>;
