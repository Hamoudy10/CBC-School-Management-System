-- Parent chatbot sessions
CREATE TABLE IF NOT EXISTS chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  parent_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chatbot_sessions_phone ON chatbot_sessions(phone_number);
CREATE INDEX idx_chatbot_sessions_school ON chatbot_sessions(school_id);

ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_sessions_school_isolation" ON chatbot_sessions
  FOR ALL USING (school_id IN (
    SELECT school_id FROM users WHERE user_id = auth.uid()
  ));
