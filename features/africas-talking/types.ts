export interface AfricasTalkingConfig {
  apiKey: string;
  username: string;
  senderId: string;
  env: 'sandbox' | 'production';
}

export interface SendSmsParams {
  to: string[];
  message: string;
  senderId?: string;
}

export interface SendWhatsAppParams {
  to: string[];
  message: string;
}

export interface AfricasTalkingResponse {
  success: boolean;
  message: string;
  recipients?: { number: string; status: string; cost: string }[];
}

export interface SmsLog {
  id: string;
  schoolId: string;
  recipientUserId: string | null;
  phoneNumber: string;
  message: string;
  channel: 'sms' | 'whatsapp';
  status: 'sent' | 'failed';
  providerResponse: Record<string, unknown>;
  sentAt: string;
}

export type NotificationChannel = 'sms' | 'whatsapp' | 'both';

export interface ParentNotificationRequest {
  studentId: string;
  channel: NotificationChannel;
  template: 'fee_reminder' | 'attendance_alert' | 'report_available' | 'discipline_notice' | 'event_announcement' | 'custom';
  customMessage?: string;
  variables?: Record<string, string>;
}

export interface ParentNotificationResult {
  success: boolean;
  parentPhone: string | null;
  parentName: string;
  channel: NotificationChannel;
  sent: boolean;
  error?: string;
}

export interface ClassNotificationResult {
  success: boolean;
  sent: number;
  failed: number;
  total: number;
  channel: 'sms' | 'whatsapp';
}
