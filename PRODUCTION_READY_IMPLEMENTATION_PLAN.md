# 100% Production Readiness Implementation Plan

Created: 2026-06-29  
Project: CBC School Management System  
Purpose: A step-by-step implementation plan to take the system from its current pilot-ready state to production-ready for real school operations.

## Production-Ready Definition

The system is considered 100% production-ready only when all of these are true:

- A clean clone can install, type-check, lint, test, schema-check, and build successfully.
- Every API route is classified and protected according to an explicit access policy.
- Critical student, staff, parent, finance, and school data is protected by RLS, app permissions, tests, and audit logs.
- AI tools cannot perform unsafe writes without permissions, confirmation, audit logging, and tested database contracts.
- File uploads, payments, webhooks, public forms, and offline sync have production-grade abuse protection.
- Deployment, rollback, backup, restore, monitoring, alerting, and incident response are documented and tested.
- Role-based UAT has passed for all target roles.
- Incomplete or risky modules are either finished, feature-flagged, or hidden.

## Phase 0: Stabilize The Baseline

Goal: Establish a reliable engineering baseline before changing product behavior.

### Tasks

- Create a dedicated `production-hardening` branch.
- Add CI pipeline for:
  - `npm ci`
  - `npm run type-check`
  - `npm run lint`
  - `npm test -- --runInBand`
  - `node scripts/check-schema-drift.mjs`
  - `npm run build`
- Fix local cache/write problems that currently block type-check and lint verification.
- Remove `eslint.ignoreDuringBuilds: true` from `next.config.mjs` once lint is green.
- Ensure `.env.example` contains every required production variable.
- Document required Node version and package manager.
- Produce a clean-clone setup checklist.

### Acceptance Criteria

- CI is green from a clean checkout.
- Build, lint, type-check, test, and schema drift checks all pass.
- A developer can set up the project from README/setup docs without private knowledge.

## Phase 1: Fix Release-Blocking Code Defects

Goal: Remove known defects that can cause runtime failure or data inconsistency.

### Tasks

- Fix AI-agent schema drift in `features/ai-agent/services/tool-registry.service.ts`:
  - Replace `timetable_entries` with the correct `timetable_slots` model.
  - Replace or verify `user_roles` against the actual users/roles schema.
  - Replace `fee_waivers` with `fee_exemptions` or the canonical waiver table.
- Add tests for every fixed AI-agent tool.
- Review all direct `.from()` table references using `scripts/check-schema-drift.mjs`.
- Verify every route using cookies/session is explicitly dynamic where required.
- Re-run production build and fix all build-time dynamic usage warnings/errors.
- Check deprecated routes and remove, redirect, or document their sunset behavior.

### Acceptance Criteria

- Schema drift checker returns zero issues.
- `next build` completes successfully.
- AI-agent write tools match the real database schema.
- Deprecated routes do not create duplicate business logic.

## Phase 2: API Security And Authorization

Goal: Ensure every backend route has intentional, testable access control.

### Tasks

- Generate an API route inventory from `app/api`.
- Classify every endpoint as:
  - Public
  - Authenticated
  - Permissioned
  - Admin-only
  - Webhook-only
  - Deprecated redirect
- Create `API_ROUTE_ACCESS_POLICY.md`.
- Convert business endpoints to standard wrappers:
  - `withAuth`
  - `withPermission`
  - `withRoles`
- Replace custom inline role lists where practical.
- Review sensitive endpoints:
  - Admin AI logs
  - Audit logs
  - User management
  - Staff password reset
  - Finance/payment routes
  - Reports publishing
  - Parent/student data routes
- Add tests for:
  - No session
  - Wrong role
  - Correct role
  - Cross-school access
  - Parent/student scoped access
- Add an automated check that flags unclassified new API routes.

### Acceptance Criteria

- Every API route is listed in the access policy.
- Sensitive endpoints require the correct permission.
- Cross-school access is rejected in tests.
- New unclassified routes fail CI.

## Phase 3: Database, RLS, And Migration Hardening

Goal: Make the database contract safe, repeatable, and deployment-ready.

### Tasks

- Create a canonical migration order document.
- Verify all migrations apply cleanly to an empty database.
- Verify all migrations apply cleanly to a copy of existing data.
- Review RLS policies for every sensitive table:
  - `users`
  - `students`
  - `student_guardians`
  - `staff`
  - `attendance`
  - `assessments`
  - `student_fees`
  - `payments`
  - `report_cards`
  - `messages`
  - `notifications`
  - `audit_logs`
  - AI-related tables
