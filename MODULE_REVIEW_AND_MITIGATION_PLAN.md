# Module Review And Mitigation Plan

Review date: 2026-07-13

Scope reviewed:
- Lesson planner: `app/(dashboard)/academics/lesson-planner`, `app/(dashboard)/ai-tools/lesson-planner`, CBC Copilot API, AI grading lesson API
- AI grading: grading API, service, schema, UI
- Online application form: public `/apply`, admissions APIs, admissions dashboard
- Communication: messages, notifications, announcements, broadcast routes
- Predictive analytics: forecasts, clusters, interventions, subject recommendations
- AI Data Query: natural-language analytics query module

Verification performed:
- `npm.cmd run type-check` passes.
- Review was static plus behavioral tracing through UI, route, service, and validator layers.

## Executive Summary

The code compiles, but several modules have production-risk behavioral defects. The highest priority items are:

1. Public admission submissions are assigned to the first school in the database, which is unsafe in a multi-school system.
2. AI grading accepts model scores without clamping or recomputing trusted class summaries, so impossible marks can be returned.
3. Predictive performance forecasts request AI predictions but the AI response schema cannot map predictions back to learning-area rows.
4. Communication message sending is not transactional; a message can be created without recipients and still be reported as success.
5. AI Data Query is useful, but its current implementation should not expose raw generated SQL, and its query-plan handling needs stricter guardrails.

## Why The AI Data Query Module Exists

The AI Data Query module lets school leaders and staff ask operational questions in plain English, such as:
- Which students are below meeting expectations in Grade 5?
- What is the attendance breakdown this month?
- Which learning areas have the lowest averages?
- What is the fee payment status by class?

Why it matters:
- It reduces dependence on custom reports for every question.
- It helps non-technical users reach the data already stored in assessments, attendance, discipline, and finance.
- It is useful for fast decision-making during staff meetings, parent meetings, intervention planning, and leadership reviews.
- It can become the bridge between dashboards and action, especially when paired with saved queries, drill-downs, and role-based access.

Important limitation:
- It must be treated as an analytics assistant, not an unrestricted database agent. The system should build safe structured queries server-side and never trust free-form model output as executable SQL.

## Confirmed Issues And Mitigation Plan

### 1. Lesson Planner

Relevant files:
- `app/(dashboard)/academics/lesson-planner/page.tsx`
- `app/(dashboard)/ai-tools/lesson-planner/page.tsx`
- `app/api/ai/cbc-copilot/lesson-plan/route.ts`
- `app/api/ai-grading/generate-lesson/route.ts`
- `features/ai-cbc-copilot/services/cbcCopilot.service.ts`
- `features/ai-grading/services/lesson-generator.service.ts`

Findings:
- There are two lesson planner experiences using different APIs and output formats. This will confuse users and make QA harder.
- The AI Tools lesson planner calls `/api/ai-grading/generate-lesson`, while the Academics lesson planner calls `/api/ai/cbc-copilot/lesson-plan`.
- The AI Tools version loads all learning areas after class selection but does not filter them to the selected class/grade/curriculum relationship.
- Generated lesson plans are not persisted, versioned, exported, or linked to timetable/class/teacher context.
- The AI fallback can generate generic lesson plans even when class or learning-area lookup failed, which may hide reference-data problems.
- The Academics lesson planner requires strand and sub-strand, which is good for CBC alignment, but it has no save, print, or reuse workflow.

Mitigation:
1. Pick one canonical lesson planner path, preferably `app/(dashboard)/academics/lesson-planner`, backed by CBC Copilot.
2. Keep `/ai-tools/lesson-planner` only as a redirect or remove it from navigation.
3. Store generated lesson plans in a `lesson_plans` table with school, class, learning area, strand, sub-strand, teacher, generated JSON, status, and timestamps.
4. Add export/print support and a "Regenerate with changes" flow.
5. Show reference-data warnings clearly when class, learning area, strand, or sub-strand lookup fails.
6. Add tests for required curriculum context, permission enforcement, successful generation, AI fallback, and invalid IDs.

Priority: High

### 2. AI Grading

Relevant files:
- `app/(dashboard)/ai-tools/grading/page.tsx`
- `app/api/ai-grading/grade/route.ts`
- `features/ai-grading/services/ai-grading.service.ts`
- `features/ai-grading/validators/ai-grading.schema.ts`

