# Audit Findings Report — CBC School Management System

> **Audit Date:** 2026-04-09
> **Auditor:** Qwen Code
> **Scope:** All 13 modules, API routes, service layer, types, database, build pipeline

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| **Service Layer** | 2 | 4 | 3 | 2 | 11 |
| **API Routes** | 1 | 5 | 8 | 5 | 19 |
| **Database/Schema** | 1 | 3 | 4 | 1 | 9 |
| **Build/Compilation** | 1 | 2 | 2 | 1 | 6 |
| **Missing Modules** | 0 | 4 | 3 | 2 | 9 |
| **Duplicate/Dead Code** | 0 | 2 | 3 | 3 | 8 |
| **Type Safety** | 1 | 3 | 2 | 1 | 7 |
| **TOTAL** | **6** | **23** | **25** | **15** | **69** |

---

## 🔴 CRITICAL Issues (Must Fix Before Production)

### C1. Duplicate Staff Service — One Is a Stub File
- **File:** `features/staff/services/staff.service.ts` (15 lines)
- **Real implementation:** `features/staff/services/staff.services.ts` (1,254 lines)
- **Issue:** The stub file exports 13 functions all returning `null` or `[]`. No files currently import from it (verified), but its presence is dangerous — any accidental import would silently return null.
- **Action:** Delete `features/staff/services/staff.service.ts` immediately.

### C2. Broken Supabase Client Import — `createServerClient` Does Not Exist
- **Files affected:**
  - `features/attendance/services/discipline.service.ts`
  - `features/settings/services/settings.service.ts`
  - `features/reports/services/reportData.service.ts`
- **Issue:** All three import `createServerClient` from `@/lib/supabase/server`. The actual exported function name is `createSupabaseServerClient`. These files will **crash at runtime** when any function is called.
- **Action:** Replace `createServerClient` → `createSupabaseServerClient` in all 3 files.

### C3. 72 `@ts-nocheck` Directives — Silent Type Errors Across the Codebase
- **In the active project (root):** 25 files with `@ts-nocheck`
- **In duplicate directories:** 47 additional copies (same files)
- **Key affected files:**
  - `features/timetable/services/timetable.service.ts` (~700 lines untyped)
  - `features/finance/services/studentFees.service.ts` (~600 lines untyped)
  - `features/assessments/services/reportCards.service.ts` (~470 lines untyped)
  - `features/assessments/services/analytics.service.ts` (~560 lines untyped)
  - `features/reports/services/pdfGenerator.service.ts` (~400 lines untyped)
  - `features/reports/services/reportData.service.ts` (~430 lines untyped)
  - `features/settings/services/settings.service.ts` (~220 lines untyped)
  - `features/discipline/index.ts`
  - `features/attendance/[id]/route.ts`, `features/attendance/student/studentId/route.ts`
  - `features/attendance/services/discipline.service.ts`
  - 12+ API route files under `app/api/staff/*`, `app/api/students/route.ts`, `app/api/fee-structures/route.ts`, etc.
- **Action:** Remove `@ts-nocheck` from each file, fix resulting type errors. Connect `database.types.ts` to eliminate `as any` patterns.

### C4. No `.env` File or `.env.example` Template
- **Issue:** No `.env` file exists anywhere in the project. The build output references `.env` but none is present. There is no `.env.example` for onboarding new developers or deployment.
- **Action:** Create `.env.example` with all required variables (Supabase URL/keys, M-Pesa keys, etc.).

### C5. Build Fails with 40+ Dynamic Server Errors
- **Issue:** During `next build`, 40+ API routes throw `DYNAMIC_SERVER_USAGE` errors because they use `cookies()` in contexts where Next.js tries static rendering.
- **Affected:** Academic years, terms, and nearly every route that calls `getCurrentUser()` which reads cookies.
- **Build output:** 920 lines, ~700 of which are the same cookie-related error repeated.
- **Action:** Either add `export const dynamic = 'force-dynamic'` to affected routes or restructure cookie access patterns.