- Add database constraints for critical invariants:
  - One active academic year per school.
  - One active term per school/year where applicable.
  - Unique admission numbers per school.
  - Idempotent payment transaction references.
  - Required school scope on tenant-owned rows.
- Wire `types/database.types.ts` into all Supabase clients.
- Start reducing `any` and `as any` in core modules.

### Acceptance Criteria

- Fresh database migration succeeds.
- Existing database migration rehearsal succeeds.
- RLS policies are reviewed and tested.
- Critical uniqueness and tenant constraints exist.
- Supabase clients use the generated `Database` type.

## Phase 4: Privileged Operations And Audit Logging

Goal: Make high-impact operations accountable and reversible where possible.

### Tasks

- Create a service-role usage register.
- Review every `createSupabaseAdminClient()` call.
- For each service-role operation, document:
  - Why service role is required.
  - Permission checked before use.
  - Tables affected.
  - Audit event emitted.
- Add audit logs for:
  - User creation/deactivation/deletion.
  - Password reset by admin.
  - Role changes.
  - Payment creation/update/reversal.
  - Fee waivers/exemptions.
  - Report publishing.
  - AI-agent write actions.
  - M-Pesa reconciliation decisions.
- Add request IDs to audit logs where possible.

### Acceptance Criteria

- No undocumented service-role usage remains.
- Every critical write has an audit trail.
- Audit logs identify actor, school, action, target, old value, new value, timestamp, and request ID.

## Phase 5: Authentication, Sessions, And Account Safety

Goal: Harden user access and account lifecycle.

### Tasks

- Review login and password reset flows.
- Add durable rate limiting for login and password reset.
- Add optional MFA support for high-privilege roles.
- Add password policy documentation.
- Ensure inactive/suspended users cannot access APIs.
- Add session invalidation after role change, deactivation, or password reset.
- Review staff reset-password endpoint for secure temporary password handling.
- Ensure parent account creation sends a secure onboarding flow rather than exposing temporary credentials.

### Acceptance Criteria

- Brute-force protections are durable across instances.
- High-privilege accounts have stronger protection.
- User status changes take effect immediately.
- Account lifecycle is documented and tested.

## Phase 6: File Upload And Storage Security

Goal: Prevent unsafe file handling and accidental public exposure.

### Tasks

- Decide storage privacy per category:
  - Public: school logo or explicitly public assets.
  - Private: student photos, staff files, reports, documents, imports.
- Change Supabase bucket strategy accordingly.
- Remove SVG upload support or sanitize SVG strictly.
- Validate file signatures, not only extensions.
- Add upload size limits per route and category.
- Add filename normalization and collision safety.
- Add antivirus or malware scanning workflow for production.
- Ensure signed URLs expire appropriately.
- Add tests for blocked file types and oversized uploads.

### Acceptance Criteria

- Sensitive files are private by default.
- Unsafe file types are blocked.
- Upload behavior is tested.
- Storage access is school-scoped.

## Phase 7: Payments And M-Pesa Production Hardening

Goal: Make finance workflows reliable and auditable.

### Tasks

- Strengthen M-Pesa C2B validation and confirmation:
  - Verify shortcode.
  - Enforce transaction uniqueness.
  - Reject invalid or duplicate transaction IDs.
  - Store raw payloads safely.
  - Add replay protection.
- Add idempotency keys for payment creation.
- Add payment reversal/void workflow with permissions and audit logs.
- Add finance period/term locking rules.
- Add reconciliation dashboard:
  - Matched payments.
  - Unmatched transactions.
  - Manual review.
  - Failed validations.
- Add tests for duplicate payment, webhook replay, manual reconciliation, and cross-school attempts.

### Acceptance Criteria

- M-Pesa webhooks are idempotent and replay-safe.
- Finance actions are audited.
- Payment data cannot be silently duplicated or overwritten.
- Bursar/admin can reconcile exceptions from the UI.

## Phase 8: AI Safety And Governance

Goal: Make AI features useful without creating data, privacy, or operational risk.

### Tasks

