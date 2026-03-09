// features/communication/services/messages.service.ts
// Internal messaging service

import { createClient } from "@/lib/supabase/client";
import type { Message, MessageFilters, SendMessageInput } from "../types";

const supabase = createClient();

// ============================================================
// SEND MESSAGE
// ============================================================

export async function sendMessage(
  input: SendMessageInput,
  senderId: string,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  // Create message
  const { data: msg, error: msgError } = await supabase
    .from("messages")
    .insert({
      sender_id: senderId,
      subject: input.subject,
      body: input.body,
      priority: input.priority || "normal",
      category: input.category || "general",
      school_id: schoolId,
    })
    .select("id")
    .single();

  if (msgError || !msg) {
    return {
      success: false,
      message: msgError?.message || "Failed to create message",
    };
  }

  // Resolve recipients
  const recipientRecords: Array<{
    message_id: string;
    recipient_id: string;
    recipient_type: string;
    read_status: boolean;
    deleted: boolean;
    school_id: string;
  }> = [];

  for (const r of input.recipients) {
    if (r.recipient_type === "user") {
      recipientRecords.push({
        message_id: msg.id,
        recipient_id: r.recipient_id,
        recipient_type: "user",
        read_status: false,
        deleted: false,
        school_id: schoolId,
      });
    } else if (r.recipient_type === "role") {
      // Get all users with this role
      const { data: roleUsers } = await supabase
        .from("users")
        .select("user_id")
        .eq("role_id", r.recipient_id)
        .eq("school_id", schoolId)
        .eq("status", "active");

      (roleUsers || []).forEach((u) => {
        if (u.user_id !== senderId) {
          recipientRecords.push({
            message_id: msg.id,
            recipient_id: u.user_id,
            recipient_type: "role",
            read_status: false,
            deleted: false,
            school_id: schoolId,
          });
        }
      });
    } else if (r.recipient_type === "class") {
      // Get all students + their parents in this class
      const { data: classStudents } = await supabase
        .from("student_classes")
        .select(
          `
          student_id,
          student:students(
            user_id,
            parent_id
          )
        `,
        )
        .eq("class_id", r.recipient_id)
        .eq("school_id", schoolId)
        .eq("status", "active");

      (classStudents || []).forEach((sc: any) => {
        if (sc.student?.user_id && sc.student.user_id !== senderId) {
          recipientRecords.push({
            message_id: msg.id,
            recipient_id: sc.student.user_id,
            recipient_type: "class",
            read_status: false,
            deleted: false,
            school_id: schoolId,
          });
        }
        // Also notify parent if exists
        if (sc.student?.parent_id) {
          recipientRecords.push({
            message_id: msg.id,
            recipient_id: sc.student.parent_id,
            recipient_type: "class",
            read_status: false,
            deleted: false,
            school_id: schoolId,
          });
        }
      });
    }
  }

  // Deduplicate recipients
  const uniqueRecipients = Array.from(
    new Map(recipientRecords.map((r) => [r.recipient_id, r])).values(),
  );

  if (uniqueRecipients.length > 0) {
    const { error: recipError } = await supabase
      .from("message_recipients")
      .insert(uniqueRecipients);

    if (recipError) {
      // Message was created but recipients failed - log error
      console.error("Failed to add recipients:", recipError.message);
      return {
        success: true,
        id: msg.id,
        message: `Message created but ${uniqueRecipients.length} recipients may not have been added`,
      };
    }
  }

  return {
    success: true,
    id: msg.id,
    message: `Message sent to ${uniqueRecipients.length} recipient(s)`,
  };
}

// ============================================================
// INBOX
// ============================================================

export async function getInbox(
  userId: string,
  schoolId: string,
  filters: MessageFilters = {},
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  success: boolean;
  data: Message[];
  total: number;
  message?: string;
}> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("message_recipients")
    .select(
      `
      id,
      read_status,
      read_at,
      message:messages(
        id,
        subject,
        body,
        priority,
        category,
        created_at,
        sender:users!sender_id(first_name, last_name)
      )
    `,
      { count: "exact" },
    )
    .eq("recipient_id", userId)
    .eq("school_id", schoolId)
    .eq("deleted", false);

  if (filters.read_status !== undefined) {
    query = query.eq("read_status", filters.read_status);
  }

  if (filters.date_from) {
    query = query.gte("message.created_at", filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte("message.created_at", filters.date_to);
  }

  const { data, error, count } = await query
    .order("created_at", { foreignTable: "messages", ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  // Transform to message format
  const messages = (data || []).map((r: any) => ({
    ...r.message,
    read_status: r.read_status,
    read_at: r.read_at,
    recipient_record_id: r.id,
  }));

  return { success: true, data: messages, total: count || 0 };
}

// ============================================================
// SENT MESSAGES
// ============================================================

export async function getSentMessages(
  userId: string,
  schoolId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  success: boolean;
  data: Message[];
  total: number;
  message?: string;
}> {
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabase
    .from("messages")
    .select(
      `
      *,
      recipients:message_recipients(
        recipient_id,
        read_status,
        recipient:users!recipient_id(first_name, last_name)
      )
    `,
      { count: "exact" },
    )
    .eq("sender_id", userId)
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as unknown as Message[],
    total: count || 0,
  };
}

// ============================================================
// READ / DELETE
// ============================================================

export async function markMessageAsRead(
  recipientRecordId: string,
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("message_recipients")
    .update({
      read_status: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", recipientRecordId)
    .eq("recipient_id", userId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Message marked as read" };
}

export async function markAllMessagesAsRead(
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("message_recipients")
    .update({
      read_status: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_id", userId)
    .eq("school_id", schoolId)
    .eq("read_status", false);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "All messages marked as read" };
}

export async function deleteMessage(
  recipientRecordId: string,
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  // Soft delete - just hide from recipient
  const { error } = await supabase
    .from("message_recipients")
    .update({ deleted: true })
    .eq("id", recipientRecordId)
    .eq("recipient_id", userId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Message deleted" };
}

export async function getMessageById(
  messageId: string,
  userId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: Message; message?: string }> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      *,
      sender:users!sender_id(first_name, last_name),
      recipients:message_recipients(
        id,
        recipient_id,
        read_status,
        read_at,
        recipient:users!recipient_id(first_name, last_name)
      )
    `,
    )
    .eq("id", messageId)
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  // Verify user is sender or recipient
  const isSender = data.sender_id === userId;
  const isRecipient = (data.recipients as any[])?.some(
    (r: any) => r.recipient_id === userId,
  );

  if (!isSender && !isRecipient) {
    return {
      success: false,
      message: "You do not have access to this message",
    };
  }

  // Auto-mark as read for recipient
  if (isRecipient) {
    const recipientRecord = (data.recipients as any[])?.find(
      (r: any) => r.recipient_id === userId && !r.read_status,
    );
    if (recipientRecord) {
      await markMessageAsRead(recipientRecord.id, userId, schoolId);
    }
  }

  return { success: true, data: data as unknown as Message };
}
