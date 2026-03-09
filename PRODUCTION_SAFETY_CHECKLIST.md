PRODUCTION SAFETY CHECKLIST

CBC SCHOOL ERP SYSTEM

1️⃣ DATABASE HARDENING
1.1 Enforce Foreign Keys Everywhere

All relational columns must use REFERENCES

Use ON DELETE RESTRICT unless explicitly needed

No orphan records allowed

1.2 Add Composite Unique Constraints

Must exist:

-- Assessment uniqueness
UNIQUE (student_id, competency_id, term, academic_year);

-- Attendance uniqueness
UNIQUE (student_id, date);

-- Finance payment safety
UNIQUE (student_fee_id, transaction_id);

-- Active academic year constraint
UNIQUE (school_id) WHERE is_active = true;
1.3 CHECK Constraints
CHECK (score >= 1 AND score <= 4);
CHECK (amount_due >= 0);
CHECK (amount_paid >= 0);
CHECK (term IN ('Term 1','Term 2','Term 3'));
1.4 Required Indexes

Add indexes to:

school_id

student_id

teacher_id

class_id

term

academic_year

created_at

Heavy tables:

assessments

attendance

payments

messages

1.5 Database Triggers

Create triggers for:

Auto-update aggregate tables on assessment change

Auto-write audit trail entries

Prevent deleting referenced users

Enforce only one active academic year

Enforce only one active term per year

2️⃣ ROW-LEVEL SECURITY (RLS)

Every table must include:

school_id UUID NOT NULL

RLS policies must enforce:

user.school_id = table.school_id

Teachers only see assigned students

Parents only see linked child

Students only see own records

Never rely on frontend filtering.

3️⃣ INPUT VALIDATION LAYER

All API routes must:

Validate payload using schema validation (Zod/Joi)

Reject invalid score ranges

Reject negative payments

Reject term mismatch

Sanitize text fields (XSS prevention)

Validate role before DB execution

Validation must run BEFORE database queries.

4️⃣ AUTHENTICATION SECURITY

Must implement:

Short-lived access tokens (15–30 min)

Refresh token rotation

HTTP-only secure cookies

Strong password rules

Account lock after 5 failed attempts

Email verification for new accounts

Password reset token expiration (15 min)

5️⃣ AUDIT LOGGING (IMMUTABLE)

Audit these actions:

User creation

Role changes

Assessment edits

Payment edits

Promotion decisions

Login attempts

Configuration changes

Audit rules:

Cannot be edited

Cannot be deleted

Must include performed_by

Must include timestamp

Must include JSON details

6️⃣ RATE LIMITING

Apply rate limits to:

Login

Password reset

Messaging

Payment submission

Report generation

Implement:

IP-based throttling

Per-user throttling

Cooldown enforcement

7️⃣ DATA PRIVACY & ENCRYPTION

Required:

HTTPS enforced

Encryption at rest

Encrypted backups

No plaintext passwords

No DB credentials in code

Restricted production DB access

Access logging enabled

8️⃣ BACKUP & DISASTER RECOVERY

Must implement:

Daily automated backups

Off-site backup storage

Restore testing quarterly

Backup encryption

Disaster recovery document

You must answer:

How long does full system restore take?

9️⃣ TESTING REQUIREMENTS

Minimum test coverage:

Assessment aggregation logic

Promotion rule logic

RLS isolation tests

Role permission tests

Finance payment validation

Report generation logic

Include:

Unit tests

Integration tests

Permission boundary tests

Load testing for assessments

🔟 PERFORMANCE PROTECTION

Must implement:

Pagination on list endpoints

Query limits

Proper indexing

Avoid N+1 queries

Caching for dashboard analytics

Bulk insert optimization for assessments

1️⃣1️⃣ DEPLOYMENT SAFETY

Required setup:

Separate dev / staging / production

Environment variable isolation

Migration version control

CI pipeline before deployment

Rollback capability

Zero-downtime migration plan

1️⃣2️⃣ MONITORING & ALERTING

Must monitor:

Failed login spikes

DB CPU usage

Slow queries

Backup failures

Payment processing errors

API error rate

Implement structured logging.

✅ PRODUCTION READINESS CRITERIA

You are production-safe when:

RLS is tested and enforced

Audit logs are immutable

Backups are automated

Rate limits are active

Role escalation is impossible

All core logic has tests

Monitoring is active

Disaster recovery plan exists

Until then — do not deploy to live schools.

END OF FILE