-- Runtime API support schema for routes that are present in server.py/admin_routes_simple.py
-- but are not part of the base Prisma schema export.
--
-- Run after full_db_schema.sql and production extension SQL files.
-- This file is idempotent. When content_reports is absent, it creates a
-- compatibility view over the canonical reports table so admin routes and docs
-- can use either naming shape without hiding real report rows.

BEGIN;

CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT 'null'::jsonb,
  category text,
  description text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blocked_keywords (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  keyword text NOT NULL UNIQUE,
  match_type text NOT NULL DEFAULT 'exact',
  category text NOT NULL DEFAULT 'general',
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blocked_ips (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ip_address text NOT NULL UNIQUE,
  reason text,
  blocked_by text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rate_limit_config (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  endpoint_pattern text NOT NULL UNIQUE,
  limit_type text NOT NULL DEFAULT 'per_ip',
  requests_limit integer NOT NULL DEFAULT 60,
  window_seconds integer NOT NULL DEFAULT 60,
  action_on_exceed text NOT NULL DEFAULT 'block',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS error_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  stack text,
  user_id text,
  request_id text,
  status text NOT NULL DEFAULT 'open',
  resolved_by text,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  flag_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  rollout_percentage integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS admin_id text,
  ADD COLUMN IF NOT EXISTS admin_email text,
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS session_id text;

ALTER TABLE IF EXISTS admin_users
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hash_algorithm text NOT NULL DEFAULT 'sha256',
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

ALTER TABLE IF EXISTS groups
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS group_post_requests
  ADD COLUMN IF NOT EXISTS institution_id text REFERENCES institutions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'content_reports'
  ) THEN
    EXECUTE $view$
      CREATE VIEW content_reports AS
      SELECT
        id,
        reporter_id,
        target_type AS reported_type,
        target_id AS reported_id,
        target_type,
        target_id,
        group_id,
        reason,
        description,
        status,
        resolution,
        resolved_by,
        resolved_at,
        created_at
      FROM reports
    $view$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_status ON admin_notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_keywords_keyword ON blocked_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limit_config_endpoint ON rate_limit_config(endpoint_pattern);
CREATE INDEX IF NOT EXISTS idx_error_logs_status_created ON error_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_group_post_requests_institution_id ON group_post_requests(institution_id);

COMMIT;
