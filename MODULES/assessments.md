# Assessments Module

## Purpose
- Record CBC competency assessments and produce term/year aggregates.
- Provide analytics for teachers, admins, and parents.

## Core Data Model
- `assessments`: raw per‑student competency scores and remarks.
- `assessment_templates`: reusable assessment definitions per competency.
- `analytics` (or equivalent aggregates): derived results for dashboards.
- `report_cards`: stored metadata and analytics JSON for reports.

## Architecture and Data Flow
- Teacher selects class/subject → chooses competency → records score.
- Score is mapped to performance level via centralized logic.
- Aggregations roll up from competency → sub‑strand → strand → learning area.
- Aggregates feed dashboards and report generation.

## Performance Level Mapping
- Mapping is centralized in a utility or service (no hardcoding in controllers).
- Supports CBC 4‑point scale or configured grading scales.

## API Surface (Representative)
- `GET /api/assessments?student_id=&term=&year=`
- `POST /api/assessments`
- `PUT /api/assessments/:id`
- `GET /api/assessments/strand_results`
- `GET /api/assessments/area_results`
- `GET /api/assessments/year_results`

## UI Structure
- Teacher entry forms with competency pickers and templates.
- Class summary dashboards with heatmaps and trends.
- Student detail views with radar/line charts.

## Security and RBAC
- Teachers can only assess assigned students and subjects.
- Parents and students can only view their own results.
- Admin roles can view aggregates across the school.

## Constraints and Rules
- Unique constraint per student/competency/term/year to avoid duplicates.
- Aggregations must be deterministic and reproducible.
- Special needs adjustments are layered, not destructive to raw scores.

## Improvement Ideas
- Background job for aggregation recalculation.
- Assessment locking after term close.
- Automated anomaly detection for missing assessments.