Findings:
- The AI output schema accepts `totalScore` and question scores as arbitrary numbers. The service does not clamp question scores to each question's maximum mark.
- `classSummary` is taken directly from the AI response instead of being recomputed from normalized graded responses.
- The schema does not require the AI to return every student exactly once or every question exactly once.
- AI grading results are not persisted to assessments, moderation queues, or audit logs.
- The UI uses temporary student IDs like `student_${Date.now()}`, so grades are not linked to actual student records.
- The tool is valuable for draft marking, but there is no teacher review/approval workflow before results become official.
- The deterministic fallback is simplistic and may over-score answers by word count where no expected points are provided.

Mitigation:
1. Normalize AI output server-side:
   - Clamp each question score between `0` and the question's marks.
   - Recompute total score, percentage, performance level, and class summary.
   - Reject or warn for missing/extra students and missing/extra questions.
2. Require real student IDs when grading from the production assessments module.
3. Add a moderation workflow: AI draft -> teacher review -> approved marks -> write to assessments.
4. Persist grading attempts with prompt metadata, model/provider, confidence, warnings, teacher approver, and final status.
5. Add rubric support in the UI for expected points and marking schemes.
6. Add tests for over-max AI scores, missing questions, missing students, deterministic fallback, and class summary correctness.

Priority: Critical

### 3. Online Application Form And Submission

Relevant files:
- `app/apply/page.tsx`
- `app/api/admissions/apply/route.ts`
- `app/api/admissions/applications/route.ts`
- `app/api/admissions/applications/[id]/route.ts`
- `features/admissions/services/admissions.service.ts`
- `features/admissions/validators/admissions.schema.ts`

Findings:
- Public submission uses `schools.limit(1).single()` to assign `school_id`. In a multi-school database, applications can be sent to the wrong school.
- There is no school slug, tenant domain, invite token, or configured default admission school in the public form.
- Rate limiting is in-memory and IP-only; it is not enough for production abuse prevention.
- Date of birth is only validated as a string, not as a real date or acceptable age range.
- Phone validation only checks length, not Kenyan phone format or normalization.
- Duplicate application detection is missing.
- There is no file upload path for birth certificates, report forms, or parent ID documents.
- There is no applicant confirmation reference number.
- Accepted applications do not appear to convert into student records or parent/guardian records.
- Admissions review uses `students:create` permission; a distinct `admissions:review` permission would be cleaner.

Mitigation:
1. Add tenant-safe application routing:
   - `/apply/[schoolSlug]`, school-specific domain, or public admissions token.
   - Reject submissions when the school cannot be resolved unambiguously.
2. Add submission hardening:
   - CAPTCHA or challenge after repeated submissions.
   - Persistent rate-limit table or edge-provider rate limiting.
   - Duplicate check on student name, DOB, parent phone, and school.
3. Improve validation:
   - Real date parsing and future-date prevention.
   - Configurable age/grade checks.
   - Phone normalization to E.164 or a consistent local format.
4. Add application reference numbers and confirmation UI.
5. Add optional document uploads with storage policies and virus/file-type checks.
6. Add review workflow:
   - pending -> reviewed -> accepted/rejected/waitlisted.
   - accepted -> create student draft -> create/link guardian -> class placement.
7. Add tests for school resolution, validation, duplicate prevention, review permissions, status transitions, and student conversion.

Priority: Critical

### 4. Communication

Relevant files:
- `features/communication/services/messages.service.ts`
- `features/communication/services/notifications.service.ts`
- `features/communication/services/announcements.service.ts`
- `features/communication/validators/communication.schema.ts`
- `app/api/communication/messages/route.ts`
- `app/api/communication/broadcast/route.ts`
- `app/api/communication/messages/recipients/route.ts`

Findings:
- `messages.service.ts` creates a Supabase browser client at module scope. This shared service is used by API routes and should use the server client for reliable request/session behavior.
- Message creation and recipient insertion are not transactional. If recipient insert fails, the route can still return success.
- `recipient_type` stores the requested group type (`role`, `class`) even when `recipient_id` is an actual user ID. This can confuse downstream logic.
- The validator allows `recipient_type: "all"`, but the main send route rejects it. Broadcast supports compatibility paths, so behavior is inconsistent.
- Broadcast GET reads `broadcast_messages`, but POST delegates to `MessagesService.broadcastMessage`, which inserts into `messages`, not `broadcast_messages`. The broadcast list may not show newly sent broadcasts.
- Role recipient options query roles without filtering by school. That may leak global/cross-school roles depending on schema.
- The class recipient flow assumes `student.parent_id`; elsewhere the system appears to use guardians through student guardian routes, so parent delivery may be incomplete.
- Search filtering happens after pagination, so a user can miss matching messages on later pages.
- Announcements filter by role but not by class on read, despite supporting `target_classes`.
- There is no delivery status for external channels such as SMS/email/push in the core communication flow.

