-- Quick fix: add grade_level column to learning_areas
-- Run this if you already ran create_full_cbc_schema.sql

ALTER TABLE learning_areas ADD COLUMN IF NOT EXISTS grade_level VARCHAR(50);
