1️⃣ Purpose

Define all API endpoints for frontend-backend communication

Implement CRUD operations for all modules

Enforce authentication & role-based access control

Integrate Supabase functions & RLS policies

Ensure production-ready, token-efficient design

2️⃣ General Guidelines

RESTful endpoints for simplicity and compatibility

Modular route structure (per module: academic, admin, finance, compliance, communication)

Supabase client in Next.js for backend calls

JWT claims used for user_id and role to enforce permissions

Error handling: consistent JSON response { success: bool, data: object/null, error: string/null }

Rate limiting & validation to prevent misuse (basic for v1)

Pagination for tables (students, assessments, messages)

All endpoints production-ready, no mock data

3️⃣ API Structure
A. Academic Module
Endpoint	Method	Purpose	Access
/api/students	GET	List students (class/teacher-specific)	Teacher, Class Teacher, Principal, Deputy, Admin
/api/students/:id	GET	Student profile	Same as above + parent of student
/api/students	POST	Add new student	Admin, Super Admin
/api/students/:id	PUT	Update student info	Admin, Super Admin
/api/assessments	GET	List student assessments	Teacher, Principal, Deputy
/api/assessments	POST	Add assessment	Teacher, Subject Teacher
/api/assessments/:id	PUT	Update assessment	Teacher, Subject Teacher
/api/report_cards/:student_id	GET	Generate term/year report	Teacher, Class Teacher, Parent, Student

Notes:

Include filters for term & academic year

Analytics included in report JSON

B. Administrative Module
Endpoint	Method	Purpose	Access
/api/staff	GET	List staff	Admin, Super Admin
/api/staff/:id	GET	Staff profile	Admin, Principal, Deputy
/api/staff	POST	Add staff	Admin, Super Admin
/api/staff/:id	PUT	Update staff info	Admin, Super Admin
/api/classes	GET/POST/PUT	Class management	Admin, Principal, Deputy
/api/timetable	GET/POST/PUT	Manage class timetable	Admin, Principal, Deputy
C. Finance Module (v1)
Endpoint	Method	Purpose	Access
/api/fees	GET/POST/PUT	Fee structures	Finance Officer, Bursar, Admin
/api/student_fees	GET	Student-specific fees	Finance Officer, Bursar, Admin, Parent, Student
/api/payments	GET/POST	Record payments	Finance Officer, Bursar

Notes:

Mpesa integration planned for v2

Status badges included in API response (Paid, Due, Overdue)

D. Compliance Module
Endpoint	Method	Purpose	Access
/api/discipline	GET/POST/PUT	Disciplinary records	Admin, Principal, Deputy, Teacher
/api/parent_consents	GET/POST/PUT	Consent tracking	Admin, Parent
E. Communication Module
Endpoint	Method	Purpose	Access
/api/messages	GET	Inbox	All roles (filtered)
/api/messages	POST	Send message	Teacher, Admin, Super Admin, Parent
/api/notifications	GET	System notifications	All roles
/api/notifications	POST	Create notification	Admin, Super Admin
4️⃣ Supabase Integration

Use Supabase client in API routes:

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

Queries should respect RLS policies

CRUD operations mapped to tables: students, staff, assessments, report_cards, fees, payments, disciplinary_records, messages, notifications

Joins and filters applied server-side for large tables

5️⃣ API Security & RLS

Use JWT claims to enforce access: user_id, role

Example:

const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('current_class_id', classId)
  .eq('school_id', userSchoolId) // ensures school-level access

Avoid exposing full tables to unauthorized users

Audit logs for sensitive actions (INSERT, UPDATE, DELETE)

6️⃣ File Upload & PDF Generation

Reports stored in Supabase storage bucket

report_cards.pdf_url contains secure link

API endpoint returns URL + metadata for frontend display

7️⃣ AI Implementation Instructions

Implement all API endpoints as defined

Ensure RLS-compliant queries (Supabase enforced)

Include filters, pagination, term/year selection

Connect CBC assessment engine for analytics & trends

Enable PDF generation for reports

Include error handling with consistent JSON responses

Maintain modular file structure if API code exceeds token limits

Prepare concise Claude .md summary including:

Endpoints per module

RLS policies per table

Notes on data filters, analytics, PDF links