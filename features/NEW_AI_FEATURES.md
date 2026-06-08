# New AI-Powered Features — CBC School Management System

## 1. Africa's Talking SMS/WhatsApp Notifications

**Module:** `features/africas-talking/`
**API:** `POST /api/africas-talking/send`
**Permission:** `communication:create`

Send SMS and WhatsApp messages to parents via Africa's Talking. Supports templates for:
- Fee reminders (with balance, due date)
- Attendance alerts (child marked absent/late)
- Report card availability notifications
- Discipline notices
- Event announcements
- Custom messages with variable substitution

**Setup:**
1. Create an Africa's Talking account at https://account.africastalking.com
2. Set env vars: `AT_API_KEY`, `AT_USERNAME`, `AT_SENDER_ID`, `AT_ENV`
3. Link parent phone numbers in `users.phone` column

**Key files:**
- `features/africas-talking/services/africas-talking.service.ts` — Raw SMS/WhatsApp API calls
- `features/africas-talking/services/notification-templates.service.ts` — Template rendering + parent lookup

---

## 2. Adaptive Homework Generator

**Module:** `features/adaptive-homework/`
**API:** `POST /api/adaptive-homework/generate`
**Permission:** `assessments:view`

AI generates personalized practice worksheets based on each student's weakest CBC competencies. The system:
1. Analyzes the student's assessment history (from `assessment_aggregates`)
2. Identifies the lowest-scoring strands and sub-strands
3. Generates targeted practice questions at the appropriate difficulty level
4. Includes answers and explanations

**Input:** `{ studentId, subjectId?, strandId?, difficulty?, questionCount? }`
**Output:** Complete worksheet with title, questions, options, answers, and explanations

**Key files:**
- `features/adaptive-homework/services/adaptive-homework.service.ts` — AI worksheet generation
- `features/adaptive-homework/validators/adaptive-homework.schema.ts` — Request validation

---

## 3. Voice Mark Entry

**Module:** `features/voice-mark-entry/`
**API:** `POST /api/voice-mark-entry/record`
**Permission:** `assessments:create`

Teachers can dictate assessment scores using their voice. The browser's Web Speech API transcribes speech, then AI extracts:
- Student name
- Subject/learning area
- Strand being assessed
- Score (1-4 CBC scale)
- Optional remarks

**Client hook:** `useVoiceRecorder()` in `components/useVoiceRecorder.ts`
- Works in Chrome/Edge (free, no API key needed)
- Continuous recording with interim results
- Automatic score parsing (spoken words like "exceeding" → 4)

**Key files:**
- `features/voice-mark-entry/components/useVoiceRecorder.ts` — React hook for browser speech recognition
- `features/voice-mark-entry/services/voice-mark-entry.service.ts` — AI parsing + assessment recording

---

## 4. Parent Chatbot (Multi-Channel Webhook)

**Module:** `features/parent-chatbot/`
**API:** `POST /api/parent-chatbot/webhook`
**Auth:** None (webhook called by external services)

Generic webhook endpoint that any messaging provider can connect to (WhatsApp, SMS, Telegram, Facebook Messenger). Parents ask questions in natural language and get instant AI-generated responses about their children:
- Academic performance and grades
- Fee balances and payment history
- Attendance records
- Discipline incidents

**How it works:**
1. Parent sends a message via WhatsApp/SMS/etc.
2. System looks up their phone number in `users` table
3. Finds linked students via `student_guardians`
4. Queries real-time data from assessments, fees, attendance, discipline
5. AI generates a natural language response in plain Swahili/English
6. Flags issues requiring human intervention (`requiresHuman: true`)

**Key files:**
- `features/parent-chatbot/services/parent-chatbot.service.ts` — Query handler + AI response generation
- `features/parent-chatbot/validators/parent-chatbot.schema.ts` — Inbound webhook validation

---

## 5. AI-Assisted Timetable Optimizer

**Module:** `features/timetable-optimizer/`
**API:** `POST /api/timetable-optimizer/suggest`
**Permission:** `timetable:create`

AI proposes optimal weekly timetables considering:
- Bell schedule (from `bell_times`)
- Teacher assignments and subject specializations
- Class groupings
- Existing slots (to preserve when possible)
- Constraints: max periods per day, consecutive periods, morning core subjects

**Output:** Day-by-day slot suggestions with potential conflict warnings
**Workflow:** Admin → AI suggests → Admin reviews/edits → Publishes

**Key files:**
- `features/timetable-optimizer/services/timetable-optimizer.service.ts` — AI generation
- `features/timetable-optimizer/validators/timetable-optimizer.schema.ts` — Request validation

---

## 6. Expanded Early Warning System

**Module:** `features/analytics-ai/services/early-warning.service.ts`
**API:** `POST /api/analytics-ai/early-warning`
**Permission:** `analytics:view`

Multi-signal risk detection that combines:
- **Attendance:** Rate below 80%, increasing absences
- **Academic:** Declining assessment scores across terms
- **Discipline:** Recent high/medium severity incidents
- **Finance:** Overdue fees causing stress/embarrassment
- **Social:** Behavioral patterns (extrapolated from discipline + attendance)

**Output:** Per-student risk level (low/medium/high) with specific signals and recommended actions for teachers and administrators.

**Key files:**
- `features/analytics-ai/services/early-warning.service.ts` — Signal collection + AI analysis
- `app/api/analytics-ai/early-warning/route.ts` — API endpoint

---

## 7. CBC Curriculum Alignment Checker

**Module:** `features/curriculum-alignment/`
**API:** `POST /api/curriculum-alignment/check`
**Permission:** `academics:view`

Teachers upload a lesson plan and the AI checks how well it aligns with official CBC competencies:
- Scores alignment (0-100%)
- Identifies which competencies are fully/partially addressed
- Lists missing competencies
- Provides specific, actionable suggestions for improvement

**Input:** Lesson plan with objectives, activities, assessment methods, materials
**Output:** Alignment score, competency mapping, suggestions

**Key files:**
- `features/curriculum-alignment/services/curriculum-alignment.service.ts` — AI analysis
- `features/curriculum-alignment/validators/curriculum-alignment.schema.ts` — Lesson plan schema

---

## 8. Fee Collection Predictor

**Module:** `features/fee-predictor/`
**API:** `POST /api/fee-predictor/analyze`
**Permission:** `finance:view`

AI analyzes historical payment patterns to:
- Predict which parents are likely to default (risk score)
- Identify contributing factors (late payments, gaps, overdue items)
- Recommend optimal reminder timing (best day of month)
- Suggest personalized collection strategies

**Input:** `{ studentId?, classId?, academicYearId?, termId? }`
**Output:** Per-student risk assessment with actionable recommendations

**Key files:**
- `features/fee-predictor/services/fee-predictor.service.ts` — Payment pattern analysis + AI prediction
- `features/fee-predictor/validators/fee-predictor.schema.ts` — Request validation

---

## Database Migrations

All new tables are defined in `database/migrations/new-features/`:
- `001_africas_talking_logs.sql` — `sms_logs` table for sent message audit trail
- `002_chatbot_sessions.sql` — `chatbot_sessions` table for conversation persistence
- `003_fee_prediction_logs.sql` — `fee_prediction_logs` + `alignment_check_logs` tables

Run migrations via Supabase SQL editor or migration runner.

## Environment Variables

Add to `.env.local`:

```env
# Africa's Talking
AT_API_KEY=your-africas-talking-api-key
AT_USERNAME=sandbox
AT_SENDER_ID=your-sender-id
AT_ENV=sandbox
```
