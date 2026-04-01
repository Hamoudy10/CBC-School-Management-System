-- Migration: Add staff_status_history table for tracking status changes
-- Purpose: Maintain audit trail of staff status transitions (active → inactive → active)
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS staff_status_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES staff(staff_id) ON DELETE CASCADE,
  previous_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  reason TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_staff_status_history_staff ON staff_status_history(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_status_history_changed_at ON staff_status_history(changed_at DESC);

-- RLS
ALTER TABLE staff_status_history ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY staff_status_history_super_admin_all ON staff_status_history
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

-- School admins and principals can view history for their school
CREATE POLICY staff_status_history_school_view ON staff_status_history
  FOR SELECT USING (
    staff_id IN (
      SELECT s.staff_id FROM staff s
      WHERE s.school_id = (auth.jwt() ->> 'school_id')::uuid
    )
  );

-- Staff can view their own history
CREATE POLICY staff_status_history_self_view ON staff_status_history
  FOR SELECT USING (
    changed_by = (auth.jwt() ->> 'user_id')::uuid
    OR staff_id IN (
      SELECT s.staff_id FROM staff s
      WHERE s.user_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Trigger: Auto-log status changes on staff table
CREATE OR REPLACE FUNCTION fn_log_staff_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO staff_status_history (staff_id, previous_status, new_status, changed_by, reason)
    VALUES (
      NEW.staff_id,
      OLD.status,
      NEW.status,
      COALESCE(NEW.updated_by, NEW.created_by),
      CASE
        WHEN NEW.status = 'inactive' THEN 'Deactivated'
        WHEN NEW.status = 'active' AND OLD.status = 'inactive' THEN 'Reactivated'
        ELSE 'Status changed'
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_status_change
  AFTER UPDATE OF status ON staff
  FOR EACH ROW
  EXECUTE FUNCTION fn_log_staff_status_change();
