`-- ============================================================================
-- User Auto-Logout System
-- When admin deletes/bans user, automatically invalidate all their sessions
-- ============================================================================

-- ============================================================================
-- 1. Create token blacklist table
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_blacklist (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,  -- Changed from UUID to TEXT to match users table
  reason TEXT NOT NULL, -- 'user_deleted', 'user_banned', 'admin_revoked'
  blacklisted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- When to remove from blacklist (for temp bans)
  admin_id TEXT, -- Admin who triggered the blacklist (TEXT to match admin_users)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at) WHERE expires_at IS NOT NULL;

-- Disable RLS for system table (admins only access this)
ALTER TABLE token_blacklist DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE token_blacklist IS 'Tracks users whose tokens should be invalidated (deleted/banned users)';
COMMENT ON COLUMN token_blacklist.reason IS 'Why user was blacklisted: user_deleted, user_banned, user_muted, admin_revoked';
COMMENT ON COLUMN token_blacklist.expires_at IS 'NULL for permanent (deleted), timestamp for temporary (banned/muted)';

-- ============================================================================
-- 2. Function to blacklist user tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION blacklist_user_tokens(
  p_user_id TEXT,  -- Changed from UUID to TEXT
  p_reason TEXT,
  p_admin_id TEXT DEFAULT NULL,  -- Changed from UUID to TEXT
  p_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$  -- Changed from UUID to TEXT
DECLARE
  v_blacklist_id TEXT;
BEGIN
  -- Insert into blacklist
  INSERT INTO token_blacklist (
    user_id,
    reason,
    admin_id,
    expires_at,
    notes
  ) VALUES (
    p_user_id,
    p_reason,
    p_admin_id,
    p_expires_at,
    p_notes
  )
  RETURNING id INTO v_blacklist_id;
  
  -- Log the action (only if audit_logs table exists)
  BEGIN
    INSERT INTO audit_logs (
      admin_id,
      action,
      target_type,
      target_id,
      details
    ) VALUES (
      p_admin_id,
      'TOKEN_BLACKLIST',
      'user',
      p_user_id,
      jsonb_build_object(
        'reason', p_reason,
        'expires_at', p_expires_at,
        'notes', p_notes
      )
    );
  EXCEPTION
    WHEN undefined_table THEN
      -- audit_logs table doesn't exist, skip logging
      NULL;
  END;
  
  RETURN v_blacklist_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION blacklist_user_tokens IS 'Add user to token blacklist to force logout everywhere';

-- ============================================================================
-- 3. Trigger on user deletion
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_blacklist_on_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Blacklist all tokens for deleted user
  PERFORM blacklist_user_tokens(
    OLD.id,
    'user_deleted',
    NULL, -- Admin ID from context if available
    NULL, -- Permanent blacklist
    'User account deleted'
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_blacklist_on_user_delete ON users;

-- Create trigger
CREATE TRIGGER trg_blacklist_on_user_delete
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_blacklist_on_user_delete();

COMMENT ON TRIGGER trg_blacklist_on_user_delete ON users IS 'Auto-blacklist user tokens when user is deleted';

-- ============================================================================
-- 4. Trigger on user ban/status change
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_blacklist_on_user_ban()
RETURNS TRIGGER AS $$
BEGIN
  -- If user status changed to banned (only valid status for blocking)
  IF NEW.status = 'banned' AND OLD.status != 'banned' THEN
    PERFORM blacklist_user_tokens(
      NEW.id,
      'user_banned',
      NULL, -- Admin ID from context
      CASE 
        WHEN NEW.banned_until IS NOT NULL THEN NEW.banned_until
        ELSE NULL -- Permanent
      END,
      'User status changed to banned'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_blacklist_on_user_ban ON users;

-- Create trigger
CREATE TRIGGER trg_blacklist_on_user_ban
  AFTER UPDATE OF status ON users
  FOR EACH ROW
  WHEN (NEW.status = 'banned')
  EXECUTE FUNCTION trigger_blacklist_on_user_ban();

COMMENT ON TRIGGER trg_blacklist_on_user_ban ON users IS 'Auto-blacklist user tokens when user is banned';

-- ============================================================================
-- 5. Function to check if user is blacklisted
-- ============================================================================

CREATE OR REPLACE FUNCTION is_user_blacklisted(p_user_id TEXT)  -- Changed from UUID to TEXT
RETURNS BOOLEAN AS $$
DECLARE
  v_blacklisted BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM token_blacklist
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO v_blacklisted;
  
  RETURN v_blacklisted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_user_blacklisted IS 'Check if user tokens are blacklisted (deleted/banned)';

-- ============================================================================
-- 6. Cleanup function for expired blacklist entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_blacklist()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM token_blacklist
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_blacklist IS 'Remove expired blacklist entries (run daily via cron)';

-- ============================================================================
-- 7. View for monitoring blacklisted users
-- ============================================================================

CREATE OR REPLACE VIEW blacklisted_users AS
SELECT 
  tb.id,
  tb.user_id,
  u.phone_hash,
  u.name,
  u.city,
  u.status as user_status,
  tb.reason,
  tb.blacklisted_at,
  tb.expires_at,
  tb.admin_id,
  a.email as admin_email,
  tb.notes,
  CASE 
    WHEN tb.expires_at IS NULL THEN 'permanent'
    WHEN tb.expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END as blacklist_status
FROM token_blacklist tb
LEFT JOIN users u ON tb.user_id = u.id::TEXT  -- Cast UUID to TEXT for comparison
LEFT JOIN admin_users a ON tb.admin_id = a.id::TEXT  -- Cast UUID to TEXT for comparison
WHERE tb.expires_at IS NULL OR tb.expires_at > NOW()
ORDER BY tb.blacklisted_at DESC;

COMMENT ON VIEW blacklisted_users IS 'Shows all currently blacklisted users with details';

-- ============================================================================
-- 8. Test the system
-- ============================================================================

-- Test function (do not run in production)
/*
-- Test manual blacklist
SELECT blacklist_user_tokens(
  '123e4567-e89b-12d3-a456-426614174000', -- user_id (TEXT format)
  'admin_revoked',
  '123e4567-e89b-12d3-a456-426614174001', -- admin_id (TEXT format)
  NOW() + INTERVAL '1 hour', -- expires in 1 hour
  'Testing auto-logout system'
);

-- Check if blacklisted
SELECT is_user_blacklisted('123e4567-e89b-12d3-a456-426614174000');

-- View blacklisted users
SELECT * FROM blacklisted_users;
*/

-- ============================================================================
-- 9. Verification
-- ============================================================================

-- Verify tables created
SELECT 
  'Verification' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'token_blacklist'
  ) as token_blacklist_exists,
  EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_blacklist_on_user_delete'
  ) as delete_trigger_exists,
  EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_blacklist_on_user_ban'
  ) as ban_trigger_exists;

-- Show summary
SELECT 
  'Migration Complete' as status,
  (SELECT COUNT(*) FROM token_blacklist) as blacklist_entries,
  NOW() as completed_at;
`