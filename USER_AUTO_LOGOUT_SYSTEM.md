# User Auto-Logout System 🔒

**Feature:** When admin deletes/bans a user, they are automatically logged out from ALL devices immediately.

---

## How It Works

### 1. **Token Blacklist Table**
Tracks users whose tokens should be invalidated:
- User deleted → Permanent blacklist
- User banned → Blacklist until unbanned
- Admin revoked → Manual blacklist

### 2. **Backend Middleware Check**
Every API request checks:
1. Is user blacklisted?
2. Is user status banned/deleted?
3. Does user still exist?

If any fail → `403 Forbidden` → Mobile app auto-logs out

### 3. **Automatic Triggers**
- Admin bans user → Added to blacklist
- Admin deletes user → Added to blacklist
- Database trigger → Auto-adds on status change

---

## Implementation

### Backend Changes ✅

#### 1. **Database Table** (`database/user_auto_logout.sql`)
```sql
CREATE TABLE token_blacklist (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,  -- 'user_deleted', 'user_banned', 'admin_revoked'
  blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- NULL = permanent
  admin_id UUID,
  notes TEXT
);
```

#### 2. **Enhanced Auth Middleware** (`server.py`)
```python
def current_user(...):
    # Check blacklist
    if user in blacklist:
        raise HTTPException(403, "Access revoked. Account banned or deleted.")
    
    # Check user status
    if user.status in ('banned', 'deleted'):
        raise HTTPException(403, "Account banned/deleted.")
```

#### 3. **Admin Actions** (`admin_routes_simple.py`)
```python
@router.post("/users/{user_id}/ban")
async def ban_user(...):
    # Ban user
    update_status('banned')
    
    # Blacklist tokens → Force logout
    blacklist_user_tokens(user_id, reason='user_banned')

@router.delete("/users/{user_id}")
async def delete_user(...):
    # Blacklist FIRST (before deletion)
    blacklist_user_tokens(user_id, reason='user_deleted')
    
    # Then delete user
    delete_from_db(user_id)
```

---

## Deployment Steps

### Step 1: Run Database Migration
```sql
-- Go to Supabase Dashboard → SQL Editor
-- Run: database/user_auto_logout.sql
```

**What it creates:**
- `token_blacklist` table
- `blacklist_user_tokens()` function
- Triggers on user deletion/ban
- `is_user_blacklisted()` check function
- Cleanup function for expired entries

### Step 2: Pull Code & Restart
```bash
cd /path/to/oncamp_v2
git pull origin main
python server.py
```

### Step 3: Test It!
1. Admin bans a user
2. User tries to use app
3. Gets "403 Access revoked"
4. App auto-logs out

---

## Testing Guide

### Test 1: Ban User
```bash
# Admin panel: Ban a test user
POST /admin/users/{user_id}/ban
{
  "reason": "Testing auto-logout"
}

# Mobile app: User tries to load feed
GET /v1/feed
# Expected: 403 Forbidden "Account banned"

# Mobile app: Auto-logout triggered
# User sees login screen
```

### Test 2: Delete User
```bash
# Admin panel: Delete user
DELETE /admin/users/{user_id}

# Mobile app: User tries any action
GET /v1/users/me
# Expected: 403 Forbidden "Account not found"

# Mobile app: Auto-logout triggered
```

### Test 3: Unban User
```bash
# Admin panel: Unban user
POST /admin/users/{user_id}/unban

# Mobile app: User can login again
POST /v1/otp/send
# Expected: 200 OK
```

---

## Verification Queries

### Check Blacklisted Users
```sql
SELECT * FROM blacklisted_users;
-- Shows all currently blacklisted users with reason
```

### Check If Specific User Blacklisted
```sql
SELECT is_user_blacklisted('user-id-here');
-- Returns TRUE if blacklisted
```

### View Blacklist History
```sql
SELECT 
  user_id,
  reason,
  blacklisted_at,
  expires_at,
  notes
FROM token_blacklist
ORDER BY blacklisted_at DESC
LIMIT 10;
```

### Count Blacklisted Users
```sql
SELECT 
  reason,
  COUNT(*) as count
FROM token_blacklist
WHERE expires_at IS NULL OR expires_at > NOW()
GROUP BY reason;
```

