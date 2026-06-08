-- Add missing columns to ai_logs for structured error monitoring
ALTER TABLE IF EXISTS ai_logs
  ADD COLUMN IF NOT EXISTS request_label VARCHAR(100),
  ADD COLUMN IF NOT EXISTS error TEXT;

COMMENT ON COLUMN ai_logs.request_label IS 'Identifies which feature/routes triggered the AI call (e.g. early-warning, fee-predictor)';
COMMENT ON COLUMN ai_logs.error IS 'Error message if the AI request failed, NULL on success';

CREATE INDEX IF NOT EXISTS idx_ai_logs_request_label ON ai_logs(request_label);
CREATE INDEX IF NOT EXISTS idx_ai_logs_error ON ai_logs(error) WHERE error IS NOT NULL;