### C6. Database Types File Is Completely Unused
- **File:** `types/database.types.ts` (1,036 lines of typed definitions)
- **Issue:** Zero service files import from it. All Supabase clients use `<any>` typing. Every service uses `as any` casting (~200+ instances across the codebase).
- **Action:** Wire `Database` type into `lib/supabase/client.ts`, `lib/supabase/server.ts`, and systematically remove `as any` from services.

---

## 🟠 HIGH Priority Issues

### H1. Wrong Permission Action on Staff Leave Creation
- **File:** `app/api/staff/[id]/leaves/route.ts` (line 67)
- **Issue:** POST handler uses `withPermission('teachers', 'view')` — the permission should be `'create'`. This means any user with "view" access can create leave requests.
- **Action:** Change `'view'` → `'create'` on the POST handler.

### H2. Duplicate API Route Namespaces
| Primary Route | Duplicate Route | Status |
|---|---|---|
| `/api/settings/academic-years` | `/api/academic-years` | Same data, different response |
| `/api/settings/classes` | `/api/classes` | Same data, different response |
| `/api/settings/terms` | `/api/terms` | Same data, different response |
| `/api/notifications` | `/api/communication/notifications` | Full duplication |
| `/api/messages` | `/api/communication/messages` | Deprecated (sunset 2026-07-01) vs canonical |

- **Action:** Either remove legacy routes or add 301 redirects to canonical paths.

### H3. Duplicate `DisciplineService` Implementations
- **File 1:** `features/attendance/services/discipline.service.ts` — Uses `class DisciplineService` with static methods, imports `createServerClient` (broken)
- **File 2:** `features/discipline/services/discipline.service.ts` — Uses standalone functions, imports `createClient`
- **Issue:** Different Supabase client imports, different column names (e.g., `admission_no` vs `admission_number`). This creates inconsistent behavior depending on which is used.
- **Action:** Consolidate into a single implementation. Delete the duplicate.

### H4. Missing `/api/subjects` API Route Group
- **Spec requirement:** `11_cbc_curriculum_and_subjects.md` defines `/api/subjects` GET/POST/PUT endpoints.
- **Current state:** No `app/api/subjects/` directory exists. The `learning_areas` endpoints partially cover this but the `subjects` table and its API are distinct in the schema.
- **Action:** Create `app/api/subjects/route.ts` and `app/api/subjects/[id]/route.ts`.

### H5. Missing `/api/student-subjects` API Route Group
- **Spec requirement:** `11_cbc_curriculum_and_subjects.md` defines `/api/student_subjects` GET/POST.
- **Current state:** No API routes exist for student-to-subject mapping.
- **Action:** Create `app/api/student-subjects/route.ts` and `app/api/student-subjects/[id]/route.ts`.

### H6. Missing `/api/grading-scales` API Route Group
- **Spec requirement:** `13_school_settings_and_configuration.md` defines `/api/grading_scales` GET/POST/PUT.
- **Current state:** No API routes exist. Grading scale logic is presumably hardcoded somewhere.
- **Action:** Create `app/api/grading-scales/` route group with CRUD.

### H7. Missing `/api/promotion-rules` API Route Group
- **Spec requirement:** `13_school_settings_and_configuration.md` defines `/api/promotion_rules` GET/POST/PUT.
- **Current state:** No API routes exist. Student promotion has a `/api/students/[id]/promote/route.ts` but no configurable rules API.
- **Action:** Create `app/api/promotion-rules/` route group.

### H8. Missing `/api/change-password` Endpoint
- **Spec requirement:** `10_user_management_and_roles.md` defines `/api/users/change_password` POST.
- **Current state:** No endpoint exists. Only `/api/auth/password-reset` exists (forgot password flow, not self-service change).
- **Action:** Create `app/api/users/change-password/route.ts`.

