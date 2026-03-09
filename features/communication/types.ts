// features/communication/types.ts
// Type definitions for Communication & Notifications module

export type MessagePriority = "low" | "normal" | "high" | "urgent";

export type MessageCategory =
  | "general"
  | "academic"
  | "finance"
  | "attendance"
  | "discipline"
  | "event"
  | "announcement";

export type RecipientType = "user" | "role" | "class" | "all";

export interface Message {
  id: string;
  sender_id: string;
  subject: string;
  body: string;
  priority: MessagePriority;
  category: MessageCategory;
  school_id: string;
  created_at: string;
  updated_at: string;
  // Joined
  sender?: {
    first_name: string;
    last_name: string;
  };
  recipients?: MessageRecipient[];
}

export interface MessageRecipient {
  id: string;
  message_id: string;
  recipient_id: string;
  recipient_type: RecipientType;
  read_status: boolean;
  read_at?: string;
  deleted: boolean;
  // Joined
  recipient?: {
    first_name: string;
    last_name: string;
  };
}

export interface SendMessageInput {
  subject: string;
  body: string;
  priority?: MessagePriority;
  category?: MessageCategory;
  recipients: Array<{
    recipient_id: string;
    recipient_type: RecipientType;
  }>;
}

export interface MessageFilters {
  category?: MessageCategory;
  priority?: MessagePriority;
  read_status?: boolean;
  date_from?: string;
  date_to?: string;
  search?: string;
}

// Notifications
export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "attendance"
  | "assessment"
  | "finance"
  | "discipline"
  | "system";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  read_status: boolean;
  read_at?: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
  school_id: string;
  created_at: string;
}

export interface CreateNotificationInput {
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

export interface BulkNotificationInput {
  user_ids: string[];
  title: string;
  body: string;
  type: NotificationType;
  action_url?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilters {
  type?: NotificationType;
  read_status?: boolean;
  date_from?: string;
  date_to?: string;
}

export interface UnreadCounts {
  messages: number;
  notifications: number;
  total: number;
}

// Announcements
export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: MessageCategory;
  priority: MessagePriority;
  target_roles?: string[];
  target_classes?: string[];
  publish_date: string;
  expiry_date?: string;
  is_active: boolean;
  created_by: string;
  school_id: string;
  created_at: string;
  updated_at: string;
  // Joined
  author?: {
    first_name: string;
    last_name: string;
  };
}
