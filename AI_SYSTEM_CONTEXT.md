# AI System Context - CBC School Management System

## 1. Purpose and Scope

This repository implements a multi-tenant school management platform for Kenyan CBC workflows.

Primary capabilities:
- Authentication and role-based access control (RBAC)
- Student and staff management
- CBC academics hierarchy and assessment capture
- Attendance and discipline
- Fee setup, billing, and payment tracking (including M-Pesa C2B reconciliation)
- Timetable planning with conflict checks
- Reports and report cards (including PDF/print/export flows)
- Messaging, notifications, and announcements
- School settings (academic years, terms, classes, profile/config)

The app is production-oriented but currently contains coexistence of newer and legacy implementations in several modules.

## 2. Technology Stack

- Frontend/runtime: Next.js 14 App Router, React 18, TypeScript
- Styling: Tailwind CSS
- Data/auth/storage: Supabase (Postgres, Auth, Storage)
- Validation: Zod
- Data fetching: SWR (client)
- PDF: `@react-pdf/renderer` + HTML-based report rendering helpers
- Tests: Jest (unit/service/api slices)

Key package entry point: `package.json`.

## 3. High-Level Architecture

Request flow:
1. Browser hits page route or API route in `app/`.
2. Middleware (`middleware.ts`) enforces authentication redirects.
3. API routes in `app/api/**` call guards (`withAuth`, `withPermission`, `withRoles`).
4. Route handlers call feature services in `features/**/services`.
5. Services use Supabase clients from `lib/supabase/*`.
6. Responses return normalized JSON helpers from `lib/api/response.ts`.

Core layers:
- `app/`: route handlers and UI pages
- `features/`: domain logic (services, types, validators)
- `lib/`: cross-cutting auth/api/supabase/navigation/rate-limit/jobs/mpesa helpers
- `services/`: shared auth/audit services
- `types/`: central TS contracts (roles/auth/database)

## 4. Runtime Layout and Providers

Root layout (`app/layout.tsx`):
- Wraps all routes in `SWRProvider`, `AuthProvider`, and `ToastProvider`.

Dashboard layout (`app/(dashboard)/layout.tsx` + `components/layout/DashboardLayout.tsx`):
- Protected shell with sidebar/header.
- Client-side redirect to `/login` if auth context has no user.
- Sidebar visibility is module-filtered by role permissions.

## 5. Authentication and Authorization

### 5.1 Authentication

- Supabase Auth is the identity source.
- User profile is loaded from `users` table with joined `roles`.
- Main auth service: `services/auth.service.ts`.
- Server-side current user helpers: `services/auth.server.service.ts`, `lib/auth/session.ts`.

### 5.2 Authorization

- Permission matrix: `types/roles.ts`.
- Permission checks: `lib/auth/permissions.ts`.
- API auth/permission wrapper: `lib/api/withAuth.ts`.
- API identity resolution: `lib/auth/api-guard.ts`.

Important detail:
- `withAuth`/`withPermission` support mixed legacy handler signatures by injecting a hybrid context object. This is intentional compatibility logic.

### 5.3 Middleware Behavior

`middleware.ts` currently enforces:
- redirect unauthenticated users from protected routes to `/login`
- redirect authenticated users away from `/login` to `/dashboard`

It does not perform full module-level RBAC; RBAC is primarily applied in API and UI visibility logic.

## 6. Multi-Tenancy Model

Tenant boundary is `school_id`.

General rule:
- Non-`super_admin` actions must be scoped to the user's `school_id`.
- Most services enforce scope explicitly; RLS is also expected to enforce it at DB level.

Common pattern:
- API/user identity includes both camel and snake aliases (for compatibility), for example `schoolId` and `school_id`.

## 7. Data Model Overview

Primary schema source files:
- `sql_creation_script.txt`
- `scripts/*.sql` migrations