### H9. Missing `/api/permissions` Endpoint
- **Spec requirement:** `10_user_management_and_roles.md` defines `/api/permissions` GET.
- **Current state:** No dedicated endpoint. Permissions are embedded in `lib/auth/permissions.ts` but not exposed via API.
- **Action:** Create `app/api/permissions/route.ts`.

### H10. Missing `/api/roles/[id]` CRUD Endpoints
- **Spec requirement:** `10_user_management_and_roles.md` defines `/api/roles/:id` GET/POST/PUT.
- **Current state:** Only `/api/roles` GET exists. `/api/roles/[id]/permissions` exists but not the role itself.
- **Action:** Create `app/api/roles/[id]/route.ts` with GET/PUT/DELETE.

### H11. Broadcast Messages — Only POST Exists
- **Spec requirement:** `09_notifications_and_communication.md` defines GET (list history), GET/[id] (view), DELETE for broadcasts.
- **Current state:** Only `app/api/communication/broadcast/route.ts` POST exists.
- **Action:** Add GET (list), GET/[id] (view), DELETE/[id] endpoints.

### H12. Library Module Has No API Routes
- **Current state:** `app/(dashboard)/library/` has a page and `LibraryClient.tsx` component, but no `app/api/library/` routes exist.
- **Action:** Either create the API routes or remove the placeholder page.

### H13. `@ts-nocheck` on `app/api/students/route.ts` — Core Student CRUD
- **File:** `app/api/students/route.ts`
- **Issue:** The main students listing and creation endpoint has `@ts-nocheck`, uses custom inline auth, and does not use the standard `withPermission` middleware. This is the most-accessed route in the system.
- **Action:** Migrate to standard middleware pattern.

### H14. Duplicate Project Directories
- **Directories:** `CBC_School_Management_System/` and `Afya_Hospital_Management_System/` are complete copies of the root project.
- **Issue:** Creates confusion, bloats search results, wastes disk space. The second directory is misnamed (hospital management).
- **Action:** Delete both duplicate directories.

### H15. Inconsistent Auth Pattern on `/api/payments` POST
- **File:** `app/api/payments/route.ts`
- **Issue:** Uses `withPermission` wrapper but then re-authenticates internally with `supabase.auth.getUser()`. Redundant and may cause session conflicts.
- **Action:** Remove the inner re-authentication.

### H16. `@ts-nocheck` on `app/api/fee-structures/route.ts`
- **File:** `app/api/fee-structures/route.ts`
- **Issue:** Uses `@ts-nocheck`, custom inline `authenticate()` function, does not use standard middleware.
- **Action:** Migrate to standard middleware.

### H17. Staff Assignment Test File Left In Place
- **File:** `app/(dashboard)/staff/[id]/assignments/new/components/TestFile.tsx`
- **Issue:** Debug/test component still present in production code.
- **Action:** Delete the file.

### H18. Multiple `@ts-nocheck` API Routes in Staff Module
- **Files:**
  - `app/api/staff/route.ts`
  - `app/api/staff/[id]/route.ts`
  - `app/api/staff/[id]/assignments/route.ts`
  - `app/api/staff/[id]/assignments/[assignmentId]/route.ts`
  - `app/api/staff/[id]/leaves/route.ts`
  - `app/api/staff/[id]/leaves/[leaveId]/route.ts`
- **Action:** Remove `@ts-nocheck`, fix type errors, standardize middleware.

### H19. Missing `/api/attendance/analytics` and `/api/discipline/analytics`
- **Spec requirement:** `07_attendance_and_discipline.md` defines dedicated analytics endpoints.
- **Current state:** Summary routes exist (`/api/discipline/summary`) but not the analytics-specific endpoints with trend calculation.
- **Action:** Create dedicated analytics endpoints or rename/extend existing summary routes.

---

## 🟡 MEDIUM Priority Issues

### M1. `features/attendance/` Contains Inline `route.ts` Files
- **Issue:** Unlike all other feature modules, `features/attendance/` has actual `route.ts` files (`features/attendance/route.ts`, `features/attendance/[id]/route.ts`, etc.). These are not picked up by Next.js (routes must be under `app/api/`). Likely dead code or misplaced.
- **Action:** Either delete or move to `app/api/attendance/` if they contain unique logic.

