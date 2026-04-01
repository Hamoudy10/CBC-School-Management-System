# Comprehensive Implementation Plan — CBC School Management System

> **Date:** 2026-04-01  
> **Status:** Active  
> **Scope:** All modules, infrastructure, and production-readiness gaps

---

## Executive Summary

After a thorough audit of every `.md` file, the full codebase structure, all API routes, service layers, and documentation, this plan identifies **what exists, what's broken, what's missing, and the priority order for implementation**.

### Current System State

| Area | Status | Notes |
|---|---|---|
| Database Schema | ✅ 95% complete | 30+ tables, RLS policies, triggers. Missing: `special_needs`, `assessment_templates`, `term_locks` tables |
| Auth & RBAC | ✅ Functional | 13 roles, permission matrix, middleware, API guards |
| API Routes | ✅ 95+ endpoints | Most modules have CRUD coverage. Gaps in assessment aggregation, timetable slot-level, exam calendar |
| Dashboard Pages | ✅ 34 pages | All major modules have UI surfaces |
| Service Layer | ✅ Mostly complete | Assessment, finance, staff, timetable services functional |
| PDF Generation | ✅ Working | `@react-pdf/renderer` + HTML fallback pipeline |
| Finance Module | ✅ Operational | Fees, payments, waivers, refunds, approvals, M-Pesa infrastructure |
| Student Lifecycle | ✅ Complete | CRUD, bulk ops, guardians, promotion, transfer |
| Communication | ✅ Functional | Inbox, compose, reply, broadcast, notifications |
| Settings | ✅ Functional | School profile, system config, classes, academic years/terms |
| Reports | ✅ Functional | Report cards, generation, publish/unpublish, export |
| Compliance | ✅ Partial | Discipline CRUD works, audit logs API exists, consent API exists |

### Critical Gaps Identified

1. **Assessment aggregation API endpoints** — 5 endpoints missing (strand-results, area-results, year-results, trends, student detail)
2. **PDF generation Buffer type error** — TypeScript compilation failure in `app/api/reports/[id]/pdf/route.ts`
3. **Timetable slot-level CRUD** — Only collection endpoint exists, missing `[id]` route
4. **Timetable bulk operations** — Service has `copyTimetable`/`deactivateTermSlots` but no API routes
5. **Teacher-specific timetable view** — No dedicated endpoint
6. **Timetable export** — No CSV/PDF export
7. **Exam calendar view** — No calendar-style presentation or export
8. **Staff reactivation** — Deactivation exists, reactivation doesn't
9. **Staff status history** — No tracking of status changes
10. **Audit log management UI** — API exists, no dedicated page
11. **Parent consent management** — Minimal UI, no dedicated workflows
12. **Special needs module** — Only 2 columns on students table, no dedicated table/API/dashboard
13. **M-Pesa configuration** — Full infrastructure exists, zero env vars configured
14. **Duplicate message routes** — `/api/messages/*` and `/api/communication/messages/*` coexist
15. **Schema inconsistencies** — Additional migration tables have different naming conventions, potential FK mismatches

---

## Implementation Phases

### Phase 1: Assessment APIs + PDF Pipeline (Priority: Critical)

**Why first:** Assessment engine is the core of CBC compliance. Without aggregation endpoints, dashboards and reports cannot display meaningful analytics. The PDF pipeline error blocks report card delivery.

