# Migration Order

Apply migrations in the order listed below. Each migration is idempotent
(`CREATE TABLE IF NOT EXISTS`) and can be re-run safely.

## Prerequisites

- Supabase project with the base schema applied (schools, users, students, etc.
  from `sql_creation_script.txt` or an equivalent full schema script)
- Node.js >= 18.17.0
- `SUPABASE_SERVICE_ROLE_KEY` with superuser privileges for DDL

## Migration Sequence

### Level 1: Core infrastructure (no dependencies)
```
1. upgrade-4/01_create_ai_intelligence_tables.sql
     Tables: ai_logs, ai_cache, analytics_snapshots, student_risk_scores
```

### Level 2: Feature tables
```
2. upgrade-5/01_create_offline_tables.sql
     Tables: offline_sync_queue, offline_metadata
     Depends on: students (via foreign keys)

3. upgrade-6/01_create_ai_agent_tables.sql
     Tables: ai_agent_sessions, ai_agent_messages, ai_agent_actions, ai_agent_tool_catalog
     Depends on: schools, users (via foreign keys)
```

### Level 3: New feature additions
```
4. new-features/001_africas_talking_logs.sql
     Table: sms_logs

5. new-features/002_chatbot_sessions.sql
     Table: chatbot_sessions

6. new-features/003_fee_prediction_logs.sql
     Tables: fee_prediction_logs, alignment_check_logs

7. new-features/004_ai_logs_columns.sql
     ALTER TABLE ai_logs (adds columns, no new table)
     Depends on: upgrade-4 (ai_logs must exist)
```

## Applying Migrations

```bash
# Via Supabase CLI (recommended)
supabase db push

# Or manually via SQL editor:
#  1. Open your Supabase project SQL editor
#  2. Copy-paste each file in order
#  3. Execute one at a time
```

## Verifying

After all migrations, run:
```bash
npm run check:schema
```

This validates that all `.from('table')` references in the code match
known canonical tables.
