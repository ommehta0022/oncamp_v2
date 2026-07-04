# Railway Root Directory Fix - CRITICAL

## Problem Identified

Railway is deploying from the `/backend` subdirectory instead of the root directory. This is why:
- ✅ Twilio environment variables ARE set correctly
- ✅ All files (server.py, twilio_service.py, requirements.txt) ARE in the root directory  
- ❌ BUT Railway is still loading the OLD files from `/backend` subdirectory
- ❌ Health endpoint shows `"provider": "firebase_phone_auth"` instead of `"provider": "twilio"`

## Evidence

From deployment logs:
```
Starting Container
✅ Admin routes loaded successfully
```

**MISSING**: No "✅ Twilio OTP service loaded successfully" message!

This means `twilio_service.py` is NOT being imported, confirming Railway is using `/backend/server.py` (old file) instead of root `/server.py` (new file with Twilio).

## Solution: Change Root Directory in Railway Dashboard

Railway CLI doesn't expose the "Root Directory" setting, so you need to fix it in the dashboard:

### Steps:

1. **Open Railway Dashboard**  
   Go to: https://railway.com/project/9c8cd366-c8cb-449c-af2c-2219e2838616

2. **Select the Service**  
   Click on "perpetual-motivation" service

3. **Open Settings**  
   Click "Settings" tab

4. **Find "Root Directory"**  
   Scroll down to find "Root Directory" or "Source" section

5. **Change from `backend` to empty/root**  
   - If it shows "Root Directory: backend" → **REMOVE IT** or set to `.` or leave empty
   - This tells Railway to build from the repository root instead of `/backend` subdirectory

6. **Save Settings**  
   Click "Save" or settings auto-save

7. **Trigger New Deployment**  
   Railway should automatically redeploy. If not, click "Deploy" or run:
   ```bash
   railway up --detach
   ```

8. **Wait for Build to Complete**  
   Wait 1-2 minutes for the new deployment

9. **Verify Fix**  
   Check health endpoint:
   ```bash
   curl https://perpetual-motivation-production-be1a.up.railway.app/v1/integrations/health
   ```
   
   Should now show:
   ```json
   {
     "twilio": {
       "configured": true,
       "phoneNumber": "+14788125679",
       "enabled": true
     },
     "otp": {
       "provider": "twilio",  ← THIS SHOULD SAY "twilio" NOT "firebase_phone_auth"
       "devMode": false
     }
   }
   ```

10. **Check Startup Logs**  
    Run `railway logs` and look for:
    ```
    🚀 Railway Deployment Startup Check
    ✅ Python 3.11.x
    ✅ twilio installed
    ✅ Twilio SDK imports successful
    ✅ All Twilio credentials present
    ✅ ALL CHECKS PASSED - Ready to start server
    ✅ Twilio OTP service initialized with number: +14788125679
    ✅ Twilio OTP service loaded successfully
    ✅ Admin routes loaded successfully
    ```

## Alternative: Delete and Recreate Service

If the Root Directory setting is not visible or doesn't work:

1. **Create New Service in Railway Dashboard**
2. **Connect to Same GitHub Repo**
3. **IMPORTANT: Leave "Root Directory" EMPTY**
4. **Set All Environment Variables** (copy from current service):
   - TWILIO_ACCOUNT_SID
   - TWILIO_AUTH_TOKEN
   - TWILIO_PHONE_NUMBER
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - JWT_SECRET
   - DEV_MODE
   - (all other vars from `railway variables` output)
5. **Deploy**
6. **Update Domain** (if needed)
7. **Delete Old Service**

## Why This Happened

When we initially set up Railway, we configured it to use the `/backend` directory. Later, we moved all backend files to the root directory to simplify deployment, but Railway continued using the old Root Directory setting from the service configuration.

## Verification Checklist

After fixing:
- [ ] Health endpoint shows `"provider": "twilio"`
- [ ] Startup logs show "Twilio OTP service loaded successfully"  
- [ ] OTP SMS sends successfully to +919356800676
- [ ] User can login/register with real phone number
- [ ] No "firebase_phone_auth" in logs or responses

## Need Help?

If you're stuck, send a screenshot of:
1. Railway service Settings page (showing Root Directory field)
2. Railway deployment logs (first 50 lines after "Starting Container")
3. Health endpoint response

Then we can troubleshoot further!
