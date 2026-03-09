// features/communication/index.ts
// Barrel export for communication module

import { z } from "zod";
import {
  sendMessage,
  getInbox,
  getSentMessages,
  getMessageById,
  deleteMessage,
} from "./services/messages.service";
import {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCounts,
} from "./services/notifications.service";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  getAnnouncementById,
} from "./services/announcements.service";

export * from "./types";
export * from "./services/messages.service";
export * from "./services/notifications.service";
export * from "./services/announcements.service";
export {
  sendMessageSchema,
  messageFilterSchema,
  createNotificationSchema,
  bulkNotificationSchema,
  notificationFilterSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "./validators/communication.schema";

// Legacy route compatibility exports
export const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  category: z
    .enum([
      "general",
      "academic",
      "finance",
      "attendance",
      "discipline",
      "event",
      "announcement",
    ])
    .optional(),
  recipients: z
    .array(
      z.object({
        recipient_id: z.string(),
        recipient_type: z.enum(["user", "role", "class", "all"]),
      }),
    )
    .optional(),
  user_ids: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
});

export const MessagesService = {
  async getInbox(schoolId: string, userId: string, params: any) {
    return getInbox(userId, schoolId, params, params?.page, params?.page_size ?? params?.pageSize);
  },
  async getSent(schoolId: string, userId: string, params: any) {
    return getSentMessages(userId, schoolId, params?.page, params?.page_size ?? params?.pageSize);
  },
  async sendMessage(schoolId: string, userId: string, input: any) {
    return sendMessage(input, userId, schoolId);
  },
  async broadcastMessage(schoolId: string, userId: string, input: any) {
    const recipients =
      input?.recipients ??
      [
        ...(input?.user_ids ?? []).map((id: string) => ({
          recipient_id: id,
          recipient_type: "user" as const,
        })),
        ...(input?.roles ?? []).map((id: string) => ({
          recipient_id: id,
          recipient_type: "role" as const,
        })),
        ...(input?.classes ?? []).map((id: string) => ({
          recipient_id: id,
          recipient_type: "class" as const,
        })),
      ];

    return sendMessage(
      {
        subject: input.subject,
        body: input.body,
        priority: input.priority,
        category: input.category,
        recipients,
      },
      userId,
      schoolId,
    );
  },
  async getMessage(schoolId: string, messageId: string, userId: string) {
    const result = await getMessageById(messageId, userId, schoolId);
    return result.data;
  },
  async deleteMessage(schoolId: string, messageId: string, userId: string) {
    // Legacy route passes message ID; service expects recipient record ID.
    return deleteMessage(messageId, userId, schoolId);
  },
  async getUnreadCount(schoolId: string, userId: string) {
    const result = await getUnreadCounts(userId, schoolId);
    return result.data ?? { messages: 0, notifications: 0, total: 0 };
  },
};

export const NotificationsService = {
  async getUserNotifications(schoolId: string, userId: string, params: any) {
    return getUserNotifications(
      userId,
      schoolId,
      params,
      params?.page,
      params?.page_size ?? params?.pageSize,
    );
  },
  async createNotification(schoolId: string, input: any) {
    return createNotification(input, schoolId);
  },
  async createBulkNotifications(
    schoolId: string,
    userIds: string[],
    input: any,
  ) {
    return createBulkNotifications(
      {
        ...input,
        user_ids: userIds,
      },
      schoolId,
    );
  },
  async markAsRead(schoolId: string, notificationId: string, userId: string) {
    return markNotificationAsRead(notificationId, userId, schoolId);
  },
  async markAllAsRead(schoolId: string, userId: string) {
    return markAllNotificationsAsRead(userId, schoolId);
  },
};

export const AnnouncementsService = {
  async getAllAnnouncements(schoolId: string, page = 1, pageSize = 20) {
    return getAnnouncements(schoolId, {}, page, pageSize);
  },
  async getAnnouncementsForUser(
    schoolId: string,
    role: string,
    page = 1,
    pageSize = 20,
  ) {
    return getAnnouncements(
      schoolId,
      { target_role: role, is_active: true },
      page,
      pageSize,
    );
  },
  async createAnnouncement(schoolId: string, input: any, userId: string) {
    return createAnnouncement(input, userId, schoolId);
  },
  async updateAnnouncement(schoolId: string, id: string, input: any) {
    return updateAnnouncement(id, input, schoolId);
  },
  async deleteAnnouncement(schoolId: string, id: string) {
    return deleteAnnouncement(id, schoolId);
  },
  async getAnnouncementById(schoolId: string, id: string) {
    return getAnnouncementById(id, schoolId);
  },
};
