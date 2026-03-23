# Finance Module

## Purpose
- Manage fee structures, student fee assignments, and payments.
- Provide dashboards for collections and outstanding balances.

## Core Data Model
- `fee_structures`: fee definitions per academic year.
- `student_fees`: per‑student assigned fees.
- `payments`: payment records and methods.

## Architecture and Data Flow
- Admin defines fee structures.
- Student fees are assigned per term/year.
- Payments update status and feed dashboards.
- Aggregations provide totals (paid, pending, overdue).

## API Surface (Representative)
- `GET /api/fee-structures`
- `POST /api/fee-structures`
- `PUT /api/fee-structures/:id`
- `GET /api/payments`
- `POST /api/payments`

## UI Structure
- Fee structures table with filters.
- Student fee ledger views with status badges.
- Payments list and record forms.
- Finance dashboard cards and charts.

## Security and RBAC
- Finance roles and admins can manage fees and payments.
- Parents/students can only view their own fees.
- `school_id` enforced on every finance query.

## Constraints and Rules
- Payment totals should not exceed fee amounts without explicit overrides.
- Status transitions are controlled: Pending → Paid, Pending → Overdue.

## Improvement Ideas
- Mpesa integration (planned v2).
- Automated reminders for overdue balances.
- Exported finance statements by class or term.
