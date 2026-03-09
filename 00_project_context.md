1️⃣ Project Overview

System Name: [To be defined, e.g., Kenyan CBC School Management System]

Target: Primary school + private academy

Curriculum: Strictly CBC (Kenya)

Goal: Build production-ready system to sell to schools, modular, easily adaptable

Users: 300–1000 students initially

2️⃣ User Roles

Super Admin (system owner)

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

Note: Each role has strict RBAC access; all permissions must be implemented via Supabase RLS.

3️⃣ Modules & Submodules

Academic

Student admission

CBC assessment tracking

Gradebook (rubric-based)

Report card generation (term-wise & yearly, analytics & trends)

Timetable

Attendance

Competency analytics dashboard

Administrative

Staff management (TSC tracking, roles, leaves)

School profile & settings

Finance

Fees, invoices, payment tracking (Mpesa integration in v2)

Compliance

Data retention & protection

Audit logs

Parent consent tracking

Communication

Messaging system

SMS / notifications

Parent portal

4️⃣ Tech Stack

Frontend: Next.js (responsive, modern, mobile-adaptable, PWA-ready)

Backend: Supabase (PostgreSQL + Auth + RLS)

Hosting: Frontend → Vercel, Backend → Supabase free tier

Version Control: GitHub

5️⃣ Database & Schema Guidelines

Highly normalized schema

Must store disciplinary records & special needs info

Should support term-wise and yearly analytics

Modular structure: tables per module (students, staff, assessments, competencies, finance, communication, compliance)

6️⃣ Authentication & Security

Email/password authentication (Supabase Auth)

Role-based access control (Supabase RLS)

Data protection aligned with Kenya Data Protection Act 2019

Audit logging for sensitive actions

7️⃣ UI/UX Requirements

Claude to generate modern, responsive, appealing design

Standard component library for forms, dashboards, tables, notifications

Must reflect all modules, roles, and CBC reporting structure

Design should allow future mobile adaptation

8️⃣ Reporting Requirements

Term-wise and yearly report cards

Analytics and trend visualization

Printable and downloadable PDFs inside the system

9️⃣ AI Implementation Rules (to be strictly followed in all .md files)

Never assume; always clarify with instructions.

No mock/demo data; production-ready data structures only.

Prepare concise, detailed summary of implementation in every .md file.

Modular, small, manageable files; build up to full system.

Token-efficient; split large modules into multiple .md if necessary.

Responsive, modern UI/UX; visually appealing, mobile-adaptable.

Always reflect CBC curriculum, Kenyan compliance, roles, and modules.

10️⃣ Deployment & Version Control

GitHub for source tracking

Vercel for frontend deployment

Supabase free-tier backend hosting

Modular .md design to track progress per module

11️⃣ Future Notes / v2

Mpesa integration in finance module

Multi-school adaptability

Mobile app adaptation