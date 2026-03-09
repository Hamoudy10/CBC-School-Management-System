1️⃣ Purpose

Record CBC competency-based assessments

Calculate strand, sub-strand, subject, and learning area performance

Generate term-wise and yearly aggregates

Provide trend analytics

Integrate with:

Curriculum module

Reporting module

Dashboards

Special needs adjustments

2️⃣ Core CBC Assessment Structure

CBC hierarchy:

Learning Area
 └── Strand
      └── Sub-Strand
           └── Competency
                └── Student Assessment
3️⃣ Tables
A. Student Assessments
Column	Type	Description
assessment_id	PK	Unique record
student_id	FK	Linked student
competency_id	FK	Linked competency
score	INT	Numeric score (1–4 or 1–5 scale)
performance_level	ENUM	Below / Approaching / Meeting / Exceeding
term	VARCHAR	Term 1/2/3
academic_year	VARCHAR	e.g. 2026
assessed_by	FK	Teacher
remarks	TEXT	Optional comments
created_at	TIMESTAMP	
updated_at	TIMESTAMP	
B. Strand Aggregates
Column	Type
strand_result_id	PK
student_id	FK
strand_id	FK
term	VARCHAR
academic_year	VARCHAR
average_score	DECIMAL
performance_level	ENUM
trend	VARCHAR
C. Learning Area Aggregates
Column	Type
area_result_id	PK
student_id	FK
area_id	FK
term	VARCHAR
academic_year	VARCHAR
average_score	DECIMAL
performance_level	ENUM
trend	VARCHAR
D. Yearly Results
Column	Type
year_result_id	PK
student_id	FK
academic_year	VARCHAR
overall_average	DECIMAL
overall_performance	ENUM
promotion_status	VARCHAR
trend	VARCHAR
4️⃣ Performance Level Mapping Logic

Example (4-point CBC scale):

Score	Performance Level
1.0 – 1.9	Below Expectation
2.0 – 2.9	Approaching
3.0 – 3.4	Meeting
3.5 – 4.0	Exceeding

This mapping should be centralized in:

/utils/performanceMapping.ts

Never hard-code mapping inside controllers.

5️⃣ Aggregation Logic
Term Aggregation

Average competency scores → Sub-strand

Average sub-strands → Strand

Average strands → Learning Area

Average learning areas → Overall term performance

Year Aggregation

Average Term 1, 2, 3 results

Compute yearly performance level

Calculate trend:

Improving

Stable

Declining

6️⃣ API Endpoints
Assessments
Endpoint	Method	Access
/api/assessments	GET	Teacher, Admin
/api/assessments	POST	Teacher
/api/assessments/:id	PUT	Teacher
/api/assessments/:id	DELETE	Admin
Aggregates
Endpoint	Method	Access
/api/assessments/strand_results	GET	Teacher, Admin
/api/assessments/area_results	GET	Teacher, Admin
/api/assessments/year_results	GET	Admin, Principal
Analytics
Endpoint	Method	Access
/api/assessments/trends	GET	Admin, Principal
/api/assessments/student/:id	GET	Teacher, Parent (restricted), Student (self)
7️⃣ Role-Based Access
Role	Permissions
Super Admin	Full control
Admin	Full academic oversight
Principal	View analytics & yearly results
Deputy	View class performance
Teacher	Assess assigned students only
Class Teacher	View all subject performance for class
Parent	View own child results
Student	View own performance
ICT Admin	Monitoring only

All enforcement via:

JWT role claims

RLS policies

Subject-to-teacher mapping validation

8️⃣ Special Needs Integration

When calculating averages:

If student has active accommodation:

Allow modified scoring scale

Flag adjusted assessments

Include adjusted = true in analytics JSON

Never alter raw scores — adjustments must be layered, not destructive.

9️⃣ Dashboard Design
Teacher Dashboard

Class competency heatmap

Strand averages

Low-performing student alerts

Admin Dashboard

School-wide learning area performance

Term comparisons

Yearly improvement trends

Student Dashboard

Radar chart per learning area

Performance trend graph

Filters:

Term

Academic year

Class

Learning area

🔟 Data Integrity Rules

Unique constraint:

student_id + competency_id + term + academic_year

Soft delete for assessments (optional)

Trigger to auto-update aggregates when assessment inserted/updated

1️⃣1️⃣ AI Implementation Instructions

Create normalized tables with foreign keys

Implement aggregation service layer (not inside controller)

Centralize performance-level mapping logic

Add RLS policies for teacher/student isolation

Implement trend calculation logic

Integrate with reporting module

Maintain modular, production-grade architecture

Produce concise implementation summary