Core table families:
- Identity: `users`, `roles`, `user_profiles`
- School calendar/config: `schools`, `academic_years`, `terms`, `school_settings`, `class_levels`, `classes`, `grades`
- Academics: `learning_areas`, `strands`, `sub_strands`, `competencies`, `teacher_subjects`, `subjects`, `student_subjects`
- Learners: `students`, `student_classes`, `student_guardians`, `guardians`, `student_parents`
- Assessment/reporting: `assessments`, `assessment_aggregates`, `report_cards`, `performance_levels`
- Operations: `attendance`, `disciplinary_records`, `timetable_slots`, `bell_times`
- Finance: `fee_structures`, `student_fees`, `payments`
- Communication/compliance: `messages`, `message_recipients`, `notifications`, `announcements`, `parent_consents`
- Audit/background/integrations: `audit_logs`, `jobs`, `mpesa_c2b_transactions`, `term_locks`, `staff_status_history`, `special_needs`

## 8. Important Schema and Type Caveats

1. Naming convention drift exists:
- Older schema patterns use `*_id` (for example `student_id`, `academic_year_id`).
- Some migrations/modules introduce generic `id` columns.
- Code often supports both via normalization.

2. Generated DB types drift:
- `types/database.types.ts` does not include some newer tables (for example `term_locks`, `jobs`, `mpesa_c2b_transactions`, `special_needs`, `bell_times`, `staff_status_history`).

3. Documentation drift:
- Some older docs describe structures that are no longer exact current code.
- Code should be treated as source of truth when docs conflict.

## 9. API Surface Map

`app/api` is broad and modular, with major namespaces including:
- `students`, `staff`, `users`, `roles`, `permissions`
- `academics` plus hierarchy endpoints (`learning-areas`, `strands`, `sub-strands`, `competencies`)
- `assessments`, `attendance`, `discipline`, `timetable`, `exams`
- `finance`, `fees`, `fee-structures`, `student-fees`, `payments`, `mpesa`
- `reports`
- `communication`, `messages`, `notifications`, `announcements`
- `settings`, `schools`, `terms`, `academic-years`
- `special-needs`, `audit-logs`, `parent-consents`, `upload`

Notable compatibility/deprecation routes:
- `/api/messages` is marked deprecated in favor of `/api/communication/messages` with sunset `2026-07-01`.
- `/api/academic-years` redirects to `/api/settings/academic-years`.
- `/api/terms` redirects to `/api/settings/terms`.
- Several `/api/communication/notifications/*` endpoints redirect to `/api/notifications/*`.

## 10. Feature Modules and Behavior

### 10.1 Students (`features/students`, `app/api/students/**`)

Key behavior:
- Student CRUD with strong validation and school scoping
- Guardian linking via `student_guardians`
- Parent user bootstrap for guardian emails (creates auth user + `users` row when needed)
- Class history tracking (`student_classes`)
- Optional automatic mandatory fee assignment via finance helpers on creation/class assignment
- Support for list/search/filter/pagination and bulk import/export/lifecycle endpoints

### 10.2 Staff and Users (`features/staff`, `features/users`)

Key behavior:
- Staff CRUD, assignments, leave tracking, status history, reactivation, password reset
- User management with role hierarchy checks (`canManageRole`)
- Soft-deactivation and hard-delete safety paths
- Server-side role escalation prevention

### 10.3 Academics / CBC Structure (`features/academics`)

Key behavior:
- CBC hierarchy management:
  `learning_areas -> strands -> sub_strands -> competencies`
- Teacher subject assignments and student subject mappings
- Scheme import endpoints (`/api/academics/scheme-import`, `/api/academics/scheme-import-ai`)
- AI import path depends on external LLM key (`GROQ_API_KEY`) in current implementation

### 10.4 Assessments (`features/assessments`, `app/api/assessments/**`)

Key behavior:
- Assessment CRUD, bulk entry, student/strand/area/year result slices
- Context resolution for academic year + term + class + competency constraints
- Performance/analytics aggregation logic feeding report card generation

