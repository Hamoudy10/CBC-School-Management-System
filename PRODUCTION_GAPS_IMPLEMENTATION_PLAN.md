# Production Gaps Implementation Plan

This file is the working implementation plan for closing the highest-priority production-readiness gaps in the school management system.

## How This Plan Will Be Used
- Work will be completed one priority item at a time.
- After each item:
  - this file will be updated
  - implemented scope will be noted
  - the next recommended item will be identified
  - user confirmation will be requested before continuing

## Priority Order

### 1. Settings Administration Foundation
Status: `Implemented`

Scope:
- Add editable school-profile workflow in the settings dashboard.
- Wire missing `PUT /api/settings/school` support.
- Replace read-only school-profile view with a proper admin update flow.

Why this is first:
- School setup is foundational for live deployment.
- It affects reports, communication, identity, and overall system administration.
- The backend service support already exists, so this is a high-value, low-risk production step.

Implemented:
- Added `PUT /api/settings/school`.
- Wired school-profile validation through the settings schema.
- Replaced the read-only school-profile view with an editable admin form.
- Added save/cancel flow and refresh after successful updates.
- Allowed optional profile fields to be cleared safely during updates.

Implementation Notes:
- The school profile edit/save flow is now complete.
- The broader system configuration editor remains the next settings priority.

### 2. System Configuration Editor
Status: `Implemented`

Scope:
- Replace the current read-only system configuration summary with real editable settings.
- Surface academic, finance, communication, and general settings in the dashboard.
- Validate and persist configuration safely through the existing settings API surface.

Implemented:
- Replaced the system configuration summary with a full editor in the settings dashboard.
- Added editable academic, finance, communication, and general configuration fields.
- Added client-side validation for threshold, reminder-day, messaging, and school-day inputs before save.
- Extended the settings validation schema to accept the editable configuration fields now exposed in the UI.
- Normalized legacy grading-system values during settings load/update to keep persisted configuration safe.

Implementation Notes:
- System settings now support save/reset workflow and refresh from the persisted API response after updates.
- The settings dashboard now also surfaces active academic year, active term, and active class count alongside the editor.
- Finance operational workflows are the next highest-priority production gap.

### 3. Finance Operational Completeness
Status: `In Progress`

Scope:
- Add waivers, refunds, and approval workflows.
- Add student ledger view and receipt reprint flow.
- Close key finance operational gaps required for day-to-day school use.

Implemented So Far:
- Added a dedicated student ledger view under finance for reviewing assigned fees, payment history, and balances.
- Added receipt reprint flow from payment history and from the student ledger.
- Added a detailed payment receipt API surface to support consistent receipt retrieval and printing.
- Wired finance navigation to the new ledger from the balances table and from the student finance tab.
- Completed student-scoped payment filtering in the payments service/API so ledger payment history can load correctly.
- Added an approval-controlled fee waiver workflow from the student ledger with reason capture and audit logging.
- Added payment adjustment and refund workflows from payment history, with fee-balance recalculation and audit capture.
- Added a finance exception register for reviewing waived, refunded, and adjusted transactions from finance operations.
- Added summary visibility for waiver totals, refund totals, and logged adjustment activity from finance audit data.
- Backfilled explicit payment-adjustment audit logging so finance exception reporting now includes adjustment history consistently.
- Hardened approval boundaries so payment amount changes now require finance approval permission, while non-financial payment edits can still be handled separately.
- Added separation-of-duties checks that block self-approved refunds, fee waivers, and payment amount changes except for elevated approver roles.

Implementation Notes:
- The finance gap is now in progress rather than still planned.
- Core refund and adjustment handling is now in place for recorded payments.
- Finance staff can now review exception history directly from the payments screen instead of relying on raw audit-log access.
- Payment metadata edits and money-impacting exceptions now follow clearer approval boundaries in both backend enforcement and finance UI messaging.
- Remaining finance work should focus on broader exception handling beyond payments, such as reversal/reallocation workflows and stronger exception reporting exports.

### 4. Student Lifecycle Completeness
Status: `Implemented`

Scope:
- Add guardian add/edit/remove management.
- Implement bulk student operations.
- Surface promotion and transfer workflows clearly in the main UI.

Implemented So Far:
- Replaced the placeholder bulk-student action entry point with a real bulk workflow on the students list.
- Added bulk promotion, class transfer, and bulk lifecycle status update handling for selected students.
- Wired bulk student operations through a dedicated API path with validation and summary feedback for processed, skipped, and failed records.
- Added full guardian management from the student profile, including create, edit, and remove workflows backed by dedicated guardian API routes.
- Added clear single-student promotion and transfer actions on the student detail page with destination-class selection and lifecycle validation.

