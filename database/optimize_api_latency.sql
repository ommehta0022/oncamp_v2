-- Consolidate high-traffic mobile reads and login writes into single database calls.
-- Idempotent and safe to re-run.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_institution_admins_user_status
  ON public.institution_admins (user_id, status);

CREATE INDEX IF NOT EXISTS idx_posts_feed_published
  ON public.posts (status, pinned DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_group_members_group_status
  ON public.group_members (group_id, status);

CREATE INDEX IF NOT EXISTS idx_group_members_user_status
  ON public.group_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_groups_public_discovery
  ON public.groups (visibility, official DESC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.oncampus_fast_feed(
  p_user_id text,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH page_posts AS (
    SELECT p.*
    FROM public.posts p
    WHERE p.status = 'published'
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_blocks ub
        WHERE (ub.blocker_id = p_user_id AND ub.blocked_user_id = p.author_id)
           OR (ub.blocked_user_id = p_user_id AND ub.blocker_id = p.author_id)
      )
    ORDER BY p.pinned DESC, p.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
    OFFSET GREATEST(COALESCE(p_page, 1) - 1, 0)
      * GREATEST(1, LEAST(COALESCE(p_limit, 30), 100))
  ), feed_items AS (
    SELECT
      p.pinned,
      p.created_at,
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'content', p.content,
        'mediaUrl', p.media_url,
        'mediaType', p.media_type,
        'pinned', p.pinned,
        'postType', p.type,
        'announcement', p.type::text IN ('announcement', 'emergency', 'notice'),
        'createdAt', COALESCE(p.published_at, p.created_at),
        'author', jsonb_build_object(
          'id', p.author_id,
          'name', COALESCE(u.name, 'OnCampus user'),
          'avatarUrl', u.avatar_url,
          'verified', COALESCE(u.verified, false),
          'badge', CASE WHEN u.account_type::text = 'institution_admin' THEN 'official' END
        ),
        'group', CASE WHEN g.id IS NULL THEN NULL ELSE jsonb_build_object('id', g.id, 'name', g.name) END,
        'counts', jsonb_build_object(
          'reactions', (SELECT count(*) FROM public.post_reactions pr WHERE pr.post_id = p.id),
          'comments', (SELECT count(*) FROM public.post_comments pc WHERE pc.post_id = p.id AND pc.deleted_at IS NULL)
        ),
        'liked', EXISTS (
          SELECT 1 FROM public.post_reactions pr
          WHERE pr.post_id = p.id AND pr.user_id = p_user_id
        ),
        'bookmarked', EXISTS (
          SELECT 1 FROM public.saved_posts sp
          WHERE sp.post_id = p.id AND sp.user_id = p_user_id
        )
      ) AS payload
    FROM page_posts p
    LEFT JOIN public.users u ON u.id = p.author_id
    LEFT JOIN public.groups g ON g.id = p.group_id
  )
  SELECT jsonb_build_object(
    'feed', COALESCE(jsonb_agg(payload ORDER BY pinned DESC, created_at DESC), '[]'::jsonb),
    'hasMore', count(*) = GREATEST(1, LEAST(COALESCE(p_limit, 30), 100)),
    'page', GREATEST(COALESCE(p_page, 1), 1)
  )
  FROM feed_items;
$function$;

CREATE OR REPLACE FUNCTION public.oncampus_discovery_groups(
  p_q text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_official boolean DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH matching_groups AS (
    SELECT
      g.*,
      (SELECT count(*) FROM public.group_members gm WHERE gm.group_id = g.id AND gm.status = 'active') AS member_count
    FROM public.groups g
    WHERE g.deleted_at IS NULL
      AND g.visibility = 'public'
      AND (p_city IS NULL OR g.city = p_city)
      AND (p_category IS NULL OR g.category ILIKE '%' || p_category || '%')
      AND (p_official IS NULL OR g.official = p_official)
      AND (p_q IS NULL OR g.name ILIKE '%' || p_q || '%')
    ORDER BY
      CASE WHEN p_q IS NOT NULL AND lower(g.name) = lower(p_q) THEN 0 ELSE 1 END,
      CASE WHEN p_q IS NOT NULL AND lower(g.name) LIKE lower(p_q) || '%' THEN 0 ELSE 1 END,
      g.official DESC,
      g.created_at DESC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 100))
  )
  SELECT jsonb_build_object(
    'groups', COALESCE(
      jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'description', description,
        'city', city,
        'category', category,
        'visibility', visibility,
        'avatarUrl', avatar_url,
        'official', official,
        'postingMode', posting_mode,
        'joinPolicy', join_policy,
        'institutionId', institution_id,
        'memberCount', member_count,
        'role', NULL,
        'pinned', false,
        'muted', false,
        'mutedAt', NULL,
        'unread', 0,
        'lastMessage', NULL,
        'lastMessageAt', NULL
      )),
      '[]'::jsonb
    )
  )
  FROM matching_groups;
$function$;

CREATE OR REPLACE FUNCTION public.oncampus_my_groups(p_user_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH memberships AS (
    SELECT
      g.*,
      gm.role,
      gm.pinned,
      gm.muted,
      gm.muted_at,
      (SELECT count(*) FROM public.group_members members WHERE members.group_id = g.id AND members.status = 'active') AS member_count
    FROM public.group_members gm
    JOIN public.groups g ON g.id = gm.group_id AND g.deleted_at IS NULL
    WHERE gm.user_id = p_user_id AND gm.status = 'active'
    ORDER BY gm.pinned DESC, g.name ASC
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'id', id,
      'name', name,
      'description', description,
      'city', city,
      'category', category,
      'visibility', visibility,
      'avatarUrl', avatar_url,
      'official', official,
      'postingMode', posting_mode,
      'joinPolicy', join_policy,
      'institutionId', institution_id,
      'memberCount', member_count,
      'role', role,
      'pinned', pinned,
      'muted', muted,
      'mutedAt', muted_at,
      'unread', 0,
      'lastMessage', NULL,
      'lastMessageAt', NULL
    )),
    '[]'::jsonb
  )
  FROM memberships;
$function$;

CREATE OR REPLACE FUNCTION public.oncampus_create_auth_session(
  p_user_id text,
  p_device_id text,
  p_platform text,
  p_refresh_id text,
  p_token_hash text,
  p_family text,
  p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  existing_user_id text;
BEGIN
  SELECT user_id INTO existing_user_id
  FROM public.user_devices
  WHERE id = p_device_id;

  IF existing_user_id IS NOT NULL AND existing_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Device identifier is already registered' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.user_devices (
    id, user_id, platform, trusted, last_seen_at, revoked_at, updated_at
  ) VALUES (
    p_device_id, p_user_id, COALESCE(p_platform, 'unknown'), true, now(), NULL, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    platform = EXCLUDED.platform,
    trusted = true,
    last_seen_at = now(),
    revoked_at = NULL,
    updated_at = now();

  INSERT INTO public.refresh_tokens (
    id, user_id, device_id, token_hash, family, expires_at, created_at
  ) VALUES (
    p_refresh_id, p_user_id, p_device_id, p_token_hash, p_family, p_expires_at, now()
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.oncampus_fast_feed(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oncampus_discovery_groups(text, text, text, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oncampus_my_groups(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.oncampus_create_auth_session(text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.oncampus_fast_feed(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oncampus_discovery_groups(text, text, text, boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.oncampus_my_groups(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.oncampus_create_auth_session(text, text, text, text, text, text, timestamptz) TO service_role;

COMMIT;
