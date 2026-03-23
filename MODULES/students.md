# Students Module

## Purpose
- Manage student profiles, enrollment, guardians, and class assignments.
- Provide the base entity for assessments, attendance, and fees.

## Core Data Model
- `students`: student master table.
- `student_classes`: enrollment mapping by term/year.
- `student_parents` (or equivalent): parent/guardian mapping.
- `users`, `user_profiles`: identity and extended data.

## Architecture and Data Flow
- Student creation links a `users` record with `students`.
- Enrollment records define class placement per term/year.
- Parent mapping drives parent portal visibility.

## API Surface (Representative)
- `GET /api/students`
- `POST /api/students`
- `GET /api/students/:id`
- `PUT /api/students/:id`
- `DELETE /api/students/:id` (soft delete/deactivate)
- `POST /api/students/import` (bulk import)

## UI Structure
- Student list with search and filters.
- Profile detail page with tabs (bio, attendance, fees, assessments).
- Import page with validation summary.

## Security and RBAC
- Staff roles can view students by class/school.
- Parents only see their own children.
- Students see only their own profiles.

## Constraints and Rules
- Admission numbers must be unique per school.
- Enrollment must reference valid academic year and term.

## Improvement Ideas
- Duplicate detection for imports.
- Automated promotion to next class on term rollover.
