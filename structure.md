ROOT STRUCTURE
school-management-system/
│
├── app/                      # Next.js App Router
├── components/               # Shared UI components
├── features/                 # Domain modules (VERY IMPORTANT)
├── lib/                      # Core utilities
├── hooks/                    # Reusable hooks
├── services/                 # Supabase data access layer
├── types/                    # Global TypeScript types
├── constants/                # System constants
├── styles/                   # Tailwind + global styles
├── middleware.ts             # Role-based routing middleware
├── supabase/                 # Supabase SQL + policies
├── docs/                     # Claude MD tracking files
├── public/
├── .env.local
├── next.config.js
├── package.json
🔥 1️⃣ APP (ROUTING LAYER)
app/
│
├── layout.tsx
├── page.tsx
│
├── (auth)/
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│
├── (dashboard)/
│   ├── layout.tsx
│   ├── page.tsx
│   │
│   ├── students/
│   ├── teachers/
│   ├── academics/
│   ├── finance/
│   ├── compliance/
│   ├── communication/
│   ├── reports/
│   └── settings/
Why this structure?

(auth) separated from (dashboard)

Route groups prevent layout duplication

Clean separation of public vs protected routes

Easy to enforce RBAC via middleware

🔥 2️⃣ FEATURES (CORE DOMAIN ARCHITECTURE)

This is the most important folder.

Each module is isolated.

features/
│
├── users/
├── students/
├── teachers/
├── classes/
├── subjects/
├── academics/
├── assessments/
├── attendance/
├── finance/
├── communication/
├── compliance/
├── library/
├── reports/
└── analytics/
📦 Example Feature Structure

Example: students

features/students/
│
├── components/
│   ├── StudentForm.tsx
│   ├── StudentProfileCard.tsx
│   ├── StudentTable.tsx
│
├── hooks/
│   ├── useStudents.ts
│
├── services/
│   ├── students.service.ts
│
├── validators/
│   ├── student.schema.ts
│
├── types.ts
└── index.ts
Why this is powerful:

Fully isolated domain

Each AI module works inside its own feature

No bleeding across modules

Easy to refactor

Easy to scale

Easy to convert to mobile later

🔥 3️⃣ SERVICES LAYER (Supabase Access)
services/
│
├── supabaseClient.ts
├── auth.service.ts
├── audit.service.ts
└── storage.service.ts

⚠️ RULE:
Features never call Supabase directly.
They go through service layer.

This enforces production safety.

🔥 4️⃣ LIB (CORE UTILITIES)
lib/
│
├── auth/
│   ├── roleGuard.ts
│   ├── permissionMatrix.ts
│
├── utils/
│   ├── dateUtils.ts
│   ├── termUtils.ts
│
├── pdf/
│   ├── pdfGenerator.ts
│
├── validation/
│   ├── zodSchemas.ts
│
└── analytics/
    ├── trendCalculations.ts
🔥 5️⃣ SUPABASE FOLDER
supabase/
│
├── schema.sql
├── rls/
│   ├── users_policies.sql
│   ├── students_policies.sql
│   ├── finance_policies.sql
│
├── functions/
│   ├── calculate_term_average.sql
│   ├── generate_student_code.sql
│
└── migrations/

This ensures:

Version-controlled database

Reproducible deployments

Clean migration tracking

Production-grade RLS security

🔥 6️⃣ DOCS FOLDER (CRITICAL FOR LM ARENA)
docs/
│
├── 00_MASTER_RULES.claude.md
├── 01_SYSTEM_ARCHITECTURE.claude.md
├── 02_DATABASE_SCHEMA.claude.md
│
├── modules/
│   ├── 01_USERS.claude.md
│   ├── 02_STUDENTS.claude.md
│   ├── 03_CLASSES.claude.md
│   ├── 04_SUBJECTS.claude.md
│   ├── 05_CBC_ASSESSMENTS.claude.md
│   ├── 06_ATTENDANCE.claude.md
│   ├── 07_FINANCE.claude.md
│   ├── 08_COMPLIANCE.claude.md
│   ├── 09_COMMUNICATION.claude.md
│   └── 10_ANALYTICS.claude.md

This prevents:

Context loss

AI confusion

Duplicate implementation

Assumption errors

🎨 UI STRUCTURE
components/
│
├── ui/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   ├── Table.tsx
│   ├── Badge.tsx
│   ├── Tabs.tsx
│   ├── Dropdown.tsx
│
├── layout/
│   ├── Sidebar.tsx
│   ├── Navbar.tsx
│   ├── DashboardLayout.tsx
│
└── charts/
    ├── TrendChart.tsx
    ├── PerformanceChart.tsx
📊 ANALYTICS STRUCTURE (TERM + YEARLY)
features/analytics/
│
├── services/
│   ├── performance.service.ts
│   ├── trend.service.ts
│
├── components/
│   ├── TermPerformanceChart.tsx
│   ├── YearComparisonChart.tsx
│
├── hooks/
│   ├── usePerformanceAnalytics.ts
│
└── types.ts

Supports:

Term averages

CBC competency trends

Year-to-year comparisons

Teacher performance analysis

Class performance rankings

🔐 ROLE-BASED ACCESS CONTROL
lib/auth/
│
├── roles.ts
├── permissions.ts
├── roleMatrix.ts
├── guard.ts

Mapped to roles:

Super Admin

School Admin

Principal

Deputy

Teacher

Class Teacher

Subject Teacher

Finance Officer

Parent

Student

Bursar

Librarian

ICT Admin

Enforced via:

Supabase RLS

Next.js middleware

UI visibility logic