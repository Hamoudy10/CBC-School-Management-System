# School Settings and Configuration Module

## Purpose
- Centralize academic years, terms, grading scales, and promotion rules.
- Provide system‑wide settings used by all modules.

## Core Data Model
- `schools`: tenant root table.
- `academic_years`: term boundaries and active year.
- `terms`: active term within year.
- `grading_scales`: performance bands per school.
- `promotion_rules`: yearly promotion constraints.
- `system_settings`: JSON settings per school.

## Architecture and Data Flow
- All modules reference active academic year and term from this module.
- Grading scales are used by assessment mapping.
- Promotion rules are used by yearly report logic.

## API Surface (Representative)
- `GET /api/academic_years`, `POST /api/academic_years`
- `GET /api/terms`, `POST /api/terms`
- `GET /api/grading_scales`, `POST /api/grading_scales`
- `GET /api/system_settings`, `PUT /api/system_settings`

## UI Structure
- Configuration pages for academic year/term management.
- Grading scale editor.
- System settings forms (e.g., attendance required for exams).

## Security and RBAC
- Admin roles can manage settings.
- Teachers have read‑only access to term/year data.

## Constraints and Rules
- Only one active academic year per school.
- Only one active term per academic year.
- Grading scales must cover full score range without overlaps.

## Improvement Ideas
- Versioned settings with audit history.
- Scheduled term rollover automation.
