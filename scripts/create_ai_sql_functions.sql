-- Run this against your Supabase PostgreSQL database via SQL editor in Supabase Dashboard.
-- Creates two functions for the AI agent's SQL-based query system.

-- ============================================================
-- 1. exec_readonly_sql: executes SELECT queries safely
-- ============================================================
CREATE OR REPLACE FUNCTION public.exec_readonly_sql(query_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
SET search_path = 'public'
AS $$
DECLARE
  normalized TEXT;
  result JSON;
BEGIN
  normalized := LOWER(TRIM(query_text));

  -- Only allow SELECT or WITH (CTE) queries
  IF normalized !~ '^select ' AND normalized !~ '^with ' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;

  -- Block dangerous operations embedded anywhere in the query
  IF normalized ~ '(^|\s)(delete|drop|truncate|insert|update|alter|create|grant|revoke|copy|import|execute|call|reindex|vacuum|analyze|cluster|listen|notify)(\s|$|\(|;)' THEN
    RAISE EXCEPTION 'Only read-only queries are allowed';
  END IF;

  -- Execute with row limit and aggregate results as JSON array
  EXECUTE format('SELECT COALESCE(json_agg(row_to_json(__t)), ''[]''::json) FROM (%s LIMIT 1000) __t', query_text) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 2. get_db_schema: returns live database schema as JSON
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_db_schema()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'table_name', t.table_name,
      'columns', (
        SELECT json_agg(
          json_build_object(
            'name', c.column_name,
            'type', c.data_type,
            'nullable', c.is_nullable = 'YES',
            'default', c.column_default
          ) ORDER BY c.ordinal_position
        )
        FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = t.table_name
      ),
      'primary_key', (
        SELECT json_agg(kcu.column_name ORDER BY kcu.ordinal_position)
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.constraint_schema = kcu.constraint_schema
        WHERE tc.constraint_schema = 'public'
          AND tc.table_name = t.table_name
          AND tc.constraint_type = 'PRIMARY KEY'
      ),
      'foreign_keys', (
        SELECT json_agg(
          json_build_object(
            'column', kcu.column_name,
            'ref_table', ccu.table_name,
            'ref_column', ccu.column_name
          )
        )
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.constraint_schema = kcu.constraint_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.constraint_schema = ccu.constraint_schema
        WHERE tc.constraint_schema = 'public'
          AND tc.table_name = t.table_name
          AND tc.constraint_type = 'FOREIGN KEY'
      ),
      'enums', (
        SELECT json_agg(
          json_build_object(
            'column', c.column_name,
            'values', (
              SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder)
              FROM pg_enum e
              JOIN pg_type pt ON e.enumtypid = pt.oid
              WHERE pt.typname = c.udt_name
            )
          )
        )
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = t.table_name
          AND c.data_type = 'USER-DEFINED'
      )
    ) ORDER BY t.table_name
  ) INTO result
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';

  RETURN COALESCE(result, '[]'::json);
END;
$$;
