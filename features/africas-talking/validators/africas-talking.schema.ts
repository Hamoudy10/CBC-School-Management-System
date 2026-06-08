import { z } from 'zod';

export const sendSmsSchema = z.object({
  to: z.array(z.string().min(10)).min(1),
  message: z.string().min(1).max(1600),
  senderId: z.string().max(11).optional(),
});

export const sendWhatsAppSchema = z.object({
  to: z.array(z.string().min(10)).min(1),
  message: z.string().min(1).max(4096),
});

export const parentNotificationSchema = z.object({
  studentId: z.string().uuid(),
  channel: z.enum(['sms', 'whatsapp', 'both']),
  template: z.enum(['fee_reminder', 'attendance_alert', 'report_available', 'discipline_notice', 'event_announcement', 'custom']),
  customMessage: z.string().max(1600).optional(),
  variables: z.record(z.string()).optional(),
});

export const atSettingsSchema = z.object({
  apiKey: z.string().min(1),
  username: z.string().min(1),
  senderId: z.string().max(11).optional(),
  env: z.enum(['sandbox', 'production']).default('sandbox'),
});

export type SendSmsInput = z.infer<typeof sendSmsSchema>;
export type SendWhatsAppInput = z.infer<typeof sendWhatsAppSchema>;
export type ParentNotificationInput = z.infer<typeof parentNotificationSchema>;
export type AtSettingsInput = z.infer<typeof atSettingsSchema>;
