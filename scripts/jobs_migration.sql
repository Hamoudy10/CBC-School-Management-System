-- Migration: Add jobs table for background job queue
-- Purpose: Persistent storage for background jobs (report generation, batch exports, notifications)
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error TEXT,
  retries INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  priority INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  processed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Valid status values
  CONSTRAINT chk_jobs_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_school ON jobs(school_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_priority_status ON jobs(priority DESC, created_at ASC) WHERE status = 'pending';

-- RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY jobs_super_admin_all ON jobs
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

-- School admins can manage jobs for their school
CREATE POLICY jobs_school_admin_all ON jobs
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('school_admin', 'principal')
    AND school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Users can view their own jobs and jobs for their school
CREATE POLICY jobs_user_view ON jobs
  FOR SELECT USING (
    school_id = (auth.jwt() ->> 'school_id')::uuid
    OR created_by = (auth.jwt() ->> 'user_id')::uuid
  );

-- Users can create jobs for their school
CREATE POLICY jobs_user_create ON jobs
  FOR INSERT WITH CHECK (
    school_id = (auth.jwt() ->> 'school_id')::uuid
  );
