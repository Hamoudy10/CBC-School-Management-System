-- Migration: Add term_locks table for assessment governance
-- Purpose: Allow administrators to lock/unlock terms to prevent assessment edits after term close
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS term_locks (
  lock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES terms(term_id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES academic_years(academic_year_id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One active lock per term per school
  UNIQUE (school_id, term_id, academic_year_id, is_active)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_term_locks_school ON term_locks(school_id);
CREATE INDEX IF NOT EXISTS idx_term_locks_term ON term_locks(term_id);
CREATE INDEX IF NOT EXISTS idx_term_locks_year ON term_locks(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_term_locks_active ON term_locks(is_active);

-- RLS
ALTER TABLE term_locks ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY term_locks_super_admin_all ON term_locks
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

-- School admins and principals can manage locks for their school
CREATE POLICY term_locks_school_admin_all ON term_locks
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('school_admin', 'principal')
    AND school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Teachers and others can only view locks for their school
CREATE POLICY term_locks_view ON term_locks
  FOR SELECT USING (
    school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION fn_update_term_lock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_term_locks_updated_at
  BEFORE UPDATE ON term_locks
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_term_lock_updated_at();
