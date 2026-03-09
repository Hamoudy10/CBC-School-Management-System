1️⃣ Purpose

Configure academic years and terms

Define grading scales (CBC or custom)

Manage promotion rules

Control system-wide academic behavior

Enable branding and report customization

Support multi-school architecture

All other modules must reference this module — never hardcode academic rules.

2️⃣ Core Configuration Architecture

Configuration hierarchy:

System
 └── School
      ├── Academic Years
      ├── Terms
      ├── Grading Scales
      ├── Promotion Rules
      └── Branding Settings
3️⃣ Tables
A. Schools
Column	Type	Description
school_id	PK	Unique school
name	VARCHAR	School name
code	VARCHAR	Unique identifier
address	TEXT	
phone	VARCHAR	
email	VARCHAR	
logo_url	TEXT	
primary_color	VARCHAR	Branding
created_at	TIMESTAMP	
updated_at	TIMESTAMP	

Supports multi-tenant deployment.

B. Academic Years
Column	Type
year_id	PK
school_id	FK
name	VARCHAR (e.g. 2026)
start_date	DATE
end_date	DATE
is_active	BOOLEAN

Only one active year per school.

C. Terms
Column	Type
term_id	PK
year_id	FK
name	VARCHAR (Term 1/2/3)
start_date	DATE
end_date	DATE
is_active	BOOLEAN

Used by:

Assessment engine

Attendance

Finance

Reporting

D. Grading Scales
Column	Type
scale_id	PK
school_id	FK
name	VARCHAR
min_score	DECIMAL
max_score	DECIMAL
performance_label	VARCHAR
description	TEXT

Example CBC 4-point scale configurable per school.

Never hardcode grade boundaries in code.

E. Promotion Rules
Column	Type
rule_id	PK
school_id	FK
minimum_average	DECIMAL
minimum_attendance_percentage	DECIMAL
allow_conditional_promotion	BOOLEAN
created_at	TIMESTAMP

Used by yearly result engine.

F. System Settings
Column	Type
setting_id	PK
school_id	FK
key	VARCHAR
value	JSONB
updated_at	TIMESTAMP

Examples:

"attendance_required_for_exam": true

"enable_sms_notifications": false

"default_currency": "KES"

4️⃣ API Endpoints
Schools
Endpoint	Method	Access
/api/schools	GET	Super Admin
/api/schools	POST	Super Admin
/api/schools/:id	PUT	Super Admin
Academic Years & Terms
Endpoint	Method	Access
/api/academic_years	GET	Admin
/api/academic_years	POST	Admin
/api/terms	GET	Admin
/api/terms	POST	Admin
Grading Scales
Endpoint	Method	Access
/api/grading_scales	GET	Admin
/api/grading_scales	POST	Admin
/api/grading_scales/:id	PUT	Admin
Promotion Rules
Endpoint	Method	Access
/api/promotion_rules	GET	Admin
/api/promotion_rules	POST	Admin
/api/promotion_rules/:id	PUT	Admin
System Settings
Endpoint	Method	Access
/api/system_settings	GET	Admin
/api/system_settings	PUT	Admin
5️⃣ Business Logic Rules
Academic Year

Only one is_active = true

Activating a year auto-deactivates previous year

Term

Only one active term per academic year

Term dates must fall within academic year range

Grading

No overlapping score ranges

Must cover complete score spectrum

Promotion

Promotion engine must check:

IF yearly_average >= minimum_average
AND attendance_percentage >= minimum_attendance_percentage
THEN Promote
ELSE Repeat OR Conditional
6️⃣ Role-Based Access
Role	Permissions
Super Admin	Manage all schools
School Admin	Manage academic settings
Principal	View settings
Deputy	View academic calendar
Teacher	Read-only term info
Parent	No access
Student	No access
ICT Admin	System monitoring
7️⃣ Integration Points

This module is referenced by:

Assessment engine → grading scale

Attendance → term boundaries

Finance → academic year

Reporting → branding + active year

Promotion → yearly results

Dashboard → active term filters

All modules must query settings dynamically.

8️⃣ Multi-Tenant Enforcement

Every major table across system must include:

school_id UUID NOT NULL

And enforce RLS:

user.school_id = table.school_id

Prevents cross-school data leakage.

9️⃣ AI Implementation Instructions

Implement normalized configuration tables

Enforce single active year/term constraint

Centralize grading scale logic in service layer

Apply RLS for school isolation

Integrate promotion engine with yearly results

Ensure no module hardcodes dates or grade boundaries

Produce concise implementation summary

Maintain modular architecture

🔟 System Architecture Status

You now have defined:

Authentication & Roles

Finance Module

Attendance & Discipline

Reporting & PDF Generation

Notifications

CBC Curriculum

Assessment Engine

School Configuration
