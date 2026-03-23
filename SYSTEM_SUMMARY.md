# CBC School Management System — System Summary (Concise + Complete)

This document is a single source of truth for how the system works, how it is designed, and what is still missing. It is ordered in lifecycle sequence (setup → users → learning → operations → reporting).

## 1. Purpose and Scope
- Multi‑tenant, production‑ready Kenyan CBC (Competency‑Based Curriculum) school management system.
- Target: primary school + private academy, 300–1000 students initially.
- Core modules: users/roles, students, staff, academics, assessments, attendance/discipline, exams, finance, reports, communication, timetable, settings, compliance/audit.
- Strict RBAC enforced by Supabase RLS plus API guards and UI filtering.

## 2. Tech Stack and Runtime Architecture
- Frontend: Next.js 14.1 (App Router), React 18, TypeScript 5.3.
- Styling: Tailwind CSS + shared UI components.
- Backend: Supabase (Postgres + Auth + RLS) via Next.js API routes and services.
- Storage: Supabase Storage for uploads (reports, exams).
- Hosting: Vercel (frontend), Supabase (backend).

**Key runtime layers**
- `app/` routes and server components (App Router).
- `app/api/*` API routes with auth guards and response helpers.
- `features/*/services/*` for business logic.
- `lib/auth/*` and `lib/api/*` for RBAC and API protection.
- `lib/navigation/navConfig.ts` for module visibility and routing.

## 3. Data Model and Tenancy Rules
- Highly normalized schema in `sql_creation_script.txt`.
- `school_id` is mandatory for all tenant tables (except `super_admin` users).
- Constraints enforced via FK, unique indexes, and CHECKs.
- Audit fields and triggers on critical tables.

**CBC hierarchy**
`learning_areas → strands → sub_strands → competencies → assessments`

**Multi‑tenant rule**
- Every query must filter by `school_id` unless role is `super_admin`.

## 4. Authentication and RBAC
- Supabase email/password auth linked to `users` table.
- Roles defined in `types/roles.ts` with permission matrix.
- Middleware enforces module access; API routes enforce role and permission checks.
- UI hides unauthorized tabs and pages.

**Security constraints**
- RLS is the primary enforcement layer.
- Admin client uses `SUPABASE_SERVICE_ROLE_KEY` server‑side only.
- Role escalation is blocked by `ROLE_HIERARCHY`.

## 5. Request and Response Flows (Concise)
1. **Authenticated read**: Client → `app/api/*` → server Supabase client (RLS) → JSON response.
2. **Admin create/update**: Client → `app/api/admin/*` → admin Supabase client → DB write → JSON response.
3. **File upload**: Client → API route → Supabase Storage → DB metadata insert → JSON response.
4. **Report generation**: Client → API route → data aggregation → PDF render → Storage upload → `report_cards` insert → JSON response.

## 6. Module Summary (Chronological, Concise)

### 6.1 Users and Roles
Design: Central role system with hierarchy and permission matrix.  
Data: `roles`, `users`, `permissions`, `audit_logs`/`audit_trail`.  
UI: Admin user list, role assignment, role filters.  
Verified API: `/api/admin/users`, `/api/users`, `/api/users/:id`, `/api/users/:id/hard-delete`, `/api/roles`.  
Status: Implemented core RBAC and user creation via admin route.  
Missing endpoints: Role CRUD beyond list, permission management, audit UI for role changes.

### 6.2 Students
Design: Students are core entities for learning, attendance, and fees.  
Data: `students`, `student_classes`, `student_parents`, `users`, `user_profiles`.  
UI: Student list, profile tabs, import workflow.  
Verified API: `/api/students`, `/api/students/:id`, `/api/students/import`, `/api/students/stats`, `/api/students/:id/fees`.  
Status: Core API and import exist; UI coverage may be partial.  
Missing endpoints: Parent/guardian mapping endpoints, student promotions if not implemented.