Mitigation:
1. Move message and announcement services to server Supabase clients in API/server paths.
2. Implement a transactional RPC or database function for message + recipients insert.
3. Return failure if recipient insertion fails; do not report partial success as sent.
4. Normalize recipient records:
   - store `recipient_user_id`
   - store source target separately, such as `source_type` and `source_id`.
5. Align broadcast behavior:
   - either write broadcasts into `broadcast_messages` and recipient rows, or remove `broadcast_messages` list.
6. Add school filtering to roles and all recipient option queries.
7. Support guardian resolution through the actual student-guardian relationship.
8. Move search to the database query or add full-text search.
9. Apply `target_classes` when reading announcements.
10. Add delivery logs for SMS/email/push providers and retry handling.
11. Add tests for user, role, class, all/broadcast recipients, partial failures, unread counts, delete/read access, and announcement targeting.

Priority: High

### 5. Predictive Analytics

Relevant files:
- `app/(dashboard)/analytics/predictive/page.tsx`
- `app/api/predictive-analytics/performance-forecast/route.ts`
- `app/api/predictive-analytics/student-clusters/route.ts`
- `app/api/predictive-analytics/intervention-recommendations/route.ts`
- `app/api/predictive-analytics/subject-recommendations/route.ts`
- `features/predictive-analytics/services/performance-forecast.service.ts`
- `features/predictive-analytics/services/student-clustering.service.ts`
- `features/predictive-analytics/services/intervention.service.ts`
- `features/predictive-analytics/services/subject-recommendation.service.ts`

Findings:
- Performance forecast schema omits `learningAreaId`, but merge logic requires it. AI predictions may never attach to forecast rows.
- Forecast class summary is accepted from AI rather than recomputed from final displayed forecast rows.
- Predictive services run per-student queries in loops, which can become slow for large classes.
- Several models mix academic, attendance, discipline, and fee data without an explicit consent/governance warning. These recommendations could affect students, so explainability matters.
- Intervention recommendations include financial risk, which is sensitive and should be permission-gated or at least visible only to appropriate roles.
- Subject recommendation accepts optional `classId` but does not verify the student belongs to that class when provided.
- Forecasts, clusters, and interventions are not persisted, so leaders cannot track whether interventions were accepted or worked.
- Confidence and contributing factors are not consistently displayed in the UI.

Mitigation:
1. Fix forecast schema to include `learningAreaId`, or merge by stable row key produced before the prompt.
2. Recompute summary server-side from normalized forecast rows.
3. Batch data loading:
   - one query for students
   - one query for aggregates
   - one query for attendance
   - one query for discipline
   - one query for fees, scoped by class student IDs.
4. Add explainability fields for every recommendation: data used, reason, confidence, last updated.
5. Add role gating for financial factors.
6. Verify `studentId` belongs to requested `classId` and `schoolId`.
7. Persist predictions and intervention plans with status: proposed, accepted, in_progress, completed, dismissed.
8. Add tests for merge correctness, summary correctness, class membership checks, financial visibility, and empty-data handling.

Priority: Critical for forecast correctness; High for performance/governance.

### 6. AI Data Query

Relevant files:
- `app/(dashboard)/analytics/nl-query/page.tsx`
- `app/api/nl-query/route.ts`
- `features/nl-query/services/nl-query.service.ts`
- `features/nl-query/components/NLQueryInterface.tsx`

Findings:
- The module builds a SQL-looking string using model-selected filters and displays it as `sqlGenerated`, but it does not execute that SQL. This can mislead admins into thinking the query was truly run.
- If this SQL is ever executed later, the current string interpolation would be unsafe.
- The user join in generated SQL uses `s.student_id = u.id`, which is likely wrong for this schema.
- Only fixed-size samples are loaded: 200 students, 500 assessment rows, 500 attendance rows, 200 discipline rows, 200 fee rows. Results can be incomplete without clear "sampled" warnings.
- The fallback for `general` returns no data, so broad questions can produce weak responses.
- The query plan allows arbitrary field names/operators from the model. Even though execution is simulated, this can produce incorrect results.
- The module exposes finance/discipline/attendance summaries under analytics permission only; sensitive categories may need separate permission checks.
- The UI shows examples like "declining performance trends", but the current service does not compute real longitudinal trends in NL Query.

Mitigation:
1. Rename `sqlGenerated` to `queryPlanPreview` unless real safe query execution is implemented.
2. Never execute model-generated SQL. Use a server-owned allowlisted query builder.
3. Add an allowlist:
   - allowed domains
   - allowed fields
   - allowed operators
   - allowed aggregations
   - max limits.
