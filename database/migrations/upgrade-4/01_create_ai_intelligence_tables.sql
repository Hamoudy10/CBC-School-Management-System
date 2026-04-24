-- Upgrade 4: CBC Report Intelligence Database Additions
-- School Management System - AI-Powered CBC School Operating System
-- This migration adds tables required for Upgrade 4: CBC Report Intelligence

-- Create ai_logs table to track AI usage and costs
CREATE TABLE IF NOT EXISTS ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt TEXT NOT NULL,
    response JSONB NOT NULL,
    cost DECIMAL(10, 6) DEFAULT 0,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    model_used VARCHAR(100) DEFAULT 'groq',
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create student_risk_scores table for tracking student risk assessments
CREATE TABLE IF NOT EXISTS student_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    risk_factors JSONB, -- Store factors contributing to risk score
    confidence_score DECIMAL(3, 2) DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one active risk score per student at a time
    CONSTRAINT unique_active_student_risk UNIQUE (student_id, school_id) 
    WHERE (valid_until IS NULL OR valid_until > NOW())
);

-- Create analytics_snapshots table for storing computed analytics
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    metrics_json JSONB NOT NULL, -- Store various computed metrics
    snapshot_type VARCHAR(50) NOT NULL CHECK (snapshot_type IN (
        'class_performance', 
        'attendance_trends', 
        'risk_assessment', 
        'subject_analytics',
        'teacher_performance',
        'school_health'
    )),
    date DATE NOT NULL,
    period_start DATE,
    period_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ai_cache table for caching AI responses to reduce costs and improve speed
CREATE TABLE IF NOT EXISTS ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 hash of the prompt + context
    response JSONB NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    subject VARCHAR(100),
    prompt_text TEXT, -- Store original prompt for debugging/transparency
    system_prompt TEXT,
    model_used VARCHAR(100),
    temperature DECIMAL(3, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance

-- Indexes for ai_logs
CREATE INDEX IF NOT EXISTS idx_ai_logs_school_id ON ai_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON ai_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_logs_model_used ON ai_logs(model_used);

-- Indexes for student_risk_scores
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_student_id ON student_risk_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_school_id ON student_risk_scores(school_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_risk_level ON student_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_computed_at ON student_risk_scores(computed_at);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_valid_until ON student_risk_scores(valid_until);

-- Indexes for analytics_snapshots
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_class_id ON analytics_snapshots(class_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_school_id ON analytics_snapshots(school_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_snapshot_type ON analytics_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period ON analytics_snapshots(period_start, period_end);

-- Indexes for ai_cache
CREATE INDEX IF NOT EXISTS idx_ai_cache_hash ON ai_cache(hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_school_id ON ai_cache(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_class_id ON ai_cache(class_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_subject ON ai_cache(subject);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires_at ON ai_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_hit_count ON ai_cache(hit_count);

-- Add helpful comments to tables and columns
COMMENT ON TABLE ai_logs IS 'Logs all AI interactions for monitoring, cost tracking, and auditing';
COMMENT ON COLUMN ai_logs.prompt IS 'The prompt sent to the AI model';
COMMENT ON COLUMN ai_logs.response IS 'The response received from the AI model';
COMMENT ON COLUMN ai_logs.cost IS 'Estimated cost of the AI request in USD';
COMMENT ON COLUMN ai_logs.model_used IS 'Which AI model was used for the request';
COMMENT ON COLUMN ai_logs.tokens_used IS 'Number of tokens consumed in the request';

COMMENT ON TABLE student_risk_scores IS 'Stores computed risk scores for students based on various factors';
COMMENT ON COLUMN student_risk_scores.risk_level IS 'Calculated risk level: low, medium, or high';
COMMENT ON COLUMN student_risk_scores.risk_factors IS 'JSON object detailing factors that contributed to the risk score';
COMMENT ON COLUMN student_risk_scores.confidence_score IS 'Confidence in the risk assessment (0.0 to 1.0)';
COMMENT ON COLUMN student_risk_scores.valid_until IS 'When this risk score expires and needs recomputation';

COMMENT ON TABLE analytics_snapshots IS 'Pre-computed analytics snapshots for dashboard performance';
COMMENT ON COLUMN analytics_snapshots.metrics_json IS 'JSON object containing various computed metrics';
COMMENT ON COLUMN analytics_snapshots.snapshot_type IS 'Type of analytics stored in this snapshot';
COMMENT ON COLUMN analytics_snapshots.date IS 'The date this snapshot represents';
COMMENT ON COLUMN analytics_snapshots.period_start IS 'Start date of the period analyzed';
COMMENT ON COLUMN analytics_snapshots.period_end IS 'End date of the period analyzed';

COMMENT ON TABLE ai_cache IS 'Caches AI responses to reduce costs and improve response times';
COMMENT ON COLUMN ai_cache.hash IS 'Unique hash identifying the cached prompt+context combination';
COMMENT ON COLUMN ai_cache.response IS 'The cached AI response';
COMMENT ON COLUMN ai_cache.expires_at IS 'When this cache entry expires';
COMMENT ON COLUMN ai_cache.hit_count IS 'Number of times this cache entry has been used';

-- Updated trigger function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at column
DROP TRIGGER IF EXISTS update_ai_logs_updated_at ON ai_logs;
CREATE TRIGGER update_ai_logs_updated_at
    BEFORE UPDATE ON ai_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_risk_scores_updated_at ON student_risk_scores;
CREATE TRIGGER update_student_risk_scores_updated_at
    BEFORE UPDATE ON student_risk_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_analytics_snapshots_updated_at ON analytics_snapshots;
CREATE TRIGGER update_analytics_snapshots_updated_at
    BEFORE UPDATE ON analytics_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_cache_updated_at ON ai_cache;
CREATE TRIGGER update_ai_cache_updated_at
    BEFORE UPDATE ON ai_cache
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert initial helpful comments about the purpose of these tables
COMMENT ON SCHEMA public IS 'Standard public schema containing application tables including new AI intelligence tables';