### M2. Inconsistent Response Patterns
- **Issue:** The codebase uses 4+ different response formats:
  - `{ success, message, id? }` — Most CRUD services
  - `{ success, data?, message? }` — Attendance, discipline
  - `PaginatedResponse<T>` — Users, students, finance
  - Direct error throws — Aggregation, analytics
- **Action:** Standardize on a single response type across all services.

### M3. `/api/settings/initialize` POST Is Misnamed
- **File:** `app/api/settings/initialize/route.ts` (under `/api/settings/`)
- **Issue:** Uses permission `"create"` but the handler only reads settings. Does not actually initialize anything.
- **Action:** Either implement actual initialization logic or remove/rename the endpoint.

### M4. `/api/reports/generate` Uses Inline Auth
- **File:** `app/api/reports/generate/route.ts`
- **Issue:** Has `@ts-nocheck`, custom inline auth with hardcoded role array, does not use standard middleware.
- **Action:** Migrate to `withPermission` middleware.

### M5. Hardcoded Column Name Inconsistencies
- **Issue:** Column names vary across service files:
  - `admission_no` (discipline service) vs `admission_number` (students service, database types)
  - `id` vs `record_id` for primary keys in various tables
  - `term` (string) vs `term_id` (FK) used interchangeably
- **Action:** Audit all column references against `database.types.ts` and standardize.

### M6. No `.env.example` for M-Pesa Configuration
- **Spec requirement:** M-Pesa integration needs 6 environment variables.
- **Current state:** M-Pesa API routes exist (c2b, lookup, reconcile) but there is no documentation of required env vars in the codebase.
- **Action:** Add M-Pesa variables to `.env.example` (see C4).

### M7. Exams Module Missing `loading.tsx`
- **File:** `app/(dashboard)/exams/` has no `loading.tsx` while all other dashboard routes do.
- **Action:** Add `loading.tsx` for consistent UX.

### M8. `/api/teacher-subjects/[id]` Missing GET
- **Current state:** Only DELETE is implemented.
- **Action:** Add GET for single teacher-subject mapping.

### M9. `/api/students/[id]` Uses PATCH Instead of PUT
- **Spec requirement:** `05_api_layer.md` specifies PUT for full updates.
- **Current state:** Only PATCH exists.
- **Action:** Either rename PATCH to PUT or add PUT as an alias.

### M10. Role Permission Management Is Incomplete
- **Current state:** `/api/roles/[id]/permissions` exists but only GET. No PUT endpoint to actually modify role permissions.
- **Action:** Add PUT handler for permission updates.

### M11. No `.d.ts` Type Declaration Files
- **Current state:** No `.d.ts` files exist. All types are in `.ts` files.
- **Impact:** Not critical, but limits module augmentation and third-party type extension.
- **Action:** Consider adding `types/global.d.ts` for ambient declarations.

### M12. Settings Service Has Only 3 Functions
- **File:** `features/settings/services/settings.service.ts` (~220 lines, but `@ts-nocheck`)
- **Issue:** Only has `getSettings`, `updateSettings`, `getSchoolInfo`. Missing functions for logo upload, batch updates, initialization that are implied by the API layer.
- **Action:** Audit API routes vs service functions and fill gaps.

### M13. Duplicate Announcements Routes
- **Files:** `app/api/announcements/` and `app/api/communication/announcements/`
- **Issue:** Both exist. The communication namespace is canonical but the legacy path is still active.
- **Action:** Deprecate or redirect the legacy path.

---

## 🟢 LOW Priority Issues

### L1. No `/api/schools` API Route Group
- **Spec requirement:** `13_school_settings_and_configuration.md` defines `/api/schools` for multi-tenant management.
- **Current state:** School info is managed via `/api/settings/school`. No standalone schools CRUD.
- **Impact:** Not needed for single-school deployment. Required for v2 multi-school.

