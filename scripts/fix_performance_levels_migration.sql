-- Migration: Fix performance_levels table schema and seed data
-- Run in Supabase SQL Editor: https://app.supabase.com/project/_/sql
-- This fixes the schema mismatch and seeds default performance levels

-- 1. Rename id column to level_id (if not already done)
ALTER TABLE performance_levels RENAME COLUMN id TO level_id;

-- 2. Add label column (if not exists)
ALTER TABLE performance_levels ADD COLUMN IF NOT EXISTS label VARCHAR(50);

-- 3. Backfill label from code (convert code to label)
UPDATE performance_levels 
SET label = CASE code
  WHEN 'EE' THEN 'exceeding'
  WHEN 'ME' THEN 'meeting'  
  WHEN 'AP' THEN 'approaching'
  WHEN 'BE' THEN 'below_expectation'
END
WHERE label IS NULL OR label = '';

-- 4. Seed default performance levels (global, not school-specific)
INSERT INTO performance_levels (level_id, code, label, name, description, min_score, max_score, order_index, is_active)
SELECT 
  gen_random_uuid(),
  code,
  CASE code
    WHEN 'EE' THEN 'exceeding'
    WHEN 'ME' THEN 'meeting'
    WHEN 'AP' THEN 'approaching'
    WHEN 'BE' THEN 'below_expectation'
  END,
  name,
  description,
  min_score,
  max_score,
  order_index,
  is_active
FROM (
  VALUES
    ('EE', 'Exceeding Expectations', 'Learner consistently demonstrates mastery beyond expected level', 80, 100, 1, true),
    ('ME', 'Meeting Expectations', 'Learner consistently demonstrates mastery at expected level', 65, 79, 2, true),
    ('AP', 'Approaching Expectations', 'Learner demonstrates partial mastery, approaching expected level', 50, 64, 3, true),
    ('BE', 'Below Expectations', 'Learner has not yet demonstrated mastery at expected level', 0, 49, 4, true)
) AS v(code, name, description, min_score, max_score, order_index, is_active)
ON CONFLICT (code) DO NOTHING;

-- 5. Verify the data
SELECT code, label, name, min_score, max_score FROM performance_levels ORDER BY order_index;