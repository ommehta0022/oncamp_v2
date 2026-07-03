-- ============================================
-- Add Test Users to OnCampus Platform
-- Run this in Supabase SQL Editor
-- ============================================

-- First, check if users table exists and is empty
DO $$
BEGIN
  RAISE NOTICE 'Current user count: %', (SELECT COUNT(*) FROM users);
END $$;

-- Add 20 diverse test users for admin panel testing
INSERT INTO users (
  id, 
  phone_hash, 
  name, 
  city, 
  course,
  bio,
  status, 
  verified, 
  account_type,
  avatar_url,
  created_at,
  updated_at
) VALUES
  -- Active verified users (Institution admins)
  (gen_random_uuid(), sha256('9876543210'::bytea)::text, 'Dr. Sarah Johnson', 'New York', 'Computer Science', 'Professor of CS', 'active', true, 'institution_admin', null, NOW() - INTERVAL '180 days', NOW()),
  (gen_random_uuid(), sha256('9876543211'::bytea)::text, 'Prof. Michael Chen', 'Los Angeles', 'Mathematics', 'Mathematics Department Head', 'active', true, 'institution_admin', null, NOW() - INTERVAL '150 days', NOW()),
  
  -- Active verified users (Regular)
  (gen_random_uuid(), sha256('9876543212'::bytea)::text, 'Emily Rodriguez', 'Chicago', 'Engineering', 'CS student, tech enthusiast', 'active', true, 'normal_user', null, NOW() - INTERVAL '120 days', NOW()),
  (gen_random_uuid(), sha256('9876543213'::bytea)::text, 'David Kim', 'Houston', 'Business', 'MBA student', 'active', true, 'normal_user', null, NOW() - INTERVAL '90 days', NOW()),
  (gen_random_uuid(), sha256('9876543214'::bytea)::text, 'Jessica Williams', 'Phoenix', 'Medicine', 'Medical student', 'active', true, 'normal_user', null, NOW() - INTERVAL '60 days', NOW()),
  
  -- Active unverified users
  (gen_random_uuid(), sha256('9876543215'::bytea)::text, 'James Anderson', 'Philadelphia', 'Arts', 'Art student', 'active', false, 'normal_user', null, NOW() - INTERVAL '30 days', NOW()),
  (gen_random_uuid(), sha256('9876543216'::bytea)::text, 'Maria Garcia', 'San Antonio', 'Psychology', 'Psychology major', 'active', false, 'normal_user', null, NOW() - INTERVAL '25 days', NOW()),
  (gen_random_uuid(), sha256('9876543217'::bytea)::text, 'Robert Taylor', 'San Diego', 'Physics', 'Physics researcher', 'active', false, 'normal_user', null, NOW() - INTERVAL '20 days', NOW()),
  (gen_random_uuid(), sha256('9876543218'::bytea)::text, 'Lisa Martinez', 'Dallas', 'Chemistry', 'Chemistry lab assistant', 'active', false, 'normal_user', null, NOW() - INTERVAL '15 days', NOW()),
  (gen_random_uuid(), sha256('9876543219'::bytea)::text, 'Christopher Lee', 'San Jose', 'Engineering', 'Mechanical Engineering', 'active', false, 'normal_user', null, NOW() - INTERVAL '10 days', NOW()),
  
  -- Muted users (temporary silence for violations)
  (gen_random_uuid(), sha256('9876543220'::bytea)::text, 'Amanda White', 'Austin', 'Law', 'Law student', 'muted', true, 'normal_user', null, NOW() - INTERVAL '7 days', NOW()),
  (gen_random_uuid(), sha256('9876543221'::bytea)::text, 'Daniel Harris', 'Jacksonville', 'Economics', 'Economics major', 'muted', false, 'normal_user', null, NOW() - INTERVAL '5 days', NOW()),
  
  -- Banned users (serious violations)
  (gen_random_uuid(), sha256('9876543222'::bytea)::text, 'Jennifer Clark', 'San Francisco', 'History', 'Former student', 'banned', false, 'normal_user', null, NOW() - INTERVAL '3 days', NOW()),
  (gen_random_uuid(), sha256('9876543223'::bytea)::text, 'Matthew Lewis', 'Columbus', 'Sociology', null, 'banned', false, 'normal_user', null, NOW() - INTERVAL '2 days', NOW()),
  
  -- Recently joined users
  (gen_random_uuid(), sha256('9876543224'::bytea)::text, 'Ashley Robinson', 'Fort Worth', 'Biology', 'Biology student', 'active', false, 'normal_user', null, NOW() - INTERVAL '1 day', NOW()),
  (gen_random_uuid(), sha256('9876543225'::bytea)::text, 'Joshua Walker', 'Charlotte', 'Political Science', 'Poli Sci major', 'active', false, 'normal_user', null, NOW() - INTERVAL '12 hours', NOW()),
  (gen_random_uuid(), sha256('9876543226'::bytea)::text, 'Stephanie Hall', 'Seattle', 'Environmental Science', 'Environmental activist', 'active', false, 'normal_user', null, NOW() - INTERVAL '6 hours', NOW()),
  (gen_random_uuid(), sha256('9876543227'::bytea)::text, 'Andrew Allen', 'Denver', 'Music', 'Music composition', 'active', false, 'normal_user', null, NOW() - INTERVAL '3 hours', NOW()),
  (gen_random_uuid(), sha256('9876543228'::bytea)::text, 'Michelle Young', 'Boston', 'Journalism', 'Campus journalist', 'active', true, 'normal_user', null, NOW() - INTERVAL '1 hour', NOW()),
  (gen_random_uuid(), sha256('9876543229'::bytea)::text, 'Kevin King', 'Portland', 'Architecture', 'Architecture student', 'active', false, 'normal_user', null, NOW() - INTERVAL '30 minutes', NOW());

-- Verify insertion
DO $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users;
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '✅ Test users added successfully!';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Total users in database: %', user_count;
  RAISE NOTICE '';
  RAISE NOTICE 'User breakdown:';
  RAISE NOTICE '  Active: %', (SELECT COUNT(*) FROM users WHERE status = 'active');
  RAISE NOTICE '  Muted: %', (SELECT COUNT(*) FROM users WHERE status = 'muted');
  RAISE NOTICE '  Banned: %', (SELECT COUNT(*) FROM users WHERE status = 'banned');
  RAISE NOTICE '';
  RAISE NOTICE '  Verified: %', (SELECT COUNT(*) FROM users WHERE verified = true);
  RAISE NOTICE '  Unverified: %', (SELECT COUNT(*) FROM users WHERE verified = false);
  RAISE NOTICE '';
  RAISE NOTICE '  Institution Admins: %', (SELECT COUNT(*) FROM users WHERE account_type = 'institution_admin');
  RAISE NOTICE '  Normal Users: %', (SELECT COUNT(*) FROM users WHERE account_type = 'normal_user');
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE '🧪 Test in Admin Panel:';
  RAISE NOTICE '  1. Login: https://admin-panel-gray-rho.vercel.app';
  RAISE NOTICE '  2. Go to Users section';
  RAISE NOTICE '  3. You should see % users', user_count;
  RAISE NOTICE '═══════════════════════════════════════════════════════';
END $$;

-- Show sample of added users
SELECT 
  name,
  city,
  course,
  status,
  verified,
  account_type,
  created_at
FROM users
ORDER BY created_at DESC
LIMIT 10;

