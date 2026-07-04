# Manual Steps Required After Git Pull

## ✅ Quick Checklist

### 1. **Install Dependencies** (REQUIRED)
```bash
cd /path/to/oncamp_v2
pip install -r requirements.txt
```

**What it does:** Installs `slowapi` for rate limiting  
**Time:** 10 seconds  
**Required:** YES

---

### 2. **Database Migration** (OPTIONAL but RECOMMENDED)
```bash
# Option A: Supabase Dashboard
1. Go to Supabase Dashboard
2. Click "SQL Editor"
3. Open: database/security_phase1_migration.sql
4. Copy all content and paste
5. Click "Run"
```

```bash
# Option B: Command line (if you have psql)
psql -h <supabase-host> -U postgres -d postgres -f database/security_phase1_migration.sql
```

**What it does:** Adds `hash_algorithm` column to track bcrypt vs SHA256  
**Time:** 5 seconds  
**Required:** NO (code works without it, just less optimal)  
**Safe:** YES (idempotent, can run multiple times)

---

### 3. **Restart Backend Server** (REQUIRED)
```bash
# Kill existing server process
# Then restart:
python server.py

# Or with uvicorn:
uvicorn server:app --reload --port 4000
```

**What it does:** Loads new security code  
**Time:** 5 seconds  
**Required:** YES

---

### 4. **Test Login** (RECOMMENDED)
```bash
# Try logging in to admin panel
# Should work normally
# Password auto-migrates from SHA256 to bcrypt
```

**What to test:**
- Login with existing password ✅
- Try 6 wrong passwords (should be blocked) ✅
- Check if password was rehashed to bcrypt ✅

---

## 🔍 Detailed Steps

### Step 1: Install Dependencies

**On Server:**
```bash
cd /path/to/oncamp_v2
git pull origin main
pip install -r requirements.txt
```

**Expected Output:**
```
Collecting slowapi>=0.1.9
  Using cached slowapi-0.1.9-py3-none-any.whl
Installing collected packages: slowapi
Successfully installed slowapi-0.1.9
```

**Verify Installation:**
```bash
pip show slowapi
```

---

### Step 2: Database Migration (Optional)

#### Why Optional?
The code checks for `hash_algorithm` column and defaults to `'sha256'` if missing. BUT adding the column is better because:
- Explicit tracking of hash type
- Better performance (no default fallback)
- Audit trail with `password_changed_at`

#### How to Run:

**Method 1: Supabase Dashboard (Easiest)**
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Create new query
4. Copy content from `database/security_phase1_migration.sql`
5. Paste and click "Run"
6. Check output - should say "Added hash_algorithm column"

**Method 2: Command Line**
```bash
# Get your Supabase connection string from dashboard
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres" \
  -f database/security_phase1_migration.sql
```

#### Verify Migration:
```sql
-- Run in Supabase SQL Editor
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'admin_users' 
  AND column_name IN ('hash_algorithm', 'password_changed_at');
```

**Expected Result:**
```
column_name         | data_type | is_nullable | column_default
--------------------+-----------+-------------+----------------
hash_algorithm      | text      | NO          | 'sha256'::text
password_changed_at | timestamp | YES         | NULL
```

---

### Step 3: Restart Server

**Find and Kill Process:**
```bash
# Linux/Mac:
ps aux | grep server.py
kill <PID>

# Or:
pkill -f server.py
```

**Restart:**
```bash
cd /path/to/oncamp_v2
python server.py
```

**Expected Output:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:4000
```

**Verify Slowapi Loaded:**
```bash
# Check logs for any errors about slowapi
# Should see no errors
```

---

### Step 4: Test Security Features

#### Test 1: Normal Login (Should Work)
```bash
# Go to admin panel: https://your-domain/auth/login
# Login with existing credentials
# Should work normally
```

**Check Database:**
```sql
-- After successful login, check if password was rehashed
SELECT 
    email,
    hash_algorithm,
    password_changed_at,
    LEFT(password_hash, 10) as hash_preview
