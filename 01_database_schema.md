1️⃣ Purpose

Define all tables, relationships, constraints

Normalized schema for CBC compliance

Production-ready for Supabase/PostgreSQL

Covers: Academic, Administrative, Finance, Compliance, Communication

2️⃣ Schema Guidelines

Normalization: 3NF+ (no redundant data)

Referential integrity: foreign keys enforce relationships

Sensitive info: disciplinary, special needs stored securely

Audit fields: created_at, updated_at, created_by, updated_by

Role-based RLS-ready: tables include school_id / role_id for filtering

3️⃣ Core Tables & Relationships
A. Users & Roles
Table	Description	Key Columns
roles	All system roles	role_id PK, name, description
users	All system users	user_id PK, role_id FK, email, password_hash, first_name, last_name, phone, status, created_at, updated_at
user_profiles	Extended user info	user_id PK/FK, address, dob, photo_url, special_needs_id FK
B. Schools
Table	Description	Key Columns
schools	School profiles	school_id PK, name, type, address, contact_email, contact_phone, created_at, updated_at
C. Students & Enrollment
Table	Description	Key Columns
students	Core student info	student_id PK, user_id FK, admission_no, current_class_id FK, enrollment_date, status
student_classes	Student-class mapping per term/year	id PK, student_id FK, class_id FK, term, academic_year, status
D. Staff & Assignments
Table	Description	Key Columns
staff	Teachers, admin, finance, etc.	staff_id PK, user_id FK, tsc_no, employment_date, position, status
teacher_subjects	Which subjects a teacher handles	id PK, teacher_id FK, subject_id FK, class_id FK, term, academic_year
E. Academic Structure (CBC)
Table	Description	Key Columns
learning_areas	Main CBC learning areas	learning_area_id PK, name, description
strands	Subsections of learning areas	strand_id PK, learning_area_id FK, name, description
sub_strands	Further breakdown	sub_strand_id PK, strand_id FK, name, description
competencies	Skills/competencies	competency_id PK, sub_strand_id FK, name, description
performance_levels	CBC performance descriptors	level_id PK, name (Below Expectation / Approaching / Meeting / Exceeding), description
F. Assessments
Table	Description	Key Columns
assessments	Individual assessment events	assessment_id PK, student_id FK, competency_id FK, score, level_id FK, term, academic_year, remarks, assessed_by FK, date
report_cards	Term/year report summaries	report_id PK, student_id FK, term, academic_year, generated_at, pdf_url, analytics_json
G. Attendance
Table	Description	Key Columns
attendance	Daily attendance	id PK, student_id FK, date, status (Present/Absent/Late), recorded_by FK
H. Finance
Table	Description	Key Columns
fee_structures	School fee categories	id PK, name, amount, description, academic_year
student_fees	Assigned fees per student	id PK, student_id FK, fee_structure_id FK, amount_due, due_date, status
payments	Payment records	id PK, student_fee_id FK, amount_paid, payment_method, transaction_id, paid_at
I. Compliance & Discipline
Table	Description	Key Columns
disciplinary_records	Records for students	id PK, student_id FK, incident_type, description, date, action_taken, recorded_by FK
parent_consents	GDPR/DP Act compliance	id PK, student_id FK, consent_type, consent_status, date_given
J. Communication
Table	Description	Key Columns
messages	Internal messaging	id PK, sender_id FK, receiver_id FK, subject, body, sent_at, read_status
notifications	System notifications	id PK, user_id FK, title, body, type, read_status, created_at
K. Audit & Logging
Table	Description	Key Columns
audit_logs	Track changes	id PK, table_name, record_id, action, performed_by FK, performed_at, changes_json
4️⃣ Relationships & Notes

users → roles (many-to-one)

students → user_profiles (one-to-one)

students → student_classes (one-to-many)

staff → teacher_subjects (one-to-many)

assessments → competencies → sub_strands → strands → learning_areas (hierarchy for CBC)

report_cards → aggregates assessments for term/year

All sensitive tables (disciplinary, special needs) must have restricted RLS policies

5️⃣ AI Implementation Instructions

Generate Supabase tables & relations exactly as defined.

Avoid mock/demo data; production-ready tables only.

Include all audit fields for tracking and compliance.

Ensure tables can support term-wise and yearly analytics.

Modular: separate files per major module if file gets too large.

Maintain CBC hierarchy integrity (learning areas → strands → sub-strands → competencies → performance levels).

Add comments/documentation in DB schema to explain each table & field.

After implementing, prepare a concise Claude .md summary describing all tables, relationships, and constraints.