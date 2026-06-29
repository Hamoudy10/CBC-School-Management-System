# Feature Flags

## Purpose
Enable/disable features without code deploys. Useful for gradual rollouts, A/B testing, and emergency disable.

## Implementation Options

### Option A: Environment Variables (Simple)
```env
FEATURE_AI_AGENT=true
FEATURE_PARENT_CHATBOT=true
FEATURE_OFFLINE_MODE=true
FEATURE_MULTI_SCHOOL=true
```

Check in code:
```ts
const aiEnabled = process.env.FEATURE_AI_AGENT === "true";
```

### Option B: Database-backed (Recommended)
Create a `feature_flags` table:
```sql
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  school_id UUID REFERENCES schools(id),
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Check with a simple API endpoint:
```ts
const { data } = await supabase
  .from("feature_flags")
  .select("enabled")
  .eq("key", "ai_agent")
  .maybeSingle();
```

### Option C: LaunchDarkly / Split.io (Enterprise)
Third-party feature management service with gradual rollouts, targeting, and analytics.

## Planned Feature Flags

| Flag | Default | Scope | Description |
|------|---------|-------|-------------|
| `ai_agent` | on | School | Enable/disable AI assistant panel |
| `parent_chatbot` | on | School | Enable/disable parent chatbot webhook |
| `offline_mode` | on | School | Enable/disable offline IndexedDB sync |
| `mpesa_payments` | on | School | Enable/disable M-Pesa payment integration |
| `bulk_operations` | on | System | Enable/disable bulk import/export features |
| `report_cards_ai` | on | School | Enable/disable AI-generated report comments |
