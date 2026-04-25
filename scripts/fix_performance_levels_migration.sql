-- Migration: Backfill missing CBC performance levels per school
-- Safe to run multiple times.
-- Date: 2026-04-25

DO $$
DECLARE
  schools_pk_column TEXT;
  label_udt_name TEXT;
  label_insert_expr TEXT;
BEGIN
  -- Validate expected performance_levels shape used by the assessment module.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'performance_levels'
      AND column_name = 'school_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'performance_levels'
      AND column_name = 'label'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'performance_levels'
      AND column_name = 'numeric_value'
  ) THEN
    RAISE EXCEPTION
      'performance_levels is missing required columns (school_id, label, numeric_value). Run the schema migration first.';
  END IF;

  -- Handle either schools.school_id or schools.id across schema variants.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schools'
      AND column_name = 'school_id'
  ) THEN
    schools_pk_column := 'school_id';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'schools'
      AND column_name = 'id'
  ) THEN
    schools_pk_column := 'id';
  ELSE
    RAISE EXCEPTION
      'Unable to determine school key column. Expected schools.school_id or schools.id.';
  END IF;

  -- Detect label column type so insert works for enum-based and text-based schemas.
  SELECT c.udt_name
  INTO label_udt_name
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'performance_levels'
    AND c.column_name = 'label'
  LIMIT 1;

  IF label_udt_name = 'cbc_performance_level' THEN
    label_insert_expr := 'v.label::cbc_performance_level';
  ELSE
    label_insert_expr := 'v.label';
  END IF;

  EXECUTE format(
    $sql$
      INSERT INTO performance_levels (school_id, name, label, numeric_value, description)
      SELECT
        s.%1$I AS school_id,
        v.name,
        %2$s AS label,
        v.numeric_value,
        v.description
      FROM schools s
      CROSS JOIN (
        VALUES
          (
            'Below Expectation',
            'below_expectation',
            1,
            'Learner has not achieved the expected competency level. Needs significant support.'
          ),
          (
            'Approaching Expectation',
            'approaching',
            2,
            'Learner is progressing towards expected competency. Requires additional support.'
          ),
          (
            'Meeting Expectation',
            'meeting',
            3,
            'Learner has achieved the expected competency level.'
          ),
          (
            'Exceeding Expectation',
            'exceeding',
            4,
            'Learner has surpassed the expected competency level. Shows exceptional understanding.'
          )
      ) AS v(name, label, numeric_value, description)
      WHERE NOT EXISTS (
        SELECT 1
        FROM performance_levels pl
        WHERE pl.school_id = s.%1$I
          AND pl.label::text = v.label
      );
    $sql$,
    schools_pk_column,
    label_insert_expr
  );
END $$;

-- Verification
SELECT school_id, COUNT(*) AS performance_level_count
FROM performance_levels
GROUP BY school_id
ORDER BY performance_level_count ASC, school_id;