### 6.3 Staff
Design: Staff tied to users with role‑scoped visibility.  
Data: `staff`, `users`, `user_profiles`, `teacher_subjects`.  
UI: Staff list, detail page, create/edit forms.  
Verified API: `/api/staff`, `/api/staff/:id`, `/api/staff/:id/reset-password`, `/api/staff/:id/assignments`, `/api/staff/:id/leaves`.  
Status: API coverage present; UI may still be partial.  
Missing endpoints: Staff analytics and departmental structures if not implemented.

### 6.4 Academics (Curriculum)
Design: CBC hierarchy as the source of truth for assessment and reporting.  
Data: `subjects`, `learning_areas`, `strands`, `sub_strands`, `competencies`, mappings.  
UI: Hierarchy management, subject assignment to teachers and students.  
Verified API: `/api/learning-areas`, `/api/learning-areas/:id/hierarchy`.  
Status: Partial API present for hierarchy view.  
Missing endpoints: Subjects CRUD, strands/sub‑strands/competencies CRUD, teacher/student subject mappings.

### 6.5 Assessments
Design: CBC competency assessments with centralized performance mapping.  
Data: `assessments`, `assessment_templates`, aggregates, `report_cards`.  
UI: Teacher entry forms, class dashboards, student analytics.  
Verified API: `/api/assessments`, `/api/assessments/:id`, `/api/assessments/bulk`, `/api/analytics/school`, `/api/analytics/class/:id`, `/api/analytics/student/:id/trends`.  
Status: Core assessment CRUD and analytics endpoints present.  
Missing endpoints: Assessment templates CRUD, strand/area/year aggregate endpoints if required.

### 6.6 Attendance and Discipline
Design: Daily attendance + incident tracking with analytics summaries.  
Data: `attendance`, `disciplinary_records`, `special_needs`, analytics tables.  
UI: Attendance grid, incident log, analytics dashboards.  
Verified API: `/api/attendance/import`, `/api/attendance/school`, `/api/attendance/summary/class/:classId`, `/api/attendance/summary/student/:studentId`, `/api/discipline`, `/api/discipline/:id`, `/api/discipline/summary`, `/api/discipline/student/:studentId`.  
Status: Discipline endpoints present; attendance summary endpoints present.  
Missing endpoints: Base attendance CRUD (`/api/attendance`) and special needs endpoints if not implemented.

### 6.7 Exam Bank
Design: Reusable exam repository with scheduling.  
Data: `exam_bank`, `exam_sets`.  
UI: Create/Upload → Exam Bank → Set Exams flow with filters and preview.  
API: `/api/exams`, `/api/exams/sets`.  
Status: Implemented.  
Missing endpoints: None identified.

### 6.8 Finance
Design: Fee structures and payment tracking with role scoping.  
Data: `fee_structures`, `student_fees`, `payments`.  
UI: Fee setup, student ledger, payment records, finance dashboard.  
Verified API: `/api/fee-structures`, `/api/fees`, `/api/student-fees`, `/api/payments`, `/api/finance/stats`, `/api/finance/balances`, `/api/finance/recent-payments`.  
Status: Finance APIs are present; UI may be partial.  
Missing endpoints: None obvious, confirm if fee structure updates and student fee assignment are covered in handlers.

### 6.9 Reports and PDF Generation
Design: Aggregated term/year reporting with PDF storage.  
Data: `report_cards`, `analytics`, `report_templates`.  
UI: Report list, PDF preview, export actions.  
Verified API: `/api/reports/report-cards`, `/api/reports/report-cards/:id`, `/api/reports/report-cards/generate-class`, `/api/reports/report-cards/publish`, `/api/reports/generate`, `/api/reports/list`, `/api/reports/term-report`, `/api/reports/class-reports`, `/api/reports/class-list`, `/api/reports/attendance-report`, `/api/reports/fee-statement`, `/api/reports/batch-report-cards`, `/api/reports/print/:studentId`, `/api/reports/:id/pdf`.  
Status: Reports APIs are extensive; PDF pipeline still needs production hardening.  
Missing endpoints: None obvious.

