# Database and Functionality Implementation Plan

This plan converts the current functionality audit into an AI-ready work plan. It is written so another implementation agent can work through the project without guessing, skipping hidden schema problems, or fixing symptoms while leaving the underlying database mismatch intact.

## Primary Objective

Make the school management system reliable for real database-backed use by:

1. Eliminating schema drift between code, SQL migrations, and Supabase.
2. Fixing broken fetch/post flows that currently use wrong table or column names.
3. Replacing placeholder and mock implementations with working features.
4. Adding verification so future database regressions are caught before runtime.
5. Improving the system with the highest-value operational features.

## Non-Negotiable Rules for the Implementing AI

- Do not rename database columns casually. First identify the canonical schema, then align code and migrations to it.
- Prefer the existing project schema in `sql_creation_script.txt` unless the live Supabase schema proves otherwise.
- Do not introduce a second naming convention. The current canonical pattern is mostly `school_id`, `student_id`, `user_id`, `class_id`, `academic_year_id`, `term_id`, `learning_area_id`, and `staff_id`.
- Do not leave Supabase clients typed as `any` after the schema work is complete.
- Every fixed API route must be tested with at least one success path and one failure path where practical.
- Keep legacy routes only when needed for backward compatibility. If retained, clearly redirect or delegate to canonical services.
- Keep changes scoped. Avoid broad UI redesigns while fixing database correctness.

## Current High-Risk Findings To Address

### 1. Missing Generated Database Types

Problem:
- `types/database.types.ts` is missing.
- `lib/supabase/server.ts` uses `createServerClient<any>` and `createClient<any>`.
- This allows incorrect table and column names to compile.

Known file:
- `lib/supabase/server.ts`

Required outcome:
- Generate or manually create `types/database.types.ts` from the canonical schema.
- Wire `Database` into server, client, middleware, and realtime Supabase clients.
- Remove unnecessary `as any` casts from touched service/API files.

Acceptance criteria:
- `npx.cmd tsc --noEmit --incremental false` passes.
- Supabase clients no longer use `any` generics.
- New DB queries in fixed modules are type checked.

### 2. Canonical Schema Drift

Problem:
- Main schema uses ID columns like `school_id`, `student_id`, `user_id`, `learning_area_id`.
- Some migrations and API routes assume generic `id`.

Known files:
- `scripts/missing_module_tables_migration.sql`
- `scripts/create_full_cbc_schema.sql`
- `scripts/sql/2026-04-24-ai-core-foundation.sql`
- `app/api/schools/route.ts`
- `app/api/schools/[id]/route.ts`
- `app/api/student-subjects/route.ts`
- `app/api/student-subjects/[id]/route.ts`
- `app/api/subjects/route.ts`
- `app/api/subjects/[id]/route.ts`
- `app/api/grading-scales/route.ts`
- `app/api/grading-scales/[id]/route.ts`
- `app/api/promotion-rules/route.ts`
- `app/api/promotion-rules/[id]/route.ts`

Required outcome:
- Decide and document the canonical schema.
- Update migrations and routes to use canonical primary/foreign keys.
- If some new tables truly use generic `id`, isolate that choice and do not mix it with core tables that use named IDs.

Acceptance criteria:
- No route checks `students.id` if the table uses `student_id`.
- No migration references `schools(id)` if the actual table uses `schools(school_id)`.
- Subject/student-subject/grading-scale/promotion-rule APIs work against the chosen schema.

### 3. Broken Parent Dashboard Data Fetching

Problem:
- Parent dashboard queries `attendance_records` and `fee_payments`.
- Main schema has `attendance` and `payments`.
- `payments` links to students through `student_fees.student_id`, not directly by `student_id`.

Known file:
- `app/api/parent/dashboard/route.ts`

Required outcome:
- Replace `attendance_records` with `attendance`.
- Replace `fee_payments` with `payments` joined through `student_fees`.
- Use `payment_date`, `amount_paid`, and `receipt_number` where needed.
- Add error handling for each query instead of silently returning partial or empty data.

