1️⃣ Purpose

Implement Supabase authentication for all users.

Define role-based access control (RBAC).

Configure Row-Level Security (RLS) for each module/table.

Ensure production-ready security for sensitive CBC, disciplinary, and special needs data.

2️⃣ Authentication Setup

Method: Email/password login via Supabase Auth

Supabase Configuration Steps:

Enable email/password authentication.

Add user signup with verification email.

Add login and password reset functionality.

Link auth.users (Supabase default) with users table in DB:

-- Example: link Supabase auth user with our users table
ALTER TABLE users
ADD COLUMN auth_uid uuid REFERENCES auth.users(id) UNIQUE;

Ensure every users record has a role_id (from roles table).

3️⃣ Role-Based Access Control (RBAC)

Roles:

Super Admin

School Admin

Principal

Deputy

Teacher

Class Teacher

Subject Teacher

Finance Officer

Parent

Student

Bursar

Librarian

ICT Admin

RBAC Principles:

Users can only access modules they are authorized for.

Sensitive tables (disciplinary, special needs, finance) restricted by role.

All access goes through Supabase RLS policies.

4️⃣ Example RLS Policies (Production-Ready)

A. Students Table

-- Allow only assigned teachers, class teacher, and parents to select student info
CREATE POLICY select_student_for_role
ON students
FOR SELECT
USING (
  auth.role() = 'super_admin' OR
  auth.role() = 'school_admin' OR
  auth.role() = 'principal' OR
  (
    auth.role() IN ('teacher','class_teacher','subject_teacher') AND
    EXISTS (
      SELECT 1 FROM student_classes sc
      WHERE sc.student_id = students.student_id
      AND sc.class_id IN (
        SELECT class_id FROM teacher_subjects ts
        WHERE ts.teacher_id = current_setting('jwt.claims.user_id')::uuid
      )
    )
  ) OR
  (
    auth.role() = 'parent' AND
    EXISTS (
      SELECT 1 FROM student_parents sp
      WHERE sp.student_id = students.student_id
      AND sp.parent_user_id = current_setting('jwt.claims.user_id')::uuid
    )
  )
);

B. Disciplinary Records

-- Only school admin, principal, deputy, and relevant teacher can view
CREATE POLICY select_disciplinary_records
ON disciplinary_records
FOR SELECT
USING (
  auth.role() IN ('super_admin','school_admin','principal','deputy') OR
  (
    auth.role() IN ('teacher','class_teacher','subject_teacher') AND
    EXISTS (
      SELECT 1 FROM students s
      WHERE s.student_id = disciplinary_records.student_id
      AND s.current_class_id IN (
        SELECT class_id FROM teacher_subjects ts
        WHERE ts.teacher_id = current_setting('jwt.claims.user_id')::uuid
      )
    )
  )
);

C. Finance Tables

Only finance_officer, bursar, school_admin, super_admin can view payments and fees.

RLS policies will filter student_fees and payments by school_id and role.

D. Messages & Notifications

Users can only access their own inbox.

Teachers can send to students/parents in their assigned classes.

RLS ensures no cross-class leaks.

5️⃣ JWT Claims & Role Mapping

Configure Supabase JWT claims to include:

user_id → links to users.user_id

role → maps to roles.name

Use these claims in RLS policies.

-- Example JWT claim usage
current_setting('jwt.claims.role')::text
current_setting('jwt.claims.user_id')::uuid
6️⃣ AI Implementation Instructions

Implement Supabase Auth email/password login & password reset.

Configure all 13 roles in roles table.

Apply RLS policies on all sensitive tables:

Students

Staff

Assessments

Disciplinary Records

Special Needs

Finance

Messages / Notifications

Ensure policies are production-ready, no bypasses, enforce per-role access.

Test RLS policies with multiple role scenarios.

Maintain concise Claude .md summary describing:

Auth setup

Role definitions

RLS policies per table

Any assumptions clarified with instructions

Modular file structure: if policies exceed 200–300 lines, split per module.

7️⃣ Notes for v2

Future support for phone OTP login.

Integration with mobile PWA auth.