### 6.10 Communication
Design: Messaging, notifications, and broadcast announcements.  
Data: `messages`, `notifications`, `broadcast_messages`.  
UI: Inbox/Sent tabs, unread indicators, compose modal.  
Verified API: `/api/messages`, `/api/messages/:id`, `/api/messages/sent`, `/api/messages/read-all`, `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/read-all`, `/api/notifications/unread-count`, `/api/communication/messages`, `/api/communication/notifications`, `/api/communication/announcements`, `/api/communication/broadcast`, `/api/announcements`.  
Status: APIs present; there is overlap between `/api/messages` and `/api/communication/*`.  
Missing endpoints: Consolidation of duplicate routes or deprecation plan.

### 6.11 Timetable
Design: Class schedules with conflict checks for teachers.  
Data: `timetable` or `schedule_slots`, linked to classes and teachers.  
UI: Class timetable grid and teacher view.  
API: `/api/timetable`.  
Status: API routes exist; UI may be partial.  
Missing endpoints: Conflict validation or export endpoints if not implemented.

### 6.12 Settings and Configuration
Design: Academic years, terms, grading scales, promotion rules.  
Data: `schools`, `academic_years`, `terms`, `grading_scales`, `promotion_rules`, `system_settings`.  
UI: Configuration pages with admin access.  
Verified API: `/api/settings/academic-years`, `/api/settings/academic-years/:id`, `/api/settings/academic-years/:id/activate`, `/api/settings/terms`, `/api/settings/terms/:id`, `/api/settings/terms/:id/activate`, `/api/settings/classes`, `/api/settings/classes/:id`, `/api/settings/classes/levels`, `/api/settings/classes/sections`, `/api/settings/classes/sections/:id`, `/api/settings/school`, `/api/settings/logo`, `/api/settings/config`, `/api/settings/current-context`, `/api/settings/initialize`, plus `/api/academic-years` and `/api/terms`.  
Status: Settings APIs are rich; duplicate endpoints exist in `/api/terms` and `/api/academic-years`.  
Missing endpoints: Grading scales and promotion rules if not implemented.

### 6.13 Compliance and Audit
Design: Enforce audit trails and regulatory compliance.  
Data: `audit_logs`/`audit_trail`, consent tables.  
UI: Audit logs viewer.  
Verified API: `/api/audit-logs`, `/api/parent-consents`.  
Status: API coverage present; UI may be partial.  
Missing endpoints: Audit log viewer UI and consent admin workflows if not implemented.

## 7. Implementation Status Summary (High‑Level)
- Implemented: RBAC core, users/admin creation, exam bank, reports API surface.
- Partially implemented: students UI, staff UI, academics CRUD, assessments aggregates, attendance CRUD, communication consolidation, settings grading scales, compliance UI.
- Verified on 2026-03-17: API routes scanned in `app/api/*` and reflected above.

## 8. Known Gaps and Risks
- Report generation pipeline needs production hardening and async jobs.
- RLS coverage audit across all sensitive tables.
- Limited E2E test coverage.
- No global request throttling or rate limiting.

## 9. Recommended Improvements (High‑Value)
1. RLS audit per table with tenant isolation checks.
2. Add background jobs for reports, analytics, notifications.
3. Signed URLs and strict storage policies for uploads.
4. Add Playwright tests for critical flows.
5. Add caching for reference data (roles, classes, subjects).
6. Add observability (latency, error monitoring).

## 10. Quick Pointers (File Map)
- Auth + RBAC: `lib/auth/*`, `types/roles.ts`, `middleware.ts`.
- Supabase client: `lib/supabase/*`.
- UI system: `components/ui/*`.
- Navigation: `lib/navigation/navConfig.ts`.
- Exam module: `app/(dashboard)/exams/page.tsx`, `app/api/exams/*`.
- Schema: `sql_creation_script.txt`.
- Performance script: `scripts/performance-check.js`.