| # | Task | Files to Create/Modify | Estimated Effort |
|---|---|---|---|
| 1.1 | Add `GET /api/assessments/strand-results` | New: `app/api/assessments/strand-results/route.ts` | 2 hours |
| 1.2 | Add `GET /api/assessments/area-results` | New: `app/api/assessments/area-results/route.ts` | 2 hours |
| 1.3 | Add `GET /api/assessments/year-results` | New: `app/api/assessments/year-results/route.ts` | 2 hours |
| 1.4 | Add `GET /api/assessments/trends` | New: `app/api/assessments/trends/route.ts` | 2 hours |
| 1.5 | Add `GET /api/assessments/student/[id]` | New: `app/api/assessments/student/[id]/route.ts` | 3 hours |
| 1.6 | Fix PDF generation Buffer type error | Modify: `app/api/reports/[id]/pdf/route.ts` | 30 min |
| 1.7 | Add assessment template CRUD API routes | New: `app/api/assessments/templates/route.ts`, `app/api/assessments/templates/[id]/route.ts`; Implement: `features/assessments/services/assessmentTemplates.service.ts` | 4 hours |
| 1.8 | Add assessment locking / term-close controls | New: `app/api/assessments/term-lock/route.ts`; Migration: `scripts/term_locks_migration.sql` | 3 hours |

**Dependencies:** Existing service layer (`aggregation.service.ts`, `analytics.service.ts`, `assessmentTemplates.service.ts` stubs) already has the logic — just needs API wiring.

---

### Phase 2: Timetable and Exam Operational Tooling (Priority: High)

**Why second:** Timetable is a daily operational tool. Teachers and administrators need slot-level management, bulk operations for term transitions, and export capabilities.

| # | Task | Files to Create/Modify | Estimated Effort |
|---|---|---|---|
| 2.1 | Add timetable slot CRUD (`GET/PATCH/DELETE /api/timetable/[id]`) | New: `app/api/timetable/[id]/route.ts` | 2 hours |
| 2.2 | Add timetable copy/deactivate term endpoints | New: `app/api/timetable/copy/route.ts` | 2 hours |
| 2.3 | Add teacher-specific timetable view | New: `app/api/timetable/teacher/[id]/route.ts` | 1.5 hours |
| 2.4 | Add timetable CSV export | New: `app/api/timetable/export/route.ts` | 1.5 hours |
| 2.5 | Add exam calendar view with filters and export | New: `app/api/exams/calendar/route.ts` | 3 hours |

**Dependencies:** `TimetableService` already has `copyTimetable()`, `deactivateTermSlots()`, `getTeacherTimetable()` — just needs API routes.

---

### Phase 3: Staff Workflow Completeness (Priority: High)

**Why third:** Staff management is foundational. Reactivation is the inverse of existing deactivation, and status history is needed for audit compliance.

| # | Task | Files to Create/Modify | Estimated Effort |
|---|---|---|---|
| 3.1 | Add staff reactivation flow | New: `app/api/staff/[id]/reactivate/route.ts`; Implement: `reactivateStaff()` in `features/staff/services/staff.services.ts` | 2 hours |
| 3.2 | Add staff status history tracking | New: `app/api/staff/[id]/status-history/route.ts`; Migration: `scripts/staff_status_history_migration.sql` with auto-logging trigger | 3 hours |

**Dependencies:** Deactivation logic already exists and can be mirrored for reactivation.

---

### Phase 4: Compliance and Audit Operations (Priority: Medium)

**Why fourth:** Compliance is important but not blocking daily operations. The audit log API exists, just needs a UI. Consent API exists, needs workflow completion.

| # | Task | Files to Create/Modify | Estimated Effort |
|---|---|---|---|
| 4.1 | Add dedicated audit-log management UI page | New: `app/(dashboard)/compliance/audit-logs/page.tsx`; New: `app/api/audit-logs/export/route.ts` | 4 hours |
| 4.2 | Add parent-consent management workflows | New: `app/api/parent-consents/[id]/route.ts` (GET/PUT/DELETE); New: `app/(dashboard)/compliance/consents/page.tsx` | 4 hours |
| 4.3 | Add special needs dedicated table, API, and dashboard | Migration: `scripts/special_needs_migration.sql`; New: `app/api/special-needs/route.ts`, `app/api/special-needs/[id]/route.ts`; New: `features/special-needs/` module; New: `app/(dashboard)/compliance/special-needs/page.tsx` | 8 hours |