Acceptance criteria:
- Parent users see linked students, current attendance summary, performance, and recent payments.
- Query errors return useful API errors during development.
- Parent cannot access students not linked through `student_guardians`.

### 4. Broken Fee Predictor Payment Queries

Problem:
- Fee predictor queries `payments.paid_at` and `payments.student_id`.
- Main schema has `payments.payment_date` and `payments.student_fee_id`.

Known file:
- `features/fee-predictor/services/fee-predictor.service.ts`

Required outcome:
- Query `student_fees` for the target student, then fetch matching `payments` by `student_fee_id`.
- Use `payment_date` instead of `paid_at`.
- Calculate payment frequency, average amount, last payment date, and preferred method from valid rows.

Acceptance criteria:
- Fee predictor works for one student and for class/school batch analysis.
- It handles students with no fees or no payments gracefully.
- It does not silently skip all students due to query errors.

### 5. Broken Report Finance Data Queries

Problem:
- Report data service queries `receipt_no` and `paid_at`.
- Main schema uses `receipt_number` and `payment_date`.

Known file:
- `features/reports/services/reportData.service.ts`

Required outcome:
- Replace incorrect payment columns.
- Ensure payment-to-student filtering works through `student_fees`.
- Ensure fee statement/report card finance sections produce correct balances.

Acceptance criteria:
- Fee statement generation includes correct fee descriptions, due amounts, paid amounts, balances, receipt numbers, and payment dates.
- No Supabase error occurs from missing payment columns.

### 6. Student Subjects and Subjects APIs Are Likely Inconsistent

Problem:
- Student-subjects route selects `students(id, ..., admission_no)`, but core students use `student_id` and `admission_number`.
- Migration defines `student_subjects.student_id REFERENCES students(id)`, which conflicts with core schema.

Known files:
- `app/api/student-subjects/route.ts`
- `app/api/student-subjects/[id]/route.ts`
- `app/api/subjects/route.ts`
- `app/api/subjects/[id]/route.ts`
- `scripts/missing_module_tables_migration.sql`

Required outcome:
- Align these tables and APIs to canonical IDs.
- If `subjects` is a new table, decide whether it should use `subject_id` for consistency or keep `id` and document that exception.
- Fix all relation selects.

Acceptance criteria:
- `GET /api/student-subjects` lists mappings with student names, admission numbers, subject names, and teacher names.
- `POST /api/student-subjects` validates school ownership and creates a mapping.
- Duplicate mappings return a clear conflict response.

### 7. Placeholder Staff Components

Problem:
- Staff UI contains placeholder components that render empty divs.

Known files:
- `app/(dashboard)/staff/[id]/components/StaffLeavesList.tsx`
- `app/(dashboard)/staff/[id]/components/StaffAssignmentsList.tsx`
- `app/(dashboard)/staff/[id]/leaves/new/components/LeaveRequestForm.tsx`

Required outcome:
- Replace placeholders with working UI connected to existing staff leave and assignment APIs.
- Support loading, empty, success, error, and permission states.

Acceptance criteria:
- Staff detail page shows leave history and subject/class assignments.
- Leave request form submits valid leave requests and displays validation errors.
- The UI refreshes after create/update actions.

### 8. Placeholder Reports Filter Component

Problem:
- Reports filter component is a placeholder.

Known file:
- `app/(dashboard)/reports/ReportsFilters.tsx`

Required outcome:
- Implement real filters for class, term, academic year, report type/status, search, and published state where supported.
- Keep filters synchronized with URL query parameters if the reports page already expects them.

Acceptance criteria:
- Users can filter report lists without manual URL edits.
- Filters persist through refresh/shareable URL where practical.
- Export actions use the same filters as the visible list.

### 9. Mock AI Report Context

Problem:
- AI report generation uses empty mock CBC context.

