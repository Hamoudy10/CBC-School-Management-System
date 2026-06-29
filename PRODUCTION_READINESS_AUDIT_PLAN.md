# Production Readiness Audit Plan

Audit date: 2026-06-29  
Project: CBC School Management System  
Audit mode: Codebase review, configuration review, selected service/API inspection, and local verification commands. No product code was changed.

## Executive Verdict

This project is feature-rich and has the shape of a serious school management platform: students, staff, attendance, assessments, finance, reports, communication, timetable, AI tooling, admissions, library, transport, offline support, and M-Pesa are all represented. The architecture is mostly modular, and the test suite currently passes.

However, it is not production-ready yet. I would rate it about 55-65% production-ready for a controlled pilot, and not ready for broad live school deployment with real student, parent, finance, and staff data.

The main blockers are not missing screens. The blockers are production hardening: inconsistent API protection patterns, unproven build/type/lint pipeline, database drift in AI-agent tools, public storage/file concerns, weak deployment/runtime guarantees, and several features that look implemented but are still prototype-level.

## Verification Results

- `npm.cmd test -- --runInBand`: Passed. 12 suites, 174 tests.
- `npm.cmd run type-check`: Failed before checking code because TypeScript could not write `tsconfig.tsbuildinfo` due to `EPERM`.
- `npx.cmd tsc --noEmit --incremental false`: Timed out in this environment.
- `npm.cmd run lint`: Failed before linting code because Next could not write `.next/cache/eslint/...` due to `EPERM`.
- `npx.cmd next lint --no-cache`: Timed out in this environment.
- `npx.cmd next build --no-lint`: Timed out after starting the Next build. Build success is currently unproven.
- `node scripts/check-schema-drift.mjs`: Failed with 3 schema drift issues in `features/ai-agent/services/tool-registry.service.ts`.

## Strengths

- Broad module coverage across core school operations.
- Good use of feature folders, validators, service layers, and API route grouping.
- Central auth wrappers exist: `withAuth`, `withPermission`, and `withRoles`.
- Zod validation is used in many important write paths.
- Tests are present and currently green.
- Local `.env` and `.env.local` are not tracked by git; only `.env.example` is tracked.
- Many previous audit findings appear to have been addressed, including removal of `@ts-nocheck`.

## Critical Production Blockers

### 1. Build, lint, and type-check are not proven green

The test suite passes, but production readiness requires a repeatable green CI pipeline. In this environment, type-check, lint, and build could not be confirmed.

Required upgrade:
- Make `npm run type-check`, `npm run lint`, and `npm run build` reliably pass on a clean machine and CI.
- Stop disabling lint during builds in `next.config.mjs`.
- Add CI that runs install, type-check, lint, test, schema drift check, and build.

### 2. API authorization is inconsistent

Many routes use `withAuth` or `withPermission`, but several routes use direct exported handlers, redirects, public handlers, or custom inline auth. Some of this is intentional, such as login, password reset, webhooks, and deprecated redirects. The problem is that there is no enforced route policy map proving which endpoints are public, authenticated, permissioned, webhook-only, or deprecated.

Examples:
- `app/api/settings/school/route.ts` uses manual auth for `GET`, but `withPermission` for `PUT`.
- `app/api/attendance/import/route.ts` has a custom role list rather than the standard permission system.
- `app/api/admin/ai-logs/route.ts` uses only `withAuth`, even though AI logs are admin/audit data.
- Deprecated routes such as `/api/classes`, `/api/terms`, and `/api/announcements` remain active as redirects.

Required upgrade:
- Create an API route inventory and classify every endpoint.
- Convert non-public business endpoints to standard wrappers.
- Require explicit comments/tests for public webhooks and public application forms.
- Add automated tests for unauthorized, wrong-role, cross-school, and happy-path access.

### 3. AI-agent database tools have schema drift

The schema drift checker flags:
- `timetable_entries` should use `timetable_slots`.
- `user_roles` needs verification and appears inconsistent with the current users/roles model.
- `fee_waivers` should use `fee_exemptions`.

