# Pre‑Change Requirements Summary (For Any AI/Engineer)

This file captures the exact artifacts that must be reviewed before making changes. It is organized by priority so an engineer can avoid breaking security, schema, and integration patterns.

## Critical (Must Have Before Any Code Changes)

### 1. Database Schema
File: `sql_creation_script.txt`
What to confirm:
- Every `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `CREATE POLICY`, trigger, and function.
- Column names and constraints to avoid query mismatches.
- RLS policies for tenant isolation (`school_id`).
- Audit triggers and updated_at triggers.

Why it matters:
- Prevents schema mismatches, constraint violations, and RLS bypass risks.

### 2. Supabase Client Configuration
Files:
- `lib/supabase/client.ts` (browser client)
- `lib/supabase/server.ts` (server client)
- `lib/supabase/admin.ts` (if present) or admin client inside `lib/supabase/server.ts`
What to confirm:
- How each client is instantiated (SSR vs browser vs admin).
- Whether queries are scoped by `school_id` at the service layer.
- Which client is used inside API routes vs server components.

### 3. Auth and RBAC Core
Files:
- `types/roles.ts`
- `lib/auth/*`
- `middleware.ts`
- `lib/api/*`
What to confirm:
- Role list, hierarchy, and permission matrix.
- Guard patterns for APIs and pages.
- How role and school claims are read from session/JWT.

### 4. Environment Variables
File: `.env` (or `.env.example` if added)
What to confirm:
- Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Any custom variables used in code.
- Ensure secrets are not exposed client‑side.

## Important (Required Before Implementing Modules)

### 5. Navigation and Layout Structure
Files:
- `lib/navigation/navConfig.ts`
- `app/(dashboard)/layout.tsx`
- `components/layout/*`
What to confirm:
- How modules are registered in nav.
- How role‑based tab filtering is applied.

### 6. Shared UI Components and Patterns
Files/Folders:
- `components/ui/*`
- Example pages like `app/(dashboard)/exams/page.tsx`
- Example API routes like `app/api/exams/route.ts`
What to confirm:
- Standard handling for loading/error states.
- Form patterns, validation, and data fetching strategy.
- UI conventions for tables, modals, and cards.

### 7. Type Definitions
Folder: `types/*`
What to confirm:
- Shared types for Student, Staff, Assessment, School, Term, AcademicYear.
- API response shapes and DTOs.

### 8. Service Layer Examples
Folder: `features/*/services/*`
What to confirm:
- How Supabase queries are composed.
- Error handling conventions.
- How `school_id` filtering is enforced.
- Transaction patterns (if any).

## Helpful (Speeds Work, Prevents Rework)

### 9. Dependencies
File: `package.json`
What to confirm:
- Exact library versions and available tooling.

### 10. TypeScript Configuration
File: `tsconfig.json`
What to confirm:
- Path aliases (e.g., `@/lib/*`, `@/features/*`).

### 11. Migrations Beyond Creation Script
Folder: `scripts/` or other SQL files
What to confirm:
- Any SQL migrations not yet merged into `sql_creation_script.txt`.

### 12. Tests and Patterns
Files/Folders:
- `__tests__`, `tests`, or `*.test.ts`
What to confirm:
- Existing test patterns and coverage expectations.

## Priority Selection (Choose 2–3 Before New Work)
Pick the next focus areas to avoid scope creep:
- **A** RLS Audit and Security Hardening
- **B** Academics CRUD (Subjects, Strands, Sub‑Strands, Competencies)
- **C** Attendance CRUD (Beyond imports and summaries)
- **D** Communication Route Consolidation
- **E** Settings Completion (Grading Scales, Promotion Rules)
- **F** Report Pipeline Hardening (Async jobs, retries)
- **G** UI Completion (Students, Staff, Compliance dashboards)
- **H** Testing (Playwright E2E for critical flows)

---

Note: This checklist is designed to be read before any change to avoid breaking RBAC, RLS, or schema constraints.
