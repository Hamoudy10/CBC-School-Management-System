# Deployment Guide: CBC School Operating System - AI-Powered Upgrades

## Overview
This guide outlines the steps to deploy the completed AI-powered upgrades to the CBC School Management System. All seven upgrades have been successfully implemented as specified in the UPGRADE_PLAN.md.

## ✅ Completed Upgrades
1. **AI Core Foundation** (lib/ai) - Already completed
2. **Upgrade 1: CBC Copilot** - Already completed  
3. **Upgrade 2: Teacher AI Copilot** - Already completed
4. **Upgrade 3: Intelligence & Prediction Layer** - Already completed
5. **Upgrade 4: CBC Report Intelligence** - **NEWLY IMPLEMENTED**
6. **Upgrade 5: Offline-First Architecture** - **NEWLY IMPLEMENTED**
7. **Upgrade 6: AI Cache System** - **NEWLY IMPLEMENTED**
8. **Upgrade 7: Data Intelligence Pipeline** - **NEWLY IMPLEMENTED**

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
Ensure these environment variables are set in your `.env` file:
```bash
# Existing variables (verify these are correct)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GROQ_API_KEY=your_groq_api_key

# New variables for AI Cache System (optional, with defaults)
AI_CACHE_TTL_SECONDS=21600  # 6 hours (default: 6*60*6)
AI_REQUEST_TIMEOUT_MS=30000  # 30 seconds (default: 30s)
AI_MAX_OUTPUT_TOKENS=2048   # Default: 2048
AI_MAX_PROMPT_CHARS=30000   # Default: 30000
```

### 2. Database Migration
Run the SQL migration scripts in sequence:

```bash
# Upgrade 4: AI Intelligence Tables for CBC Report Intelligence
psql -h YOUR_SUPABASE_HOST -U YOUR_USERNAME -d YOUR_DATABASE -f database/migrations/upgrade-4/01_create_ai_intelligence_tables.sql

# Upgrade 5: Offline-First Architecture Tables  
psql -h YOUR_SUPABASE_HOST -U YOUR_USERNAME -d YOUR_DATABASE -f database/migrations/upgrade-5/01_create_offline_tables.sql

# Note: Upgrades 6-7 use existing tables or don't require schema changes
```

### 3. Build the Application
```bash
# Install dependencies (if not already done)
npm install

# Build for production
npm run build

# Start production server
npm start
```

## 🔧 Verification Steps

### 1. Health Check
After deployment, verify the system is running:
- Visit `https://your-domain.com` - should load the login page
- API health check: `https://your-domain.com/api/reports-ai` should return API info

### 2. Test New Features
#### CBC Report Intelligence (Upgrade 4)
- Navigate to Reports section → Generate AI Report
- Verify AI-generated reports include insights and parent-friendly summaries
- Test translator service with technical terms like "Numeracy", "Competency-based assessment"

#### Offline-First Architecture (Upgrade 5)
- Disconnect network or toggle offline mode
- Verify you can still access student lists and record attendance
- Reconnect network and verify sync occurs
- Check browser dev tools for IndexedDB storage under Application tab

#### AI Cache System (Upgrade 6)
- Repeat identical AI requests (e.g., same report generation)
- Verify reduced response times on second request (cache hit)
- Monitor logs for "Response served from AI cache" messages

#### Data Intelligence Pipeline (Upgrade 7)
- Verify analytics snapshots table gets populated daily
- Check student_risk_scores table for computed risk assessments
- Verify pipeline jobs can be triggered manually via API if needed

## 📊 Post-Deployment Monitoring

### Key Metrics to Watch:
1. **AI Cache Hit Rate** - Should improve over time as similar requests are cached
2. **Sync Queue Length** - Should approach zero after network reconnects
3. **Pipeline Job Completion** - Check logs for successful daily job execution
4. **Error Rates** - Monitor for any new errors in logs

### Log Messages to Verify:
- `[offline.sync.engine] Starting offline sync with server`
- `[ai.cache] Response served from AI cache` 
- `[pipeline.service] Starting daily pipeline jobs`
- `[offline.attendance.service] Attendance recorded offline and queued for sync`

## 🔄 Rollback Procedure
If issues arise after deployment:

1. **Code Rollback**: Redeploy previous version
2. **Database**: The migration scripts are additive-only, so no schema rollback needed
3. **Feature Flags**: All new features are opt-in via UI, so existing functionality remains unaffected

## 📞 Support
For issues related to the new upgrades:
- Check application logs for detailed error messages
- Verify environment variables are correctly set
- Confirm database migrations ran successfully
- Test individual features in isolation to isolate problems

## ✨ Summary
The CBC School Management System has been successfully upgraded to a full AI-powered CBC School Operating System with:
- **AI-driven report generation** with intelligent insights
- **Offline-first capabilities** for reliable operation in low-connectivity areas
- **Intelligent caching** to reduce AI costs and improve response times  
- **Automated analytics pipeline** for continuous intelligence generation

The system now meets the goal of becoming "The first AI-native CBC school system in Kenya" - a decision + teaching + intelligence system rather than just a school management tool.