Important caveat:
- `term-lock` endpoints exist (`/api/assessments/term-lock`), but assessment write paths are not consistently enforcing lock state in service methods.

### 10.5 Attendance (`features/attendance`, `app/api/attendance/**`)

Key behavior:
- Daily attendance capture (single and bulk)
- Class/day roster attendance views
- Student/class/school summaries and analytics
- Import/export endpoints
- Context helpers resolve active term/year fallback behavior

### 10.6 Discipline (`app/api/discipline/**`)

Key behavior:
- Disciplinary record CRUD and analytics
- Student-level and summary endpoints
- Visibility scoping by role and school

### 10.7 Finance (`features/finance`, `app/api/finance|fees|student-fees|payments/**`)

Key behavior:
- Fee structures and student fee assignment
- Payment recording with duplicate transaction checks and overpayment prevention
- Recalculation of fee balance/status after payment adjustments/refunds
- Waiver flows with approval constraints and audit logging
- Finance summaries, balances, exports, exception views

### 10.8 M-Pesa Integration (`app/api/mpesa/**`, `lib/mpesa/*`)

Key behavior:
- C2B validation/confirmation/register endpoints
- Transaction persistence in `mpesa_c2b_transactions`
- Auto reconciliation attempts:
  - match by `student_fees.id`/invoice
  - fallback to student admission number
  - enforce no-overpay
- Manual reconcile endpoint creates a payment and marks transaction reconciled

Env requirements are documented in `.env.example`.

### 10.9 Reports (`app/api/reports/**`, `features/reports`, `features/assessments/reportCards`)

This area has two coexisting stacks:

Stack A (newer report-card-oriented path):
- `app/api/reports/report-cards/**`
- backed by `features/assessments/services/reportCards.service.ts`
- supports generate/list/publish/unpublish/report retrieval with school/role filters

Stack B (legacy/general reports path):
- endpoints like `/api/reports/generate`, `/api/reports/list`, `/api/reports/term-report`, `/api/reports/print/[studentId]`, `/api/reports/[id]/pdf`
- backed by `features/reports/services/*`
- includes request/orchestration code referencing `report_requests`

Important caveats:
- `features/reports/services/reports.service.ts` uses browser client alias (`createClient` from `lib/supabase/client.ts`) which is not ideal for server API execution.
- `report_requests` usage exists in service code but is not part of the primary base schema script, so this path may require additional DB setup or refactor.

### 10.10 Communication (`features/communication`, `app/api/communication|messages|notifications|announcements`)

Key behavior:
- Inbox/sent messaging, mark-read flows, recipients resolution
- Notifications and unread counters
- Announcements and broadcast APIs

Important caveat:
- Route duplication remains (canonical and legacy aliases/redirects), so clients should prefer canonical namespaces.

### 10.11 Timetable (`features/timetable`, `app/api/timetable/**`)

Key behavior:
- Slot CRUD and filtered retrieval
- Teacher/class/room conflict detection
- Validation against `teacher_subjects` assignment before slot creation/update
- Term copy and deactivation flows
- Bell times endpoints and related migrations

### 10.12 Settings (`features/settings`, `app/api/settings/**`)

Key behavior:
- School profile/config/logo
- Academic year CRUD and activation
- Term CRUD and activation
- Class levels/sections and teacher assignment support
- Reference-data and current-context endpoints for UI initialization

### 10.13 Exams (`app/api/exams/**`, dashboard exams page)

Key behavior:
- Exam bank and exam sets CRUD
- Schedule/calendar routes
- Teacher ownership checks in editing patterns

### 10.14 Special Needs (`features/special-needs`, `app/api/special-needs/**`)

Key behavior:
- CRUD and export for `special_needs` records
- Links to student and class context
- Permission module key: `special_needs`

## 11. Background Jobs and Async Work

`lib/jobs/queue.ts` provides:
- in-memory job store
- optional persistence to `jobs` table if present
- limited concurrency processing
- placeholder handlers for some job types

