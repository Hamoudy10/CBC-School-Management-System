# Observability & Operations Setup

## Current State

- `lib/logger.ts`: Structured JSON logger (wraps console) with levels, request logging, timers, and slow-query detection.
- `app/api/health/route.ts`: Health-check endpoint (`GET /api/health`) returning DB connectivity status.
- Business metrics stored in PostgreSQL via pipeline jobs.
- No Sentry, no APM, no health check automation.

## Recommended Production Setup

### 1. Error Tracking — Sentry

Install `@sentry/nextjs` and follow the wizard:

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

This creates `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`.
Configure `dsn` from the Sentry project settings. Set `tracesSampleRate: 0.1` in production
to capture 10% of transactions for performance monitoring.

### 2. Structured Logging Adoption

Replace raw `console.error()` calls with the structured logger:

```ts
// Before:
console.error("Upload API error:", error);

// After:
import { logger } from "@/lib/logger";
logger.error("Upload API error", { source: "api.upload", error });
```

Run a cleanup pass across all route handlers and services.

### 3. Vercel Observability (if deploying on Vercel)

Vercel provides built-in:
- **Web Analytics**: Enable in Vercel Dashboard → Project → Analytics.
- **Speed Insights**: Enable in Vercel Dashboard → Project → Speed Insights.
- **Logs**: Accessible via Vercel Dashboard → Deployments → Logs.
- **Edge Functions Monitoring**: Built-in for edge runtime.

### 4. Database Monitoring — Supabase

Supabase provides:
- **Query Performance**: Supabase Dashboard → Database → Query Performance.
- **Error Logs**: Supabase Dashboard → Database → Logs.
- **PostgreSQL Extensions**: Enable `pg_stat_statements` for query profiling.

### 5. Health Check Automation

Configure your deployment platform to poll `GET /api/health`:
- **Vercel Cron Jobs**: Add a `vercel.json` cron job to hit `/api/health` every 5 minutes.
- **External Monitoring**: Set up UptimeRobot, Pingdom, or Checkly to monitor the health
  endpoint and alert on non-200 responses.

### 6. Rate Limiting — Production Store

The in-memory rate-limit store resets on every server restart. For multi-instance deployments:

- **Option A (Recommended)**: Replace with a `@upstash/ratelimit` Redis store.
- **Option B**: Implement a Postgres-backed store using a `rate_limits` table with TTL cleanup.

### 7. Performance Budgets

Add a `bundlesize` or `@next/bundle-analyzer` step in CI to catch regressions:

```bash
npm install @next/bundle-analyzer
```

Add to `next.config.mjs` and run `ANALYZE=true npm run build` to visualize bundle sizes.

### 8. Incident Response

Refer to `DISASTER_RECOVERY.md` for:
- RPO: 1 hour (via Supabase PITR)
- RTO: 30 minutes
- Rollback procedures per layer (database, application, DNS)