---

## Error Handling

### Mobile App Gets 403
```javascript
// In API client interceptor
if (response.status === 403) {
  // Clear all tokens
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
  
  // Redirect to login
  navigation.navigate('Login');
  
  // Show message
  Alert.alert('Session Expired', 'Your account has been banned or deleted.');
}
```

---

## Features

### ✅ Implemented
- Token blacklist table
- Automatic blacklisting on ban/delete
- Middleware checks blacklist on every request
- Admin endpoints trigger blacklisting
- Database triggers for status changes

### 🔄 Auto-Cleanup (Optional)
Add to cron job:
```sql
-- Run daily to cleanup expired blacklist entries
SELECT cleanup_expired_blacklist();
```

---

## Security Benefits

1. **Immediate Effect** - User logged out instantly (next API call)
2. **All Devices** - Works across mobile, web, everywhere
3. **No Token Refresh** - Can't bypass with refresh token
4. **Audit Trail** - All blacklist actions logged
5. **Reversible** - Unban removes from blacklist

---

## Performance Impact

- **Minimal** - Single indexed query per request
- **Fast Lookup** - Index on `user_id`
- **Cached** - Can add Redis layer if needed

### Optimization (Optional)
```python
# Add Redis cache for blacklist
@lru_cache(maxsize=10000)
def is_blacklisted(user_id):
    return check_db(user_id)
```

---

## Maintenance

### Regular Cleanup
```sql
-- Remove expired blacklist entries
DELETE FROM token_blacklist
WHERE expires_at IS NOT NULL 
  AND expires_at < NOW() - INTERVAL '30 days';
```

### Monitor Blacklist Size
```sql
SELECT 
  'Blacklist Stats' as metric,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE expires_at IS NULL) as permanent,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_temp
FROM token_blacklist;
```

---

## Troubleshooting

### User Not Logging Out
**Check:**
1. Blacklist entry exists: `SELECT * FROM token_blacklist WHERE user_id = '...'`
2. Middleware is checking: Look for server logs
3. Mobile app handling 403: Check error interceptor

### False Positives
**Check:**
1. User status in database
2. Blacklist expiry date
3. Recent admin actions

### Performance Issues
**Solutions:**
1. Add index: `CREATE INDEX idx_blacklist_lookup ON token_blacklist(user_id, expires_at);`
2. Add Redis caching
3. Cleanup old entries regularly

---

## API Error Responses

### User Blacklisted
```json
{
  "detail": "Access revoked. Your account has been deleted or banned."
}
```

### User Banned
```json
{
  "detail": "Account banned. Please contact support."
}
```

### User Deleted
```json
{
  "detail": "Account not found. Your account may have been deleted."
}
```

---

## Mobile App Implementation

### API Interceptor
```typescript
// Add to api client
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 403) {
      // Account banned/deleted
      await logout();
      navigation.navigate('Login');
      Alert.alert(
        'Account Issue',
        error.response.data.detail || 'Your account has been suspended.'
      );
    }
    return Promise.reject(error);
  }
);
```

---

## Admin Panel UI (Optional Enhancement)

### Add Blacklist Management Page
```typescript
// Show blacklisted users
GET /admin/blacklist

// Manually blacklist user
POST /admin/blacklist
{
  "user_id": "...",
  "reason": "admin_revoked",
  "expires_at": "2024-12-31T23:59:59Z",  // or null
  "notes": "Manual revocation"
}

// Remove from blacklist
DELETE /admin/blacklist/{user_id}
```

---

## Summary

### What Happens:
1. Admin deletes/bans user
2. User added to `token_blacklist` table
3. User's next API request checked
4. Middleware finds blacklist entry
5. Returns 403 error
6. Mobile app receives 403
7. App logs user out automatically
8. User redirected to login screen

### Time to Effect:
- **Immediate** on next API call
- Usually <1 second in active usage
- Background sync will catch it within minutes

---

**Status:** ✅ Ready for Production  
**Risk:** Low (backward compatible)  
**Impact:** High (instant logout on ban/delete)

**Next Steps:**
1. Run database migration
2. Pull code and restart server
3. Test with a dummy user
4. Monitor for 24 hours
