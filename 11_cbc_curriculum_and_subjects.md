1️⃣ Purpose

Define CBC subjects, learning areas, strands, sub-strands, and competencies

Map students and teachers to subjects

Support assessment engine integration for term-wise and yearly tracking

Ensure modular, production-ready design for analytics, report generation, and dashboards

2️⃣ Tables
A. Subjects
Table	Description	Key Columns
subjects	List of CBC subjects	subject_id PK, name, code, description, term_applicable (Term 1/2/3), created_at, updated_at
B. Learning Areas
Table	Description	Key Columns
learning_areas	Group subjects into broad areas	area_id PK, name, description, created_at, updated_at
C. Strands
Table	Description	Key Columns
strands	Specific focus within a learning area	strand_id PK, area_id FK, name, description, created_at, updated_at
D. Sub-Strands
Table	Description	Key Columns
sub_strands	Detailed competencies under a strand	sub_strand_id PK, strand_id FK, name, description, created_at, updated_at
E. Competencies
Table	Description	Key Columns
competencies	Specific learning outcomes	competency_id PK, sub_strand_id FK, name, description, term, assessment_type (Observation/Test/Project), created_at
F. Student-Subject Mapping
Table	Description	Key Columns
student_subjects	Assign subjects to students	mapping_id PK, student_id FK, subject_id FK, teacher_id FK, term, academic_year
G. Teacher-Subject Mapping
Table	Description	Key Columns
teacher_subjects	Assign teachers to subjects/classes	mapping_id PK, teacher_id FK, subject_id FK, class_id FK, term, academic_year
3️⃣ API Endpoints
Subjects & Learning Areas
Endpoint	Method	Purpose	Access
/api/subjects	GET	List all subjects	Admin, Super Admin, Principal
/api/subjects	POST	Add new subject	Admin, Super Admin
/api/subjects/:id	PUT	Update subject	Admin, Super Admin
/api/learning_areas	GET	List all learning areas	Admin, Super Admin
/api/strands	GET	List strands per learning area	Admin, Super Admin
/api/sub_strands	GET	List sub-strands per strand	Admin, Super Admin
/api/competencies	GET	List competencies per sub-strand	Teacher, Admin
Mapping Students & Teachers
Endpoint	Method	Purpose	Access
/api/student_subjects	GET	List student subjects	Teacher, Class Teacher, Admin
/api/student_subjects	POST	Assign subjects to students	Admin
/api/teacher_subjects	GET	List teacher subjects	Teacher, Admin
/api/teacher_subjects	POST	Assign teachers to subjects	Admin
4️⃣ Role-Based Access
Role	Permissions
Super Admin	Full access to all subjects, strands, competencies, mappings
School Admin	Manage subjects, learning areas, teacher/student mapping
Principal	View all mappings and subject details
Deputy	View assigned classes and subjects
Teacher	Access own subjects, competencies, and assigned students
Class Teacher	Access class subjects and student mapping
Parent	View child’s subjects (read-only)
Student	View own subjects and learning areas
ICT Admin	View for monitoring only
5️⃣ Dashboard & Analytics

Subject Dashboard: subjects per class, assigned teachers

Learning Area Dashboard: average performance per area

Competency Dashboard: track student mastery per sub-strand

Filters: term, academic year, class, teacher

Exportable reports: CSV/JSON/PDF for integration with report generation

6️⃣ AI Implementation Instructions

Implement tables (subjects, learning_areas, strands, sub_strands, competencies, student_subjects, teacher_subjects) with foreign keys & constraints

Apply RLS policies per role

Implement API endpoints for CRUD operations and mappings

Ensure term-wise and yearly mapping for students and teachers

Integrate with assessment engine for competency tracking

Prepare concise Claude .md summary describing:

Tables & relationships

API endpoints

Student-teacher-subject mapping logic

CBC curriculum structure for analytics

Maintain modular, production-ready, token-efficient design