Implementation Notes:
- Student lifecycle work is now complete for the core production scope called out in this plan.
- Bulk operational handling is now available from the main students screen, reducing one-by-one lifecycle updates for administrators.
- Student detail now supports both guardian maintenance and individual class movement workflows without forcing staff back to list-level tools.
- Remaining follow-up in this area should be polish rather than a blocking production gap.

### 5. Reports Production Hardening
Status: `In Progress`

Scope:
- Rebuild/align PDF and printable report flows.
- Improve report export/storage handling.
- Complete missing report filtering and operational actions.

Implemented So Far:
- Added filtered CSV export for the reports dashboard, including direct detail/PDF/print links in the exported data.
- Added single-report publish and unpublish actions so report release can be handled from the report detail workflow instead of only through bulk-oriented paths.
- Added in-app report remark editing from the report detail experience for roles that are allowed to maintain report content.
- Aligned report dashboard actions with the role-permission matrix so report generation/export visibility now follows configured permissions instead of hard-coded role checks.
- Extended report permissions and report-card relation handling so report detail/list data resolves more reliably for real Supabase relation payload shapes.

Implementation Notes:
- Report-card operational controls are now available directly from the report detail page for authorized staff.
- Report export now supports the same main filters used by the dashboard, which is a safer production workflow than manual screen-by-screen downloads.
- Remaining reports hardening should focus on stored export/report artifacts, broader batch publication/review workflows, and deeper coverage for non-report-card report types.

### 6. Communication Workflow Completeness
Status: `In Progress`

Scope:
- Add compose, reply, sent-folder, and message-detail UX.
- Consolidate duplicate communication route surfaces.
- Stabilize broadcast/multi-recipient messaging behavior.

Implemented So Far:
- Added direct-message compose flow from the communication workspace with recipient lookup for active school users.
- Added inbox and sent-folder switching inside the messages experience instead of a single undifferentiated list.
- Added message-detail modal handling with full-body review and reply entry point from the same workflow.
- Added mark-all-read handling from the inbox workflow for quicker day-to-day communication cleanup.
- Extended message compose targeting to support user, role, and class recipients from the main communication workflow.
- Consolidated the communication messages route onto the shared messaging service so inbox/sent behavior and recipient expansion now follow the same backend path.
- Hardened message deletion compatibility so legacy and communication route surfaces can now resolve recipient message records more safely.
- Moved inbox mark-all-read onto the communication route surface and added inbox delete action from the message-detail workflow for roles allowed to remove messages.
- Tightened the main communication message routes so list, compose, detail, and delete actions now follow explicit communication permissions rather than authentication alone.
- Aligned the communication unread-count endpoint with the shared message-recipient model so badge counts now reflect the actual inbox storage path.
- Realigned the communication notifications routes with the shared notification service so list/read flows use the current boolean read-status model consistently.

Implementation Notes:
- Communication compose now covers the main operational recipient groups without forcing staff onto a separate broadcast-only endpoint.
- Communication inbox operations now run through the communication-specific route surface instead of relying on the legacy messages read-all endpoint.
- Remaining communication work should focus on sent-folder archive/delete semantics, richer sent-message recipient summaries, and broader cleanup of duplicate legacy communication route surfaces.

### 7. Compliance and Audit Operations
Status: `Planned`

Scope:
- Add dedicated audit-log management UI.
- Add full parent-consent management workflows for staff and guardians.

### 8. Assessment Governance Controls
Status: `Planned`

Scope:
- Add assessment template CRUD.
- Add assessment locking / term-close controls.
- Complete missing class-overview functionality.

### 9. Timetable and Exam Operational Tooling
Status: `Planned`

Scope:
- Add timetable bulk-copy/template workflows and configurable bell times.
- Add exam schedule filters, export, and calendar/timetable-style presentation.

### 10. Staff Workflow Completeness
Status: `Planned`

Scope:
- Replace placeholder leaves/assignments UI.
- Add reactivation flow and status-history support.

### 11. Performance and Navigation Optimization
Status: `In Progress`

Scope:
- Reduce route-to-route loading delay across the dashboard shell.
- Remove duplicated auth/session initialization in the dashboard path.
- Restore faster navigation behavior and reduce avoidable client/server round trips.

