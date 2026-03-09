// features/communication/validators/communication.schema.ts
// Zod validation schemas for communication inputs

import { z } from "zod";

const priorityEnum = z.enum(["low", "normal", "high", "urgent"]);
const categoryEnum = z.enum([
  "general",
  "academic",
  "finance",
  "attendance",
  "discipline",
  "event",
  "announcement",
]);
const recipientTypeEnum = z.enum(["user", "role", "class", "all"]);
const notificationTypeEnum = z.enum([
  "info",
  "success",
  "warning",
  "error",
  "attendance",
  "assessment",
  "finance",
  "discipline",
  "system",
]);

// Messages
export const sendMessageSchema = z.object({
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject must be under 200 characters"),
  body: z
    .string()
    .min(1, "Message body is required")
    .max(5000, "Message must be under 5000 characters"),
  priority: priorityEnum.default("normal"),
  category: categoryEnum.default("general"),
  recipients: z
    .array(
      z.object({
        recipient_id: z.string().uuid("Invalid recipient ID"),
        recipient_type: recipientTypeEnum,
      }),
    )
    .min(1, "At least one recipient is required")
    .max(100, "Maximum 100 recipients per message"),
});

export const messageFilterSchema = z.object({
  category: categoryEnum.optional(),
  priority: priorityEnum.optional(),
  read_status: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Notifications
export const createNotificationSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be under 200 characters"),
  body: z
    .string()
    .min(1, "Body is required")
    .max(1000, "Body must be under 1000 characters"),
  type: notificationTypeEnum.default("info"),
  action_url: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const bulkNotificationSchema = z.object({
  user_ids: z
    .array(z.string().uuid())
    .min(1, "At least one user required")
    .max(500, "Maximum 500 users per batch"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be under 200 characters"),
  body: z
    .string()
    .min(1, "Body is required")
    .max(1000, "Body must be under 1000 characters"),
  type: notificationTypeEnum.default("info"),
  action_url: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const notificationFilterSchema = z.object({
  type: notificationTypeEnum.optional(),
  read_status: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Announcements
export const createAnnouncementSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be under 200 characters"),
  body: z
    .string()
    .min(1, "Body is required")
    .max(5000, "Body must be under 5000 characters"),
  category: categoryEnum.default("general"),
  priority: priorityEnum.default("normal"),
  target_roles: z.array(z.string()).optional(),
  target_classes: z.array(z.string().uuid()).optional(),
  publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
  category: categoryEnum.optional(),
  priority: priorityEnum.optional(),
  target_roles: z.array(z.string()).optional(),
  target_classes: z.array(z.string().uuid()).optional(),
  publish_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  is_active: z.boolean().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageFilterInput = z.infer<typeof messageFilterSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type BulkNotificationInput = z.infer<typeof bulkNotificationSchema>;
export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
