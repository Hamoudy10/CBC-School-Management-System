# Service-Role Usage Register

Generated: 2026-06-29

| # | File | Function | Table(s) | Permission Check | Audit Log | Required? |
|---|---|---|---|---|---|---|
| 1 | `lib/supabase/storage.ts` | `ensureStorageBucket()` | storage | N/A (utility) | No | Yes — storage bucket management |
| 2 | `lib/supabase/storage.ts` | `getSignedUrl()` | storage | Upstream API route | No | Yes — signed URL generation |
| 3 | `lib/supabase/storage.ts` | `uploadFile()` | storage | Upstream API route | No | Yes — file upload |
| 4 | `lib/supabase/storage.ts` | `deleteFile()` | storage | Upstream API route | No | Yes — file deletion |
| 5 | `services/auth.server.service.ts` | `createUser()` | auth.users, users | Yes (canManageRole) | No | Yes — auth user creation |
| 6 | `features/users/services/users.service.ts` | `createUser()` | auth.users, users | Yes (canManageRole) | No | Yes — user management |
| 7 | `features/users/services/users.service.ts` | `hardDeleteUser()` | auth.users, users, 16+ ref tables | Yes (canManageRole) | No | Yes — hard delete |
| 8 | `features/staff/services/staff.services.ts` | `createStaff()` | auth.users, users, staff | Yes (canManageRole) | No | Yes — staff creation |
| 9 | `features/students/services/students.service.ts` | `ensureParentUser()` | auth.users, users | Partial | No | Yes — parent account creation |
| 10 | `features/settings/services/school.service.ts` | `getSchoolSettings()` | school_settings | Upstream | No | Yes — settings read |
| 11 | `features/settings/services/school.service.ts` | `updateSchoolSettings()` | school_settings | Upstream | Yes (settings.service.ts) | Yes — settings write |
| 12 | `app/api/mpesa/c2b/validation/route.ts` | POST handler | mpesa_c2b_transactions | IP check only | No | Yes — M-Pesa callback |
| 13 | `app/api/mpesa/c2b/confirmation/route.ts` | POST handler | mpesa_c2b_transactions | IP check only | No | Yes — M-Pesa callback |
| 14 | `features/assessments/services/performanceLevels.service.ts` | `seedMissingSchoolLevelsWithAdminClient()` | performance_levels | No | No | Yes — seed data |
| 15 | `features/ai-agent/services/sql-executor.service.ts` | `executeSqlQuery()` | All tables (read-only) | Upstream AI pipeline | No | Yes — AI SQL tool |
| 16 | `features/ai-agent/services/db-schema.service.ts` | `getDbSchema()` | information_schema | Upstream AI pipeline | No | Yes — AI schema tool |
| 17 | `features/finance/services/studentFees.service.ts` | `waiveFee()` | student_fees | Yes | Yes | Yes — fee waiver |
| 18 | `features/finance/services/payments.service.ts` | `getManagedPaymentRecord()` | payments | Yes | Yes | Yes — payment mgmt |
| 19 | `features/finance/services/exceptions.service.ts` | `listFinanceExceptions()` | audit_logs | Yes | N/A (read) | Yes — reconciliation |

## Gaps

1. **M-Pesa routes (#12, #13)**: No audit log written. DB-trigger on `mpesa_c2b_transactions` may exist but no application-level audit.
2. **User creation (#5, #6, #8, #9)**: No application-level audit log. DB trigger on `users` table captures the data change but not business context.
3. **AI agent tools (#15, #16)**: Rely on upstream permission check. If the AI agent pipeline is compromised, admin client provides unfettered access.
