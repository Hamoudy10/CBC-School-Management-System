-- Create ai_logs table if not exists (for environments that skipped upgrade-4)
CREATE TABLE IF NOT EXISTS ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    response JSONB NOT NULL,
    cost DECIMAL(10, 6) DEFAULT 0,
    school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
    model_used VARCHAR(100) DEFAULT 'groq',
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to ai_logs for structured error monitoring
ALTER TABLE IF EXISTS ai_logs
  ADD COLUMN IF NOT EXISTS request_label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS error TEXT;

COMMENT ON COLUMN ai_logs.request_label IS 'Identifies which feature/routes triggered the AI call (e.g. early-warning, fee-predictor)';
COMMENT ON COLUMN ai_logs.error IS 'Error message if the AI request failed, NULL on success';

CREATE INDEX IF NOT EXISTS idx_ai_logs_request_label ON ai_logs(request_label);
CREATE INDEX IF NOT EXISTS idx_ai_logs_error ON ai_logs(error) WHERE error IS NOT NULL;