Known file:
- `features/reports-ai/services/ai-report.service.ts`

Required outcome:
- Fetch real student, class, term, school, assessment, learning area, competency, and attendance data.
- Pass real context into AI prompt.
- Fail clearly when required data is missing.

Acceptance criteria:
- Generated AI report is based on actual database records.
- Student ID, term, academic year, and school ID are validated.
- No report is generated from empty context unless explicitly allowed for demo mode.

## Implementation Phases

### Phase 0: Baseline and Safety Checks

Tasks:
1. Run `git status --short` and note existing user changes.
2. Run `npx.cmd tsc --noEmit --incremental false`.
3. Run current relevant tests: `npm.cmd test -- --runInBand` if available and not too slow.
4. Save current failures in a short implementation log.

Deliverables:
- Baseline result summary.
- List of files that already had unrelated changes.

Acceptance criteria:
- The implementing AI knows which failures are pre-existing.

### Phase 1: Canonical Schema Decision

Tasks:
1. Compare `sql_creation_script.txt`, `scripts/schema_fix_migration.sql`, `scripts/missing_module_tables_migration.sql`, and live Supabase schema if credentials are available.
2. Create a short `SCHEMA_CANONICAL_MAP.md` or update this plan with:
   - Table name
   - Primary key
   - Important foreign keys
   - Known aliases to eliminate
3. Explicitly resolve these pairs:
   - `attendance` vs `attendance_records`
   - `payments` vs `fee_payments`
   - `receipt_number` vs `receipt_no`
   - `payment_date` vs `paid_at`
   - `admission_number` vs `admission_no`
   - `school_id` vs `id`
   - `student_id` vs `id`
   - `user_id` vs `id`
   - `learning_area_id` vs `id`

Deliverables:
- Canonical schema map.
- List of migration files needing correction.

Acceptance criteria:
- No implementation proceeds while the canonical table/column name is unknown.

### Phase 2: Database Types and Supabase Client Typing

Tasks:
1. Generate `types/database.types.ts` from Supabase if credentials are available:
   - `npm.cmd run db:generate-types`
   - If PowerShell cannot redirect correctly, use a safe command variant.
2. If live generation is unavailable, create a focused temporary type file for the tables being fixed, then replace with generated types later.
3. Update:
   - `lib/supabase/client.ts`
   - `lib/supabase/server.ts`
   - `lib/supabase/middleware.ts`
   - `lib/supabase/realtime.ts`
4. Replace `createServerClient<any>` and `createClient<any>` with typed clients.

Deliverables:
- Typed Supabase clients.
- Generated or focused DB type definitions.

Acceptance criteria:
- Type-check still passes.
- New schema mistakes in touched code are caught by TypeScript.

### Phase 3: Fix Schema-Drifted Migrations

Tasks:
1. Correct `scripts/missing_module_tables_migration.sql` foreign keys:
   - `schools(school_id)`
   - `students(student_id)`
   - `users(user_id)`
   - `learning_areas(learning_area_id)`
   - `staff(staff_id)`
   - `academic_years(academic_year_id)`
   - `terms(term_id)`
2. Decide new table primary keys:
   - Preferred: `subject_id`, `grading_scale_id`, `promotion_rule_id` for consistency.
   - Alternative: keep generic `id`, but document and ensure routes use that only for those new tables.
3. Fix `scripts/create_full_cbc_schema.sql` if it is still used.
4. Fix `scripts/sql/2026-04-24-ai-core-foundation.sql` references to schools if needed.
5. Add migration comments explaining compatibility.

Deliverables:
- Corrected migrations.
- Optional follow-up migration for already-created wrong tables if the live DB has them.

Acceptance criteria:
- Fresh database setup can run without FK errors.
- Existing live DB can be migrated without data loss.

### Phase 4: Fix Broken Parent-Facing Data Reads

Tasks:
1. Update `app/api/parent/dashboard/route.ts`.
2. Query attendance from `attendance`.
3. Query payments through:
   - `student_fees` filtered by `student_id`
   - `payments` filtered by matching `student_fee_id`