- Add feature flags for all AI modules.
- Review AI prompts for student-data leakage.
- Add data minimization to AI context builders.
- Ensure AI logs do not store excessive sensitive data.
- Add retention policy for AI logs and cache.
- Add per-role AI permissions.
- Add cost controls:
  - Per-user quota.
  - Per-school quota.
  - Daily budget alerts.
- Add high-risk AI-agent confirmation screens.
- Add AI-agent dry-run mode for write tools.
- Add tests for AI tool permissions and confirmation requirements.

### Acceptance Criteria

- AI features can be disabled by school/module.
- AI write actions are permissioned, confirmed, and audited.
- AI logs and cache respect privacy and retention policy.
- AI spend is bounded and observable.

## Phase 9: Offline And PWA Readiness

Goal: Either make offline mode real or remove it from production scope.

### Tasks

- Decide if offline mode is in the production launch.
- If not launching:
  - Hide offline UI.
  - Do not register the service worker.
  - Remove offline claims from deployment docs.
- If launching:
  - Add `public/offline.html`.
  - Add `public/manifest.json`.
  - Split client sync code from server-only code.
  - Add sync table allowlist.
  - Add conflict-resolution rules.
  - Add retry and dead-letter behavior.
  - Add sync status UI.
  - Test offline attendance, assessment draft, and reconnect sync.

### Acceptance Criteria

- Offline behavior is either disabled or fully tested.
- Service worker does not cache sensitive data unsafely.
- Sync cannot write arbitrary tables.
- Conflicts are visible and resolvable.

## Phase 10: Observability And Operations

Goal: Make production failures visible and recoverable.

### Tasks

- Add structured logging with request IDs.
- Add error tracking.
- Add performance monitoring.
- Add uptime checks.
- Add admin health dashboard for:
  - Database connectivity.
  - Auth status.
  - Storage status.
  - Failed jobs.
  - M-Pesa queue/reconciliation.
  - AI usage and errors.
  - Offline sync failures.
- Add alerting for:
  - Build/deploy failure.
  - API error spikes.
  - Payment webhook failure.
  - Database migration failure.
  - AI spend threshold.
  - Storage quota threshold.
- Create incident response runbook.

### Acceptance Criteria

- Production issues emit actionable alerts.
- Admins can view system health.
- Engineers can trace a request across logs and audit events.

## Phase 11: Backup, Restore, And Disaster Recovery

Goal: Protect the school from data loss.

### Tasks

- Document Supabase backup schedule.
- Document storage backup strategy.
- Add manual export process for school data.
- Test restore into a staging environment.
- Define RPO and RTO targets.
- Create disaster recovery runbook.
- Schedule quarterly restore rehearsal.

### Acceptance Criteria

- Backup exists for database and storage.
- Restore has been tested.
- Recovery process is documented and assigned.

## Phase 12: Performance And Scalability

Goal: Ensure the system remains fast with real school data.

### Tasks

- Define expected production sizes:
  - Number of schools.
  - Students per school.
  - Staff per school.
  - Assessments per term.
  - Attendance records per year.
  - Payments per term.
- Add indexes for common filters and joins.
- Review slow pages:
  - Dashboard.
  - Students.
  - Attendance.
  - Assessments.
  - Finance.
  - Reports.
  - AI agent.
- Add pagination to any large list still missing it.
- Add query limits to AI/database tools.
- Load test key API endpoints.
- Optimize report generation and PDF generation jobs.

### Acceptance Criteria

- Main workflows meet agreed response-time targets.
- Large tables have indexes for common queries.
- No endpoint returns unbounded datasets.

## Phase 13: Product Completion And Feature Flags

Goal: Avoid launching unfinished or risky functionality.

### Tasks

- Review every dashboard navigation item.
- Classify modules as:
  - Ready
  - Needs hardening
  - Pilot only
  - Hidden
- Add feature flags for:
  - AI agent.
  - Offline.
  - M-Pesa.
  - Public admissions.
  - Predictive analytics.
  - Parent chatbot.
  - Library/transport/inventory if not fully tested.
- Finish or hide incomplete workflows.
- Add empty/error/loading states for key pages.
- Add user-facing validation and recovery paths.

### Acceptance Criteria

- Users only see modules that are ready for their role and school.
- Incomplete features cannot be reached accidentally.
- Feature rollout can be controlled without redeploying.

## Phase 14: Compliance, Privacy, And Data Governance

Goal: Protect minors and sensitive school records.

### Tasks

