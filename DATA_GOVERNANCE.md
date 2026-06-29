# Data Governance & Compliance

## Regulatory Context

### Kenya Data Protection Act (2019)
- **Data Controller**: The school (not the platform provider).
- **Data Processor**: CBC School Management System.
- **Legal Basis**: Contractual necessity (school operations), consent (parent communication).
- **Data Subject Rights**: Access, rectification, erasure, portability, objection.

### Children's Online Privacy
- Student data requires parental consent (for children under 18).
- Student records accessible only by authorized school staff and parents/guardians.

## Data Classification

| Classification | Examples | Access Restriction |
|----------------|----------|-------------------|
| **Public** | School name, term dates, academic calendar | No auth required |
| **Internal** | Class rosters, timetable, fee structures | Authenticated users only |
| **Confidential** | Student grades, attendance records, discipline | Role-based (teacher/staff/parent) |
| **Restricted** | Payment details, M-Pesa transactions, audit logs | Finance + admin only |
| **Highly Restricted** | Password hashes, API keys, service-role tokens | Service role only (never client-side) |

## Data Retention

| Data Type | Retention Period | Action After |
|-----------|-----------------|--------------|
| Active student records | Duration of enrollment + 3 years | Archive |
| Payment records | 7 years (tax compliance) | Delete or anonymize |
| Attendance records | 2 years | Aggregate + delete raw |
| Audit logs | 3 years | Archive |
| Session/chat logs | 1 year | Delete |
| Error logs | 90 days | Rotate |

## Data Deletion Procedures

### Student Data Erasure (Right to be Forgotten)
1. De-identify student record: remove `first_name`, `last_name`, `admission_number`, contacts.
2. Keep anonymized academic records for statistical purposes.
3. Delete associated attendance, assessment, discipline, and fee records.
4. Log the erasure request in `audit_logs` with `action: "GDPR_ERASURE"`.

### School Data Deletion (Contract End)
1. Export all school data (admin dashboard → Export).
2. Delete all rows scoped to `school_id`.
3. Delete the school's storage bucket content.
4. Confirm deletion and provide certificate of destruction.

## Security Measures
- **Encryption at rest**: Supabase PostgreSQL (AES-256).
- **Encryption in transit**: TLS 1.3.
- **Access logging**: All payment, student, and user modifications logged to `audit_logs`.
- **Password policy**: Min 9 chars, 3 of 4 character types (uppercase, lowercase, digits, special).
- **Session expiry**: 7 days absolute max (configurable), 24h inactivity timeout.
