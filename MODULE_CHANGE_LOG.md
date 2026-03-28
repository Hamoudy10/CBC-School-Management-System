# Module Change Log

This file is the running reference for module-by-module review and implementation work. It is intended for any future AI or developer session to quickly understand:
- what has already been reviewed
- what was implemented
- what remains open
- what should be done next

Update this file after every module pass.

## Workflow Standard

For each module, follow this order:
1. Review current user interactions and implemented functionality.
2. Identify gaps, broken contracts, missing routes, and UI/API mismatches.
3. Recommend improvements in priority order.
4. Implement approved fixes.
5. Run targeted lint/tests where practical.
6. Record what changed, what remains, and the next recommended actions.

## Global Work Already Completed

### Performance and Routing
- Added shared auth provider to remove repeated client-side auth fetches.
- Moved dashboard auth gating to server layout.
- Reduced middleware overhead by excluding API routes from dashboard-page middleware handling.
- Memoized repeated server user resolution.
- Added shared reference-data endpoint and hook for reusable settings/class/year/term data.
- Reused shared reference data in students, attendance, assessments, exams, and related pages.

### Access Control
- Sidebar/module visibility is role-filtered.
- Modular access enforcement is applied so users only see relevant tabs/pages.
- Unauthorized tabs are hidden instead of showing access-denied pages where applicable.

## Module Status Overview

| Module | Review Status | Implementation Status | Notes |
|---|---|---|---|
| Finance | Reviewed | Major fixes implemented | Core workflows now connected |
| Students | Reviewed | Major fixes implemented | Detail/edit/export/subroutes fixed |
| Staff | Reviewed | Major fixes implemented | Permission mismatch and broken routes fixed |
| Academics | Reviewed | Major fixes implemented | Curriculum CRUD and management UI added |
| Assessments | Reviewed | Major fixes implemented | Entry workflow and service layer restored |
| Attendance | Reviewed | Major fixes implemented | CRUD and summary routes restored |
| Exams | Reviewed | Major fixes implemented | Bank and schedule management aligned |
| Reports | Reviewed | Major fixes implemented | Listing, generation, and detail flow corrected |
| Communication | Reviewed | Major fixes implemented | Live dashboard routes aligned with schema |
| Timetable | Reviewed | Major fixes implemented | Dashboard/API/service contract restored |
| Settings | Reviewed | Major fixes implemented | Server-side settings, config, and class status flows aligned |
| Compliance/Audit | Reviewed | Major fixes implemented | Discipline workflows and compliance landing restored |

---

## 1. Finance Module

### Review Summary
Finance was reviewed first because it is a core operational module tied to fees, payments, balances, and M-Pesa reconciliation.

### Initial Findings
- Dashboard linked to missing routes.
- Fee structure update/delete route was missing.
- Bulk fee assignment route was missing.
- Export route was missing.
- Payment create flow had frontend/backend contract mismatches.
- Fee structure create flow had missing academic year handling.
- Payment history and fee assignment viewer pages were missing.

### Implemented Changes

#### Backend
- Added `app/api/fees/[id]/route.ts`
- Reworked `app/api/fees/route.ts`
  - normalized fee structure response
  - added collection/assignment stats
  - defaulted `academicYearId` to active year when omitted
- Reworked `app/api/payments/route.ts`
  - accepts camelCase and snake_case payloads
  - returns `receiptNumber`
- Reworked `app/api/student-fees/route.ts`
  - normalized student fee response
  - added `feeStructureId` and `hasBalance` support
- Added `app/api/student-fees/bulk-assign/route.ts`
- Added `app/api/finance/export/route.ts`
- Updated `app/api/finance/recent-payments/route.ts`

#### Frontend
- Added `app/(dashboard)/finance/payments/page.tsx`
- Added `app/(dashboard)/finance/fee-structures/[id]/assignments/page.tsx`
- Updated `app/(dashboard)/finance/page.tsx`
  - export filename handling
  - correct student linking from recent payments
  - corrected collected amount usage

### Validation
- Targeted finance lint passed.

### Remaining Gaps
- Waivers/refunds/approval workflow not implemented.
- Finance audit trail UX can be improved.
- Parent/student finance UI is still limited compared to API support.
- M-Pesa automation can be hardened further.

