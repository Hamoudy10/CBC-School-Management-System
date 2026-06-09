-- upgrade-6/01_create_ai_agent_tables.sql
-- AI Agent Runtime Tables
-- ============================================================

-- ============================================================
-- 1. AI Agent Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(200),
  mode VARCHAR(30) NOT NULL DEFAULT 'assist'
    CHECK (mode IN ('assist', 'act')),
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'error')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. AI Agent Messages
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_agent_sessions(session_id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  structured_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. AI Agent Actions (planned and executed)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_actions (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_agent_sessions(session_id) ON DELETE CASCADE,
  school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tool_name VARCHAR(150) NOT NULL,
  module VARCHAR(80) NOT NULL,
  permission_action VARCHAR(40) NOT NULL,
  risk_level VARCHAR(20) NOT NULL
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(30) NOT NULL
    CHECK (status IN ('planned', 'awaiting_confirmation', 'approved', 'executing', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL,
  output JSONB,
  error TEXT,
  requires_confirmation BOOLEAN DEFAULT false,
  confirmed_by UUID REFERENCES users(user_id),
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. AI Agent Tool Catalog (registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_agent_tool_catalog (
  tool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) UNIQUE NOT NULL,
  module VARCHAR(80) NOT NULL,
  permission_action VARCHAR(40) NOT NULL,
  description TEXT NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ai_agent_sessions_scope
  ON ai_agent_sessions(school_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_messages_session
  ON ai_agent_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_actions_session_status
  ON ai_agent_actions(session_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_actions_scope
  ON ai_agent_actions(school_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_actions_tool
  ON ai_agent_actions(tool_name);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE ai_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_tool_catalog ENABLE ROW LEVEL SECURITY;

-- Sessions: own school access
CREATE POLICY ai_agent_sessions_school_access
  ON ai_agent_sessions
  FOR ALL
  USING (school_id = auth.uid()::text::uuid);

-- Messages: own school access
CREATE POLICY ai_agent_messages_school_access
  ON ai_agent_messages
  FOR ALL
  USING (school_id = auth.uid()::text::uuid);

-- Actions: own school access
CREATE POLICY ai_agent_actions_school_access
  ON ai_agent_actions
  FOR ALL
  USING (school_id = auth.uid()::text::uuid);

-- Tool catalog: read-only for authenticated users
CREATE POLICY ai_agent_tool_catalog_read
  ON ai_agent_tool_catalog
  FOR SELECT
  USING (true);
