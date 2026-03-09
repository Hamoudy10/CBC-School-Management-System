1️⃣ Purpose

Manage all users in the system (students, parents, teachers, admin roles)

Assign roles and permissions

Integrate with Supabase Auth for authentication

Enable password resets, account activation, and audit trails

Ensure role hierarchy enforcement and production-ready design

2️⃣ Tables
A. Users
Table	Description	Key Columns
users	Stores all system users	user_id PK, email, password_hash, full_name, role_id FK, profile_picture_url, status (Active/Inactive), created_at, updated_at
B. Roles
Table	Description	Key Columns
roles	Define user roles	role_id PK, name, description
C. Permissions
Table	Description	Key Columns
permissions	Role-specific permissions	permission_id PK, role_id FK, module_name, can_read BOOL, can_create BOOL, can_update BOOL, can_delete BOOL
D. Audit Trails
Table	Description	Key Columns
audit_trail	Track changes to users & roles	audit_id PK, performed_by FK, action_type, target_user_id FK, details_json, performed_at
3️⃣ API Endpoints
User Management
Endpoint	Method	Purpose	Access
/api/users	GET	List users	Super Admin, Admin
/api/users/:id	GET	View user profile	Super Admin, Admin, user self
/api/users	POST	Create user	Super Admin, Admin
/api/users/:id	PUT	Update user profile	Super Admin, Admin, user self (limited fields)
/api/users/:id	DELETE	Deactivate user	Super Admin, Admin
/api/users/reset_password	POST	Send password reset link	User self, Admin
/api/users/change_password	POST	Change password	User self
Roles & Permissions
Endpoint	Method	Purpose	Access
/api/roles	GET	List roles	Super Admin, Admin
/api/roles/:id	GET	View role & permissions	Super Admin, Admin
/api/roles	POST	Create new role	Super Admin
/api/roles/:id	PUT	Update role & permissions	Super Admin
/api/permissions	GET	List all permissions	Super Admin, Admin
Audit Trail
Endpoint	Method	Purpose	Access
/api/audit_trail	GET	List user/role changes	Super Admin, Admin
4️⃣ Role Hierarchy & Access Control
Role	Key Access
Super Admin	Full access to all modules & user management
School Admin	Manage users (except Super Admin), view audit trails
Principal	View user profiles & role-specific permissions (students, teachers)
Deputy	View assigned class/staff users
Teacher	Access assigned students & personal profile
Class Teacher	Access class students, personal profile
Parent	View own child’s profile & reports
Student	View own profile & reports
ICT Admin	View system-wide user logs for monitoring
5️⃣ Supabase Integration

Authentication: Supabase Auth for email/password login

JWT tokens for role-based session handling

RLS policies for tables (users, roles, permissions)

Audit trails: captured in API calls whenever roles or user info is modified

Example:

const { user, error } = await supabase.auth.getUser()
if (user.role_id !== 'super_admin') throw new Error('Access denied')
6️⃣ Frontend UX Guidelines

Admin Dashboard: user list, role assignment, search, filters

Profile Pages: editable fields, avatar, status toggle

Role Management: table view of roles + permissions, modal to edit

Audit Logs: list with filters by user, action, date

Responsive Design:

Mobile: stacked cards, simplified tables

Desktop: table/grid view, full controls

7️⃣ AI Implementation Instructions

Implement tables (users, roles, permissions, audit_trail)

Apply RLS policies for role-based access

Implement API endpoints for user management, roles, permissions, and audit trail

Integrate with Supabase Auth for email/password login and JWT sessions

Enable password reset and change flows

Create frontend dashboard components for user list, role management, and audit trail

Maintain modular, production-ready, token-efficient design

Prepare concise Claude .md summary describing:

Tables and relationships

API endpoints & RLS enforcement

Role hierarchy & permissions

Audit trail implementation