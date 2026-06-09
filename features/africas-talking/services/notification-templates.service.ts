import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendSms, sendWhatsApp } from './africas-talking.service';
import type { ParentNotificationResult, ParentNotificationRequest, NotificationChannel, ClassNotificationResult } from '../types';
import type { SendClassNotificationInput } from '../validators/africas-talking.schema';

function renderTemplate(
  template: string,
  variables: Record<string, string> = {},
  customMessage?: string,
): string {
  if (customMessage) {
    let rendered = customMessage;
    for (const [key, value] of Object.entries(variables)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return rendered;
  }

  const templates: Record<string, string> = {
    fee_reminder: 'Dear {{parent_name}}, this is a reminder that {{student_name}}\'s school fees balance of KES {{balance}} is due. Please pay before {{due_date}} to avoid disruption. Thank you.',
    attendance_alert: 'Dear {{parent_name}}, your child {{student_name}} was marked {{status}} on {{date}}. Please ensure regular attendance. - {{school_name}}',
    report_available: 'Dear {{parent_name}}, the term {{term_name}} report for {{student_name}} is now available on the parent portal. Please log in to view. - {{school_name}}',
    discipline_notice: 'Dear {{parent_name}}, a disciplinary record has been logged for {{student_name}} regarding {{incident}}. Please contact the school for details. - {{school_name}}',
    event_announcement: 'Dear {{parent_name}}, {{school_name}} invites you to {{event_name}} on {{event_date}}. We look forward to seeing you.',
    custom: customMessage || '',
  };

  let rendered = templates[template] || '';
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return rendered;
}

async function getParentPhone(supabase: any, studentId: string): Promise<string | null> {
  const { data: guardian } = await supabase
    .from('student_guardians')
    .select('guardian_user_id, is_primary_contact')
    .eq('student_id', studentId)
    .eq('is_primary_contact', true)
    .maybeSingle();

  if (!guardian) {
    const { data: anyGuardian } = await supabase
      .from('student_guardians')
      .select('guardian_user_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();
    if (!anyGuardian) { return null; }
    guardian.guardian_user_id = anyGuardian.guardian_user_id;
  }

  const { data: user } = await supabase
    .from('users')
    .select('phone')
    .eq('user_id', guardian.guardian_user_id)
    .maybeSingle();

  return user?.phone || null;
}

async function getParentName(supabase: any, studentId: string): Promise<string> {
  const { data: guardian } = await supabase
    .from('student_guardians')
    .select('guardian_user_id')
    .eq('student_id', studentId)
    .eq('is_primary_contact', true)
    .limit(1)
    .maybeSingle();

  if (!guardian) {
    const { data: anyGuardian } = await supabase
      .from('student_guardians')
      .select('guardian_user_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();
    if (!anyGuardian) { return 'Parent'; }
    guardian.guardian_user_id = anyGuardian.guardian_user_id;
  }

  const { data: user } = await supabase
    .from('users')
    .select('first_name, last_name')
    .eq('user_id', guardian.guardian_user_id)
    .maybeSingle();

  return user ? `${user.first_name} ${user.last_name}`.trim() : 'Parent';
}

export async function sendParentNotification(
  request: ParentNotificationRequest,
): Promise<ParentNotificationResult> {
  const supabase = await createSupabaseServerClient();

  const parentPhone = await getParentPhone(supabase, request.studentId);
  const parentName = await getParentName(supabase, request.studentId);

  if (!parentPhone) {
    return {
      success: false,
      parentPhone: null,
      parentName,
      channel: request.channel,
      sent: false,
      error: 'No phone number found for parent',
    };
  }

  const message = renderTemplate(request.template, request.variables, request.customMessage);

  const channels: NotificationChannel[] =
    request.channel === 'both' ? ['sms', 'whatsapp'] : [request.channel];

  let overallSuccess = true;
  for (const channel of channels) {
    if (channel === 'sms') {
      const result = await sendSms({ to: [parentPhone], message });
      if (!result.success) { overallSuccess = false; }
    } else if (channel === 'whatsapp') {
      const result = await sendWhatsApp({ to: [parentPhone], message });
      if (!result.success) { overallSuccess = false; }
    }
  }

  return {
    success: overallSuccess,
    parentPhone,
    parentName,
    channel: request.channel,
    sent: overallSuccess,
    error: overallSuccess ? undefined : 'Failed to send via one or more channels',
  };
}

export async function sendClassNotification(
  request: SendClassNotificationInput,
): Promise<ClassNotificationResult> {
  const supabase = await createSupabaseServerClient();

  const { data: students } = await supabase
    .from('students')
    .select('student_id, first_name, last_name')
    .eq('current_class_id', request.classId)
    .eq('status', 'active');

  if (!students || students.length === 0) {
    return { success: false, sent: 0, failed: 0, total: 0, channel: request.channel };
  }

  let sentCount = 0;
  let failedCount = 0;

  for (const student of students) {
    const parentPhone = await getParentPhone(supabase, student.student_id);
    if (!parentPhone) {
      failedCount++;
      continue;
    }

    if (request.channel === 'sms') {
      const result = await sendSms({ to: [parentPhone], message: request.message });
      if (result.success) { sentCount++; } else { failedCount++; }
    } else {
      const result = await sendWhatsApp({ to: [parentPhone], message: request.message });
      if (result.success) { sentCount++; } else { failedCount++; }
    }
  }

  return {
    success: failedCount === 0,
    sent: sentCount,
    failed: failedCount,
    total: students.length,
    channel: request.channel,
  };
}
