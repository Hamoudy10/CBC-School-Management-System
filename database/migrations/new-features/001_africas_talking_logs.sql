-- Africa's Talking SMS/WhatsApp logs
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_response JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_school_id ON sms_logs(school_id);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at);

ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sms_logs_school_isolation" ON sms_logs
  FOR ALL USING (school_id IN (
    SELECT school_id FROM users WHERE user_id = auth.uid()
  ));
