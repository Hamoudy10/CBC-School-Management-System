-- ============================================================
-- Verification Script: Check if academics tables exist
-- Run this first to see what exists in your database
-- ============================================================

-- Check if learning_areas table exists and show its structure
SELECT 'learning_areas' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'learning_areas'
ORDER BY ordinal_position;

-- Check if strands table exists and show its structure
SELECT 'strands' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'strands'
ORDER BY ordinal_position;

-- Check if sub_strands table exists and show its structure
SELECT 'sub_strands' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'sub_strands'
ORDER BY ordinal_position;

-- Check if competencies table exists and show its structure
SELECT 'competencies' as table_name, column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'competencies'
ORDER BY ordinal_position;

-- Simple query to check if tables exist
SELECT 
  'learning_areas' as table_name,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'learning_areas') > 0 as exists
UNION ALL
SELECT 
  'strands',
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'strands') > 0
UNION ALL
SELECT 
  'sub_strands',
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'sub_strands') > 0
UNION ALL
SELECT 
  'competencies',
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'competencies') > 0;

-- Count rows in each table
SELECT 
  'learning_areas' as table_name,
  (SELECT COUNT(*) FROM learning_areas) as row_count
UNION ALL
SELECT 
  'strands',
  (SELECT COUNT(*) FROM strands) as row_count
UNION ALL
SELECT 
  'sub_strands',
  (SELECT COUNT(*) FROM sub_strands) as row_count
UNION ALL
SELECT 
  'competencies',
  (SELECT COUNT(*) FROM competencies) as row_count;