Operational implication:
- Current queue is not a distributed, durable worker system.
- Suitable for light/single-instance workloads, not high-scale guaranteed processing.

## 12. Rate Limiting Model

`lib/api/rateLimit.ts` uses in-memory maps:
- request-based limits (`checkRateLimit`)
- key-based legacy limits (`rateLimit`)

Implication:
- Limits reset on process restart and are not shared across instances.
- Replace with Redis or equivalent for horizontally scaled production reliability.

## 13. File Upload and Storage

`/api/upload` + `lib/supabase/storage.ts`:
- validates mime/size by category
- ensures bucket exists (`SUPABASE_STORAGE_BUCKET`, default `school-assets`)
- uploads with admin client
- returns both public URL and signed URL metadata

## 14. Testing and Quality Signals

Current Jest tests cover selected slices:
- `__tests__/lib`: validation and rate-limit behavior
- `__tests__/api`: assessments API slice
- `__tests__/services`: assessments, staff, timetable services

Coverage is useful but not full end-to-end for all critical production flows.

## 15. Operational and Maintenance Risks

1. Legacy/new coexistence:
- Multiple route/service generations increase regression risk.

2. Schema/type drift:
- DB migrations and TS database typings are not fully synchronized.

3. Naming inconsistency:
- Camel vs snake and `id` vs `*_id` mixed across modules.

4. Async infrastructure:
- Queue and rate limits are process-local, not distributed.

5. Report stack fragmentation:
- Two report implementations with partially different assumptions.

6. Term-lock enforcement gap:
- Lock state is manageable but not consistently enforced in assessment write operations.

## 16. Canonical "Read Order" for AI Agents

When implementing or debugging, use this order:
1. Relevant API route in `app/api/.../route.ts`
2. Called service function in `features/<module>/services/*.ts`
3. Shared guards/helpers in `lib/api/*` and `lib/auth/*`
4. Related types/validators in `features/<module>/types.ts` and `validators/*.ts`
5. Schema/migration references in `sql_creation_script.txt` and `scripts/*.sql`

If docs conflict with code:
- trust current route + service + schema scripts first.

## 17. Practical Rules for Future AI Changes

1. Preserve tenant scope:
- never remove school scoping for non-super-admin flows.

2. Respect compatibility:
- many endpoints intentionally support both snake_case and camelCase payload fields.

3. Prefer canonical endpoints:
- avoid adding new logic to deprecated aliases unless required for backward compatibility.

4. Validate schema assumptions:
- check table/column existence in migration scripts before deep refactors.

5. Keep auth wrappers:
- use `withPermission`/`withAuth`; do not bypass guard layer in new APIs.

6. Audit sensitive finance/report actions:
- keep existing duplicate/overpay/approval/audit protections when changing finance code.

## 18. Quick Reference Paths

- Auth and RBAC:
  - `types/roles.ts`
  - `lib/auth/permissions.ts`
  - `lib/auth/api-guard.ts`
  - `lib/api/withAuth.ts`
- Supabase clients:
  - `lib/supabase/server.ts`
  - `lib/supabase/client.ts`
  - `lib/supabase/storage.ts`
- Navigation and module visibility:
  - `lib/navigation/navConfig.ts`
  - `components/layout/Sidebar.tsx`
- Core domain services:
  - `features/students/services/students.service.ts`
  - `features/finance/services/*.ts`
  - `features/attendance/services/attendance.service.ts`
  - `features/assessments/services/*.ts`
  - `features/timetable/services/timetable.service.ts`
  - `features/communication/services/*.ts`
  - `features/settings/services/*.ts`
- Reports:
  - `features/assessments/services/reportCards.service.ts`
  - `features/reports/services/*.ts`
  - `app/api/reports/**`
- Integrations and async:
  - `lib/mpesa/*`
  - `app/api/mpesa/**`
  - `lib/jobs/queue.ts`

---

This document is intended as the AI-facing operational map of the current system state, including both canonical architecture and known coexistence/drift points that affect implementation decisions.