FROM admin_users
WHERE email = 'your@email.com';
```

**Expected After First Login:**
- `hash_algorithm` changed from `'sha256'` to `'bcrypt'`
- `password_changed_at` updated to current time
- `password_hash` starts with `$2b$12$` (bcrypt format)

#### Test 2: Rate Limiting (Should Block)
```bash
# Try logging in with WRONG password 6 times
# 5th attempt should succeed (but fail auth)
# 6th attempt should return rate limit error
```

**Expected Error:**
```json
{
  "detail": "Too many login attempts. Please try again in 15 minutes."
}
```

**Check Database:**
```sql
SELECT 
    email,
    ip_address,
    reason,
    last_attempt
FROM failed_login_attempts
WHERE email = 'your@email.com'
ORDER BY last_attempt DESC
LIMIT 5;
```

#### Test 3: Account Lockout (After 10 Attempts)
```bash
# Try 10 wrong passwords
# Should get lockout message
```

**Expected Error:**
```json
{
  "detail": "Too many failed attempts. Account locked for 57 more minutes."
}
```

---

## 📊 Verification Queries

### Check Current Admin Status:
```sql
SELECT 
    id,
    email,
    role,
    hash_algorithm,
    password_changed_at,
    is_active,
    created_at
FROM admin_users
ORDER BY created_at DESC;
```

### Check Failed Login Attempts:
```sql
SELECT 
    email,
    COUNT(*) as attempt_count,
    MAX(last_attempt) as last_attempt,
    ARRAY_AGG(DISTINCT reason) as reasons
FROM failed_login_attempts
WHERE last_attempt > NOW() - INTERVAL '24 hours'
GROUP BY email
ORDER BY attempt_count DESC;
```

### Check If Migration Needed:
```sql
-- If this returns FALSE, run the migration
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'admin_users' 
    AND column_name = 'hash_algorithm'
) as migration_done;
```

---

## 🐛 Troubleshooting

### Error: "ModuleNotFoundError: No module named 'slowapi'"
**Solution:**
```bash
pip install slowapi
```

### Error: "column 'hash_algorithm' does not exist"
**Solution:** Run the database migration (Step 2 above)

**Quick Fix (if migration fails):**
```sql
ALTER TABLE admin_users ADD COLUMN hash_algorithm TEXT DEFAULT 'sha256';
```

### Error: "429 Too Many Requests" immediately
**Solution:** Clear failed login attempts
```sql
DELETE FROM failed_login_attempts WHERE email = 'your@email.com';
```

### Passwords not migrating to bcrypt
**Check:**
1. Database migration ran successfully
2. `hash_algorithm` column exists
3. Server has bcrypt installed: `pip show bcrypt`
4. Server logs for errors

**Manual Check:**
```sql
SELECT 
    email,
    hash_algorithm,
    LENGTH(password_hash) as hash_length,
    LEFT(password_hash, 4) as hash_start
FROM admin_users;
```

**Expected:**
- SHA256: length=64, starts with lowercase letters/numbers
- Bcrypt: length=60, starts with `$2b$`

---

## ⏱️ Total Time Required

- **Step 1 (Install):** 10 seconds ⚡
- **Step 2 (Migration):** 5 seconds (optional) ⚡
- **Step 3 (Restart):** 5 seconds ⚡
- **Step 4 (Test):** 2 minutes ⏱️

**Total:** ~3 minutes

---

## ✅ Success Criteria

After completing all steps, verify:

- [x] Server starts without errors
- [x] Slowapi is installed
- [x] Login works with existing password
- [x] Password migrates to bcrypt after login
- [x] Rate limiting blocks after 5 failed attempts
- [x] Failed attempts are logged to database
- [x] Successful login clears failed attempts

---

## 🚨 Rollback (If Issues)

If something breaks:

```bash
# 1. Revert code
cd /path/to/oncamp_v2
git revert 067b944

# 2. Restart server
pkill -f server.py
python server.py

# 3. Optional: Revert database
# (Only if you ran the migration)
ALTER TABLE admin_users DROP COLUMN IF EXISTS hash_algorithm;
ALTER TABLE admin_users DROP COLUMN IF EXISTS password_changed_at;
```

---

## 📞 Need Help?

If stuck:
1. Check server logs: `tail -f logs/server.log`
2. Check database logs in Supabase Dashboard
3. Verify environment variables: JWT_SECRET, SUPABASE_URL, etc.
4. Test endpoints manually with curl

**Test Login Endpoint:**
```bash
curl -X POST https://your-api.com/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

---

**Status:** Ready to deploy 🚀  
**Risk:** LOW (backward compatible)  
**Downtime:** None (hot reload)