These are especially risky because AI-agent tools include high-impact write actions such as changing roles, waiving fees, publishing reports, recording payments, and changing active terms.

Required upgrade:
- Fix AI-agent tool table names and payloads.
- Add integration-style tests for every AI-agent write tool using mocked Supabase.
- Add mandatory audit logs for every AI-agent write.
- Add confirmation, idempotency, and rollback strategy for high-risk actions.

### 4. Offline-first support is not production complete

The service worker references `/offline.html` and `/manifest.json`, but those files are missing from `public`. The offline sync engine imports server-side Supabase code while being described as app-start/offline client logic. It also allows dynamic table names in sync operations, which needs a strict allowlist and conflict rules.

Required upgrade:
- Add real PWA assets or remove the advertised offline feature until complete.
- Split client offline sync from server-only code.
- Add table allowlists, per-record ownership checks, conflict resolution, and sync audit logs.
- Test offline attendance and reconnect sync end to end.

### 5. File upload and storage need hardening

Uploads validate extension-derived MIME type but not file signatures. SVG is allowed for images/logos, which can be dangerous if served publicly. Supabase storage bucket creation uses `public: true`, while uploads also generate signed URLs, creating mixed security semantics.

Required upgrade:
- Decide public vs private storage by file category.
- Make sensitive documents private by default.
- Remove SVG upload support or sanitize SVG strictly.
- Verify file signatures, not just extension.
- Add malware scanning or quarantine workflow for production.

## High Priority Faults And Risks

### 6. Rate limiting is in-memory

The rate limiter uses a process-local `Map`. This will not work reliably across serverless instances, restarts, or multiple nodes. Login, password reset, AI, upload, and public forms need durable rate limiting.

Required upgrade:
- Move rate limiting to Redis, Upstash, Supabase table with TTL, or platform-native WAF/rate limits.
- Add per-user and per-IP policies.
- Add webhook-specific replay protection.

### 7. M-Pesa webhook origin validation is thin

M-Pesa C2B validation/confirmation endpoints use admin Supabase and are public by necessity. Origin checks only run in production and need stronger verification, idempotency, replay protection, and reconciliation controls.

Required upgrade:
- Verify expected shortcode, transaction uniqueness, amount constraints, and replay windows.
- Store raw payloads safely and idempotently.
- Add reconciliation dashboards and alerts for manual review.

### 8. Supabase clients are typed as `any`

`types/database.types.ts` exists, but Supabase clients use `createServerClient<any>` and `createBrowserClient<any>`. This weakens the value of TypeScript across a large schema-heavy codebase.

Required upgrade:
- Wire the generated `Database` type into browser, server, middleware, and admin clients.
- Reduce `as any` in service layers over time, starting with finance, students, assessments, and reports.

### 9. Service-role usage needs policy boundaries

Admin/service-role clients are used in user creation, storage, finance exceptions/payments, and M-Pesa. This can be valid, but production needs a documented policy for when RLS bypass is allowed.

Required upgrade:
- Create a service-role usage register.
- Require permission checks before each service-role operation.
- Add audit logs to all privileged operations.
- Prefer user-session clients where RLS should enforce school boundaries.

### 10. Admission application assigns the first school

The public admission submission flow selects `schools.limit(1).single()`. This is fragile in multi-school or SaaS contexts.

Required upgrade:
- Require school slug/code/subdomain or configured public school context.
- Add anti-spam, duplicate detection, and parent contact verification.

## Product And Feature Gaps

### Must-have before broad production

- CI/CD with green build, lint, type-check, tests, schema drift check, and migration checks.
- Database migration strategy with versioning, rollback notes, and environment promotion.
- Observability: structured logs, request IDs, error tracking, performance metrics, and alerting.
- Backup and restore plan for Supabase data and storage.
- Role/permission matrix review with school-admin signoff.
- Data privacy controls for minors: consent, retention, export, deletion, and access logs.
- End-to-end smoke tests for login, students, attendance, assessment, finance, reports, and communication.
- Seed/demo data separated from production data.

