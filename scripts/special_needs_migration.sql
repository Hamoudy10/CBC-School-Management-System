-- Migration: Add special_needs table and RLS policies
-- Purpose: Dedicated table for tracking student special needs and accommodations
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS special_needs (
  special_needs_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
  needs_type VARCHAR(100) NOT NULL,
  description TEXT,
  accommodations TEXT,
  assessment_adjustments JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_special_needs_school ON special_needs(school_id);
CREATE INDEX IF NOT EXISTS idx_special_needs_student ON special_needs(student_id);
CREATE INDEX IF NOT EXISTS idx_special_needs_type ON special_needs(needs_type);
CREATE INDEX IF NOT EXISTS idx_special_needs_active ON special_needs(is_active);

-- RLS
ALTER TABLE special_needs ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY special_needs_super_admin_all ON special_needs
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

-- School admins, principals, deputies can manage all records for their school
CREATE POLICY special_needs_school_admin_all ON special_needs
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('school_admin', 'principal', 'deputy_principal')
    AND school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Teachers and class teachers can view records for their school
CREATE POLICY special_needs_teacher_view ON special_needs
  FOR SELECT USING (
    school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Parents can view their children's special needs
CREATE POLICY special_needs_parent_view ON special_needs
  FOR SELECT USING (
    student_id IN (
      SELECT sg.student_id FROM student_guardians sg
      WHERE sg.guardian_user_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Students can view their own special needs
CREATE POLICY special_needs_student_view ON special_needs
  FOR SELECT USING (
    student_id IN (
      SELECT s.student_id FROM students s
      WHERE s.user_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION fn_update_special_needs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_special_needs_updated_at
  BEFORE UPDATE ON special_needs
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_special_needs_updated_at();
