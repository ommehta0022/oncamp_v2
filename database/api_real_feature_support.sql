-- Idempotent support schema for the real v3 mobile API surface.
-- Run in Supabase after the base schema. This file creates no seed data.

BEGIN;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  privacy jsonb NOT NULL DEFAULT '{}'::jsonb,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS user_settings
  ADD COLUMN IF NOT EXISTS privacy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS storage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE IF EXISTS groups
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS join_policy text NOT NULL DEFAULT 'auto_approve_verified',
  ADD COLUMN IF NOT EXISTS posting_mode text NOT NULL DEFAULT 'members_can_request',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS official boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by text REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_id text REFERENCES institutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE IF NOT EXISTS feature_flags (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  flag_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  rollout_percentage integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self_follow CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS blocked_users (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id),
  CONSTRAINT blocked_users_no_self_block CHECK (user_id <> blocked_user_id)
);

CREATE TABLE IF NOT EXISTS saved_posts (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_shares (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_type text NOT NULL DEFAULT 'share',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, share_type, created_at)
);

CREATE TABLE IF NOT EXISTS join_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  source text,
  reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'text',
  media_url text,
  reply_to_id text REFERENCES messages(id) ON DELETE SET NULL,
  client_message_id text,
  pinned boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  mentions boolean NOT NULL DEFAULT true,
  announcements boolean NOT NULL DEFAULT true,
  join_requests boolean NOT NULL DEFAULT true,
  post_activity boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_devices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token text NOT NULL UNIQUE,
  platform text,
  trusted boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'notification',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS notification_preferences
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mentions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS announcements boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS join_requests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS post_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS user_devices
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS trusted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS notifications
  ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'notification',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

ALTER TABLE IF EXISTS group_members
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS left_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS posts
  ADD COLUMN IF NOT EXISTS repost_of text REFERENCES posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS post_comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE IF EXISTS post_views
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS reports
  ADD COLUMN IF NOT EXISTS reported_by text,
  ADD COLUMN IF NOT EXISTS details text,
  ADD COLUMN IF NOT EXISTS resolved_by text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE IF EXISTS group_post_requests
  ADD COLUMN IF NOT EXISTS decided_by text REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS published_post_id text REFERENCES posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS institution_id text REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_user_id ON post_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_group_status ON join_requests(group_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_group_created ON messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_posts_repost_of ON posts(repost_of);
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_institution_id ON groups(institution_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_push_token_unique ON user_devices(push_token) WHERE push_token IS NOT NULL;

COMMIT;
