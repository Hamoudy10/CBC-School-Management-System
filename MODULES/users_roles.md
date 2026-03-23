# Users and Roles Module

## Purpose
- Manage all users, roles, and access permissions.
- Enforce role hierarchy and prevent privilege escalation.

## Core Data Model
- `roles`: role definitions and descriptions.
- `users`: user identity, role assignment, and status.
- `permissions`: module/action permissions per role.
- `audit_logs` or `audit_trail`: records changes to users and roles.

## Architecture and Data Flow
- Admin creates users via server‑side admin client.
- Role changes validated by `ROLE_HIERARCHY`.
- Audit entries created for sensitive actions.

## API Surface (Representative)
- `GET /api/roles`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id` (deactivate)

## UI Structure
- Users list with role filters and status.
- Create/edit user modals with role selection.
- Role management table with permission summaries.

## Security and RBAC
- Only high‑privilege roles can create or change other users.
- Users can only view or edit their own profile fields (limited).

## Constraints and Rules
- `super_admin` is global and not school‑scoped.
- All other roles require a `school_id`.

## Improvement Ideas
- Invite‑based user onboarding.
- MFA support for admin roles.
