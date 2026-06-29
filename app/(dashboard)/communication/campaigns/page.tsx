'use client';

import React, { useState, useCallback } from 'react';
import { MessageSquare, Send, Users, BookOpen, AlertTriangle, DollarSign, Megaphone } from 'lucide-react';
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
  { value: 'fee_reminder', label: 'Fee Reminder', icon: DollarSign, defaultMessage: 'Dear parent, this is a reminder that {{fee_balance}} fee balance is due. Please make arrangements to clear the balance.' },
  { value: 'attendance_alert', label: 'Attendance Alert', icon: AlertTriangle, defaultMessage: 'Dear parent, your child {{student_name}} was absent on {{date}}. Please ensure regular attendance.' },
  { value: 'report_available', label: 'Report Available', icon: BookOpen, defaultMessage: 'Dear parent, {{student_name}}\'s report for {{term}} {{year}} is now available. Please check the parent portal.' },
  { value: 'event_announcement', label: 'Event Announcement', icon: Megaphone, defaultMessage: 'Dear parent, the school will hold {{event_name}} on {{date}}. Your participation is highly valued.' },
  { value: 'custom', label: 'Custom Message', icon: MessageSquare, defaultMessage: '' },
];

const CHANNELS = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'both', label: 'Both' },
];

export default function CampaignsPage() {
  const { user } = useAuth();
  const { success, error } = useToast();
  const { classes: referenceClasses } = useReferenceData({ enabled: Boolean(user) });

  const [classId, setClassId] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp' | 'both'>('sms');
  const [template, setTemplate] = useState('custom');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const handleTemplateChange = (val: string) => {
    setTemplate(val);
    const tpl = TEMPLATES.find((t) => t.value === val);
    if (tpl) {setMessage(tpl.defaultMessage);}
  };

  const handleSend = useCallback(async () => {
    if (!classId) { error('Select a class'); return; }
    if (!message.trim()) { error('Enter a message'); return; }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/africas-talking/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          message: message.trim(),
          channel: channel === 'both' ? 'sms' : channel,
          template: template !== 'custom' ? template : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {throw new Error(json.error || 'Send failed');}

      setResult({
        sent: json.data?.sent ?? 0,
        failed: json.data?.failed ?? 0,
        total: json.data?.total ?? 0,
      });
      success(`Message sent to ${json.data?.sent ?? 0} parent(s)`);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to send');
    } finally { setSending(false); }
  }, [classId, channel, template, message, success, error]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Communication"
        description="Send SMS or WhatsApp messages to parents"
        icon={<MessageSquare className="h-6 w-6" />}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Target class *">
              <option value="">Select class</option>
              {referenceClasses.map((c) => <option key={c.classId} value={c.classId}>{c.name}</option>)}
              <option value="all">All Classes</option>
            </Select>
            <Select value={channel} onChange={(e) => setChannel(e.target.value as any)} placeholder="Channel">
              {CHANNELS.map((ch) => <option key={ch.value} value={ch.value}>{ch.label}</option>)}
            </Select>
            <Select value={template} onChange={(e) => handleTemplateChange(e.target.value)} placeholder="Template">
              {TEMPLATES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Message</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message... Use {{variable}} for dynamic content."
            />
            {template !== 'custom' && (
              <p className="mt-1 text-xs text-gray-400">
                Available variables: {'{{student_name}}'}, {'{{parent_name}}'}, {'{{fee_balance}}'}, {'{{term}}'}, {'{{year}}'}, {'{{date}}'}
              </p>
            )}
          </div>

          <Button
            leftIcon={<Send className="h-4 w-4" />}
            onClick={handleSend}
            loading={sending}
            disabled={!classId || !message.trim()}
          >
            {sending ? 'Sending...' : `Send via ${channel === 'both' ? 'SMS & WhatsApp' : channel}`}
          </Button>
        </CardContent>
      </Card>

      {sending && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-3 text-sm text-gray-500">Sending messages to parents...</span>
          </CardContent>
        </Card>
      )}

      {result && !sending && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4" />
              Delivery Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-2xl font-bold text-green-600">{result.sent}</p>
                <p className="text-xs text-green-700">Delivered</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                <p className="text-xs text-red-700">Failed</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold text-gray-600">{result.total}</p>
                <p className="text-xs text-gray-600">Total Parents</p>
              </div>
            </div>
            {result.failed > 0 && (
              <Alert variant="warning" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Some messages failed</AlertTitle>
                <AlertDescription>Check phone numbers in parent profiles and try again.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
