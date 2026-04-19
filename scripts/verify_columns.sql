-- Check actual columns in each table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('learning_areas', 'strands', 'sub_strands', 'competencies')
AND table_schema = 'public'
ORDER BY table_name, ordinal_position;