### Next Recommended Finance Work
1. Add waivers/refunds/approval flow.
2. Add student ledger and receipt reprint flow.
3. Improve M-Pesa reconciliation intelligence and history.

---

## 2. Students Module

### Review Summary
Students was reviewed second because many other modules depend on it: finance, attendance, assessments, reports, and parent visibility.

### Initial Findings
- Student detail page called missing subroutes.
- Student edit page was referenced but missing.
- Student export route was missing.
- Create form and create API had payload/response mismatches.
- Detail API and detail page expected different shapes.
- Status handling was inconsistent (`inactive` vs `withdrawn`).
- Bulk actions were placeholder-only.
- Guardian create existed, but guardian management was incomplete from the UI.

### Implemented Changes

#### Shared Utilities
- Added `app/api/students/_utils.ts`
  - shared auth/context helpers
  - student normalization helpers
  - academic context resolution helpers
  - shared response helpers

#### Backend
- Updated `app/api/students/route.ts`
  - accepts camelCase and snake_case create payloads
  - supports multiple guardians from the create form
  - auto-generates admission number when missing
  - normalizes create response for the UI
  - writes student class history when active term/year exists
- Rebuilt `app/api/students/[id]/route.ts`
  - normalized student detail payload
  - normalized update handling
  - fixed status handling
  - supports soft delete via withdrawal
- Added missing detail subroutes:
  - `app/api/students/[id]/attendance-summary/route.ts`
  - `app/api/students/[id]/attendance/route.ts`
  - `app/api/students/[id]/class-history/route.ts`
  - `app/api/students/[id]/fee-summary/route.ts`
  - `app/api/students/[id]/payments/route.ts`
  - `app/api/students/[id]/performance-summary/route.ts`
  - `app/api/students/[id]/discipline/route.ts`
- Added `app/api/students/export/route.ts`

#### Frontend
- Added `app/(dashboard)/students/[id]/edit/page.tsx`
- Updated `app/(dashboard)/students/[id]/page.tsx`
  - now consumes normalized detail payload
  - fetches related data from newly added working routes
  - parallelized related fetches
- Updated `app/(dashboard)/students/page.tsx`
  - corrected withdraw/delete success messaging
  - fixed class option typing issue

### Validation
- Targeted student lint passed.
- Student module TypeScript issues introduced by this work were cleared.

### Remaining Gaps
- Guardian add/edit/remove UI still missing.
- Bulk actions are still placeholder-only.
- Promotion/transfer workflows are not fully surfaced in the main UI.
- Parent-specific guardian management UX is incomplete.

### Next Recommended Student Work
1. Add guardian management on student detail page.
2. Implement bulk student operations.
3. Add explicit promotion and transfer workflows.

---

## 3. Staff Module

### Review Summary
Staff was reviewed third because it already had active TypeScript errors and is foundational for assignments, leaves, timetable ownership, and staff administration.

### Initial Findings
- Staff module used a permission key mismatch: some files used `staff`, while global module access uses `teachers`.
- Subject assignment route folder was misspelled as `assignements`, which broke `/staff/:id/assignments/new`.
- Staff list dropdown linked to missing pages for leaves/assignments.
- Staff detail and staff table linked to a missing `/staff/:id/deactivate` page.
- Reset password route had a TypeScript issue caused by the same permission-module mismatch.

### Implemented Changes

#### Backend
- Updated all staff API route guards from `staff` to `teachers`:
  - `app/api/staff/route.ts`
  - `app/api/staff/[id]/route.ts`
  - `app/api/staff/[id]/reset-password/route.ts`
  - `app/api/staff/[id]/leaves/route.ts`
  - `app/api/staff/[id]/leaves/[leaveId]/route.ts`
  - `app/api/staff/[id]/assignments/route.ts`
  - `app/api/staff/[id]/assignments/[assignmentId]/route.ts`
- Fixed accidental table reference in:
  - `app/api/staff/[id]/reset-password/route.ts`
  - ensured password reset still queries `staff`

#### Frontend
- Updated `app/(dashboard)/staff/components/StaffForm.tsx`
  - changed permission checks from `staff` to `teachers`
- Fixed broken subject assignment route by creating the correct filesystem route:
  - `app/(dashboard)/staff/[id]/assignments/new/page.tsx`
  - `app/(dashboard)/staff/[id]/assignments/new/components/SubjectAssignmentForm.tsx`
