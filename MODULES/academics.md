# Academics Module

## Purpose
- Manage CBC curriculum structure and subject mappings.
- Provide the foundation for assessments, reporting, and analytics.

## Core Data Model
- `subjects`: subject catalog with codes and term applicability.
- `learning_areas`: top‑level CBC areas.
- `strands`: subdivisions of learning areas.
- `sub_strands`: subdivisions of strands.
- `competencies`: leaf nodes used by assessments.
- `student_subjects`: student‑to‑subject assignments by term/year.
- `teacher_subjects`: teacher‑to‑subject/class assignments by term/year.

## Architecture and Data Flow
- Curriculum hierarchy is the canonical reference for assessment lookups.
- Assessments reference `competencies` which roll up to sub‑strands, strands, and learning areas.
- Teacher and student mappings drive access to assessment entry and dashboards.

## API Surface (Representative)
- `GET /api/subjects`, `POST /api/subjects`, `PUT /api/subjects/:id`
- `GET /api/learning_areas`
- `GET /api/strands?learning_area_id=...`
- `GET /api/sub_strands?strand_id=...`
- `GET /api/competencies?sub_strand_id=...`
- `GET /api/student_subjects`, `POST /api/student_subjects`
- `GET /api/teacher_subjects`, `POST /api/teacher_subjects`

## UI Structure
- Curriculum manager pages for admins.
- Hierarchy views (learning area → strand → sub‑strand → competency).
- Assignment screens for mapping teachers and students to subjects.
- Filters by term and academic year.

## Security and RBAC
- School‑scoped queries (filter by `school_id`).
- Admin roles manage curriculum and mappings.
- Teachers can view only their assigned subjects and competencies.

## Constraints and Rules
- CBC hierarchy is immutable per assessment cycle; changes should be versioned or constrained.
- No hardcoded term/year values; always use configured academic year/term tables.

## Improvement Ideas
- Curriculum versioning by academic year.
- Bulk import tools for subjects and competencies.
- Caching for hierarchy lookups to reduce repeated joins.
