# Staff Module

## Purpose
- Manage staff records, roles, assignments, and profiles.

## Core Data Model
- `staff`: staff records linked to `users`.
- `users`: auth‑linked identity with role and school scope.
- `user_profiles`: extended profile details.
- `teacher_subjects`: subject and class assignments.

## Architecture and Data Flow
- Staff creation uses admin role validation.
- Staff profile updates are scoped by school and role.
- Assignments are used to control assessment and attendance permissions.

## UI Structure
- Staff list with filters (role, status, department).
- Staff detail page with profile and assignments.
- Create/edit forms with role selection.

## Security and RBAC
- Admin and principal roles manage staff.
- Non‑admin staff only see limited data.
- Role escalation is blocked by hierarchy checks.

## Constraints and Rules
- `users.role_id` is the source of truth for role.
- Each staff user must belong to a school.

## Improvement Ideas
- Staff leave management workflow.
- Department and designation taxonomy.
