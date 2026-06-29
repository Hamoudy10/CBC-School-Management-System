# Disaster Recovery Plan

## Backup Strategy

| Asset | Frequency | Retention | Method |
|---|---|---|---|
| PostgreSQL Database | Daily | 30 days | Supabase Point-in-Time Recovery |
| Storage (files) | Daily | 30 days | Supabase storage backup |
| Environment variables | Per deployment | Indefinite | Vercal/secret manager |

## Recovery Procedures

### Database Restore
1. Go to Supabase Dashboard → Database → Backups
2. Select restore point (PITR within 30 days)
3. Confirm restore to new branch first
4. Verify data integrity
5. Promote to production

### Full Application Rollback
1. `git revert <bad-deploy-hash>`
2. Push to production branch
3. Vercel auto-deploys previous version
4. Verify build and smoke tests

### Partial Rollback (single feature)
- Use feature flags to disable problematic module
- No code deploy required

## RPO / RTO Targets

| Metric | Target |
|---|---|
| Recovery Point Objective (RPO) | 1 hour (PITR) |
| Recovery Time Objective (RTO) | 30 minutes |

## Incident Response

1. Detect (monitoring alert)
2. Triage (severity: critical/high/medium/low)
3. Mitigate (rollback / feature flag / hotfix)
4. Resolve (deploy fix)
5. Review (post-mortem within 48 hours)