**Dependencies:** Special needs requires a new database table. The current `has_special_needs` + `special_needs_details` columns on `students` table are insufficient for the documented spec.

---

### Phase 5: Infrastructure and Production Hardening (Priority: Medium)

**Why last:** These are cross-cutting concerns that should be addressed after functional gaps are closed.

| # | Task | Files to Create/Modify | Estimated Effort |
|---|---|---|---|
| 5.1 | Configure M-Pesa environment variables | Update: `.env` (6 vars); Test: `app/api/mpesa/c2b/*` routes | 1 hour |
| 5.2 | Consolidate duplicate message routes | Deprecate: `app/api/messages/*`; Redirect to `app/api/communication/messages/*` | 2 hours |
| 5.3 | Fix schema inconsistencies | Audit: `sql_creation_script.txt` additional migrations vs original schema; Fix FK reference mismatches | 4 hours |
| 5.4 | Add storage/upload hardening | Implement: signed URL generation, file type validation, size limits in `app/api/upload/route.ts` and `lib/supabase/storage.ts` | 4 hours |
| 5.5 | Add rate limiting configuration | Extend: `lib/api/rateLimit.ts` with per-endpoint config and response headers | 3 hours |
| 5.6 | Add background job support for report generation | New: `lib/jobs/queue.ts` or integrate with external service (e.g., Upstash Qstash) | 6 hours |
| 5.7 | Add testing suite | New: `__tests__/` directory with unit tests for service layer, integration tests for API routes, Playwright E2E for critical flows | 16 hours |
| 5.8 | Add observability | Integrate: Sentry or equivalent for error tracking; structured logging middleware | 4 hours |

---

## Quick Wins (Can Be Done in 1-2 Days Each)

These are high-value, low-effort items that should be prioritized:

1. **Fix PDF Buffer type error** — 30 min, unblocks report card delivery
2. **Staff reactivation** — 2 hours, inverse of existing deactivation
3. **Timetable slot CRUD** — 2 hours, service layer already complete
4. **Timetable export** — 1.5 hours, straightforward CSV generation
5. **Audit log export** — 1 hour, API exists, just needs CSV endpoint
6. **Parent consent CRUD** — 2 hours, extends existing `/api/parent-consents`
7. **Exam calendar endpoint** — 3 hours, reuses existing exam data

---

## What's NOT Recommended Right Now

- **Mobile app adaptation** — Core system needs production hardening first
- **Multi-school deployment** — Single-school RLS needs verification first
- **Phone OTP login** — Email/password is sufficient for v1
- **Advanced analytics/ML** — Basic trend calculations are enough for now
- **Real-time Supabase subscriptions** — Nice-to-have, not blocking

---

## File-by-File Implementation Tracker

### Phase 1: Assessment APIs + PDF Pipeline

- [ ] `app/api/assessments/strand-results/route.ts` — GET strand-level aggregation
- [ ] `app/api/assessments/area-results/route.ts` — GET learning area aggregation
- [ ] `app/api/assessments/year-results/route.ts` — GET yearly aggregated results
- [ ] `app/api/assessments/trends/route.ts` — GET performance trends
- [ ] `app/api/assessments/student/[id]/route.ts` — GET student-specific assessments
- [ ] `app/api/reports/[id]/pdf/route.ts` — Fix Buffer type error (line 312)
- [ ] `features/assessments/services/assessmentTemplates.service.ts` — Implement stubs
- [ ] `app/api/assessments/templates/route.ts` — GET/POST templates
- [ ] `app/api/assessments/templates/[id]/route.ts` — GET/PUT/DELETE template
- [ ] `app/api/assessments/term-lock/route.ts` — GET/POST term lock
- [ ] `scripts/term_locks_migration.sql` — Database migration

### Phase 2: Timetable and Exam Operational Tooling

