# Progress Summary

## Scope Completed

### 1. `lib/auth` + auth chain stability
- Fixed `lib/auth/api-guard.ts` import issue and resolved profile typing failures.
- Re-exported `ROLE_HIERARCHY` from `lib/auth/permissions.ts` for compatibility.
- Added `lockedUntil?: string | null` to `types/auth.ts`.
- Stabilized auth/middleware/service type flow:
  - `middleware.ts`
  - `services/auth.server.service.ts`
  - `services/auth.service.ts`

### 2. Global blocker fix
- Fixed `tailwind.config.js` TypeScript-in-JS syntax issue:
  - Replaced `import type` + typed const with JSDoc config typing.

### 3. `lib/api` compatibility layer
- Added/normalized legacy API helpers in `lib/api/response.ts`:
  - `apiSuccess`, `apiError`, `apiPaginated`, `paginatedResponse`
- Expanded `successResponse` to support legacy `(data, 201)` usage.
- Extended `lib/api/validation.ts`:
  - `validateSearchParams`
  - dual `validateBody` support (request or raw body)
  - legacy-friendly `error` and flattened query fields
- Added legacy key-based `rateLimit()` in `lib/api/rateLimit.ts`.
- Updated `lib/api/withAuth.ts` to support both old and new handler signatures and permission call styles.

### 4. Supabase client compatibility
- Added legacy alias `createClient` in `lib/supabase/client.ts`.
- Updated shared supabase typing usage to reduce auth-chain `never` issues.

### 5. `app/api/settings/**`
- Fixed failing routes in:
  - `current-context`
  - `initialize`
  - `classes/levels`
  - `classes/sections`
  - `classes/sections/[id]`
- Replaced missing class-style imports with real service function usage.
- Fixed incorrect 201 response call patterns.

### 6. `app/api/communication/**`
- Added compatibility exports in `features/communication/index.ts`:
  - `MessagesService`, `NotificationsService`, `AnnouncementsService`
  - `broadcastSchema`
- Resolved communication route compile issues without broad route rewrites.

### 7. `app/api/reports/**`
- Added `ReportsService` compatibility facade in `features/reports/index.ts`.
- Added `termReportRequestSchema` compatibility export.
- Fixed report-card route strict typing issue in `app/api/reports/report-cards/[id]/route.ts`.

### 8. `features/academics/services/**`
- Fixed real bug in `competencies.service.ts` (`updateData` missing in update flow).
- Resolved `never` inference compile errors across:
  - `competencies.service.ts`
  - `learningAreas.service.ts`
  - `strands.service.ts`
  - `subStrands.service.ts`
  - `hierarchy.service.ts`
  - `teacherSubjects.service.ts`

## Current Status
- Folder-by-folder cleanup has removed major auth/api/settings/communication/reports/academics service blockers.
- Remaining errors are now concentrated in other API/service domains (not the completed folders above).

## Suggested Next Targets
1. `app/api/fees`
2. `app/api/payments`
3. `app/api/student-fees`
4. `app/api/students`

