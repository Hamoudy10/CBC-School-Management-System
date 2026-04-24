🧠 CBC SYSTEM EVOLUTION PLAN (2026 PRODUCTION UPGRADE)
🎯 FINAL TARGET SYSTEM

You are upgrading your current system into:

“AI-powered CBC School Operating System (CBC-OS)”

It will have 4 intelligence layers:

📊 Data Layer (already built)
🧠 AI Teaching Layer (NEW)
📈 Intelligence & Prediction Layer (NEW)
👨‍🏫 Teacher Productivity Layer (NEW)

All powered by:

Supabase (existing)
Next.js (existing)
Groq AI (existing free LLM integration)
⚙️ GLOBAL ARCHITECTURE RULE (VERY IMPORTANT)

Every new AI feature MUST follow this pattern:

UI (Next.js)
   ↓
API Route (app/api/*)
   ↓
Service Layer (features/*/services)
   ↓
AI Layer (lib/ai/* using Groq)
   ↓
Database (Supabase)

NO EXCEPTIONS.

🧠 AI CORE FOUNDATION (BUILD THIS FIRST)
📁 NEW MODULE: lib/ai/
Create:
lib/ai/
   ├── groq.client.ts
   ├── prompts/
   ├── ai.types.ts
   ├── ai.guard.ts
   ├── ai.cache.ts
   ├── ai.logger.ts
1. GROQ CLIENT WRAPPER
File: groq.client.ts

AI must implement:

retry logic (3 attempts)
timeout (30s max)
token safety limits
structured JSON output enforcement
REQUIRED FUNCTION:
generateGroqCompletion({
  prompt,
  system,
  temperature,
  responseFormat: "json" | "text"
})
2. AI RESPONSE CONTRACT (CRITICAL)

All AI outputs MUST follow strict schema:

Example:
type AIResponse<T> = {
  success: boolean;
  data: T;
  confidence: number;
  reasoning?: string;
  warnings?: string[];
};
3. PROMPT ENGINE
Folder: lib/ai/prompts/

Create structured prompts:

cbc.lesson.plan.ts
cbc.assessment.generator.ts
cbc.comment.generator.ts
risk.analysis.ts
report.summary.ts

Each prompt must include:

system role
constraints (CBC syllabus)
JSON output schema
fallback behavior
🚀 UPGRADE 1: CBC COPILOT (CORE FEATURE)
🎯 PURPOSE:

Turn CBC structure into an AI teaching assistant.

📁 NEW MODULE:
features/ai-cbc-copilot/
🔥 FEATURES:
1. Lesson Plan Generator
Input:
class
subject
strand/sub-strand
duration
Output:
{
  "objectives": [],
  "activities": [],
  "materials": [],
  "assessment": [],
  "cbcCompetenciesMapped": []
}
2. Assessment Generator
auto-create:
quizzes
tests
marking schemes
3. CBC Explanation Mode (VERY IMPORTANT)

Teachers can ask:

“Explain fractions for Grade 5 CBC”

AI returns:

simplified explanation
examples
activities
common mistakes
🧠 IMPLEMENTATION RULE:

ALL AI calls MUST pass through:

lib/ai/cbc-context-builder.ts

This injects:

learning_area
strand
sub_strand
competency
🚀 UPGRADE 2: TEACHER AI COPILOT (DAILY TOOL)
📁 MODULE:
features/teacher-ai/
🔥 FEATURES:
1. Auto Report Comments Generator

Input:

student marks
behavior data

Output:

"John shows strong understanding of algebra but needs improvement in consistency..."
2. Mark Entry Assistant

Teacher enters raw marks →
AI suggests:

grade
performance level
comment
3. Classroom Insights Generator

Daily summary:

weak students
strong performers
attention-needed students
🧠 RULE:

This module MUST consume:

assessments table
attendance table
discipline table
🚀 UPGRADE 3: INTELLIGENCE & PREDICTION LAYER
📁 MODULE:
features/analytics-ai/
🔥 FEATURES:
1. Dropout Risk Detection
INPUT FEATURES:
attendance %
grades trend
discipline frequency
OUTPUT:
{
  "riskLevel": "low | medium | high",
  "reason": [],
  "recommendation": []
}
2. Class Performance Trends
subject performance over time
teacher comparison analytics
3. School Health Dashboard

AI generates:

weakest subject in school
declining classes
improving classes
🧠 RULE:

NO raw AI guessing.

Must combine:

SQL aggregation + AI reasoning
🚀 UPGRADE 4: CBC REPORT INTELLIGENCE (FIX YOUR REPORT SYSTEM)
📁 MODULE:
features/reports-ai/
🔥 REBUILD REPORT SYSTEM:

Replace legacy reports with:

1. AI Report Generator

Input:

student
term
assessment data

Output:

structured report card
teacher comments
parent summary
2. Parent-Friendly Translator

Convert:

“Below expectations in numeracy”

Into:

“Your child needs support in basic math operations”

3. Auto Insights Section

Each report includes:

strengths
weaknesses
recommendations
🚀 UPGRADE 5: OFFLINE-FIRST ARCHITECTURE (CRITICAL FOR KENYA)
📁 MODULE:
lib/offline/
IMPLEMENTATION:
1. IndexedDB Layer

Store:

students
attendance
assessments
2. Sync Engine
lib/offline/sync.engine.ts

Handles:

offline writes queue
conflict resolution
retry sync
3. API FLAG:

Every API must support:

x-offline-mode: true
🚀 UPGRADE 6: AI CACHE SYSTEM (IMPORTANT FOR COST + SPEED)
📁 MODULE:
lib/ai/cache.ts
FEATURES:
cache identical prompts
reduce Groq usage
store results per:
school_id
class_id
subject
🚀 UPGRADE 7: DATA INTELLIGENCE PIPELINE
📁 MODULE:
features/pipeline/
JOBS:

Run daily:

compute class averages
compute attendance trends
compute risk scores

Store in:

analytics_snapshots table
🗄️ DATABASE ADDITIONS (CRITICAL)

Add these tables:

1. ai_logs
prompt
response
cost
school_id
2. student_risk_scores
student_id
risk_level
computed_at
3. analytics_snapshots
class_id
metrics_json
date
4. ai_cache
hash
response
expiry
🔐 SECURITY RULES (IMPORTANT)

Every AI feature MUST enforce:

school_id isolation
role-based access
no cross-tenant leakage
🧪 TESTING REQUIREMENTS

AI agent MUST create:

Unit tests:
AI prompt formatting
API response validation
Integration tests:
Groq failure handling
fallback responses
🚀 DEPLOYMENT READINESS CHECKLIST

System is production ready ONLY if:

✔ AI responses are structured JSON
✔ caching works
✔ no cross-school data leaks
✔ offline sync works
✔ reports unified
✔ teacher tools functional
✔ analytics running

🧠 FINAL SYSTEM RESULT

After all upgrades:

You will have:

🎓 CBC OS V2
AI lesson generator
AI marking assistant
student risk prediction
automated reports
offline classroom mode
school intelligence dashboard
🔥 STRATEGIC OUTCOME (IMPORTANT)

This becomes:

“The first AI-native CBC school system in Kenya”

NOT:

a school management tool

BUT:

a decision + teaching + intelligence system

---

IMPLEMENTATION PROGRESS TRACKER

- [x] AI Core Foundation (lib/ai)
- [x] Upgrade 1: CBC Copilot
- [x] Upgrade 2: Teacher AI Copilot
- [x] Upgrade 3: Intelligence & Prediction Layer
- [x] Upgrade 4: CBC Report Intelligence
- [x] Upgrade 5: Offline-First Architecture
- [x] Upgrade 6: AI Cache System
- [x] Upgrade 7: Data Intelligence Pipeline