4. Return recent payments with:
   - amount
   - payment date
   - receipt number
   - payment method
5. Add query error checks.
6. Review `features/parent-chatbot/services/parent-chatbot.service.ts` for the same `attendance_records` issue.
7. Review `features/smart-search/services/smart-search.service.ts` references to non-canonical tables.

Deliverables:
- Working parent dashboard and parent chatbot data paths.

Acceptance criteria:
- Parent dashboard returns correct data for linked students.
- No references to `attendance_records` remain unless that table is intentionally added and documented.
- No references to `fee_payments` remain unless that table is intentionally added and documented.

### Phase 5: Fix Finance and Report Payment Queries

Tasks:
1. Update `features/fee-predictor/services/fee-predictor.service.ts`.
2. Update `features/reports/services/reportData.service.ts`.
3. Search for:
   - `paid_at`
   - `receipt_no`
   - `fee_payments`
   - `.eq('student_id'` directly on `payments`
4. Replace with canonical `payment_date`, `receipt_number`, and joins through `student_fees`.
5. Add or update tests for:
   - fee predictor no-payment case
   - fee predictor with payment history
   - fee statement/report finance rows

Deliverables:
- Correct finance data reads.
- Tests covering payment schema.

Acceptance criteria:
- Payment history loads correctly in reports and predictors.
- No missing-column Supabase errors from payment queries.

### Phase 6: Fix Subject and Student-Subject Workflows

Tasks:
1. Update subject and student-subject APIs to canonical schema.
2. Fix relation selects:
   - `students(student_id, first_name, last_name, admission_number)`
   - `staff(staff_id, first_name, last_name)` or join through user data if staff names are stored on users.
   - `learning_areas(learning_area_id, name)`
3. Validate school ownership using canonical keys.
4. Add tests for GET, POST, duplicate POST, and wrong-school access.
5. Update `AcademicsManager` if it expects old response shape.

Deliverables:
- Working subject CRUD.
- Working student-subject mapping CRUD.

Acceptance criteria:
- Academics UI can create and list subjects/mappings.
- All returned IDs match frontend expectations.

### Phase 7: Fix School, Grading Scale, and Promotion Rule APIs

Tasks:
1. Update school APIs to use `school_id` unless live schema confirms otherwise.
2. Remove unsupported fields from insert/update payloads or add migrations for them:
   - `code`
   - `website`
   - `mission`
   - `vision`
   - `established_year`
   - `status`
3. Use `is_active` if that is the canonical status field.
4. Update grading-scale and promotion-rule tables/routes to canonical school FK.
5. Add API tests.

Deliverables:
- Working school CRUD for valid schema fields.
- Working grading scale and promotion rule APIs.

Acceptance criteria:
- Settings pages do not fail due to missing school columns.
- Promotion/grading configuration can be created, listed, updated, and deactivated.

### Phase 8: Replace Staff Placeholders

Tasks:
1. Implement `StaffLeavesList`.
2. Implement `StaffAssignmentsList`.
3. Implement `LeaveRequestForm`.
4. Use existing endpoints:
   - `GET/POST /api/staff/[id]/leaves`
   - `GET/POST /api/staff/[id]/assignments`
   - `PATCH/DELETE` routes where available.
5. Add validation and user feedback.
6. Ensure permission checks hide or disable actions where appropriate.

Deliverables:
- Staff profile shows real leaves and assignments.
- Staff leave request page submits real data.

Acceptance criteria:
- No placeholder text remains in these components.
- Staff workflow works from the UI without manual API calls.

### Phase 9: Replace Reports Filter Placeholder

Tasks:
1. Inspect reports page expected query params.
2. Build filters for:
   - search
   - class
   - academic year
   - term
   - status
   - published/unpublished
   - report type if supported
3. Keep filters reflected in URL.
4. Ensure CSV/PDF/export endpoints consume the same filters.