4. Add explicit sample/incomplete-data warnings when row limits are hit.
5. Split sensitive access:
   - analytics academic
   - analytics attendance
   - analytics discipline
   - analytics finance.
6. Add saved questions and admin-approved canned query templates for common leadership reports.
7. Add tests for query intent mapping, scope enforcement, sensitive-domain blocking, limit warnings, class filtering, and unsafe field rejection.

Priority: High

## Cross-Cutting Fixes

1. Add audit logging for all AI actions:
   - user, school, module, prompt label, input scope, provider/model, confidence, warnings, output hash, and approval state.
2. Add AI governance labels:
   - "Draft only"
   - "Requires teacher/admin review"
   - "Data sampled"
   - "Sensitive data included"
3. Standardize API response shape and errors across modules.
4. Add feature flags for AI grading, predictive analytics, and AI Data Query in production.
5. Add role/permission review:
   - `admissions:view`
   - `admissions:review`
   - `communication:broadcast`
   - `analytics:finance`
   - `analytics:discipline`
   - `ai:admin`.
6. Add database-level constraints and indexes for high-traffic paths.
7. Add Playwright E2E coverage for the user-facing workflows.

## Phased Delivery Plan

### Phase 1: Stabilize Critical Data Integrity

Target: 1-2 weeks

- Fix admission school resolution.
- Add duplicate prevention and application reference numbers.
- Normalize/clamp AI grading outputs and recompute summaries.
- Fix predictive forecast `learningAreaId` mapping and summary recomputation.
- Make communication message sending transactional.
- Add unit tests for all above.

Exit criteria:
- No application can be submitted without unambiguous school context.
- AI grading cannot return impossible scores.
- Predictive forecast rows show actual normalized AI/fallback predictions.
- Message send either fully succeeds with recipients or fails clearly.

### Phase 2: Security And Governance

Target: 1-2 weeks

- Add persistent rate limiting/CAPTCHA for public admissions.
- Add AI audit logs for grading, lesson generation, predictive analytics, and NL Query.
- Add role gates for finance/discipline analytics.
- Hide or rename generated SQL in AI Data Query.
- Add "draft/review required" labels for AI grading and predictions.

Exit criteria:
- Sensitive data access is permission-specific.
- AI outputs are auditable.
- Public endpoints have abuse protection beyond in-memory limits.

### Phase 3: Workflow Completeness

Target: 2-3 weeks

- Persist lesson plans with print/export/regenerate workflow.
- Add AI grading teacher review and approval workflow.
- Add admission acceptance to student/guardian conversion.
- Add communication delivery logs and external provider status.
- Persist intervention plans with lifecycle status.

Exit criteria:
- Modules are no longer isolated demos; each produces durable operational records.
- Staff can review, approve, and act on AI outputs.

### Phase 4: E2E QA And UAT

Target: 1 week

- Expand `END_TO_END_TEST_PLAN.md` with scenarios from this review.
- Add Playwright tests for:
  - public admission submission
  - admissions review and conversion
  - message send to user/role/class
  - lesson generation
  - AI grading review
  - predictive forecast
  - AI Data Query class-scoped question.
- Run UAT with administrator, teacher, admissions officer, and senior leader personas.

Exit criteria:
- Critical workflows pass automated and manual UAT.
- Known limitations are documented before production rollout.

## Recommended Test Matrix

| Module | Unit Tests | API Tests | E2E Tests | Data Checks |
|---|---:|---:|---:|---:|
| Admissions | Yes | Yes | Yes | duplicates, tenant school |
| Lesson Planner | Yes | Yes | Yes | curriculum IDs, saved plan |
| AI Grading | Yes | Yes | Yes | score bounds, audit trail |
| Communication | Yes | Yes | Yes | recipient count, unread count |
| Predictive Analytics | Yes | Yes | Yes | forecast merge, class scope |
| AI Data Query | Yes | Yes | Yes | allowlisted fields, row-limit warnings |

## Immediate Engineering Checklist

- [ ] Replace first-school admission assignment with tenant-safe school resolution.
- [ ] Clamp and recompute AI grading scores.
- [ ] Recompute AI grading class summary after normalization.
- [ ] Add `learningAreaId` to forecast AI schema or merge forecast rows by row key.
- [ ] Recompute forecast summary from returned rows.
- [ ] Convert communication message send to transactional insert.
- [ ] Align broadcast write/read tables.
- [ ] Rename/hide `sqlGenerated` in AI Data Query.
- [ ] Add row-limit warnings to AI Data Query.
- [ ] Add tests for all critical paths above.