- Removed obsolete misspelled route files:
  - `app/(dashboard)/staff/[id]/assignements/new/page.tsx`
  - `app/(dashboard)/staff/[id]/assignements/new/components/SubjectAssignmentForm.tsx`
  - `app/(dashboard)/staff/[id]/assignements/new/components/TestFile.tsx`
- Updated `app/(dashboard)/staff/components/StaffTable.tsx`
  - changed broken links to working detail tabs:
    - `/staff/:id?tab=leaves`
    - `/staff/:id?tab=assignments`
- Added a working deactivate confirmation page:
  - `app/(dashboard)/staff/[id]/deactivate/page.tsx`

### Validation
- Targeted staff lint passed.
- Staff-related TypeScript errors were cleared.

### Remaining Gaps
- Staff detail/list pages still duplicate some server-side data access instead of fully reusing the service layer.
- Deactivation is now implemented, but reactivation flow does not exist yet.
- Role-selection strategy for non-teaching support/admin staff may need a deliberate product decision.
- Staff leaves and assignment flows should still be reviewed for UX completeness, not just route correctness.

### Next Recommended Staff Work
1. Consolidate staff page data fetching onto the service layer for consistency.
2. Add reactivation flow and status history.
3. Review leaves and assignments UX for edit/review completeness.

---

## 4. Attendance Module

### Review Summary
Attendance was reviewed fourth because the dashboard was already wired to several missing API routes, and the existing service layer was using outdated schema assumptions.

### Initial Findings
- Dashboard calls were missing live route handlers for:
  - `/api/attendance`
  - `/api/attendance/[id]`
  - `/api/attendance/bulk`
  - `/api/attendance/class/[classId]`
  - `/api/attendance/export`
  - `/api/attendance/summary/all-classes`
- `features/attendance/services/attendance.service.ts` used the browser Supabase client on the server and referenced outdated fields such as:
  - `remarks`
  - `term`
  - `academic_year`
  - `admission_no`
- Existing summary routes in `app/api/attendance/*` depended on that outdated service.
- `app/api/attendance/import/route.ts` inserted invalid fields for the current schema:
  - `attendance_id`
  - `recorded_at`
  - missing `term_id`
- The attendance dashboard had an unnecessary post-save delay before refreshing class summaries.

### Implemented Changes

#### Backend
- Rewrote attendance service around the actual schema and server-side Supabase client:
  - `features/attendance/services/attendance.service.ts`
- Updated attendance shared types:
  - `features/attendance/types.ts`
- Updated attendance validation schemas and added update schema:
  - `features/attendance/validators/attendance.schema.ts`
- Added live route handlers:
  - `app/api/attendance/route.ts`
  - `app/api/attendance/[id]/route.ts`
  - `app/api/attendance/bulk/route.ts`
  - `app/api/attendance/class/[classId]/route.ts`
  - `app/api/attendance/export/route.ts`
  - `app/api/attendance/summary/all-classes/route.ts`
- Updated existing live summary routes to use the corrected service:
  - `app/api/attendance/school/route.ts`
  - `app/api/attendance/summary/class/[classId]/route.ts`
  - `app/api/attendance/summary/student/[studentId]/route.ts`
- Fixed attendance import to use the real schema and resolved term context:
  - `app/api/attendance/import/route.ts`

#### Frontend
- Removed the artificial save-refresh delay from:
  - `app/(dashboard)/attendance/page.tsx`

### Validation
- Targeted attendance lint passed.
- `tsc --noEmit` was run after the attendance changes.
- Attendance-related TypeScript errors were cleared.
- Remaining TypeScript errors are still outside attendance.

### Remaining Gaps
- The import route still carries custom auth/response helpers instead of reusing the shared API wrapper pattern.
- Dead legacy route files still exist under `features/attendance/*`; they are no longer the live API surface.
- Weekly trend still loads via multiple `/api/attendance/school` requests rather than a dedicated batched endpoint.

### Next Recommended Attendance Work
1. Consolidate attendance import onto shared auth/response helpers.
2. Remove or archive the dead `features/attendance/*/route.ts` files to avoid future confusion.
3. Add a batched weekly-trend endpoint to reduce dashboard request count.

---

## 5. Academics Module

### Review Summary
Academics was reviewed after attendance because the service layer already existed but most of the CRUD surface was not exposed through live routes or usable UI.

