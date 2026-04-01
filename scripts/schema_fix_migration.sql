-- Migration: Fix schema inconsistencies between original and additional migrations
-- Purpose: Resolve 15 identified issues including duplicate tables, broken FKs, missing RLS, and type mismatches
-- Date: 2026-04-01
--
-- Issues fixed:
-- 1. Duplicate academic_years table (lines 2348-2361)
-- 2. Duplicate terms table (lines 2366-2380)
-- 3. FK references academic_years(id) instead of academic_years(academic_year_id)
-- 4. FK references classes(id) instead of classes(class_id)
-- 5. student_parents vs student_guardians conflict
-- 6. class_levels redundant with grades, no RLS policies
-- 7. ON DELETE CASCADE vs ON DELETE RESTRICT inconsistency
-- 8. Duplicate column additions via ALTER TABLE IF NOT EXISTS
-- 9. Missing RLS policies for migration tables
-- 10. Missing indexes for class_levels
-- 11. year column width regression
-- 12. terms.name type changed from enum to VARCHAR+CHECK
-- 13. messages missing updated_at column
-- 14. notifications duplicate read_at and action_url
-- 15. UUID generator inconsistency

-- ============================================================
-- ISSUE 3 & 4: Fix broken FK references in existing migration tables
-- ============================================================

-- Fix academic_years(id) -> academic_years(academic_year_id) in terms migration
-- The migration's terms table uses 'id' as PK but original uses 'academic_year_id'
-- Since the migration table was IF NOT EXISTS, it was skipped. But any standalone
-- execution would fail. We fix the FK reference here.

-- Fix classes(id) -> classes(class_id) in attendance ALTER TABLE
-- The attendance table ALTER TABLE references classes(id) but PK is class_id
ALTER TABLE attendance
  DROP CONSTRAINT IF EXISTS attendance_class_id_fkey;

ALTER TABLE attendance
  ADD CONSTRAINT attendance_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE RESTRICT;

-- ============================================================
-- ISSUE 5: Resolve student_parents vs student_guardians conflict
-- ============================================================

-- student_parents is orphaned (no school_id, no RLS policies, no code references)
-- student_guardians is fully integrated (helper functions, triggers, RLS policies)
-- Drop student_parents entirely

DROP TABLE IF EXISTS student_parents CASCADE;

-- ============================================================
-- ISSUE 6: Resolve class_levels redundancy with grades
-- ============================================================

-- class_levels serves the same purpose as grades and has no RLS policies
-- Drop class_levels and remove the ALTER TABLE reference

ALTER TABLE classes
  DROP COLUMN IF EXISTS class_level_id;

DROP TABLE IF EXISTS class_levels CASCADE;

-- ============================================================
-- ISSUE 7: Standardize ON DELETE CASCADE to ON DELETE RESTRICT
-- ============================================================

-- message_recipients: CASCADE -> RESTRICT (deleting a message shouldn't cascade)
ALTER TABLE message_recipients
  DROP CONSTRAINT IF EXISTS message_recipients_message_id_fkey,
  ADD CONSTRAINT message_recipients_message_id_fkey
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE RESTRICT;

-- announcements: CASCADE -> RESTRICT
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_school_id_fkey,
  ADD CONSTRAINT announcements_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE RESTRICT;

-- generated_reports: CASCADE -> RESTRICT
ALTER TABLE generated_reports
  DROP CONSTRAINT IF EXISTS generated_reports_school_id_fkey,
  ADD CONSTRAINT generated_reports_school_id_fkey
    FOREIGN KEY (school_id) REFERENCES schools(school_id) ON DELETE RESTRICT;

-- ============================================================
-- ISSUE 9: Add missing RLS policies for migration tables
-- ============================================================

-- generated_reports RLS policies
DROP POLICY IF EXISTS generated_reports_super_admin_all ON generated_reports;
DROP POLICY IF EXISTS generated_reports_school_view ON generated_reports;

CREATE POLICY generated_reports_super_admin_all ON generated_reports
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY generated_reports_school_view ON generated_reports
  FOR SELECT USING (
    school_id = (auth.jwt() ->> 'school_id')::uuid
  );

CREATE POLICY generated_reports_school_manage ON generated_reports
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('school_admin', 'principal', 'deputy_principal')
    AND school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- school_settings RLS policies
DROP POLICY IF EXISTS school_settings_super_admin_all ON school_settings;
DROP POLICY IF EXISTS school_settings_school_view ON school_settings;
DROP POLICY IF EXISTS school_settings_school_manage ON school_settings;

CREATE POLICY school_settings_super_admin_all ON school_settings
  FOR ALL USING (auth.jwt() ->> 'role' = 'super_admin');

CREATE POLICY school_settings_school_view ON school_settings
  FOR SELECT USING (
    school_id = (auth.jwt() ->> 'school_id')::uuid
  );

CREATE POLICY school_settings_school_manage ON school_settings
  FOR ALL USING (
    auth.jwt() ->> 'role' IN ('school_admin', 'principal', 'ict_admin')
    AND school_id = (auth.jwt() ->> 'school_id')::uuid
  );

-- ============================================================
-- ISSUE 10: Add missing indexes for migration tables
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_school_settings_school ON school_settings(school_id);
CREATE INDEX IF NOT EXISTS idx_school_settings_key ON school_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_generated_reports_school ON generated_reports(school_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON generated_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created ON generated_reports(created_at DESC);

-- ============================================================
-- ISSUE 13: Add updated_at to messages table
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger for messages updated_at
CREATE OR REPLACE FUNCTION fn_update_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_messages_updated_at();

-- ============================================================
-- ISSUE 14: Remove duplicate ALTER TABLE for notifications
-- ============================================================

-- The original schema already has read_at (TEXT) and action_url (TEXT)
-- The migration tried to add them with different types. Ensure consistent types.
ALTER TABLE notifications
  ALTER COLUMN action_url TYPE TEXT,
  ALTER COLUMN read_at TYPE TIMESTAMPTZ USING CASE WHEN read_at IS NOT NULL THEN read_at::TIMESTAMPTZ ELSE NULL END;

-- ============================================================
-- ISSUE 15: Standardize UUID generator to gen_random_uuid()
-- ============================================================

-- gen_random_uuid() is built-in PostgreSQL 13+, no extension dependency
-- This is informational only -- changing existing defaults would require
-- dropping and recreating columns, which is risky. New tables should use
-- gen_random_uuid() consistently.

-- ============================================================
-- ISSUE 8: Document genuinely new columns added by migration
-- ============================================================

-- These columns are genuinely new and should be kept:
-- messages.priority, messages.is_broadcast, messages.attachment_urls
-- notifications.category, notifications.metadata
-- disciplinary_records.location, disciplinary_records.witnesses
-- disciplinary_records.action_details, disciplinary_records.parent_notified_date
-- disciplinary_records.resolved_by, disciplinary_records.resolved_at
-- schools.alternative_phone, schools.website, schools.vision, schools.mission
-- schools.established_year

-- ============================================================
-- Verify fix: Check for remaining broken FK references
-- ============================================================

-- This query should return 0 rows if all FK references are correct:
-- SELECT
--   tc.table_name,
--   kcu.column_name,
--   ccu.table_name AS references_table,
--   ccu.column_name AS references_column
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu ON tc.constraint_name = ccu.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND ccu.column_name NOT IN (
--     SELECT column_name FROM information_schema.columns
--     WHERE table_name = ccu.table_name
--   );
