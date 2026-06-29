# API Route Access Policy

Generated: 2026-06-29

## Classification Categories

| Label | Description |
|---|---|
| **Public** | No authentication required. Rate-limited. |
| **Authenticated** | Any valid session (`withAuth`). |
| **Permissioned** | Session + specific module/action permission (`withPermission`). |
| **Webhook** | External callback (M-Pesa, chatbot). IP or HMAC protected. |

## Route Inventory

### Public (Intentionally Unauthenticated)

| Route | Method | Reason |
|---|---|---|
| `auth/login` | POST | Login flow |
| `auth/logout` | POST | Logout flow |
| `auth/password-reset` | POST | Password reset |
| `admissions/apply` | POST | Public admission form |
| `mpesa/c2b/validation` | POST | Safaricom callback |
| `mpesa/c2b/confirmation` | POST | Safaricom callback |
| `parent-chatbot/webhook` | POST | External chatbot webhook |

### Authenticated (withAuth — any valid user)

| Route | Methods |
|---|---|
| `ai-agent/*` | GET, POST, PATCH |
| `finance/balances` | GET |
| `finance/recent-payments` | GET |
| `finance/stats` | GET |
| `notifications*` | GET, POST, PUT |
| `parent/*` | GET, POST |
| `payments` | GET, POST |
| `permissions` | GET |
| `roles` | GET |
| `settings/academic-years*` | GET, POST |
| `settings/classes` | GET |
| `settings/current-context` | GET |
| `settings/reference-data` | GET |
| `settings/terms*` | GET, POST |
| `student-fees` | GET |
| `upload` | POST |
| `users/*` | GET, POST, PUT, DELETE |
| `reports-ai/generate` | POST |
| `reports-ai/insights` | POST |
| `reports-ai/translate*` | POST |

### Permissioned (withPermission — session + module/action)

| Module | Actions | Example Routes |
|---|---|---|
| `students` | view, create, update, delete | `students/*`, `admissions/*` |
| `teachers` | view, create, update, delete | `staff/*`, `teachers/*` |
| `attendance` | view, create, update, delete | `attendance/*` |
| `assessments` | view, create, update, delete | `assessments/*`, `exams/*` |
| `finance` | view, create, update, approve, export | `fees/*`, `payments`, `mpesa/*` |
| `communication` | view, create, edit, delete | `messages/*`, `announcements/*`, `broadcast/*` |
| `academics` | view, create, update, delete | `learning-areas/*`, `strands/*`, `subjects/*`, `competencies/*` |
| `reports` | view, create, publish | `reports/*` |
| `analytics` | view | `analytics/*` |
| `settings` | view, create, edit, delete | `settings/*` |
| `library` | view, create, update | `library/*` |
| `inventory` | view, create | `inventory/*` |
| `transport` | view, create | `transport/*` |
| `timetable` | view, create | `timetable/*` |
| `compliance` | view, create, update, delete | `discipline/*` |
| `special_needs` | view, create, update, delete, export | `special-needs/*` |
| `exams` | view, create, update, delete | `exams/*` |
| `audit_logs` | view | `audit-logs/*` |
| `users` | view, create, update, delete | `users`, `roles` |

### Webhook / External

| Route | Method | Source |
|---|---|---|
| `mpesa/c2b/validation` | POST | Safaricom |
| `mpesa/c2b/confirmation` | POST | Safaricom |
| `parent-chatbot/webhook` | POST | External chatbot |

## Sensitive Endpoint Review

| Endpoint | Risk | Protection |
|---|---|---|
| `staff/[id]/reset-password` | High | `withPermission(teachers/update)` |
| `users/[id]/hard-delete` | Critical | `withAuth` |
| `admin/ai-logs` | Medium | `withAuth` |
| `audit-logs/export` | Medium | `withPermission(audit_logs/view)` |
| `finance/export` | Medium | `withPermission(finance/export)` |
| `payments` | High | `withAuth` (GET), `withPermission(finance/create)` (POST) |
| `mpesa/reconcile` | High | `withPermission(finance/update)` |

## Enforcement

- All new routes MUST use one of: `withAuth`, `withPermission`, `withRoles`.
- Custom auth helpers (`getCurrentUser()`, `getStudentRequestContext()`) should be migrated to standard wrappers.
- Public endpoints require documented justification.