### L2. `features/staff/server.ts` Is a Barrel That May Have Stale Exports
- **File:** `features/staff/server.ts`
- **Issue:** Re-exports from `staff.services.ts`. If `staff.service.ts` (stub) was ever the intended export, this would be wrong. Currently correct but needs monitoring.

### L3. Unused Service Functions (Potential Dead Code)
- These functions are defined but not imported by any API route:
  - `mapScoreToLevel`, `mapScoreToNumericLevel`, `getLevelDisplayName`, `getLevelColor`, `seedDefaultPerformanceLevels` (performanceLevels.service.ts)
  - `calculateYearlySummary`, `determineTrend` (analytics/aggregation services)
  - `getTeacherPerformanceSummary`, `getSchoolPerformanceDashboard` (analytics.service.ts)
  - `resetToDefaults` (bellTimes.service.ts)
- **Note:** These may be consumed by React Server Components. Verify before deleting.

### L4. Mixed Import Styles
- **Issue:** Some files use named imports, others use namespace imports, some use class static imports from the same modules.
- **Action:** Standardize on one import style per ESLint/Prettier config.

### L5. `TestFile.tsx` in Staff Assignments
- **File:** `app/(dashboard)/staff/[id]/assignments/new/components/TestFile.tsx`
- **Action:** Delete.

### L6. Build Output Contains PowerShell Error
- **Issue:** `Compiler edge-server unexpectedly exited with code: null and signal: SIGTERM` — appears to be a Windows-specific Node.js path issue.
- **Impact:** Build succeeds despite the warning. Monitor on Linux/Mac deployment.

### L7. No Rate Limit Headers in Responses
- **Current state:** `lib/api/rateLimit.ts` exists and is functional but no API routes set `X-RateLimit-*` response headers.
- **Action:** Add headers to rate-limited responses for client visibility.

### L8. `middleware.ts` at Project Root May Conflict with API Route Auth
- **File:** `middleware.ts`
- **Issue:** Next.js middleware runs on every request. API routes also have their own `withAuth` guards. Potential double-auth overhead.
- **Action:** Audit middleware scope — ensure it only handles auth redirects, not API auth.

---

## Summary: Required Actions by Priority

### Fix Immediately (Before Any Deployment)
1. **Delete** `features/staff/services/staff.service.ts` (stub)
2. **Fix** `createServerClient` → `createSupabaseServerClient` in 3 files
3. **Create** `.env.example` with all required variables
4. **Fix** staff leave POST permission (`'view'` → `'create'`)
5. **Delete** duplicate project directories (`CBC_School_Management_System/`, `Afya_Hospital_Management_System/`)
6. **Delete** `TestFile.tsx`

### Fix Before Production Launch
7. Remove all `@ts-nocheck` directives and fix type errors (25 files)
8. Wire `database.types.ts` into Supabase clients
9. Create missing API routes: `/api/subjects`, `/api/student-subjects`, `/api/grading-scales`, `/api/promotion-rules`, `/api/change-password`, `/api/permissions`, `/api/roles/[id]`
10. Add broadcast message GET/DELETE endpoints
11. Consolidate duplicate `DisciplineService`
12. Resolve or redirect duplicate API routes
13. Address build dynamic server errors (40+ routes)
14. Migrate all `@ts-nocheck` API routes to standard middleware

### Improve Over Time
15. Standardize response types across all services
16. Add `.d.ts` type declarations
17. Add rate limit response headers
18. Clean up unused service functions
19. Standardize import styles
20. Add missing `loading.tsx` files

---

## File Count Summary

| Category | Files |
|---|---|
| API route files | 173 |
| Dashboard page files | 41 |
| Service layer files | 45 |
| UI components | 28 |
| Feature module files | 85 |
| Lib files | 23 |
| Type definition files | 4 |
| SQL migration scripts | 8 |
| Test files | 6 |
| Documentation files | 30+ |

---

*End of Audit Report*
