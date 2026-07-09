# AQUA-APP: OnCampus Frontend - Master Agent Build System
## Complete Autonomous Build, Test & Deploy Pipeline

> **CRITICAL RULE**: After completing ALL tasks in this file, immediately say:  
> `✅ PHASE 1 COMPLETE. Proceeding to → aqua-app/PHASE-2-UI-OVERHAUL.md`

> **TRACKING RULE**: Before starting any work, read `aqua-app/TASKS_REMAINING.md` and `aqua-app/TASKS_COMPLETED.md`. After completing each task, move it from REMAINING to COMPLETED with timestamp.

---

## PHASE 1: DEEP AUDIT & MISSING API INTEGRATION

### 1.1 — Full Backend Route Discovery

**COMMAND 1**: Read `server.py` completely (all 2638 lines). Extract EVERY route decorated with `@app.get`, `@app.post`, `@app.patch`, `@app.delete`. Create a master list in `aqua-app/scratch/backend_routes.md`.

**COMMAND 2**: Read `admin_routes_simple.py` completely (all 2146 lines). Extract EVERY route decorated with `@router.get`, `@router.post`, `@router.patch`, `@router.delete`. Append to the master list.

**COMMAND 3**: Read `frontend/src/lib/api.ts` completely. Extract EVERY API function. Create `aqua-app/scratch/frontend_api_map.md`.

**COMMAND 4**: Cross-reference the two lists. For EVERY backend route that has NO matching frontend API function, log it in `aqua-app/scratch/missing_api_integrations.md` with:
- Backend route path and method
- Expected request body shape
- Expected response shape
- Which frontend screen should use it
- Priority (critical/high/medium/low)

### 1.2 — Add ALL Missing API Functions to `api.ts`

**COMMAND 5**: For each missing API from the audit above, add the corresponding function to `frontend/src/lib/api.ts`. Follow the existing patterns exactly:
- Use the `request<T>()` wrapper
- Group by feature namespace (auth, users, groups, posts, etc.)
- Add proper TypeScript generics for return types

Known missing APIs to check and add:
```
auth.refreshToken()
auth.deleteAccount()
auth.logout()
users.block(id)
users.unblock(id)
users.search(query)
groups.removeMember(groupId, userId)
groups.updateMemberRole(groupId, userId, role)
groups.muteGroup(groupId)
groups.unmuteGroup(groupId)
groups.pinGroup(groupId)
groups.searchMessages(groupId, query)
posts.repost(postId)
posts.share(postId)
posts.reportComment(commentId, body)
notifications.unreadCount()
notifications.delete(id)
notifications.updatePreferences(body)
search.groups(query)
search.users(query)
search.posts(query)
platform.settings()
platform.health()
media.upload(formData)
media.uploadAvatar(formData)
blocked.block(userId)
blocked.unblock(userId)
```

**COMMAND 6**: Add proper TypeScript types/interfaces for ALL API response shapes that are currently typed as `any` or `unknown`. Create interfaces in `api.ts` for:
- `MessageDto`
- `CommentDto`
- `NotificationDto`
- `ReportDto`
- `JoinRequestDto`
- `PostRequestDto`
- `MemberDto`
- `InstitutionDto`
- `SearchResultDto`

### 1.3 — Auth Flow Audit & Fix

**COMMAND 7**: Read `frontend/app/(auth)/login.tsx`, `signup.tsx`, `otp.tsx`, `profile-setup.tsx`, `welcome.tsx` completely.

**COMMAND 8**: Verify that:
- Login screen calls `/v1/auth/otp/start` correctly
- OTP screen calls `/v1/auth/otp/verify` or `/v1/auth/otp/verify-code` correctly
- Tokens (access + refresh) are saved to SecureStore
- Token refresh happens automatically on 401 responses
- Logout clears all tokens and navigates to welcome
- Profile setup calls `PATCH /v1/users/me` correctly
- The `_layout.tsx` root checks auth state and routes correctly

**COMMAND 9**: If token refresh is NOT implemented in `api.ts`, add it:
```typescript
// In the request() function, after getting a 401:
// 1. Try to refresh using the refresh token
// 2. If refresh succeeds, retry the original request
// 3. If refresh fails, clear session and redirect to login
```

**COMMAND 10**: Verify the Firebase phone auth integration in `firebasePhoneAuth.native.ts` works with the backend OTP endpoints. Fix any mismatches.

### 1.4 — Navigation & Deep Linking Audit

