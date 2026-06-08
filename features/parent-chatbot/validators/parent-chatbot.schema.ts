import { z } from 'zod';

export const chatbotWebhookSchema = z.object({
  from: z.string().min(1),
  text: z.string().min(1).max(5000),
  sessionId: z.string().optional(),
  channel: z.enum(['whatsapp', 'sms', 'telegram', 'messenger']).default('whatsapp'),
});

export type ChatbotWebhookInput = z.infer<typeof chatbotWebhookSchema>;
