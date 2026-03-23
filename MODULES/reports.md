# Reporting and PDF Generation Module

## Purpose
- Generate term and yearly report cards with analytics.
- Provide downloadable PDFs and exports.

## Core Data Model
- `report_cards`: metadata + `pdf_url` + `analytics_json`.
- `report_templates`: optional layout templates.
- `analytics`: derived data used by dashboards.

## Architecture and Data Flow
- Collect data from assessments, attendance, discipline, and finance.
- Aggregate per term or year.
- Render PDF and store in Supabase Storage.
- Save `pdf_url` in `report_cards`.

## API Surface (Representative)
- `GET /api/report_cards?student_id=&term=&year=`
- `POST /api/report_cards` (generate)
- `GET /api/report_cards/:id`
- `DELETE /api/report_cards/:id` (admin)

## UI Structure
- Report list with term/year filters.
- Report detail view with PDF preview.
- Export options for admins.

## Security and RBAC
- Parents/students only access their own reports.
- Teachers/class teachers can generate reports for assigned students.
- Admin roles can generate and delete school‑wide.

## Constraints and Rules
- Report generation must be deterministic and reproducible.
- Avoid blocking UI while generating PDFs; prefer async jobs.

## Improvement Ideas
- Background job queue for PDF rendering.
- Report template customization per school branding.
