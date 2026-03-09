# PROJECT CONTEXT: CBC School Management System

This document provides a single-source-of-truth for the system architecture, code patterns, and implementation state of the school management system.

## 1. Package Dependencies (UI/Utility)
- **Framework**: Next.js 14.1.0 (App Router)
- **Base**: React 18.2.0, TypeScript 5.3.0
- **Database**: @supabase/supabase-js 2.39.0, @supabase/ssr 0.1.0
- **Styling**: Tailwind CSS 3.4.0, class-variance-authority 0.7.0, tailwind-merge 2.2.0, clsx 2.1.0
- **Icons**: lucide-react 0.303.0
- **Forms**: react-hook-form 7.49.0, @hookform/resolvers 3.3.4, zod 3.22.4
- **Charts**: recharts 2.10.0
- **Utilities**: date-fns 3.0.0

## 2. Supabase Client Patterns
**Import Paths:**
- Server: `import { createSupabaseServerClient } from "@/lib/supabase/server";`
- Browser: `import { createSupabaseBrowserClient } from "@/lib/supabase/client";`

**Function Signatures:**
```typescript
// Server (Async)
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>>;

// Browser (Singleton)
export function createSupabaseBrowserClient(): SupabaseClient<Database>;
```

## 3. Auth Hook Pattern
**Hook**: `useAuth` from `@/hooks/useAuth.ts`
**Usage Pattern:**
```typescript
const { user, session, isLoading, signOut, refreshUser } = useAuth();
// Return type: { user: AuthUser | null, session: Session | null, isLoading: boolean, ... }
```

## 4. API Response Pattern
**Helpers**: `successResponse` and `errorResponse` from `@/lib/api/response.ts`
**Signatures:**
```typescript
export function successResponse<T>(data: T, message?: string, status = 200): NextResponse;
export function errorResponse(message: string, status = 400, errors?: any): NextResponse;
```

## 5. Auth Guard Pattern
**API Protection**: `withAuth` wrapper from `@/lib/api/withAuth.ts`
```typescript
export const GET = withAuth(async ({ req, params, user }) => { ... }, {
  requiredPermission: 'view_students', // optional
  allowedRoles: ['admin', 'teacher']   // optional
});
```

## 6. Permission System
**Roles**: `super_admin`, `school_admin`, `principal`, `deputy_principal`, `teacher`, `class_teacher`, `subject_teacher`, `finance_officer`, `bursar`, `parent`, `student`, `librarian`, `ict_admin`.
**Core Helper**: `hasPermission(user: AuthUser, permission: AppPermission): boolean` in `@/lib/auth/permissions.ts`

## 7. Database Types (Excerpts)
*Note: Full file is @/types/database.types.ts*
```typescript
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      schools: { Row: { school_id: string; name: string; type: string; ... } };
      users: { Row: { user_id: string; school_id: string | null; role_id: string; email: string; ... } };
      students: { Row: { student_id: string; admission_number: string; ... } };
      classes: { Row: { class_id: string; grade_id: string; ... } };
      assessments: { Row: { assessment_id: string; competency_id: string; score: number; ... } };
      payments: { Row: { id: string; amount_paid: number; ... } };
      // ... and all other system tables
    },
    Enums: {
      user_status: "active" | "inactive" | "suspended" | "archived";
      school_term: "Term 1" | "Term 2" | "Term 3";
      cbc_performance_level: "below_expectation" | "approaching" | "meeting" | "exceeding";
      // ...
    }
  }
}
```

## 8. Internal Auth Types (@/types/auth.ts)
```typescript
export interface AuthUser {
  id: string;
  email: string;
  role: RoleName;
  firstName: string;
  lastName: string;
  schoolId?: string;
  status: UserStatus;
  permissions: AppPermission[];
}
```

