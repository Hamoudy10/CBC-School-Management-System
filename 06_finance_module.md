1️⃣ Purpose

Implement student fee structures, invoices, and payments

Provide finance dashboards for admin, bursar, and finance officers

Ensure role-based access and RLS enforcement

Production-ready, fully normalized, modular

2️⃣ Tables
A. Fee Structures
Table	Description	Key Columns
fee_structures	Defines types of fees	fee_id PK, school_id FK, name, amount, description, academic_year, created_at, updated_at
B. Student Fees
Table	Description	Key Columns
student_fees	Assigns fees to students	student_fee_id PK, student_id FK, fee_id FK, amount_due, due_date, status (Pending/Paid/Overdue), created_at, updated_at
C. Payments
Table	Description	Key Columns
payments	Records fee payments	payment_id PK, student_fee_id FK, amount_paid, payment_method (Cash, Bank, Mpesa in v2), transaction_id, paid_at, recorded_byFK,created_at`
D. Finance Dashboard

Aggregates data for total fees, collected, pending, overdue

Visualizations: pie chart, bar chart, trend line per term/year

3️⃣ API Endpoints
Endpoint	Method	Purpose	Access
/api/fees	GET	List all fee structures	Finance Officer, Bursar, Admin, Super Admin
/api/fees	POST	Add new fee type	Finance Officer, Bursar, Admin
/api/fees/:id	PUT	Update fee structure	Finance Officer, Bursar, Admin
/api/student_fees	GET	List student fees	Finance Officer, Bursar, Admin, Parent, Student
/api/student_fees	POST	Assign fees to student	Finance Officer, Bursar, Admin
/api/payments	GET	List payments	Finance Officer, Bursar, Admin, Parent, Student
/api/payments	POST	Record payment	Finance Officer, Bursar

Notes:

Filter student fees by school_id, class_id, student_id per role

Status updates automatically (Paid, Pending, Overdue)

4️⃣ Role-Based Access
Role	Permissions
Super Admin	Full access to all finance tables & dashboards
School Admin	Manage fees, view all students’ payments
Finance Officer	Manage fees, assign student fees, record payments
Bursar	Record payments, view dashboards
Parent	View assigned student fees, payment history
Student	View own fees, payment history
Other roles	Read-only access limited to school-level dashboards (if applicable)
5️⃣ Finance Dashboard Design

Cards: total fees, collected, pending, overdue

Charts: term-wise collections, fee category breakdown

Tables: student-level fees & payment status

Filters: class, term, academic year

Downloadable Reports: PDF/Excel for administrative purposes

6️⃣ AI Implementation Instructions

Implement tables (fee_structures, student_fees, payments) with foreign keys & constraints

Apply RLS policies per role: only authorized roles can view/edit financial data

Implement API endpoints as defined for CRUD operations

Create finance dashboard with cards, charts, tables, filters

Ensure automatic status calculation for student fees

Prepare concise Claude .md summary describing:

Tables and relationships

API endpoints and access control

Dashboard design & metrics

Data aggregation & reporting logic

Maintain modular, production-ready, token-efficient design

Ensure future Mpesa integration is planned in v2 without changing core structure