Implementation Steps:
- [x] Step 1. Remove duplicate dashboard auth-provider setup while keeping server-side access protection.
- [x] Step 2. Re-enable efficient route prefetching for main dashboard navigation.
- [ ] Step 3. Reduce client -> API -> Supabase double-hop loading on the most-used dashboard routes.
- [x] Step 4. Split the heaviest client pages into smaller lazy/client islands.
- [x] Step 5. Reduce repeated permission/module computation in shell-level components.

Implementation Notes:
- This track is focused on perceived loading speed, not feature expansion.
- Steps will be completed one by one and marked here immediately after implementation.
- Step 1 completed: `AuthProvider` was removed from the global root layout and scoped to route groups instead.
- Dashboard routes now use a single server-hydrated auth provider in `app/(dashboard)/layout.tsx`.
- Auth pages now use their own provider in `app/(auth)/layout.tsx`, preventing unnecessary auth initialization on every app route.
- Step 2 completed: dashboard sidebar links now use normal Next.js prefetching again instead of forcing cold navigations.
- The delayed manual `router.prefetch(...)` sidebar workaround was removed so route warming happens through the framework's built-in behavior.
- Step 3 attempted: the main dashboard was temporarily switched to server-loaded metrics, but that change was rolled back after Supabase server-side connect timeouts caused render failures in this environment.
- The dashboard currently uses the stable client-side `/api/analytics/school` loading path again while the other navigation improvements remain in place.
- Step 4 completed: the largest settings tabs were split into lazy-loaded client chunks so the main settings shell no longer hydrates class-management and system-configuration code up front.
- `ClassesSection` and `SystemConfigSection` now load on demand from dedicated component files instead of being bundled into the base `SettingsClient` payload.
- Step 5 completed: auth/provider permission results are now memoized by accessible modules and the sidebar filters navigation from cached role data instead of re-running module access checks per item.
- The remaining open item in this track is a safer way to reduce the dashboard data-loading double hop without introducing unstable server-render auth/network calls.

## Deferred Cross-Cutting Platform Work

These are important for full production maturity, but they are being deferred until the core operational gaps above are closed:
- storage/access hardening for uploaded assets
- production-grade distributed rate limiting
- observability and error monitoring
- end-to-end automated coverage for critical flows
- background-job support for heavier workflows such as report generation

## Progress Log

### 2026-03-26
- Plan created.
- Item 1 completed: school profile edit workflow and `PUT /api/settings/school`.
- Item 2 completed: system configuration editor with editable academic, finance, communication, and general settings.
- Item 3 started: student ledger view and receipt reprint flow implemented.
- Item 3 extended: approval-controlled fee waiver workflow implemented from the student ledger.
- Item 3 extended again: payment adjustment and refund workflow implemented from finance payment history.
- Item 3 extended again: finance exception visibility/reporting implemented for waivers, refunds, and payment adjustments.
- Item 3 extended again: finance approval hardening implemented for payment amount changes, refunds, and fee waivers with separation-of-duties checks.
- Item 4 started: bulk student operations implemented for promotion, transfer, and lifecycle status handling from the students list.
- Item 4 completed: guardian management plus individual promotion/transfer workflows implemented from the student detail experience.
- Item 5 started: reports dashboard export, detail-level publish/unpublish actions, and in-app remark editing implemented with permission-aligned access.
- Auth hardening pass: replaced the remaining security-sensitive Supabase `getSession()` usage in protected dashboard flow with `getUser()`.
- Item 6 started: communication direct-message compose, inbox/sent switching, message detail, and reply workflow implemented.
- Item 6 extended: communication compose now supports user/role/class targeting and the main communication messages route now uses the shared messaging service path.
- Item 6 extended again: communication inbox mark-all-read and delete actions now run through the communication route surface with explicit permission checks.
- Recommended next item: continue communication workflow completeness with sent-message archival semantics and further retirement of duplicate legacy message routes.
- Item 11 started: performance/navigation optimization plan added with duplicate dashboard auth-provider removal as the first implementation step.
- Item 11 step 1 completed: auth-provider setup moved out of the global root layout and into route groups so dashboard navigation no longer pays for duplicate auth context setup.
- Item 11 step 2 completed: sidebar navigation now uses built-in Next.js prefetching again, removing the forced cold-load behavior on main dashboard links.
- Item 11 step 3 rolled back: the server-rendered dashboard preload caused Supabase connect timeouts, so the dashboard was returned to the stable client-fetch path.
- Item 11 step 4 completed: the largest settings tabs now lazy-load from separate chunks, reducing the amount of client code downloaded and hydrated when opening settings.
- Item 11 step 5 completed: shell permission checks now reuse cached accessible-module data, reducing repeated navigation computation during dashboard renders.
