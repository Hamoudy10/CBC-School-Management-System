# AI Agent Interface Implementation Plan

## 1. Goal

Build the school management system in two equivalent operation modes:

1. Manual mode: users click through the existing UI and use the system normally.
2. AI agent mode: users interact through a secure AI interface that can answer questions, reason over school data, make predictions, and execute permitted operations on behalf of the logged-in user.

The AI agent must never bypass authentication, role permissions, school tenancy, validation, audit logging, or business rules. It must act as the logged-in user, with the same authority and the same limits.

## 2. Current System Fit

The repository already has important foundations:

- Next.js App Router APIs under `app/api/**`.
- Feature services under `features/**/services`.
- RBAC in `types/roles.ts`, `lib/auth/permissions.ts`, `lib/auth/api-guard.ts`, and `lib/api/withAuth.ts`.
- Tenant boundary through `school_id`.
- AI primitives in `lib/ai/**`, including Groq completion, cache, logs, guards, prompt limits, JSON schema validation, and retries.
- Existing assistive AI modules: teacher AI, analytics AI, CBC copilot, smart search, reports AI, parent chatbot, fee predictor, study plan, exam generator, adaptive homework.
- Audit logging through `services/audit.service.ts` and `audit_logs`.

The missing production layer is an AI agent runtime with safe tool execution.

## 3. Design Principles

- Same permissions as manual use: agent actions must call existing guarded APIs or feature services through a permission-aware executor.
- Least privilege: the agent only receives tools the current user is allowed to use.
- Tenant isolation: every read/write is scoped to `user.schoolId` unless `super_admin`.
- Human confirmation for risky actions: destructive, financial, publishing, bulk, notification, and user/role changes require confirmation.
- Deterministic before generative: calculations, permissions, totals, balances, risk scoring, and validations must be computed by code, not guessed by the model.
- Structured outputs only for decisions: model plans, tool calls, and final answers must be validated with Zod schemas.
- Full traceability: every AI session, plan, tool call, confirmation, result, and failure must be logged.
- Privacy by role: the agent must not reveal confidential data unavailable to the same user through manual UI.
- Graceful refusal: when data or permissions are insufficient, the agent explains what it can do instead.

## 4. Target Architecture

Add a new feature module:

- `features/ai-agent/`
  - `types.ts`
  - `validators/aiAgent.schema.ts`
  - `services/agent.service.ts`
  - `services/tool-registry.service.ts`
  - `services/tool-executor.service.ts`
  - `services/context-builder.service.ts`
  - `services/confirmation.service.ts`
  - `services/memory.service.ts`
  - `services/policy.service.ts`
  - `services/agent-audit.service.ts`
  - `components/AIAgentPanel.tsx`
  - `components/AIAgentMessageList.tsx`
  - `components/AIAgentComposer.tsx`
  - `components/AIAgentActionPreview.tsx`
  - `components/AIAgentConfirmationModal.tsx`

Add API routes:

- `app/api/ai-agent/chat/route.ts`
- `app/api/ai-agent/sessions/route.ts`
- `app/api/ai-agent/sessions/[id]/route.ts`
- `app/api/ai-agent/confirm/route.ts`
- `app/api/ai-agent/cancel/route.ts`
- `app/api/ai-agent/tools/route.ts`

Add UI entry points:

- Global dashboard assistant button in `components/layout/Header.tsx` or `DashboardLayout.tsx`.
- Full-page assistant at `app/(dashboard)/ai-agent/page.tsx`.
- Optional contextual side panel inside major modules later.

## 5. Database Plan

Create a migration, for example:

- `database/migrations/upgrade-6/01_create_ai_agent_tables.sql`

Tables:

### `ai_agent_sessions`

Purpose: conversation/session root.

Columns:

- `session_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE`
- `title VARCHAR(200)`
- `mode VARCHAR(30) NOT NULL DEFAULT 'assist' CHECK (mode IN ('assist', 'act'))`
- `status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'error'))`
- `metadata JSONB DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

### `ai_agent_messages`

Purpose: chat history.

Columns:

- `message_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `session_id UUID NOT NULL REFERENCES ai_agent_sessions(session_id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE`
- `role VARCHAR(30) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool'))`
- `content TEXT NOT NULL`
- `structured_payload JSONB`
- `created_at TIMESTAMPTZ DEFAULT NOW()`

### `ai_agent_actions`

Purpose: planned and executed operations.

Columns:

- `action_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `session_id UUID NOT NULL REFERENCES ai_agent_sessions(session_id) ON DELETE CASCADE`
- `school_id UUID REFERENCES schools(school_id) ON DELETE CASCADE`
- `user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE`
- `tool_name VARCHAR(150) NOT NULL`
- `module VARCHAR(80) NOT NULL`
- `permission_action VARCHAR(40) NOT NULL`
- `risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))`
- `status VARCHAR(30) NOT NULL CHECK (status IN ('planned', 'awaiting_confirmation', 'approved', 'executing', 'completed', 'failed', 'cancelled'))`
- `input JSONB NOT NULL`
- `output JSONB`
- `error TEXT`
- `requires_confirmation BOOLEAN DEFAULT false`
- `confirmed_by UUID REFERENCES users(user_id)`
- `confirmed_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ DEFAULT NOW()`
- `updated_at TIMESTAMPTZ DEFAULT NOW()`

### `ai_agent_tool_catalog`

Purpose: optional DB-visible registry of enabled tools.

Columns:

- `tool_id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `name VARCHAR(150) UNIQUE NOT NULL`
- `module VARCHAR(80) NOT NULL`
- `permission_action VARCHAR(40) NOT NULL`
- `description TEXT NOT NULL`
- `risk_level VARCHAR(20) NOT NULL`
- `enabled BOOLEAN DEFAULT true`
- `created_at TIMESTAMPTZ DEFAULT NOW()`

Indexes:

- `ai_agent_sessions(school_id, user_id, created_at)`
- `ai_agent_messages(session_id, created_at)`
- `ai_agent_actions(session_id, status)`
- `ai_agent_actions(school_id, user_id, created_at)`
- `ai_agent_actions(tool_name)`

RLS:

- Users can only read their own sessions unless admin roles are viewing audit.
- School users can only access rows for their school.
- Super admin can access all schools.
- Parents/students must only access their own linked data through executor-level rules.

## 6. Agent Runtime Flow

For every user message:

1. Authenticate with `withAuth`.
2. Load current user, role, school, allowed modules, and allowed actions.
3. Load short session history.
4. Build safe context:
   - school name and current academic context
   - user's role and allowed modules
   - no bulk sensitive records unless needed for a selected tool
5. Ask model to classify intent:
   - answer only
   - retrieve data
   - propose action
   - execute low-risk action
   - request clarification
6. Validate model output with Zod.
7. If answering:
   - retrieve only permitted data
   - produce answer with citations to internal data summaries where useful
8. If acting:
   - select a registered tool
   - validate tool input with the tool schema
   - verify permission with `hasPermission(user.role, module, action)`
   - verify tenant scope
   - run business validation
   - if risky, create `ai_agent_actions` row with `awaiting_confirmation`
   - if low-risk, execute and log
9. Return a response containing:
   - assistant message
   - action preview or result
   - confirmation requirement if any
   - warnings and confidence

## 7. Tool Registry Design

Tools are server-side functions. The model never directly queries the database or constructs SQL.

Tool definition shape:

```ts
type AgentTool<TInput, TOutput> = {
  name: string;
  description: string;
  module: ModuleName;
  action: ActionName;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresConfirmation: (input: TInput, user: AuthUser) => boolean;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  execute: (input: TInput, context: AgentExecutionContext) => Promise<TOutput>;
};
```