- Define data retention policy.
- Define parent/student data access policy.
- Define consent requirements:
  - Parent communication.
  - Media/photo storage.
  - AI-generated reports/comments.
  - Special needs data.
- Add export/delete procedures where required.
- Review audit log retention.
- Review AI log retention.
- Add privacy notice and terms for public admission forms and parent portal.
- Restrict special-needs and medical data to approved roles.

### Acceptance Criteria

- Privacy and retention policies are documented.
- Sensitive fields have stricter access controls.
- Consent state is visible and enforceable.

## Phase 15: End-To-End QA And UAT

Goal: Prove real users can complete complete workflows.

### Tasks

- Create UAT scripts for:
  - Super admin.
  - School admin.
  - Principal.
  - Teacher.
  - Class teacher.
  - Bursar/finance user.
  - Parent.
  - Student if supported.
- Test full workflows:
  - School setup.
  - Academic year and term setup.
  - Class setup.
  - Staff creation.
  - Student admission.
  - Attendance.
  - Assessment entry.
  - Report generation and publishing.
  - Fee structure creation.
  - Payment recording.
  - M-Pesa reconciliation.
  - Parent communication.
  - Audit review.
- Log all defects with severity.
- Fix all critical and high defects.
- Get signoff from pilot users.

### Acceptance Criteria

- Every role can complete its core workflows.
- Critical and high UAT defects are closed.
- Pilot users sign off.

## Phase 16: Production Launch Preparation

Goal: Launch with a controlled, reversible process.

### Tasks

- Create production deployment checklist.
- Create rollback checklist.
- Create launch-day monitoring checklist.
- Create admin onboarding guide.
- Create user training materials.
- Create support escalation process.
- Configure production environment variables.
- Run final migration rehearsal.
- Run final smoke tests against staging.
- Schedule launch window.
- Prepare rollback build.

### Acceptance Criteria

- Launch checklist is complete.
- Rollback path is tested.
- Support team knows how to respond.
- Staging matches production configuration as closely as possible.

## Phase 17: Post-Launch Stabilization

Goal: Catch issues early after go-live.

### Tasks

- Monitor logs, errors, payments, and performance daily for the first two weeks.
- Review audit logs for suspicious activity.
- Review failed jobs and webhook errors.
- Collect user feedback.
- Patch critical issues immediately.
- Maintain a known-issues list.
- Hold a post-launch review.

### Acceptance Criteria

- No unresolved critical production incidents.
- Performance remains within target.
- School users can operate without developer intervention.

## Workstream Checklist

Use this as the master progress tracker.

- [ ] CI and build verification.
- [ ] API route access policy.
- [ ] Schema drift fixes.
- [ ] Database migration and RLS review.
- [ ] Service-role audit.
- [ ] Auth/session hardening.
- [ ] Upload/storage hardening.
- [ ] Payment/M-Pesa hardening.
- [ ] AI safety and governance.
- [ ] Offline/PWA decision and implementation.
- [ ] Observability and alerts.
- [ ] Backup and restore.
- [ ] Performance testing.
- [ ] Feature flags and module readiness.
- [ ] Privacy/compliance.
- [ ] End-to-end QA.
- [ ] UAT signoff.
- [ ] Launch checklist.
- [ ] Post-launch monitoring.

## Recommended Execution Order

1. Baseline CI and build.
2. Schema drift and known runtime blockers.
3. API access policy and authorization tests.
4. Database/RLS/migration hardening.
5. Service-role and audit logging.
6. Upload, rate limit, payment, and webhook hardening.
7. AI-agent safety.
8. Offline decision.
9. Observability, backup, and operational runbooks.
10. Performance testing.
11. Feature flags and incomplete-module cleanup.
12. UAT and pilot.
13. Production launch.

## Suggested Milestones

### Milestone 1: Engineering Baseline

All checks pass in CI and the build is reproducible.

### Milestone 2: Security Baseline

All API routes are classified, critical routes are tested, RLS is reviewed, and privileged operations are audited.

### Milestone 3: Operational Baseline

Monitoring, alerts, backups, restore, deployment, and rollback are ready.

### Milestone 4: Pilot Readiness

Feature flags are in place, incomplete modules are hidden, and UAT scripts pass in staging.

### Milestone 5: Production Readiness

Pilot signoff is complete, launch checklist is complete, rollback is tested, and post-launch monitoring is staffed.

