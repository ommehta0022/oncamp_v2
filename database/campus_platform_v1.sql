-- OnCampus Campus Platform v1
-- Institution operations + student campus services. Server-only access with deny-by-default RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS institution_student_approvals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','needs_info','revoked')),
  source text NOT NULL DEFAULT 'self_join',
  verification_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_message text,
  reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, user_id)
);

CREATE TABLE IF NOT EXISTS institution_departments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  code text,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE TABLE IF NOT EXISTS institution_roles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions)='array'),
  is_system boolean NOT NULL DEFAULT false,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE TABLE IF NOT EXISTS institution_staff (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 140),
  email text,
  phone text,
  title text,
  department_id text REFERENCES institution_departments(id) ON DELETE SET NULL,
  role_id text REFERENCES institution_roles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','inactive')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  description text NOT NULL DEFAULT '',
  location text,
  location_lat double precision,
  location_lng double precision,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  capacity integer CHECK (capacity IS NULL OR capacity > 0),
  visibility text NOT NULL DEFAULT 'institution' CHECK (visibility IN ('public','institution','invite_only')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','scheduled','published','cancelled','completed')),
  image_url text,
  rsvp_enabled boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS campus_event_rsvps (
  event_id text NOT NULL REFERENCES campus_events(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going','interested','not_going','waitlist')),
  guests integer NOT NULL DEFAULT 0 CHECK (guests BETWEEN 0 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS scheduled_announcements (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 12000),
  target jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  publish_at timestamptz,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','published','cancelled','expired')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','critical')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  published_post_id text REFERENCES posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_broadcasts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 180),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  target jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  channels jsonb NOT NULL DEFAULT '{"inApp":true,"push":true}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_entity_verifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('group','club','society','department','staff')),
  entity_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','revoked')),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_message text,
  requested_by text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS institution_webhooks (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  url text NOT NULL CHECK (url ~ '^https://'),
  events jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(events)='array'),
  secret_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_status integer,
  last_delivery_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_backups (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  label text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('creating','ready','restored','failed')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  restored_by text REFERENCES users(id) ON DELETE SET NULL,
  restored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_media_assets (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  owner_user_id text REFERENCES users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'file',
  url text NOT NULL,
  mime_type text,
  bytes bigint NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_invites (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 8 AND 80),
  invite_type text NOT NULL DEFAULT 'institution' CHECK (invite_type IN ('institution','group','event','club')),
  target_id text,
  auto_approve boolean NOT NULL DEFAULT false,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like','love','celebrate','support','insightful','funny')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_polls (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id text NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 300),
  multiple_choice boolean NOT NULL DEFAULT false,
  anonymous boolean NOT NULL DEFAULT false,
  closes_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_poll_options (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  poll_id text NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS post_poll_votes (
  poll_id text NOT NULL REFERENCES post_polls(id) ON DELETE CASCADE,
  option_id text NOT NULL REFERENCES post_poll_options(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, option_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag text NOT NULL CHECK (tag ~ '^[A-Za-z0-9_]{1,60}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, tag)
);

CREATE TABLE IF NOT EXISTS post_mentions (
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  mentioned_user_id text REFERENCES users(id) ON DELETE CASCADE,
  handle text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, handle)
);

CREATE TABLE IF NOT EXISTS link_previews (
  url_hash text PRIMARY KEY,
  url text NOT NULL,
  title text,
  description text,
  image_url text,
  site_name text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_search_history (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 160),
  scope text NOT NULL DEFAULT 'global',
  result_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_feedback (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  institution_id text REFERENCES institutions(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'feedback',
  subject text NOT NULL,
  message text NOT NULL,
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','closed')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_archived_groups (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  archived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS user_activity_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  institution_id text REFERENCES institutions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS post_versions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text,
  content text,
  changed_by text REFERENCES users(id) ON DELETE SET NULL,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, version)
);

CREATE TABLE IF NOT EXISTS changelog_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  version text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','students','institutions')),
  published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_marketplace_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  seller_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'INR',
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reserved','sold','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_lost_found_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lost','found')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text,
  event_at timestamptz,
  image_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','matched','resolved','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_places (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'building',
  description text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  floor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_opportunities (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'internship' CHECK (kind IN ('internship','placement','part_time','project','scholarship','competition')),
  title text NOT NULL,
  organization text,
  description text NOT NULL DEFAULT '',
  location text,
  apply_url text,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','closed')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_attendance_sessions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id text REFERENCES institution_departments(id) ON DELETE SET NULL,
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  checkin_code_hash text,
  geofence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','open','closed','cancelled')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS campus_attendance_records (
  session_id text NOT NULL REFERENCES campus_attendance_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent','excused')),
  checkin_at timestamptz,
  method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS campus_integrations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lms','library','timetable','calendar','attendance','webhook','other')),
  name text NOT NULL,
  base_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref text,
  active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_status text,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_digital_ids (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  public_id text NOT NULL UNIQUE,
  department_id text REFERENCES institution_departments(id) ON DELETE SET NULL,
  valid_from date NOT NULL DEFAULT current_date,
  valid_until date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','expired','revoked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campus_emergency_alerts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'high' CHECK (severity IN ('info','warning','high','critical')),
  target jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','resolved','cancelled')),
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  resolved_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS campus_alumni_profiles (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  institution_id text NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  graduation_year integer CHECK (graduation_year BETWEEN 1900 AND 2200),
  course text,
  employer text,
  job_title text,
  city text,
  mentorship_available boolean NOT NULL DEFAULT false,
  visible boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_intelligence_signals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  institution_id text REFERENCES institutions(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('moderation','spam','duplicate','recommendation','quality')),
  score double precision NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 1),
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text,
  model text NOT NULL DEFAULT 'oncampus-rules-v1',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (target_type, target_id, signal_type)
);

CREATE INDEX IF NOT EXISTS idx_student_approvals_inst_status ON institution_student_approvals(institution_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_departments_inst_active ON institution_departments(institution_id,active,name);
CREATE INDEX IF NOT EXISTS idx_staff_inst_status ON institution_staff(institution_id,status,name);
CREATE INDEX IF NOT EXISTS idx_events_inst_start ON campus_events(institution_id,start_at);
CREATE INDEX IF NOT EXISTS idx_rsvp_user ON campus_event_rsvps(user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_schedule ON scheduled_announcements(status,publish_at);
CREATE INDEX IF NOT EXISTS idx_broadcasts_inst_created ON institution_broadcasts(institution_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifications_inst_status ON campus_entity_verifications(institution_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_inst_active ON campus_invites(institution_id,active,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id,reaction);
CREATE INDEX IF NOT EXISTS idx_hashtags_tag ON post_hashtags(tag,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON post_mentions(mentioned_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON user_search_history(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_events(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_inst_status ON campus_marketplace_items(institution_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lost_found_inst_status ON campus_lost_found_items(institution_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_inst_status ON campus_opportunities(institution_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_inst_status ON campus_emergency_alerts(institution_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_inst_status ON content_intelligence_signals(institution_id,status,created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'institution_student_approvals','institution_departments','institution_roles','institution_staff',
    'campus_events','campus_event_rsvps','scheduled_announcements','institution_broadcasts',
    'campus_entity_verifications','institution_webhooks','institution_backups','institution_media_assets',
    'campus_invites','post_reactions','post_polls','post_poll_options','post_poll_votes','post_hashtags',
    'post_mentions','link_previews','user_search_history','user_feedback','user_archived_groups',
    'user_activity_events','post_versions','changelog_entries','campus_marketplace_items','campus_lost_found_items',
    'campus_places','campus_opportunities','campus_attendance_sessions','campus_attendance_records',
    'campus_integrations','campus_digital_ids','campus_emergency_alerts','campus_alumni_profiles',
    'content_intelligence_signals'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM public, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

COMMIT;
