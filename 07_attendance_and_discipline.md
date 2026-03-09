1️⃣ Purpose

Track daily attendance for students

Record disciplinary incidents

Track special needs and accommodations

Provide analytics & reporting dashboards for term-wise and yearly trends

Enforce role-based access and production-ready design

2️⃣ Tables
A. Attendance
Table	Description	Key Columns
attendance	Daily attendance for each student	attendance_id PK, student_id FK, class_id FK, date, status (Present/Absent/Late), recorded_by FK, remarks, created_at, updated_at

Notes:

Teachers and class teachers record attendance

Parents can view their child’s attendance

Admins can generate class or school-level summaries

B. Disciplinary Records
Table	Description	Key Columns
disciplinary_records	Record student incidents	record_id PK, student_id FK, incident_type, description, date, action_taken, recorded_by FK, created_at, updated_at

Notes:

Includes incident type categories (Minor, Major, Severe)

Role-based access: Admin, Principal, Deputy, relevant Teachers

C. Special Needs
Table	Description	Key Columns
special_needs	Track accommodations	special_needs_id PK, student_id FK, needs_type, description, accommodations, created_at, updated_at

Notes:

Links to student profiles

Supports CBC assessment adjustments

Role-based access: Admin, Principal, Deputy, Teacher, Class Teacher

D. Attendance & Discipline Analytics
Table	Description	Key Columns
attendance_analytics	Term/year attendance summaries	id PK, student_id FK, class_id FK, term, academic_year, total_present, total_absent, total_late, trend
discipline_analytics	Term/year disciplinary summaries	id PK, student_id FK, class_id FK, term, academic_year, total_incidents, major_incidents, trend
3️⃣ API Endpoints
Attendance
Endpoint	Method	Purpose	Access
/api/attendance	GET	List attendance per class/date	Teacher, Class Teacher, Admin
/api/attendance	POST	Record daily attendance	Teacher, Class Teacher
/api/attendance/:id	PUT	Update attendance	Teacher, Class Teacher, Admin
/api/attendance/analytics	GET	Term/year attendance summary	Admin, Principal, Deputy, Teacher
Discipline
Endpoint	Method	Purpose	Access
/api/discipline	GET	List disciplinary records	Admin, Principal, Deputy, Teachers
/api/discipline	POST	Record disciplinary incident	Admin, Principal, Deputy, Teacher
/api/discipline/:id	PUT	Update incident record	Admin, Principal, Deputy
/api/discipline/analytics	GET	Term/year summary	Admin, Principal, Deputy
Special Needs
Endpoint	Method	Purpose	Access
/api/special_needs	GET	List student special needs	Admin, Principal, Deputy, Teacher, Class Teacher
/api/special_needs	POST	Add special needs record	Admin, Principal, Deputy
/api/special_needs/:id	PUT	Update record	Admin, Principal, Deputy
4️⃣ Role-Based Access
Role	Permissions
Super Admin	Full access to all attendance, discipline, and special needs data
School Admin	View & manage all records
Principal	View & manage all records, analytics dashboards
Deputy	View & manage attendance & discipline
Teacher	Record and view own class students only
Class Teacher	Record attendance, view class students, manage adjustments for special needs
Parent	View own child’s attendance & discipline only
Student	View own attendance summary only
ICT Admin	View for system monitoring only
5️⃣ Analytics & Dashboards
Attendance Dashboard

Total Present / Absent / Late per term/year

Class-level averages

Trends (improving / stable / declining attendance)

Filters: Class, Term, Academic Year

Discipline Dashboard

Total incidents per student/class

Major incidents count

Trends over terms/years

Action taken summaries

Special Needs Dashboard

Students with accommodations

Accommodations per learning area/competency

Integration with CBC assessment analytics

Notes: All dashboards should be responsive, card-based, and chart-supported.

6️⃣ AI Implementation Instructions

Implement tables (attendance, disciplinary_records, special_needs, analytics) with foreign keys & constraints

Apply RLS policies per role

Implement API endpoints as defined for CRUD and analytics

Ensure term-wise and yearly aggregation for dashboards

Include trend calculation logic for attendance and disciplinary records

Integrate special needs adjustments with CBC assessments

Prepare concise Claude .md summary describing:

Tables and relationships

API endpoints

Dashboard metrics & visualizations

Role-based access

Maintain modular, production-ready, token-efficient design