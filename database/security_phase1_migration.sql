-- ============================================================================
-- Admin Panel Security - Phase 1 Database Migration
-- Version: 1.0
-- Date: 2026-07-04
-- Status: OPTIONAL but RECOMMENDED
-- ============================================================================

-- This migration adds the hash_algorithm column to track password hashing method
-- The code will work WITHOUT this migration (defaults to sha256), but it's better to add it

-- ============================================================================
-- 1. Add hash_algorithm column to admin_users
-- ============================================================================

-- Check if column exists, add if missing
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' 
        AND column_name = 'hash_algorithm'
    ) THEN
        ALTER TABLE admin_users 
        ADD COLUMN hash_algorithm TEXT NOT NULL DEFAULT 'sha256';
        
        RAISE NOTICE 'Added hash_algorithm column to admin_users';
    ELSE
        RAISE NOTICE 'hash_algorithm column already exists';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN admin_users.hash_algorithm IS 'Password hashing algorithm: bcrypt (secure) or sha256 (legacy)';

-- ============================================================================
-- 2. Add password_changed_at column (for tracking)
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' 
        AND column_name = 'password_changed_at'
    ) THEN
        ALTER TABLE admin_users 
        ADD COLUMN password_changed_at TIMESTAMPTZ;
        
        -- Set to created_at for existing users
        UPDATE admin_users 
        SET password_changed_at = created_at 
        WHERE password_changed_at IS NULL;
        
        RAISE NOTICE 'Added password_changed_at column to admin_users';
    ELSE
        RAISE NOTICE 'password_changed_at column already exists';
    END IF;
END $$;

COMMENT ON COLUMN admin_users.password_changed_at IS 'Timestamp of last password change';

-- ============================================================================
-- 3. Verify failed_login_attempts table exists
-- ============================================================================

-- The table should already exist, but verify
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'failed_login_attempts'
    ) THEN
        -- Create if missing
        CREATE TABLE failed_login_attempts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email TEXT NOT NULL,
            ip_address TEXT,
            reason TEXT,
            last_attempt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        CREATE INDEX idx_failed_login_email ON failed_login_attempts(email, last_attempt);
        CREATE INDEX idx_failed_login_time ON failed_login_attempts(last_attempt);
        
        RAISE NOTICE 'Created failed_login_attempts table';
    ELSE
        RAISE NOTICE 'failed_login_attempts table already exists';
    END IF;
END $$;

-- ============================================================================
-- 4. Verification Query
-- ============================================================================

-- Run this to verify everything is set up correctly
SELECT 
    'admin_users' as table_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'hash_algorithm'
    ) as has_hash_algorithm,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_users' AND column_name = 'password_changed_at'
    ) as has_password_changed_at,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'failed_login_attempts'
    ) as has_failed_login_table,
    (SELECT COUNT(*) FROM admin_users) as admin_count,
    (SELECT COUNT(*) FROM admin_users WHERE hash_algorithm = 'bcrypt') as bcrypt_count,
    (SELECT COUNT(*) FROM admin_users WHERE hash_algorithm = 'sha256') as sha256_count;

-- ============================================================================
-- Summary
-- ============================================================================

/*
What this migration does:
✅ Adds hash_algorithm column (tracks bcrypt vs sha256)
✅ Adds password_changed_at column (audit trail)
✅ Verifies failed_login_attempts table exists
✅ Sets defaults for existing admins

IMPORTANT:
- This is OPTIONAL - code works without it
- Existing admins default to 'sha256'
- First login auto-migrates to 'bcrypt'
- Run on Supabase SQL editor or psql

How to run:
1. Copy this entire file
2. Go to Supabase Dashboard > SQL Editor
3. Paste and click "Run"
4. Verify: Last SELECT shows results

Rollback (if needed):
ALTER TABLE admin_users DROP COLUMN IF EXISTS hash_algorithm;
ALTER TABLE admin_users DROP COLUMN IF EXISTS password_changed_at;
*/
