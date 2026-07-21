-- Support tables/columns for the real mobile API routes used by the Expo app.
-- Run once in Supabase before testing profile settings, blocking, sharing, and pinned groups.

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
  ADD COLUMN IF NOT EXISTS storage jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CONSTRAINT user_blocks_no_self_block CHECK (blocker_id <> blocked_user_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_blocks' AND column_name = 'blocked_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_blocks' AND column_name = 'blocked_user_id'
  ) THEN
    ALTER TABLE user_blocks RENAME COLUMN blocked_id TO blocked_user_id;
  END IF;
END $$;

ALTER TABLE IF EXISTS user_blocks
  ADD COLUMN IF NOT EXISTS reason text;

CREATE TABLE IF NOT EXISTS user_pinned_groups (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS post_shares (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE IF EXISTS user_devices
  ADD COLUMN IF NOT EXISTS push_token text,
  ADD COLUMN IF NOT EXISTS trusted boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE IF EXISTS reports
  ADD COLUMN IF NOT EXISTS resolved_by text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS ban_reason text;

ALTER TABLE IF EXISTS post_comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE IF EXISTS post_views
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON user_blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_user_pinned_groups_user_id ON user_pinned_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_user_id ON post_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

COMMIT;