### Initial Findings
- The academics page was only an overview/dashboard:
  - `app/(dashboard)/academics/page.tsx`
  - `app/(dashboard)/academics/components/AcademicsOverview.tsx`
- Live API coverage was limited to:
  - `app/api/learning-areas/route.ts`
  - `app/api/learning-areas/[id]/hierarchy/route.ts`
- Service-layer CRUD already existed for:
  - learning areas
  - strands
  - sub-strands
  - competencies
  - teacher-subject assignments
- There was no management UI for building the CBC hierarchy chronologically.
- Teacher-subject assignment logic existed in services but had no live management UI/API surface.

### Implemented Changes

#### Backend
- Added learning area item route:
  - `app/api/learning-areas/[id]/route.ts`
- Added strands routes:
  - `app/api/strands/route.ts`
  - `app/api/strands/[id]/route.ts`
- Added sub-strands routes:
  - `app/api/sub-strands/route.ts`
  - `app/api/sub-strands/[id]/route.ts`
- Added competencies routes:
  - `app/api/competencies/route.ts`
  - `app/api/competencies/[id]/route.ts`
- Added teacher-subject assignment routes:
  - `app/api/teacher-subjects/route.ts`
  - `app/api/teacher-subjects/[id]/route.ts`

#### Frontend
- Expanded the academics page to include real curriculum management:
  - `app/(dashboard)/academics/page.tsx`
- Added a client-side academics manager with tabs for:
  - learning areas
  - curriculum hierarchy
  - teacher assignments
  - file: `app/(dashboard)/academics/components/AcademicsManager.tsx`

### Validation
- Targeted academics lint passed.
- `tsc --noEmit` passed after the academics changes.

### Remaining Gaps
- Learning-area edit UI is present, but lower hierarchy levels currently expose create/delete through UI more directly than full edit workflows.
- Student-subject mapping is still not surfaced here.
- Teacher assignment UI currently supports create and deactivate; edit/reactivation is still absent.

### Next Recommended Academics Work
1. Add edit UI for strands, sub-strands, and competencies.
2. Add student-subject mapping routes and screens if that workflow is still required in product scope.
3. Add hierarchy drag-and-drop reordering backed by `sort_order`.

---

## 6. Assessments Module

### Review Summary
Assessments was reviewed next because the dashboard page existed, but the live entry workflow was broken by missing route coverage and stubbed service implementations.

### Initial Findings
- `GET /api/assessments` was not implemented, even though the dashboard depended on it to load class assessment rosters.
- `features/assessments/services/assessments.service.ts` was still a stub file, which broke:
  - assessment detail
  - assessment update/delete
  - bulk assessment save
- The assessment page posted a payload shape that did not match the bulk API validator/service contract.
- The assessment page requested `/api/learning-areas?includeHierarchy=true`, but the live route only returned flat learning-area data.
- Academic year and term context were not being resolved consistently for assessment entry.

### Implemented Changes

#### Backend
- Replaced the stub assessment service with real implementations in:
  - `features/assessments/services/assessments.service.ts`
  - added list/detail/create/update/delete support
  - added bulk save support
  - added active term/year resolution when omitted
  - added teacher-subject assignment enforcement for teacher-scoped writes
- Rebuilt `app/api/assessments/route.ts`
  - added working `GET` list/roster support
  - added working single-record `POST`
- Kept `app/api/assessments/[id]/route.ts` live by wiring it to the implemented service layer
- Restored `app/api/assessments/bulk/route.ts` by backing it with the real bulk service
- Updated `features/assessments/validators/assessment.schema.ts`
  - made academic year and term optional so server-side active-context resolution can be used safely
- Updated `app/api/learning-areas/route.ts`
  - added `includeHierarchy=true` support returning nested learning area → strand → sub-strand → competency data for assessment entry

#### Frontend
- Updated `app/(dashboard)/assessments/page.tsx`
  - sends active academic year and term when loading/saving
  - posts the canonical bulk payload expected by the API
  - keeps roster loading aligned with the restored `GET /api/assessments` contract

### Validation
- Targeted ESLint passed for the modified assessment and hierarchy files.
- `npm run type-check` passed.

### Remaining Gaps
- Assessment templates are still documented in the module, but template services/routes remain effectively unimplemented.
- The class overview tab on the assessments page is still placeholder-only.
- Bulk save currently writes per-student updates sequentially; this is correct but can be optimized later if volume grows.
- Assessment locking or term-close controls are still absent.

