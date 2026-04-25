-- Migration: Allow trigger-driven writes to assessment_aggregates
-- Date: 2026-04-25
-- Problem:
--   Saving assessments triggers fn_update_assessment_aggregate(), which performs
--   INSERT/UPDATE on assessment_aggregates. The table had SELECT-only RLS policy,
--   causing "new row violates row-level security policy" for teacher saves.
--
-- Safe to run multiple times.

ALTER TABLE assessment_aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aggregates_insert ON assessment_aggregates;
CREATE POLICY aggregates_insert ON assessment_aggregates
  FOR INSERT TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (is_school_admin_level() AND school_id = get_user_school_id())
    OR (
      get_user_role() IN ('teacher', 'class_teacher', 'subject_teacher')
      AND school_id = get_user_school_id()
    )
  );

DROP POLICY IF EXISTS aggregates_update ON assessment_aggregates;
CREATE POLICY aggregates_update ON assessment_aggregates
  FOR UPDATE TO authenticated
  USING (
    is_super_admin()
    OR (is_school_admin_level() AND school_id = get_user_school_id())
    OR (
      get_user_role() IN ('teacher', 'class_teacher', 'subject_teacher')
      AND school_id = get_user_school_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR (is_school_admin_level() AND school_id = get_user_school_id())
    OR (
      get_user_role() IN ('teacher', 'class_teacher', 'subject_teacher')
      AND school_id = get_user_school_id()
    )
  );

-- Quick verification helper:
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'assessment_aggregates'
-- ORDER BY policyname, cmd;
