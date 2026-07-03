# 🚨 CRITICAL SECURITY ISSUE - IMMEDIATE ACTION REQUIRED

**Date:** July 3, 2026  
**Severity:** 🔴 **CRITICAL**  
**Status:** ⚠️ **SECRETS EXPOSED ON GITHUB**

---

## 🚨 WHAT HAPPENED

**JWT secrets, Supabase keys, and API tokens were committed to documentation files and are publicly visible on GitHub.**

### Exposed Secrets:
1. ✅ JWT_SECRET: `[REDACTED]`
2. ✅ SUPABASE_SERVICE_ROLE_KEY: `[REDACTED]`
3. ✅ Vercel Token: `[REDACTED]`
4. ✅ Railway Tokens: `[REDACTED]`
5. ✅ Supabase Anon Key: `[REDACTED]`

### Files Containing Secrets:
- Multiple `.md` documentation files
- `admin-panel/DEPLOYMENT_GUIDE.md`
- `admin-panel/DEPLOYMENT_COMPLETE.md`
- `.kiro/specs/enterprise-backend-system/design.md`
- Other documentation files

---

## ⚡ IMMEDIATE ACTIONS (DO THIS NOW!)

### Step 1: Rotate JWT Secret (5 minutes)

**Generate New Secret:**
```powershell
# Generate strong random secret
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Update Railway:**
```bash
# Set new JWT_SECRET in Railway
railway variables set JWT_SECRET="YOUR_NEW_SECRET_HERE"
```

**Update Vercel (if used):**
```bash
vercel env rm JWT_SECRET production
vercel env add JWT_SECRET production
# Enter new secret when prompted
```

### Step 2: Rotate Supabase Keys (10 minutes)

**Option A: Keep Current (if low risk)**
- Log into Supabase Dashboard
- Check Access Logs for suspicious activity
- Enable Row Level Security (RLS) if not already

**Option B: Rotate (recommended)**
- Go to: https://supabase.com/dashboard/project/nxoqasndyebhiwkkfvnj/settings/api
- Click "Reset service_role key" (⚠️ will break current deployments)
- Update Railway environment variable
- Update Vercel environment variable
- Redeploy both services

### Step 3: Revoke and Recreate Railway Tokens (2 minutes)

1. Go to: https://railway.app/account/tokens
2. Delete exposed tokens:
   - `8f7432e1-22cc-479e-8f84-79f77a1639d6`
   - `3d9b2513-a53a-4f33-a72c-19857a712125`
3. Create new tokens
4. Update local scripts if used

### Step 4: Revoke and Recreate Vercel Token (2 minutes)

1. Go to: https://vercel.com/account/tokens
2. Delete exposed token: `[REDACTED - Check local documentation]`
3. Create new token with same permissions
4. Update local scripts if used

### Step 5: Redeploy Everything (5 minutes)

**Backend (Railway):**
```bash
cd d:\automate\oncamp_v2\backend
git add .
git commit -m "chore: rotate secrets"
git push origin main
# Railway auto-deploys
```

**Admin Panel (Vercel):**
```bash
cd d:\automate\oncamp_v2\admin-panel
vercel --prod
```

---

## 🔒 PREVENTING FUTURE EXPOSURE

### Update .gitignore (DONE)
Already updated to exclude sensitive files.

### Move Secrets to Environment Variables Only

**Railway:**
```bash
railway variables set JWT_SECRET="..."
railway variables set SUPABASE_SERVICE_ROLE_KEY="..."
```

**Vercel:**
```bash
vercel env add JWT_SECRET production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

### Never Commit These Files:
- `.env` files
- `*credentials*.md` files
- `*token*.txt` files
- Any file with actual secret values

---

## 🧹 CLEANING GIT HISTORY

**⚠️ WARNING: Only do this AFTER rotating all secrets!**

### Why Clean History?
Even after rotating secrets, old commits still contain them. Anyone who cloned the repo before rotation could still have the old secrets.

### How to Clean:

**Option 1: Using BFG Repo-Cleaner (Recommended)**
```powershell
# Install
choco install bfg

# Remove secrets
bfg --replace-text secrets.txt d:\automate\oncamp_v2

# Force push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin main --force
```

**Option 2: Using git-filter-repo**
```powershell
# Install
pip install git-filter-repo

# Remove secrets
git filter-repo --path-glob '*.md' --invert-paths --force

# Force push
git push origin main --force
```

**Option 3: Delete and Recreate Repository**
1. Create new empty repository
2. Copy files (without .git folder)
3. Initialize new git repo
4. Push to new repository
5. Update deployment URLs
6. Delete old repository

---

## 📋 CHECKLIST

### Immediate (Within 1 Hour)
- [ ] Generate new JWT_SECRET
- [ ] Update JWT_SECRET in Railway
- [ ] Update JWT_SECRET in Vercel (if used)
- [ ] Revoke old Railway tokens
- [ ] Create new Railway tokens
- [ ] Revoke old Vercel token
- [ ] Create new Vercel token
- [ ] Redeploy backend (Railway)
- [ ] Redeploy frontend (Vercel)
- [ ] Test admin login works
- [ ] Test API calls work

### Within 24 Hours
- [ ] Review Supabase access logs
- [ ] Decide if Supabase key rotation needed
- [ ] Rotate Supabase keys (if needed)
- [ ] Update all environment variables
- [ ] Redeploy all services
- [ ] Test full system