### Next Recommended Assessment Work
1. Add assessment template CRUD and connect it to teacher entry flows.
2. Implement the class overview tab using existing analytics endpoints.
3. Add term-close locking rules so assessment edits can be intentionally restricted.

---

## 7. Reports Module

### Review Summary
Reports was reviewed next because the module had a visible dashboard and generation flow, but several live paths still depended on outdated report-card contracts and missing pages.

### Initial Findings
- The reports list page queried `report_cards`, but did not actually select several fields it later used:
  - `student_id`
  - `class_id`
  - `term_id`
  - `academic_year_id`
  - `report_type`
- Student report visibility on the list page assumed `student_id === user_id`, which is incorrect for the current schema.
- The list page linked to `/reports/:id`, but no report detail page existed.
- The report generation client was writing directly from the browser using outdated columns such as:
  - `overall_score`
  - `performance_level`
  - `status`
- `app/api/reports/report-cards/route.ts` only supported an outdated single-report generation flow and did not expose a working `GET` list endpoint for the UI preview state.

### Implemented Changes

#### Backend
- Updated `app/api/reports/report-cards/route.ts`
  - added working `GET` list support backed by the live report-card service
  - reworked `POST` to use the current assessment report-card generation service
- Updated `features/assessments/services/reportCards.service.ts`
  - added parent/student scoping to report-card listing
  - kept report listing aligned with the current schema and live route usage

#### Frontend
- Updated `app/(dashboard)/reports/page.tsx`
  - fixed report-card query shape to include the fields the page actually consumes
  - corrected student scoping through the `students` table
  - added real average-performance calculation
  - removed the broken print action
- Updated `app/(dashboard)/reports/generate/page.tsx`
  - fixed active academic year field usage (`year` instead of `name`)
  - normalized grade relation handling
- Updated `app/(dashboard)/reports/generate/ReportGenerationClient.tsx`
  - moved generation onto live API routes instead of direct browser inserts
  - switched preview loading to live student/report/assessment endpoints
  - kept overwrite behavior by allowing API-backed regeneration of existing reports
- Added a working report detail page:
  - `app/(dashboard)/reports/[id]/page.tsx`

### Validation
- Targeted ESLint passed for the modified reports files.
- `npm run type-check` passed.

### Remaining Gaps
- The dedicated PDF and printable report routes still need their own schema-alignment pass.
- The reports list filters are still minimal and do not yet expose class/student selectors in the UI.
- Legacy `features/reports/*` services still contain outdated schema assumptions and should be reconciled or retired.
- Report export/storage hardening is still incomplete compared to the assessment-backed report-card flow.

### Next Recommended Reports Work
1. Rebuild the PDF and print routes on top of the current `report_cards` and analytics schema.
2. Consolidate or retire the outdated `features/reports/*` service layer to avoid future drift.
3. Expand the reports list filters and add publish/detail actions directly from the dashboard.

---

## 8. Communication Module

### Review Summary
Communication was reviewed next because the dashboard UI already targeted `/api/communication/*`, but those live routes were sitting on top of stale service assumptions and mixed-schema field names.

### Initial Findings
- The communication dashboard depended on:
  - `/api/communication/messages`
  - `/api/communication/announcements`
  - `/api/communication/notifications`
  - `/api/communication/notifications/:id/read`
  - `/api/communication/unread-count`
- The older communication services were built around a mix of:
  - browser Supabase clients used on the server
  - partially added `message_recipients` assumptions
  - outdated announcement field names such as `publish_date`, `expiry_date`, and `target_classes`
- The actual schema in use for the live dashboard is different:
  - `messages.receiver_id`
  - `notifications.read_status` as enum values
  - `announcements.publish_at`, `expires_at`, and `target_class_ids`
- As a result, the dashboard routes were not reliably aligned with the database even though the UI was already wired up.

### Implemented Changes

#### Backend
- Rebuilt live communication routes directly against the current schema:
  - `app/api/communication/messages/route.ts`
  - `app/api/communication/notifications/route.ts`
  - `app/api/communication/notifications/[id]/read/route.ts`
  - `app/api/communication/notifications/read-all/route.ts`
  - `app/api/communication/unread-count/route.ts`
  - `app/api/communication/announcements/route.ts`
  - `app/api/communication/announcements/[id]/route.ts`