**COMMAND 11**: Read `frontend/app/_layout.tsx` and `frontend/app/(tabs)/_layout.tsx` completely.

**COMMAND 12**: Verify ALL routes are registered and navigable:
- `/(auth)/welcome` → `/(auth)/login` → `/(auth)/otp` → `/(auth)/profile-setup`
- `/(tabs)/feed` → `/post/[id]` → `/user/[id]`
- `/(tabs)/groups` → `/group/[id]` → `/group/info/[id]` → `/group/admin/[id]`
- `/(tabs)/discover` → `/group/[id]`
- `/(tabs)/notifications`
- `/(tabs)/profile` → `/settings/index` → all settings sub-screens
- `/create-post` → back to feed
- `/create-group` → back to groups
- `/search`
- `/saved`
- `/user/[id]` → `/user/connections`

**COMMAND 13**: Add any missing route files. Known potentially missing routes:
- `app/group/edit/[id].tsx` — edit group screen
- `app/post/edit/[id].tsx` — edit post screen
- `app/settings/account-delete.tsx` — account deletion confirmation
- `app/notifications/[id].tsx` — notification detail/action

### 1.5 — Data Flow & State Management Audit

**COMMAND 14**: Read `frontend/src/context/RoleProvider.tsx` completely.

**COMMAND 15**: Verify that:
- `refreshUser()` is called after login, after profile update, and on app focus
- The user object has ALL fields the UI needs (id, name, avatarUrl, roles, handle, bio, course, city, verified, etc.)
- `canCreatePosts`, `canCreateGroups`, `isGroupAdmin` are computed correctly from backend data
- There's proper error handling if `/auth/me` fails

**COMMAND 16**: Create a `NotificationProvider` context if it doesn't exist:
- Polls or listens for notification count
- Exposes `unreadCount` for tab badge
- Exposes `markAllRead()` action

**COMMAND 17**: Create a `PushNotificationProvider` if missing:
- Requests push permission on mount
- Registers device token with backend via `api.notifications.registerDevice()`
- Handles incoming notifications
- Navigates to correct screen on tap

### 1.6 — Error Handling & Loading States

**COMMAND 18**: Audit EVERY screen for proper error handling:
- Network errors show a retry button, not a blank screen
- Loading states show skeleton or spinner
- Empty states show meaningful message with action button
- 401 errors redirect to login
- 403 errors show "access denied" message
- 500 errors show "something went wrong, try again"

**COMMAND 19**: Create a reusable `ErrorBoundary` component if missing:
```
src/components/ErrorBoundary.tsx — catches render errors
src/components/NetworkError.tsx — shows retry UI for API failures
src/components/LoadingSkeleton.tsx — skeleton loading patterns
```

**COMMAND 20**: Add pull-to-refresh on EVERY list screen:
- Feed
- Groups list
- Notifications
- Discover
- Search results
- Saved posts
- Group messages
- Members list
- Join requests
- Post requests

### 1.7 — Offline & Cache Strategy

**COMMAND 21**: Add offline support to critical screens:
- Cache last feed data in AsyncStorage
- Cache user profile
- Cache group list
- Show cached data with "offline" banner when no network
- Queue actions (likes, messages) for retry when online

**COMMAND 22**: Create `src/lib/cache.ts`:
```typescript
export const cache = {
  set: (key: string, data: any, ttlMs?: number) => Promise<void>,
  get: <T>(key: string) => Promise<T | null>,
  clear: (key: string) => Promise<void>,
  clearAll: () => Promise<void>,
};
```

---

## VERIFICATION CHECKLIST (Phase 1)

Before proceeding to Phase 2, verify ALL of the following:

- [ ] Every backend route has a matching `api.ts` function
- [ ] All API functions have proper TypeScript types (no `any`)
- [ ] Auth flow works end-to-end (register → OTP → profile → app)
- [ ] Token refresh is implemented
- [ ] Logout clears all state
- [ ] All screens handle loading, error, and empty states
- [ ] Pull-to-refresh works on all list screens
- [ ] Navigation between all screens works
- [ ] Deep links work for post, group, and user screens
- [ ] Push notifications register device token
- [ ] ErrorBoundary catches render crashes
- [ ] `TASKS_REMAINING.md` and `TASKS_COMPLETED.md` are up to date

---

> **NEXT**: After ALL tasks above are complete, proceed to `aqua-app/PHASE-2-UI-OVERHAUL.md`