### Within 1 Week
- [ ] Clean git history (after rotation complete)
- [ ] Force push cleaned history
- [ ] Notify collaborators to re-clone
- [ ] Review all documentation files
- [ ] Remove any remaining secrets
- [ ] Set up secret scanning (GitHub Advanced Security)
- [ ] Set up pre-commit hooks to prevent secret commits

---

## 🔍 MONITORING FOR COMPROMISE

### Check for Suspicious Activity

**Supabase Logs:**
1. Go to: https://supabase.com/dashboard/project/nxoqasndyebhiwkkfvnj/logs
2. Look for:
   - Unusual API calls
   - Failed authentication attempts
   - Unexpected data access
   - Calls from unknown IPs

**Railway Logs:**
1. Go to: https://railway.app/project/9c8cd366-c8cb-449c-af2c-2219e2838616
2. Check for:
   - Unexpected deployments
   - Unusual CPU/memory spikes
   - Failed requests from unknown sources

**Database Audit:**
```sql
-- Check for unexpected admin users
SELECT * FROM admin_users WHERE created_at > NOW() - INTERVAL '7 days';

-- Check for suspicious audit logs
SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC;

-- Check for data modifications
SELECT * FROM users WHERE updated_at > NOW() - INTERVAL '7 days' ORDER BY updated_at DESC;
```

### Signs of Compromise:
- ❌ Unexpected admin users created
- ❌ Mass data deletions or modifications
- ❌ Unusual API traffic patterns
- ❌ Failed login attempts from many IPs
- ❌ Unexpected database queries
- ❌ Unauthorized deployments

---

## 🛡️ LONG-TERM SECURITY IMPROVEMENTS

### 1. Secret Management Service
Use a proper secret manager:
- **Doppler** - https://doppler.com
- **1Password Secrets** - https://1password.com/products/secrets
- **AWS Secrets Manager**
- **HashiCorp Vault**

### 2. GitHub Secret Scanning
Enable on repository:
1. Go to: Settings → Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection"

### 3. Pre-commit Hooks
Install `detect-secrets`:
```powershell
pip install detect-secrets
detect-secrets scan --baseline .secrets.baseline
```

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/sh
detect-secrets-hook --baseline .secrets.baseline
```

### 4. Environment Variable Validation
Add to deployment scripts:
```bash
# Check required vars
if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET not set"
  exit 1
fi
```

### 5. Regular Secret Rotation
Set up calendar reminders:
- Rotate JWT secrets: Every 90 days
- Rotate API tokens: Every 90 days
- Review access logs: Weekly
- Audit user permissions: Monthly

---

## 📞 IF COMPROMISE DETECTED

### Immediate Actions:
1. **🔴 TAKE SYSTEMS OFFLINE**
   ```bash
   railway down
   vercel --prod down
   ```

2. **🔴 ROTATE ALL SECRETS IMMEDIATELY**
   - JWT secrets
   - Database passwords
   - API keys
   - Access tokens

3. **🔴 REVOKE ALL ADMIN SESSIONS**
   ```sql
   -- In Supabase SQL editor
   DELETE FROM admin_sessions;
   ```

4. **🔴 ENABLE MAINTENANCE MODE**
   ```bash
   curl -X POST https://your-backend.railway.app/admin/settings/maintenance-mode \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{"enabled": true, "message": "Emergency maintenance"}'
   ```

5. **🔴 NOTIFY STAKEHOLDERS**
   - Email all admin users
   - Post status update
   - Contact support if needed

6. **🔍 CONDUCT FORENSICS**
   - Download all logs
   - Check audit trails
   - Identify extent of breach
   - Document timeline

7. **🛡️ RESTORE SAFELY**
   - Fix vulnerabilities
   - Restore from clean backup
   - Test thoroughly
   - Bring systems back online

---

## 📝 INCIDENT REPORT TEMPLATE

```
SECURITY INCIDENT REPORT

Date/Time: _______________
Detected By: _______________
Severity: [ ] Critical  [ ] High  [ ] Medium  [ ] Low

DESCRIPTION:
_______________________________________

EXPOSED SECRETS:
- [ ] JWT_SECRET
- [ ] Database credentials
- [ ] API tokens
- [ ] Other: _______________

ACTIONS TAKEN:
1. _______________
2. _______________
3. _______________

COMPROMISED DATA:
_______________________________________

AFFECTED USERS:
_______________________________________

RESOLUTION:
_______________________________________

LESSONS LEARNED:
_______________________________________

PREVENTION MEASURES:
_______________________________________

Sign-off: _______________ Date: _______________
```

---

## ⚡ QUICK COMMAND REFERENCE

```powershell
# Generate new JWT secret
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Update Railway secret
railway variables set JWT_SECRET="NEW_SECRET"

# Update Vercel secret
vercel env rm JWT_SECRET production
vercel env add JWT_SECRET production

# Check current secrets (Railway)
railway variables

# Check current secrets (Vercel)
vercel env ls

# Redeploy Railway
railway up --detach

# Redeploy Vercel
vercel --prod

# Check deployment status
railway status
vercel ls
```

---

**STATUS:** 🔴 **CRITICAL - IMMEDIATE ACTION REQUIRED**  
**PRIORITY:** 🚨 **P0 - DROP EVERYTHING**  
**TIME TO FIX:** ⏱️ **30-60 minutes**

**DO THIS NOW - THEN READ THE REST!**