Registry function:

```ts
getAvailableToolsForUser(user: AuthUser): AgentTool<any, any>[]
```

This function filters by `hasPermission`.

## 8. Initial Tool Set

Start with read-only and low-risk tools, then add writes module by module.

### Phase 1: Read-only tools

- `search_students`
- `get_student_profile`
- `get_student_attendance_summary`
- `get_student_assessment_summary`
- `get_student_fee_summary`
- `get_class_roster`
- `get_class_attendance_summary`
- `get_class_performance_summary`
- `get_school_health_summary`
- `get_timetable`
- `get_report_card_status`
- `get_messages_summary`
- `get_audit_summary` for allowed roles only

### Phase 2: Assistive generation tools

- `draft_parent_message`
- `draft_announcement`
- `draft_report_comment`
- `generate_lesson_plan`
- `generate_assessment`
- `generate_study_plan`
- `explain_cbc_result`
- `predict_dropout_risk`
- `predict_fee_default_risk`

These can produce drafts without changing records.

### Phase 3: Safe write tools

- `create_student`
- `update_student`
- `record_attendance`
- `bulk_record_attendance`
- `create_assessment`
- `bulk_create_assessments`
- `create_discipline_record`
- `create_timetable_slot`
- `create_fee_structure`
- `assign_student_fee`
- `record_payment`
- `send_message`
- `create_announcement`
- `generate_report_cards`

### Phase 4: High-risk tools

Require confirmation and possibly dual approval:

- delete student/staff/user
- hard-delete user
- change user role
- reset password
- waive fee
- approve financial exception
- publish report cards
- send broadcast message
- deactivate/reactivate staff
- change active term or academic year
- edit school settings
- manual M-Pesa reconciliation

## 9. Risk and Confirmation Policy

Low risk:

- read data
- summarize data
- draft content
- create private AI-only notes

Medium risk:

- create/update normal academic records
- create attendance records
- generate report cards in draft mode

High risk:

- financial records
- messages to parents/staff/students
- bulk operations
- publishing reports
- changing timetable broadly

Critical risk:

- user/role/security changes
- deletes
- fee waivers/approvals
- school configuration changes
- active term/year changes

Rules:

- Medium actions show preview and allow single-click confirmation depending on school setting.
- High actions always require explicit user confirmation.
- Critical actions require explicit confirmation and may require a privileged role.
- The agent must summarize exact records affected before confirmation.
- Confirmation expires after a short time, for example 10 minutes.

## 10. Permission and Confidentiality Rules

The AI agent must use the same module/action permissions from `types/roles.ts`.

Additional data-level rules:

- Parent: only linked children through `student_guardians`.
- Student: only own records.
- Teacher: only assigned classes/subjects where service logic requires it.
- Finance roles: finance operations allowed, but not academic/admin-only data beyond permission matrix.
- ICT admin: user/settings/audit as allowed, but not finance approvals unless role permits.
- Super admin: cross-school only when request explicitly selects a school.

Never include hidden fields in model context:

- password hashes or reset tokens
- auth provider secrets
- M-Pesa credentials
- API keys
- raw private system prompts
- unrelated students' sensitive details
- unrelated discipline or special-needs notes

## 11. Context and Knowledge Strategy

The agent needs a whole-system understanding without dumping the whole database into prompts.

Use layered context:

1. Static system map:
   - summary from `AI_SYSTEM_CONTEXT.md`
   - modules and capabilities
   - role permissions
2. User context:
   - role
   - school
   - active term/year
   - allowed modules/actions
3. Conversation context:
   - last N messages
   - current selected page/module if provided by UI
4. Retrieval context:
   - only records returned by approved tools
5. Tool catalog:
   - only tools available to current user

Add `context-builder.service.ts` to construct this safely.

## 12. Model Interaction Pattern

Use two structured calls for complex requests:

1. Planner call:
   - classify intent
   - select tool or ask clarification
   - produce structured plan

2. Response call:
   - explain result to user using tool output
   - no new actions allowed in this call

For simple Q&A, a single call can be used after permitted retrieval.

Planner schema:

```ts
const agentPlanSchema = z.object({
  intent: z.enum(["answer", "retrieve", "act", "clarify", "refuse"]),
  userGoal: z.string(),
  toolName: z.string().nullable(),
  toolInput: z.record(z.unknown()).nullable(),
  requiresConfirmation: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  reasoningSummary: z.string(),
  userFacingMessage: z.string(),
});
```

The model's `reasoningSummary` must be concise and user-safe. Do not expose hidden chain-of-thought.

## 13. API Contracts

### `POST /api/ai-agent/chat`

Request:

```json
{
  "sessionId": "uuid optional",
  "message": "Show fee defaulters in Grade 6",
  "pageContext": {
    "route": "/finance",
    "module": "finance",
    "selectedRecordId": "optional"
  },
  "mode": "assist"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "message": {
      "role": "assistant",
      "content": "..."
    },
    "action": {
      "actionId": "uuid",
      "status": "awaiting_confirmation",
      "preview": {}
    },
    "confidence": 0.86,
    "warnings": []
  },
  "error": null
}
```

### `POST /api/ai-agent/confirm`

Request:

```json
{
  "actionId": "uuid",
  "confirmationText": "optional typed confirmation"
}
```

Executes the saved action after rechecking:

- session owner
- permission
- school scope
- action has not expired
- input still valid

## 14. UI Plan

### Global assistant panel

Add an AI button to the dashboard header. Clicking opens a right-side panel.

Panel contents:

- message list
- input box
- page-aware suggestions
- action preview blocks
- confirmation buttons
- result cards/tables where useful
- link to affected records after successful actions

### Full assistant page

Route:

- `app/(dashboard)/ai-agent/page.tsx`

Use for longer workflows, analytics, and admin review.

### Design expectations

- Use existing `components/ui` primitives.
- Keep it operational, not landing-page styled.
- Show concise action previews.
- Do not hide risk for destructive or financial actions.
- Use module-aware empty states and loading states.

## 15. Service Implementation Rules

Do not let agent tools directly duplicate domain logic. Each tool should call existing feature services where possible.

Examples:

- Student creation tool calls `features/students/services/students.service.ts`.
- Payment tool calls `features/finance/services/payments.service.ts`.
- Attendance tool calls `features/attendance/services/attendance.service.ts`.
- Report generation tool calls report card service path, preferring the newer report-card stack.

If an existing service lacks a needed method, add the method to the feature service first, then call it from the tool.

## 16. Prompting Rules

System prompt must include:

- The agent acts as the logged-in user.
- It can only use provided tools.
- It must never invent data.
- It must never claim an action completed unless tool output confirms it.
- It must ask for clarification when required fields are missing.
- It must keep role confidentiality.
- It must refuse unauthorized requests.
- It must prefer summaries over exposing sensitive row-level data unless the user has permission and asks for it.

Every model output that controls behavior must be JSON schema validated.

## 17. AI Provider Plan

Use a provider abstraction so the agent is not locked to Groq or any single model vendor.

Recommended production default:

- Provider: OpenRouter
- Fast/default model: `deepseek/deepseek-v4-flash`
- High-reasoning model: `deepseek/deepseek-v4-pro`
- Optional free fallback, when available: `deepseek/deepseek-v4-flash:free`

OpenRouter should be called through its OpenAI-compatible chat completions API. Keep Groq support as a fallback during migration, but move new agent runtime calls behind a common provider interface.

Add:

- `lib/ai/providers/types.ts`
- `lib/ai/providers/openrouter.client.ts`
- `lib/ai/providers/groq.client.ts`
- `lib/ai/providers/index.ts`

Provider interface:

```ts
type AIProviderName = "openrouter" | "groq";

type AIProviderRequest<TJson> = {
  system: string;
  prompt: string;
  model?: string;
  responseFormat: "json" | "text";
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: z.ZodType<TJson>;
  requestLabel: string;
  cache?: false | {
    schoolId?: string;
    classId?: string;
    subject?: string;
    ttlSeconds?: number;
  };
};

type AIProvider = {
  name: AIProviderName;
  generate<TJson>(request: AIProviderRequest<TJson>): Promise<AIResponse<TJson | string>>;
};
```

Environment variables:

```env
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_URL=
OPENROUTER_APP_NAME=CBC School Management System
OPENROUTER_MODEL_FAST=deepseek/deepseek-v4-flash
OPENROUTER_MODEL_REASONING=deepseek/deepseek-v4-pro
OPENROUTER_MODEL_FREE=deepseek/deepseek-v4-flash:free
AI_ALLOW_FREE_MODEL_FALLBACK=true
AI_REQUEST_TIMEOUT_MS=30000
AI_MAX_PROMPT_CHARS=30000
AI_MAX_OUTPUT_TOKENS=2048
```

Model routing:

- Normal chat, summaries, search interpretation, drafting: `OPENROUTER_MODEL_FAST`.
- Multi-step planning, high-risk action review, finance/security/admin workflows: `OPENROUTER_MODEL_REASONING`.
- Non-critical fallback when paid model is unavailable and the school allows it: `OPENROUTER_MODEL_FREE`.
- If the free model is unavailable, retry with fast paid model or return a graceful error depending on school settings.

Important implementation notes:

- Treat OpenRouter free models as best-effort only. Availability, rate limits, and uptime can change.
- Do not assume every model supports strict structured output equally. Always validate JSON with Zod and retry/repair once before failing.
- For agent tool planning, prefer the reasoning model when the action has `high` or `critical` risk.
- For direct operation execution, never rely on model confidence alone. The tool executor and existing services must validate everything.

## 18. Observability and Audit

Extend current AI logging:

- Continue writing `ai_logs`.
- Add linked `ai_agent_actions`.
- Write `audit_logs` for every executed write action.
- Add request labels like:
  - `ai-agent.plan`
  - `ai-agent.answer`
  - `ai-agent.tool.search_students`
  - `ai-agent.tool.record_payment`

Admin AI logs page should eventually show:

- sessions
- tool calls
- failures
- token usage
- confirmation history
- highest-risk actions
- per-user usage

Provider logs should record:

- provider name
- model ID
- request label
- token usage if returned by OpenRouter
- fallback model used
- whether the response came from cache

Never log API keys, Authorization headers, or raw hidden system prompts.

## 19. Security Hardening

Required controls:

- Server-only tool execution.
- No model-generated SQL.
- No client-provided user role or school ID trusted.
- Recheck permission on both planning and confirmation.
- Rate-limit chat and action endpoints.
- Block prompt-injection attempts that ask to ignore system/developer/security rules.
- Strip secrets from context.
- Validate all inputs with Zod.
- Use service-level school filters.
- Use Supabase RLS where available.
- Require explicit school selection for super admin cross-school actions.
- Add action expiry for confirmations.

## 20. Testing Plan

Unit tests:

- OpenRouter client validates JSON responses
- provider selector chooses fast/reasoning/free models correctly
- provider fallback never runs high-risk tools on free model unless explicitly allowed
- tool registry filters tools by role
- policy service assigns risk correctly
- confirmation required for high/critical actions
- planner schema rejects invalid tool calls
- context builder strips sensitive fields
- parent/student data scoping

API tests:

- unauthenticated user cannot chat
- unauthorized tool is refused
- teacher cannot access finance write tool
- parent cannot query unrelated child
- high-risk action creates pending confirmation
- confirmation rechecks permissions
- cancelled/expired action cannot execute

Service tests:

- tool executor calls existing service
- action failures are logged
- audit logs are written for writes
- deterministic prediction fallback works when AI fails

E2E/manual test cases:

- "Show my class attendance this week" as teacher.
- "Record Grade 4 attendance: everyone present except Asha absent" as teacher.
- "Send parents a draft about report collection" as principal.
- "Record KES 5,000 payment for ADM001" as finance officer.
- "Publish Grade 6 report cards" as principal, requiring confirmation.
- "Change this user's role to school admin" as teacher, must refuse.
- Parent asks about another student's marks, must refuse.

## 21. Rollout Phases

### Phase A: Foundation

- Add DB tables.
- Add OpenRouter provider client and provider selector.
- Add validators/types.
- Add context builder.
- Add tool registry.
- Add action executor.
- Add session/message persistence.
- Add chat endpoint.
- Add basic UI page/panel.

Deliverable: read-only agent that can answer role-scoped questions.

### Phase B: Read-only intelligence

- Implement read tools for students, attendance, finance summaries, assessments, reports, timetable, analytics.
- Reuse existing analytics AI and smart search where appropriate.
- Add source summaries to answers.

Deliverable: users can ask operational questions safely.

### Phase C: Draft and prediction tools

- Add draft messaging, report comments, lesson plans, assessments, study plans.
- Integrate dropout risk, school health, fee prediction.
- Store prediction snapshots where useful.

Deliverable: agent helps users reason and prepare work without changing core records.

### Phase D: Confirmed write actions

- Add create/update tools one module at a time.
- Start with attendance and assessments.
- Add finance only after extra tests.
- Add communications with preview/confirmation.

Deliverable: agent can perform normal workflows under confirmation policy.

### Phase E: Admin and critical workflows

- Add user/role, settings, active term/year, publishing, deletion workflows.
- Enforce stricter confirmations and audit views.

Deliverable: production-grade agent for full authorized system operations.

## 22. Acceptance Criteria

The feature is production-ready only when:

- Agent answers are role-scoped and tenant-scoped.
- Agent cannot call a tool not allowed to the logged-in role.
- Agent cannot perform high-risk writes without confirmation.
- Agent cannot directly execute SQL or bypass services.
- All tool inputs and outputs are schema validated.
- All write actions appear in audit logs.
- All AI calls appear in AI logs.
- OpenRouter model calls work through provider abstraction.
- Free model fallback is configurable and never silently used for sensitive operations.
- Existing manual workflows still pass tests.
- New AI agent tests cover permissions, scope, confirmations, failures, and successful actions.
- Build, type-check, lint, and relevant tests pass.

## 23. Open Questions

1. Should the production default be OpenRouter DeepSeek V4 Flash, with DeepSeek V4 Pro only for high-risk reasoning?
2. Should high-risk actions require one approval from the acting user only, or dual approval for finance/security operations?
3. Should the assistant be enabled for parents and students in the first release, or start with staff roles only?
4. Should schools be able to disable action-taking mode and allow answer-only mode?
5. Should AI sessions be retained indefinitely, or expire after a configurable retention period?

## 24. Recommended First Build

Start with staff-only, read-only plus draft mode:

- school_admin
- principal
- deputy_principal
- teacher/class_teacher/subject_teacher
- finance_officer/bursar
- librarian
- ict_admin

Defer parent/student action mode until parent/student data scoping has dedicated tests.

This gives immediate value while proving the security model before allowing the agent to mutate records.

Recommended first AI configuration:

- `AI_PROVIDER=openrouter`
- `OPENROUTER_MODEL_FAST=deepseek/deepseek-v4-flash`
- `OPENROUTER_MODEL_REASONING=deepseek/deepseek-v4-pro`
- `AI_ALLOW_FREE_MODEL_FALLBACK=false` in production until reliability is proven
- `AI_ALLOW_FREE_MODEL_FALLBACK=true` only in development or low-risk demo environments
