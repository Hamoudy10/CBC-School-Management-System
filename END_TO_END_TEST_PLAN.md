# End-to-End QA & UAT Plan

## Prerequisites
- Production-like Supabase project seeded with realistic data (100+ students, 10+ staff, 5+ classes)
- M-Pesa sandbox credentials configured
- At least one AI provider API key (Groq/OpenAI)
- At least 3 test users: super_admin, finance_admin, teacher

## Test Scripts (Manual)

### 1. Authentication Flows
- [ ] Login with valid credentials → lands on dashboard
- [ ] Login with invalid credentials → error message
- [ ] Password reset flow → email sent, reset works
- [ ] Session timeout → redirected to login
- [ ] Role-based redirects (teacher sees different dashboard than admin)

### 2. Student Management
- [ ] Create student → appears in student list
- [ ] Edit student → changes persisted
- [ ] Import students via CSV → records created
- [ ] Delete student (with confirmation) → soft/hard delete
- [ ] Search/filter students → correct results

### 3. Attendance
- [ ] Record attendance for a class → summary updated
- [ ] Batch attendance recording → all records saved
- [ ] Attendance report → correct percentages
- [ ] Import attendance CSV → records created

### 4. Finance
- [ ] Create fee structure → appears in list
- [ ] Assign fee to student → balance correct
- [ ] Record payment → receipt generated, balance updated
- [ ] M-Pesa STK Push → payment received (sandbox)

### 5. Assessments
- [ ] Create assessment → appears in class view
- [ ] Record assessment results → grade calculated
- [ ] View student report card → all subjects shown

### 6. AI Agent
- [ ] "How many students are in Class 4?" → correct count
- [ ] "Show me attendance for John" → filtered results
- [ ] "Create a new student" → confirmation prompt, then created
- [ ] "Delete student X" → confirmation prompt, blocked for low-permission roles

### 7. Parent Portal
- [ ] Parent logs in → sees children's data only
- [ ] Parent views fee summary → correct balance shown
- [ ] Parent initiates STK Push → request recorded

### 8. Offline/PWA
- [ ] App can be installed via browser (PWA prompt)
- [ ] Open app offline → cached pages load
- [ ] Queue actions offline → sync when back online

## UAT Sign-off

| Role | Signed Off | Date |
|------|------------|------|
| School Administrator | | |
| Finance Officer | | |
| Teacher | | |
| Parent (representative) | | |
| System Admin (technical) | | |

## Known Limitations (Pre-Launch)
- Offline sync is best-effort (no conflict resolution).
- SVG file uploads blocked due to XSS risk.
- Rate limiting is in-memory (resets on server restart).
- M-Pesa webhook relies on IP whitelisting only (no HMAC).