### Recommended new features

- Admin health dashboard showing database status, failed jobs, AI usage, storage usage, M-Pesa reconciliation, sync queue health, and recent errors.
- Global audit trail viewer with filters by user, module, student, date, and action.
- Data import review workflow with preview, validation errors, rollback, and duplicate handling.
- Parent consent center for communication, media, AI-generated content, and special-needs records.
- Notification delivery status tracking for SMS/email/in-app messages.
- Finance reconciliation workflow with exceptions, approvals, and locked accounting periods.
- Report-card approval workflow before publishing to parents.
- Disaster recovery tools: export all school data, restore rehearsal checklist, and backup verification.
- Feature flags for AI tools, offline mode, M-Pesa, and public admissions.
- School onboarding wizard for academic years, terms, classes, grading scales, fee structures, roles, and staff.

## Production Readiness Plan

### Phase 0: Freeze And Baseline

Goal: Stop adding features until the platform can be verified.

- Create a branch for production hardening.
- Add CI pipeline.
- Confirm clean install on a fresh clone.
- Run and record: type-check, lint, tests, schema drift, build.
- Create an endpoint inventory from `app/api`.
- Mark intentional public endpoints.

Exit criteria:
- CI exists and reports all checks.
- Every failed check has an owner and ticket.

### Phase 1: Fix Release Blockers

Goal: Make the code deployable with confidence.

- Fix schema drift in AI-agent tools.
- Prove `next build` passes.
- Re-enable lint enforcement during build.
- Fix any type-check and lint failures.
- Add missing PWA assets or disable offline claims.
- Create route policy tests for sensitive endpoints.

Exit criteria:
- Build, lint, type-check, tests, schema drift all pass.
- No unclassified business API endpoints remain.

### Phase 2: Security And Data Protection

Goal: Protect student, parent, staff, and finance data.

- Harden file upload and storage privacy.
- Replace in-memory rate limiting.
- Audit service-role usage.
- Strengthen M-Pesa webhook verification and replay protection.
- Review AI-agent write permissions, confirmations, and logs.
- Add CSP and security headers beyond the current baseline.

Exit criteria:
- Security checklist signed off.
- Sensitive routes have authorization tests.
- Privileged operations produce audit logs.

### Phase 3: Operational Readiness

Goal: Make the system supportable after launch.

- Add structured logging and error tracking.
- Add health checks and admin monitoring dashboard.
- Add backup/restore runbook.
- Add migration runbook.
- Add performance checks for dashboard, students, finance, reports, and AI endpoints.
- Add smoke tests for the production deployment.

Exit criteria:
- Operations team can detect, diagnose, and recover from common failures.
- Restore process has been tested at least once.

### Phase 4: Product Polish And Pilot

Goal: Launch safely with a limited school/pilot group.

- Run a UAT script for each role: super admin, school admin, principal, teacher, bursar, parent, student.
- Verify real workflows: admissions, student creation, attendance, marks, fees, payments, reports, messaging.
- Add feature flags for risky modules.
- Disable or hide incomplete modules until ready.
- Collect pilot feedback and bug reports.

Exit criteria:
- Pilot school can complete one full academic workflow without developer intervention.
- Known critical/high defects are closed or explicitly accepted.

## Suggested Priority Order

1. Make CI green: type-check, lint, tests, schema drift, build.
2. Fix AI-agent schema drift and add tests around high-risk tools.
3. Inventory and standardize API authorization.
4. Harden uploads/storage and rate limiting.
5. Decide whether offline mode is production scope or hidden until complete.
6. Strengthen M-Pesa and finance reconciliation.
7. Add observability, backups, and deployment runbooks.
8. Run role-based UAT and pilot.

## Final Readiness Assessment

Current state: Not production-ready for real school operations at full scale.  
Best use today: internal demo, controlled development testing, or a tightly supervised pilot with non-critical data.  
Production target: achievable after a focused hardening cycle, especially because the project already has substantial module coverage and a passing test suite.

