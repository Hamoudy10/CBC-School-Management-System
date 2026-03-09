1️⃣ Purpose

Generate term-wise and yearly reports for students

Include CBC assessments, attendance, discipline, and finance

Support downloadable PDFs and analytics exports

Enforce role-based access and production-ready design

Integrate with Supabase storage for report files

2️⃣ Tables
A. Report Cards
Table	Description	Key Columns
report_cards	Stores report metadata	report_id PK, student_id FK, term, academic_year, generated_by FK, pdf_url, analytics_json, created_at
B. Analytics
Table	Description	Key Columns
analytics	Derived metrics per student	analytics_id PK, student_id FK, learning_area_id FK, term, academic_year, average_score, performance_level, trend, additional_notes
C. Report Templates
Table	Description	Key Columns
report_templates	Define PDF layout and sections	template_id PK, name, sections_json, created_at, updated_at

Notes:

analytics_json is frontend-ready for charts/trends

Templates allow modular report design and easy future updates

3️⃣ API Endpoints
Endpoint	Method	Purpose	Access
/api/report_cards	GET	List generated reports	Teacher, Class Teacher, Parent, Student, Admin
/api/report_cards/:id	GET	Fetch PDF and analytics	Teacher, Class Teacher, Parent, Student, Admin
/api/report_cards	POST	Generate new report	Teacher, Class Teacher, Admin
/api/report_cards/:id	DELETE	Remove report	Admin, Super Admin
/api/analytics/export	GET	Export analytics CSV/JSON	Admin, Principal, Deputy, Teacher
4️⃣ PDF Generation Logic

Collect student data: CBC assessments, attendance, discipline, fees

Aggregate term-wise and yearly metrics

Map CBC scores → performance levels

Include attendance summary and discipline incidents

Integrate finance info (fees paid/pending)

Use modular templates from report_templates

Generate PDF via Node.js library (e.g., pdfkit, puppeteer, or html-to-pdf)

Store PDFs in Supabase storage and save pdf_url in report_cards table

Generate analytics JSON for dashboards

5️⃣ Dashboard & Visualization

Term-wise dashboard per student:

CBC performance per learning area

Attendance summary

Discipline summary

Fees summary

Yearly dashboard:

Aggregated trends over three terms

Graphical visualization: line charts, radar charts, pie charts

Filters: class, term, academic year

Download: PDF or CSV export

6️⃣ Role-Based Access
Role	Permissions
Super Admin	Full access to all reports & analytics
School Admin	Generate & view all student reports
Principal	Generate & view reports for school
Deputy	View reports and analytics dashboards
Teacher	Generate term reports for assigned students
Class Teacher	Generate term reports for own class
Parent	View own child’s reports
Student	View own reports
ICT Admin	View for system monitoring only
7️⃣ AI Implementation Instructions

Implement report generation logic with modular templates

Implement PDF storage and URL retrieval via Supabase

Aggregate all module data (CBC, attendance, discipline, finance)

Implement analytics JSON generation for dashboards

Ensure role-based access in API endpoints

Provide downloadable PDFs & CSV exports

Prepare concise Claude .md summary including:

Report tables & templates

PDF generation logic

Analytics calculation & JSON structure

Role-based access rules

Maintain modular, production-ready, token-efficient design