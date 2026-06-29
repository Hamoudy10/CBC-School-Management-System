'use client';

import React, { useState, useCallback } from 'react';
import { MessageSquareText, Send, Users, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/Alert';
import { useToast } from '@/components/ui/Toast';
import { useReferenceData } from '@/hooks/useReferenceData';

const TEMPLATES = [
  { value: 'fee_reminder', label: 'Fee Reminder', defaultMessage: 'Dear parent, this is a reminder that school fees for [term] are due. Current balance: KES [amount]. Please pay via the school portal.' },
  { value: 'attendance_alert', label: 'Attendance Alert', defaultMessage: 'Dear parent, your child [student_name] was absent on [date]. Please notify the school of the reason.' },
  { value: 'report_available', label: 'Report Available', defaultMessage: 'Dear parent, the CBC report for [student_name] is now available on the parent portal.' },
  { value: 'discipline_notice', label: 'Discipline Notice', defaultMessage: 'Dear parent, regarding a behavioral matter involving [student_name], please schedule a meeting with the class teacher.' },
  { value: 'event', label: 'School Event', defaultMessage: 'Dear parent, please be informed of the upcoming school event: [event_name] on [date].' },
];

const CHANNELS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

export default function SendCommunicationPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses } = useReferenceData({ enabled: Boolean(user) });

  const [channel, setChannel] = useState('sms');
  const [template, setTemplate] = useState('');
  const [message, setMessage] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const classes = (referenceClasses || []).map((c: any) => ({
    classId: c.classId || c.id,
    name: c.name,
  }));

  const handleTemplateChange = useCallback((value: string) => {
    setTemplate(value);
    const t = TEMPLATES.find((t) => t.value === value);
    if (t) {setMessage(t.defaultMessage);}
  }, []);

  const handleSend = useCallback(async () => {
    if (!message.trim()) {
      error('Please enter a message');
      return;
    }
    if (!selectedClassId) {
      error('Please select a class');
      return;
    }

    setIsSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/africas-talking/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          message: message.trim(),
          classId: selectedClassId,
          template: template || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {throw new Error(data.error || 'Send failed');}

      setResult(data.data);
      success(`Message sent to ${data.data?.sent || 0} recipients`);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setIsSending(false);
    }
  }, [channel, message, template, selectedClassId, error, success]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send Message"
        description="Send SMS or WhatsApp notifications via Africa's Talking"
        icon={<MessageSquareText className="h-6 w-6" />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compose Message</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Channel">
              {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>

            <Select value={template} onChange={(e) => handleTemplateChange(e.target.value)} placeholder="Template (optional)">
              <option value="">Custom message</option>
              {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>

            <Select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} placeholder="Recipient class">
              <option value="">Select class</option>
              {classes.map((cls: any) => <option key={cls.classId} value={cls.classId}>{cls.name}</option>)}
            </Select>
          </div>

          <textarea
            className="w-full min-h-[120px] rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Type your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              <Users className="inline h-3 w-3 mr-1" />
              Sent to all parents of students in the selected class
            </p>
            <Button
              leftIcon={<Send className="h-4 w-4" />}
              onClick={handleSend}
              loading={isSending}
              disabled={!message.trim() || !selectedClassId}
            >
              Send via {channel === 'sms' ? 'SMS' : 'WhatsApp'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Alert variant={result.failed > 0 ? 'warning' : 'success'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Delivery Report</AlertTitle>
          <AlertDescription>
            Sent: {result.sent}, Failed: {result.failed}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
