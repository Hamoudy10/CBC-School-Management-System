# Production Deployment Checklist

## Pre-Launch

### Environment
- [ ] `NEXT_PUBLIC_SUPABASE_URL` set to production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (kept secret)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain
- [ ] M-Pesa credentials set to production values
- [ ] AI provider API keys set
- [ ] `NODE_ENV=production`

### Build
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm test -- --runInBand` passes (all 174+ tests)
- [ ] `npm run check:schema` passes
- [ ] `npm run build` succeeds

### Database
- [ ] All migrations applied in order
- [ ] RLS policies enabled on all sensitive tables
- [ ] Backup taken before migration
- [ ] Schema drift check passes against production

### Security
- [ ] `eslint.ignoreDuringBuilds` is `false`
- [ ] All API routes use `withAuth`/`withPermission`/`withRoles`
- [ ] Rate limiting configured on auth and payment endpoints
- [ ] File upload size limits enforced
- [ ] CORS headers configured for production domain

## Launch Day

- [ ] Rollback build prepared
- [ ] Monitoring dashboard open
- [ ] Support team briefed
- [ ] DNS records updated
- [ ] SSL certificates valid
- [ ] Smoke tests pass:
  - Login/logout flow
  - Student CRUD
  - Attendance entry
  - Assessment entry
  - Payment recording
  - Report generation

## Post-Launch (First 48 Hours)

- [ ] Monitor error rates
- [ ] Monitor API response times
- [ ] Check M-Pesa webhook delivery
- [ ] Check AI agent functionality
- [ ] Review audit logs for anomalies
- [ ] Collect user feedback