- Messages route changes:
  - inbox/sent listing now uses the real `messages` table
  - unread/read state is normalized for the UI
  - direct user-to-user message creation is supported through the live route
- Notifications route changes:
  - list/read/read-all now use enum-backed `read_status`
  - unread counts now combine live message and notification totals correctly
- Announcements route changes:
  - list/create/update/delete now use `publish_at`, `expires_at`, and `target_class_ids`
  - role-target filtering is applied safely for the live dashboard response shape

#### Frontend
- No dashboard component rewrites were required because the existing communication UI already targeted the `/api/communication/*` surface.
- The updated routes now return shapes compatible with:
  - `app/(dashboard)/communication/components/MessagesList.tsx`
  - `app/(dashboard)/communication/components/NotificationsList.tsx`
  - `app/(dashboard)/communication/components/AnnouncementsList.tsx`

### Validation
- Targeted ESLint passed for the modified communication routes.
- `npm run type-check` passed.

### Remaining Gaps
- Duplicate legacy communication surfaces still exist under `/api/messages`, `/api/notifications`, and related non-dashboard routes.
- Broadcast and advanced recipient flows still need a deliberate pass because they depend on mixed `messages` vs `message_recipients` behavior.
- The old `features/communication/services/*` layer still contains stale schema assumptions and should be consolidated or retired.
- The communication UI still lacks compose/reply and sent-folder management UX completeness.

### Next Recommended Communication Work
1. Consolidate duplicate communication routes so there is one canonical messaging/notification API surface.
2. Rebuild broadcast and multi-recipient messaging on a single consistent data model.
3. Add compose, sent-folder, and message-detail UX on top of the stabilized routes.

---

## 9. Timetable Module

### Review Summary
Timetable was reviewed next because the dashboard page, API route, and service layer were all present, but they had drifted into incompatible contracts and could no longer complete the live weekly scheduling workflow.

### Initial Findings
- The dashboard queried `/api/timetable` with camelCase filters such as `classId` and `teacherId`, while the route only read snake_case query parameters.
- The dashboard edited and deleted slots through `/api/timetable/:id`, but only `/api/timetable` existed.
- The API route called the timetable service with the wrong argument order and returned the wrong shape for the dashboard, so listing could not work reliably.
- Create and update flows did not enforce the teacher-subject assignment rules already used elsewhere in academics and assessments.
- The page loaded teachers from a response shape that does not match the live `/api/staff` payload, which left teacher selection broken.

### Implemented Changes

#### Backend
- Rebuilt `app/api/timetable/route.ts` around the real service contract:
  - resolves the active academic year and term automatically
  - accepts both camelCase and snake_case query parameters for compatibility
  - returns timetable rows in the flat list shape the dashboard expects
  - returns conflict payloads directly when scheduling collisions are detected
- Tightened `features/timetable/validators/timetable.schema.ts` so create/update requests validate required IDs, day-of-week values, time formats, and room length.
- Updated `features/timetable/services/timetable.service.ts` so:
  - slot listing uses the correct pagination defaults
  - slot lookups are school-scoped
  - create/update enforce matching active `teacher_subjects` assignments
  - mapped slot rows include display-ready teacher name data

#### Frontend
- Updated `app/(dashboard)/timetable/page.tsx` to:
  - load classes and learning areas from shared reference data
  - load teachers from the real `/api/staff` response and filter to teaching roles
  - query `/api/timetable` using the live filter names
  - submit edits through `PATCH /api/timetable` with `slotId`
  - delete through `DELETE /api/timetable?slot_id=...`
  - surface API conflict and validation errors correctly in the modal flow

### Validation
- Targeted ESLint passed for the modified timetable files.
- `npm run type-check` passed.

### Remaining Gaps
- The timetable module still lacks bulk copy/template tooling despite service stubs existing for those workflows.
- The dashboard still uses hard-coded default lesson periods rather than school-configurable bell times.
- There is still no dedicated timetable detail/export API beyond the repaired dashboard flow.

### Next Recommended Timetable Work
1. Review and wire the bulk copy/deactivate timetable operations that already exist in the service layer.
2. Move lesson-period definitions into configurable school settings instead of hard-coded frontend constants.
3. Continue to the `Settings` module, since active academic context and reference-data flows now underpin most of the remaining modules.

