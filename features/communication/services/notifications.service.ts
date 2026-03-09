// features/communication/services/notifications.service.ts
// Notification management service

import { createClient } from "@/lib/supabase/client";
import type {
  Notification,
  NotificationFilters,
  CreateNotificationInput,
  BulkNotificationInput,
  UnreadCounts,
} from "../types";

const supabase = createClient();

// ============================================================
// CREATE NOTIFICATIONS
// ============================================================

export async function createNotification(
  input: CreateNotificationInput,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: input.user_id,
      title: input.title,
      body: input.body,
      type: input.type,
      action_url: input.action_url || null,
      metadata: input.metadata || null,
      read_status: false,
      school_id: schoolId,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, id: data.id, message: "Notification created" };
}

export async function createBulkNotifications(
  input: BulkNotificationInput,
  schoolId: string,
): Promise<{ success: boolean; count: number; message: string }> {
  const records = input.user_ids.map((userId) => ({
    user_id: userId,
    title: input.title,
    body: input.body,
    type: input.type,
    action_url: input.action_url || null,
    metadata: input.metadata || null,
    read_status: false,
    school_id: schoolId,
  }));

  const { error } = await supabase.from("notifications").insert(records);

  if (error) {
    return { success: false, count: 0, message: error.message };
  }

  return {
    success: true,
    count: records.length,
    message: `${records.length} notifications created`,
  };
}

// Convenience function for system-generated notifications
export async function notifyUser(
  userId: string,
  schoolId: string,
  title: string,
  body: string,
  type: Notification["type"] = "info",
  actionUrl?: string,
): Promise<void> {
  await createNotification(
    {
      user_id: userId,
      title,
      body,
      type,
      action_url: actionUrl,
    },
    schoolId,
  );
}

// ============================================================
// READ NOTIFICATIONS
// ============================================================

export async function getUserNotifications(
  userId: string,
  schoolId: string,
  filters: NotificationFilters = {},
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  success: boolean;
  data: Notification[];
  total: number;
  message?: string;
}> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .eq("school_id", schoolId);

  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.read_status !== undefined) {
    query = query.eq("read_status", filters.read_status);
  }
  if (filters.date_from) {
    query = query.gte("created_at", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("created_at", filters.date_to);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as Notification[],
    total: count || 0,
  };
}

// ============================================================
// MARK AS READ
// ============================================================

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("notifications")
    .update({
      read_status: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Notification marked as read" };
}

export async function markAllNotificationsAsRead(
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("notifications")
    .update({
      read_status: true,
      read_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("read_status", false);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "All notifications marked as read" };
}

// ============================================================
// DELETE NOTIFICATION
// ============================================================

export async function deleteNotification(
  notificationId: string,
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Notification deleted" };
}

// ============================================================
// UNREAD COUNTS
// ============================================================

export async function getUnreadCounts(
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: UnreadCounts; message?: string }> {
  // Count unread notifications
  const { count: notifCount, error: notifError } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .eq("read_status", false);

  if (notifError) {
    return { success: false, message: notifError.message };
  }

  // Count unread messages
  const { count: msgCount, error: msgError } = await supabase
    .from("message_recipients")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("school_id", schoolId)
    .eq("read_status", false)
    .eq("deleted", false);

  if (msgError) {
    return { success: false, message: msgError.message };
  }

  const messages = msgCount || 0;
  const notifications = notifCount || 0;

  return {
    success: true,
    data: {
      messages,
      notifications,
      total: messages + notifications,
    },
  };
}