- [ ] `app/api/timetable/[id]/route.ts` — GET/PATCH/DELETE slot
- [ ] `app/api/timetable/copy/route.ts` — POST copy / DELETE deactivate-term
- [ ] `app/api/timetable/teacher/[id]/route.ts` — GET teacher timetable
- [ ] `app/api/timetable/export/route.ts` — GET CSV export
- [ ] `app/api/exams/calendar/route.ts` — GET calendar view + CSV export

### Phase 3: Staff Workflow Completeness

- [ ] `app/api/staff/[id]/reactivate/route.ts` — POST reactivate
- [ ] `features/staff/services/staff.services.ts` — Add `reactivateStaff()`
- [ ] `app/api/staff/[id]/status-history/route.ts` — GET status history
- [ ] `scripts/staff_status_history_migration.sql` — Table + trigger migration

### Phase 4: Compliance and Audit Operations

- [ ] `app/(dashboard)/compliance/audit-logs/page.tsx` — Audit log management UI
- [ ] `app/api/audit-logs/export/route.ts` — CSV export
- [ ] `app/api/parent-consents/[id]/route.ts` — GET/PUT/DELETE consent
- [ ] `app/(dashboard)/compliance/consents/page.tsx` — Consent management UI
- [ ] `scripts/special_needs_migration.sql` — Dedicated table migration
- [ ] `app/api/special-needs/route.ts` — GET/POST special needs
- [ ] `app/api/special-needs/[id]/route.ts` — GET/PUT/DELETE special need
- [ ] `features/special-needs/` — Feature module (services, types, validators)
- [ ] `app/(dashboard)/compliance/special-needs/page.tsx` — Special needs dashboard

### Phase 5: Infrastructure and Production Hardening

- [ ] `.env` — Configure M-Pesa variables (6 vars)
- [ ] `app/api/messages/*` — Deprecate or redirect to communication routes
- [ ] `sql_creation_script.txt` — Audit and fix FK reference mismatches
- [ ] `app/api/upload/route.ts` — Add file type validation, size limits
- [ ] `lib/supabase/storage.ts` — Implement signed URL generation
- [ ] `lib/api/rateLimit.ts` — Add per-endpoint configuration
- [ ] `lib/jobs/queue.ts` — Background job queue for report generation
- [ ] `__tests__/` — Unit tests, integration tests, E2E tests
- [ ] Sentry integration — Error tracking and monitoring

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| RLS policy gaps allowing cross-school data access | Critical | Medium | Audit all RLS policies before deployment |
| Assessment aggregation performance with 1000+ students | High | Medium | Add database indexes, consider precomputed aggregates |
| PDF generation timeout for large report batches | Medium | High | Implement background job queue (Phase 5) |
| M-Pesa callback failures in production | High | Medium | Implement retry logic and manual reconciliation UI |
| Schema migration conflicts in production | Critical | Low | Test migrations on staging first, use `IF NOT EXISTS` |

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|---|---|---|
| Phase 1 | 2-3 days | None |
| Phase 2 | 1-2 days | None |
| Phase 3 | 1 day | None |
| Phase 4 | 3-4 days | Phase 1 (assessment integration with special needs) |
| Phase 5 | 5-7 days | All previous phases |
| **Total** | **~12-17 working days** | |

---

## Success Criteria

The system is production-ready when:

1. ✅ All assessment aggregation endpoints return correct data
2. ✅ PDF generation works without TypeScript errors
3. ✅ Timetable has full CRUD + export + bulk operations
4. ✅ Staff can be reactivated with full status history
5. ✅ Audit logs are viewable and exportable
6. ✅ Parent consent workflows are complete
7. ✅ Special needs have dedicated table, API, and dashboard
8. ✅ M-Pesa is configured and tested end-to-end
9. ✅ No duplicate API routes remain
10. ✅ All TypeScript compilation passes with zero errors
11. ✅ RLS policies are verified for all sensitive tables
12. ✅ Test coverage >= 70% for service layer