---

## 10. Settings Module

### Review Summary
Settings was reviewed next because it underpins the academic-year, term, class, and shared configuration flows already used by the other repaired modules.

### Initial Findings
- Core settings services were using the browser Supabase client inside server-side API routes, which made the module fragile and inconsistent on the server.
- The code assumed `school_settings` was stored as one JSON document, but the live schema stores settings as key/value rows.
- `/api/settings/config` therefore could not reliably return or update real school settings.
- Class listing defaulted to active-only records even in the settings dashboard, which made the built-in reactivate action unreachable.
- Class duplicate checks were too broad and blocked valid same-name class creation across different academic years.

### Implemented Changes

#### Backend
- Reworked `features/settings/services/academicYear.service.ts` to use the server Supabase client per request for academic-year and term CRUD.
- Reworked `features/settings/services/classes.service.ts` to use the server client, support `status=all`, and scope duplicate class checks to the academic year.
- Rebuilt `features/settings/services/school.service.ts` around the real `school_settings` table shape:
  - reads key/value setting rows
  - seeds default rows when a school has no settings yet
  - normalizes rows into the nested settings object expected by the app
  - upserts partial settings updates back into key/value rows
- Kept `getSystemConfig` compatible with the dashboard by returning school profile, academic context, classes, and normalized settings together.

#### Frontend
- Updated `app/(dashboard)/settings/components/SettingsClient.tsx` so the classes view requests `status=all`, allowing inactive classes to remain visible and be reactivated from the UI.

### Validation
- Targeted ESLint passed for the modified settings files.
- `npm run type-check` passed.

### Remaining Gaps
- The school profile section is still read-only; edit/update UX is not yet exposed in the dashboard.
- System configuration is still largely a viewer and does not yet provide a full settings editor.
- Settings sub-areas mentioned in the original requirements such as grading-scale and promotion-rule management still need dedicated UI and route work.

### Next Recommended Settings Work
1. Add editable school-profile UX and wire `PUT /api/settings/school`.
2. Build a real settings editor for academic, finance, communication, and general config instead of the current read-only summary.
3. Continue to `Compliance/Audit`, which is the last major pending module in the current pass.

---

## 11. Compliance/Audit Module

### Review Summary
Compliance/Audit was reviewed last in the current pass because the visible module entry point, discipline workflows, and audit-adjacent routes had drifted apart into several partially working surfaces.

### Initial Findings
- The `/compliance` page was only a redirect to `/discipline`, which sent parents into the wrong screen and provided no audit or consent overview.
- The discipline dashboard expected create, update, delete, resolve, and notify flows, but the route surface only partially existed.
- `POST /api/discipline` was inserting stale columns and enum values that do not match the live disciplinary schema.
- The discipline detail, summary, and student-history routes were still wired to the older discipline service, which uses outdated field names and the browser Supabase client.
- Compliance as a whole was split across discipline, parent-consent, and audit-log surfaces without a real module landing page.

### Implemented Changes

#### Backend
- Rebuilt the live discipline API around the actual schema:
  - `app/api/discipline/route.ts`
  - `app/api/discipline/[id]/route.ts`
  - `app/api/discipline/[id]/notify/route.ts`
  - `app/api/discipline/summary/route.ts`
  - `app/api/discipline/student/[studentId]/route.ts`
- Added shared discipline mapping/scoping helpers in:
  - `app/api/discipline/_lib.ts`
- The repaired discipline routes now:
  - align create/update payloads with the dashboard’s camelCase form payloads
  - write to live columns such as `incident_date`, `recorded_by`, `parent_notified_date`, and `resolved_by`
  - support resolve and delete actions
  - add the missing parent-notify route used by the dashboard
  - enforce role-based visibility for class teachers and parents through student scoping
- The existing audit log route remained valid and did not require a contract rewrite:
  - `app/api/audit-logs/route.ts`

#### Frontend
- Replaced the compliance redirect page with a real role-aware landing page:
  - `app/(dashboard)/compliance/page.tsx`
- The new compliance landing page now:
  - shows consent-focused summaries for parents
  - shows discipline, consent, and recent audit summaries for school-side roles
  - provides a working entry point into discipline management
- Updated `app/(dashboard)/discipline/page.tsx` error handling so it surfaces repaired API errors correctly.

