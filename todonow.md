# OnCampus TODO Now

Last updated: 2026-07-02

## Current Verified State

Done:
- Supabase schema from `full_db_schema.sql` is live and verified for all required tables, including `notifications`.
- Backend uses production Firebase Phone Auth token exchange through `POST /v1/auth/otp/verify`.
- Backend dev OTP, dummy OTP code output, `ALLOW_DEV_AUTH`, `x-user-id` auth bypass, and test push endpoint are removed.
- Firebase Auth phone provider is enabled.
- Firebase test phone number from `all_set/test_phone_number.txt` is registered with test OTP in Firebase.
- Frontend login and OTP screens use Firebase Phone Auth and exchange the Firebase ID token with backend.
- Upstash Redis is configured and reachable from the verified local backend.
- Railway API service variables were pushed for Supabase, Upstash Redis, Firebase service account JSON, JWT, and CORS.
- Railway public domain exists: `https://api-production-e705.up.railway.app`.
- Render API key works, but this Render account currently has no services.
- Frontend TypeScript passes.
- Frontend lint passes.
- Frontend web export passes.
- Local updated backend is running on `http://127.0.0.1:4002`.
- Local web preview is running on `http://localhost:8082` and points to backend `4002`.

## Current Test Results

Run from `D:\2026-06-30\oncampuses-v1`:

```powershell
python -m py_compile backend\server.py
```

Result: passing.

Run from `D:\2026-06-30\oncampuses-v1\frontend`:

```powershell
npx tsc --noEmit
npm run lint
npx expo export --platform web --output-dir dist-web
```

Result: all passing.

Verified local backend:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:4002/v1/health
Invoke-RestMethod -Uri http://127.0.0.1:4002/v1/integrations/health
```

Result:
- Supabase configured.
- Upstash Redis configured and reachable.
- Firebase configured.
- OTP provider is `firebase_phone_auth`.

## Main Remaining Blocker

Railway public domain is not serving the current FastAPI backend code.

Observed:
- `https://api-production-e705.up.railway.app/v1/health` returns an older/different payload:

```json
{
  "status": "ok",
  "service": "oncampus-backend-api",
  "timestamp": "..."
}
```

Expected current backend payload includes:
- `supabaseConfigured`
- `redisConfigured`
- `redisReachable`
- `firebaseConfigured`
- `otpProvider`

What this means:
- Railway variables are pushed, and redeploy was triggered.
- The public Railway service is still running old code or a different service source/root.

Next action:
1. Open Railway project `meticulous-achievement`.
2. Open service `api`.
3. Check `Settings` and confirm deploy source points to this repo.
4. Confirm root/build/start settings match:

```text
Root directory: .
Build command: cd backend && pip install -r requirements.txt
Start command: cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT
Healthcheck path: /v1/health
```

5. Redeploy service `api`.
6. Recheck:

```powershell
Invoke-RestMethod -Uri https://api-production-e705.up.railway.app/v1/health | ConvertTo-Json -Depth 8
```

If Railway is connected to GitHub, current local changes must be pushed to the connected branch before Railway can serve them.

## Remaining Frontend Data Wiring

These screens still import `frontend/src/data/mock.ts` and should be wired to real API before production release:

- `frontend/app/(auth)/welcome.tsx`
- `frontend/app/(auth)/profile-setup.tsx`
- `frontend/app/(tabs)/feed.tsx`
- `frontend/app/(tabs)/groups.tsx`
- `frontend/app/(tabs)/discover.tsx`
- `frontend/app/(tabs)/profile.tsx`
- `frontend/app/(tabs)/notifications.tsx`
- `frontend/app/create-post.tsx`
- `frontend/app/group/[id].tsx`
- `frontend/app/group/admin/[id].tsx`
- `frontend/app/group/admin/post-requests/[id].tsx`
- `frontend/app/group/info/[id].tsx`
- `frontend/app/group/members/[id].tsx`
- `frontend/app/group/post-request/[id].tsx`
- `frontend/app/group/requests/[id].tsx`
- `frontend/app/institution/admins.tsx`
- `frontend/app/post/[id].tsx`
- `frontend/app/saved.tsx`
- `frontend/app/search.tsx`
- `frontend/app/settings/blocked.tsx`
- `frontend/app/settings/edit-profile.tsx`
- `frontend/app/settings/index.tsx`

Priority order:
1. Feed, groups, group chat, group details, create post.
2. Group admin post requests and join requests.
3. User profile, edit profile, search, notifications.
4. Saved posts, blocked users, institution admin list.
5. Welcome/onboarding can keep static slides because it is content, not fake production data.

## Backend API Gaps For Full Dummy Removal

Already available:
- Auth session from Firebase phone token.
- Current user get/update.
- Feed list.
- Create post.
- My groups.
- Discover groups.
- Group details.
- Create group.
- Join/leave group.
- Group messages.
- Join request approve/reject.
- Group post request create/list/approve/reject.
- Institution registration and dashboard.
- Notifications list and device registration.

Still needed before every mock screen can be removed:
- Single post detail API.
- Post comments/reactions/saved APIs.
- User search API.
- Group member list API.
- Group admin/member role management APIs.
- Saved posts API.
- Blocked users list/block/unblock APIs.
- Institution admins list/invite/remove APIs.

## APK Rule

Do not build final APK yet.

Before APK:
1. User approves browser preview at `http://localhost:8082`.
2. Railway or Render serves the current backend health payload.
3. Frontend production API URL points to the deployed backend.
4. Android SHA-1 and SHA-256 fingerprints are added in Firebase for the build keystore.
5. Updated `google-services.json` is downloaded after SHA fingerprints are added.

APK build command after approval:

```powershell
cd D:\2026-06-30\oncampuses-v1\frontend
$env:EXPO_PUBLIC_API_URL="https://api-production-e705.up.railway.app/v1"
npx expo prebuild --platform android
npx expo run:android --variant release
```

## Files Not To Commit

Do not commit:
- `all_info_for_api_referance_only/`
- `frontend/dist-web/`
- root helper scripts created during setup unless intentionally moved to `tools/`
- backend/frontend log files

