-- Migration: Add bell_times table for configurable school bell schedules
-- Purpose: Allow schools to define custom period times instead of hard-coded values
-- Date: 2026-04-01

CREATE TABLE IF NOT EXISTS bell_times (
  bell_time_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(school_id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  period_order INT NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure start_time is before end_time
  CONSTRAINT chk_bell_times_order CHECK (start_time < end_time)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bell_times_school ON bell_times(school_id);
CREATE INDEX IF NOT EXISTS idx_bell_times_active ON bell_times(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bell_times_order ON bell_times(school_id, period_order);

-- RLS
ALTER TABLE bell_times ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY bell_times_super_admin_all ON bell_times
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

-- School admins can manage bell times for their school
CREATE POLICY bell_times_school_admin_all ON bell_times
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('school_admin', 'principal')
    AND school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Teachers and others can view bell times for their school
CREATE POLICY bell_times_view ON bell_times
  FOR SELECT USING (
    school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION fn_update_bell_times_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bell_times_updated_at
  BEFORE UPDATE ON bell_times
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_bell_times_updated_at();

-- Seed default bell times for a typical Kenyan school day
-- These are inserted only if the table is empty for a given school
INSERT INTO bell_times (school_id, name, start_time, end_time, period_order, is_break, is_active)
SELECT 
  s.school_id,
  vals.name,
  vals.start_time::TIME,
  vals.end_time::TIME,
  vals.period_order,
  vals.is_break,
  true
FROM schools s
CROSS JOIN (
  VALUES
    ('Assembly', '07:45', '08:00', 1, false),
    ('Period 1', '08:00', '08:40', 2, false),
    ('Period 2', '08:40', '09:20', 3, false),
    ('Break Time', '09:20', '09:40', 4, true),
    ('Period 3', '09:40', '10:20', 5, false),
    ('Period 4', '10:20', '11:00', 6, false),
    ('Lunch Break', '11:00', '11:40', 7, true),
    ('Period 5', '11:40', '12:20', 8, false),
    ('Period 6', '12:20', '13:00', 9, false),
    ('Period 7', '13:00', '13:40', 10, false),
    ('End of Day', '13:40', '14:00', 11, false)
) AS vals(name, start_time, end_time, period_order, is_break)
WHERE NOT EXISTS (
  SELECT 1 FROM bell_times bt WHERE bt.school_id = s.school_id
);