Deliverables:
- Functional report filtering UI.

Acceptance criteria:
- Reports page filtering works with real data.
- Exported data matches active filters.

### Phase 10: Replace Mock AI Report Context

Tasks:
1. Implement real `buildCBCContext`.
2. Fetch:
   - student identity
   - class
   - school
   - active or selected term
   - learning areas
   - competencies
   - assessments
   - attendance summary
   - teacher remarks where available
3. Validate all requested IDs belong to the same school.
4. Add fallback only for optional data, not core identity/performance data.
5. Add tests with mocked Supabase responses.

Deliverables:
- AI report generation grounded in real database data.

Acceptance criteria:
- No mock CBC context remains.
- AI report generation fails clearly if required records are missing.

### Phase 11: Add Regression Tooling

Tasks:
1. Add a schema scan script that searches code for `.from('table')`, relation selects, and suspicious columns.
2. Compare against `types/database.types.ts` or a JSON schema map.
3. Fail CI or print high-signal warnings for unknown tables/columns.
4. Add test fixtures for key tables.
5. Consider adding Playwright later for end-to-end flows.

Deliverables:
- `npm` script for schema drift checking.
- CI-friendly output.

Acceptance criteria:
- New references to wrong tables like `attendance_records` are caught.
- New references to wrong columns like `paid_at` are caught.

## Recommended Feature Improvements After Fixes

These should come after correctness work, not before.

### Finance

- Payment reversal and reallocation workflow.
- Better M-Pesa reconciliation with automatic matching.
- Receipt reprint audit log.
- Overpayment and credit balance handling.
- Finance exception export.

### Parent Portal

- Full fee statement download.
- Report card download.
- Attendance alerts.
- Consent management.
- Parent-to-school messaging.

### Staff

- Leave approval workflow.
- Staff workload dashboard.
- Assignment history by term.
- Substitute teacher coverage.

### Reports

- Stored generated PDFs.
- Report approval workflow before publishing.
- Batch generation queue status UI.
- Report correction/version history.

### Academics

- Subject enrollment bulk assignment.
- Curriculum coverage tracker.
- Teacher workload by learning area/class.
- Promotion-rule simulation before applying promotions.

### Admin and Data Quality

- Duplicate student detection.
- Orphaned guardian/user/student record audit.
- Missing active term/year checks.
- School setup wizard.
- Data import validation reports.

### Reliability

- Error monitoring.
- Slow query logging.
- Background job dashboard.
- E2E tests for student, attendance, finance, reports, and parent portal.

## Suggested Work Order

1. Baseline checks.
2. Canonical schema map.
3. Supabase database types.
4. Migration corrections.
5. Parent dashboard and parent chatbot.
6. Fee predictor and report finance queries.
7. Subject/student-subject APIs.
8. School/grading/promotion APIs.
9. Staff placeholders.
10. Reports filters.
11. AI report real context.
12. Regression tooling.
13. Feature improvements.

## Verification Checklist

Run after each phase:

- `npx.cmd tsc --noEmit --incremental false`
- Relevant Jest tests.
- Manual API smoke tests for touched endpoints.
- Search for known bad identifiers:
  - `attendance_records`
  - `fee_payments`
  - `paid_at`
  - `receipt_no`
  - `admission_no`
  - `students(id`
  - `schools(id`
  - `users(id`

Run before final handoff:

- Full type check.
- Full unit test suite.
- Build if time allows: `npm.cmd run build`.
- Manual browser smoke test for:
  - parent dashboard
  - student creation/listing
  - attendance save/load
  - payment creation/listing
  - report generation/filtering
  - staff leave request
  - academics subject mapping

## Final Handoff Requirements

The implementing AI must report:

1. Files changed.
2. Schema decisions made.
3. Migrations added or changed.
4. Tests added or updated.
5. Commands run and results.
6. Any live Supabase migration steps required.
7. Remaining risks or deferred items.

