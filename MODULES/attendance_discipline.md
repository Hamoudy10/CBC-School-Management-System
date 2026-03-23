# Attendance and Discipline Module

## Purpose
- Track daily attendance, disciplinary incidents, and special needs accommodations.
- Provide analytics for term/year trends.

## Core Data Model
- `attendance`: per‑student daily status.
- `disciplinary_records`: incident logs with actions taken.
- `special_needs`: accommodations and adjustments.
- `attendance_analytics`, `discipline_analytics`: term/year summaries.

## Architecture and Data Flow
- Teachers record daily attendance per class.
- Discipline entries tie to a student and class context.
- Aggregation jobs compute term and yearly summaries for dashboards.

## API Surface (Representative)
- `GET /api/attendance?class_id=&date=`
- `POST /api/attendance`
- `PUT /api/attendance/:id`
- `GET /api/attendance/analytics?term=&year=`
- `GET /api/discipline?student_id=`
- `POST /api/discipline`
- `PUT /api/discipline/:id`
- `GET /api/discipline/analytics?term=&year=`

## UI Structure
- Daily attendance grid by class and date.
- Discipline log table with filters and detail modal.
- Analytics dashboards with term/year trend charts.

## Security and RBAC
- Teachers limited to assigned classes.
- Admin and principal roles can view school‑wide data.
- Parents only see their child’s attendance and incidents.

## Constraints and Rules
- Attendance should be recorded once per student per date.
- Discipline entries should not be deleted; use soft delete or audit.

## Improvement Ideas
- Batch attendance entry with offline support.
- Automated alerts for chronic absenteeism.
- Discipline escalation workflows with approvals.