### Validation
- Targeted ESLint passed for the modified compliance/discipline files.
- `npm run type-check` passed.

### Remaining Gaps
- The older `features/discipline/services/discipline.service.ts` still contains stale assumptions and should be consolidated or retired now that the live routes have been repaired directly.
- Parent-consent management still lacks a dedicated dashboard workflow beyond the new compliance landing overview.
- Audit logs are available through the API and compliance overview, but there is still no dedicated audit-log management page.

### Next Recommended Compliance/Audit Work
1. Consolidate the stale discipline service layer so there is one canonical implementation behind the repaired routes.
2. Add a dedicated parent-consent management UI for school staff and guardians.
3. Review `Exams` next, since it is the main remaining module still marked as needing a fresh review pass.

---

## 12. Exams Module

### Review Summary
Exams was reviewed after Compliance/Audit because it was the last major module still marked as needing a fresh review pass, even though a basic exam bank implementation already existed.

### Initial Findings
- The module only exposed list/create routes for exam-bank items and scheduled exams, so update/delete maintenance flows were missing.
- The dashboard could create exams and schedules, but there was no working way to correct or remove mistakes once records existed.
- Scheduled exam writes did not enforce teacher-subject assignments, which meant teacher-scoped users could schedule exams outside their assigned class/subject combinations.
- API failures surfaced as generic dashboard errors, so duplicate schedules and scheduled-exam delete conflicts were hard to diagnose from the UI.

### Implemented Changes

#### Backend
- Added shared exam helpers in:
  - `app/api/exams/_lib.ts`
- Updated exam-bank collection route:
  - `app/api/exams/route.ts`
  - reused shared normalization/context helpers
- Added exam-bank item route:
  - `app/api/exams/[id]/route.ts`
  - supports detail, update, and delete flows
  - restricts teacher-scoped edits to exams they created
  - returns friendly conflict messaging when a scheduled exam blocks deletion
- Updated exam schedule collection route:
  - `app/api/exams/sets/route.ts`
  - reused shared normalization/context helpers
  - enforces teacher-subject assignment checks on scheduling
  - returns a clear duplicate-schedule conflict response
- Added exam schedule item route:
  - `app/api/exams/sets/[id]/route.ts`
  - supports detail, update, and delete flows
  - enforces assignment checks on schedule updates

#### Frontend
- Updated `app/(dashboard)/exams/page.tsx`
  - create form now supports edit mode for existing exam-bank entries
  - existing attached files can be preserved and reopened during edits
  - exam-bank table now exposes edit and delete actions
  - schedule list now exposes edit and delete actions
  - schedule modal now supports both create and edit flows
  - API error handling now surfaces backend validation/conflict messages directly

### Validation
- Targeted ESLint passed for the modified exam dashboard and API files.
- `npm.cmd run type-check` passed.

### Remaining Gaps
- The exam bank still has no version history or revision comparison for updated papers.
- Schedule management is now editable, but the schedule view still lacks filters, export, or calendar-style presentation.
- Exam files and typed content can be reviewed, but there is still no dedicated print/PDF generation flow for bank entries.
- Teachers can still browse the school exam bank broadly; if ownership- or assignment-scoped visibility is desired, that needs a deliberate product decision.

### Next Recommended Exams Work
1. Add schedule filters/export and a calendar-style exam timetable view.
2. Add exam versioning plus audit-friendly file replacement history.
3. Decide whether teacher-facing exam-bank visibility should remain school-wide or become owner/assignment scoped.

---

## Cross-Module Technical Notes

### Current Known Unrelated TypeScript Errors
There are currently no open TypeScript errors after the latest pass.

### Update Rule
Whenever a module is reviewed:
- add a new section below in chronological order
- list findings first
- list implemented files
- list validation result
- list remaining gaps
- list recommended next work

---

## Template For Next Module

```md
## N. Module Name

### Review Summary
- Short reason for review order and scope.

### Initial Findings
- Gap 1
- Gap 2
- Gap 3

### Implemented Changes

#### Backend
- `path/to/file`
- `path/to/file`

#### Frontend
- `path/to/file`
- `path/to/file`

### Validation
- Lint/tests run and result.

### Remaining Gaps
- Gap 1
- Gap 2

### Next Recommended Work
1. Next item
2. Next item
```