## 9. UI Component Signatures
- **Button**: `ButtonProps { variant?: 'primary'|'secondary'|..., size?: 'sm'|'md'|..., loading?: boolean, leftIcon?, rightIcon? }`
- **Card**: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, `StatCard`
- **Table**: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableHead` (with sorting)
- **Modal**: `Modal`, `ConfirmDialog`
- **Input/Select**: Standardized with `label`, `error`, `helperText`

## 10. Layout Structure
- **Root Layout**: `app/layout.tsx` (Wraps with `ToastProvider`)
- **Dashboard Layout**: `components/layout/DashboardLayout.tsx` (Collapsible `Sidebar`, `Header`)

## 11. Feature Domain Types
Found in `features/[module]/types.ts`. Key modules:
1. **Academics**: CBC hierarchy (Learning areas -> Strands -> Sub-strands -> Competencies).
2. **Assessments**: Score tracking (1-4 scale), Performance levels.
3. **Finance**: Fee structures, Student fees, Payments.
4. **Attendance**: Daily status, Summaries.
5. **Timeline**: Schedule slots, conflict tracking.

## 12. Service Pattern
**Example**: `features/finance/services/payments.service.ts`
Uses `createSupabaseServerClient`, handles role-based query filtering, implements CRUD logic with business validation.

## 13. Middleware (@/middleware.ts)
Handles session refresh, redirect to login, and initial role-based route blocking based on a `ROUTE_MODULE_MAP`.

## 14. Global Style (@/tailwind.config.js & @/styles/globals.css)
Custom color palette for CBC performance levels (`exceeding`, `meeting`, etc.), premium shadows, Inter font family.

## 15. Utility Functions (@/lib/utils.ts)
- `cn(...inputs)`: Tailwind class merging.
- `formatCurrency(amount)`: KES currency formatting.
- `formatDate(date)`: Kenyan locale date string.
- `getInitials(name)`: User avatar initials.

---

## IMPLEMENTATION GAP ANALYSIS

### COMPLETED ✅
- **Database Schema**: 100% complete (2200+ lines SQL script).
- **Core Infrastructure**: Supabase SSR, Auth hooks, Permission logic, Middleware.
- **UI System**: 20+ Atomic and Layout components.
- **API Engine**: Standardized response and error handlers.
- **Internal Docs**: Type definitions for all 11 modules.

### IN PROGRESS 🏗️
- **Staff Module**: CRUD for staff records is partially implemented.
- **Auth Flow**: Login/Logout works; reset password pending.

### MISSING (REQUIRED FOR PRODUCTION) ❌
1. **Module Pages**: `Students`, `Finance (Fees/Payments)`, `Academics`, `Assessments Entry`, `Attendance`, `Timetable`, `Discipline`, `Communication`.
2. **Dashboard Views**: Role-specific dashboards (Admin vs. Teacher vs. Parent).
3. **Reports**: PDF Report Card generation service.
4. **Bulk Operations**: Bulk student/attendance import.

---

## MASTER FINALIZATION PROMPT (For AI Completion)

> "You are an expert Next.js/Supabase engineer. I have a school management system with a completed DB schema and core UI architecture. I need you to implement the remaining modules.
> 
> **Instructions:**
> 1. Use `features/[module]/services/[name].service.ts` for all business logic/Supabase calls.
> 2. Implement pages in `app/(dashboard)/[module]/page.tsx` using the provided UI components (`Card`, `Table`, `Button`, `PageHeader`).
> 3. Enforce RBAC using the `useAuth` hook and existing `lib/auth/permissions.ts`.
> 4. Follow the `Finance` payment service pattern for all CRUD: implement filters, pagination, and school-scoping (query must always check `school_id` unless super_admin).
> 5. **Priority Order**: 
>    - Students Management (Create/List students, link guardians)
>    - Finance (Fee structure setup, payment recording)
>    - Academics (CBC structure hierarchy management)
>    - Assessments (The CBC entry form for teachers)
>    - Attendance (Daily class-based entry)
> 
> Use the attached `PROJECT_CONTEXT.md` for exact type signatures and patterns. Ensure all code is production-ready, typed, and follows the existing design language."
