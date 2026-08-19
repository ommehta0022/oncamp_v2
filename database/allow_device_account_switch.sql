-- Allow one physical device identifier to switch between OnCampus accounts.
-- When the device changes account, revoke the previous account's active refresh
-- tokens for that device before rebinding the device to the newly authenticated user.

BEGIN;

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
    UPDATE public.refresh_tokens
    SET revoked_at = now()
    WHERE device_id = p_device_id
      AND revoked_at IS NULL;

    UPDATE public.user_devices
    SET user_id = p_user_id,
        platform = COALESCE(p_platform, 'unknown'),
        trusted = true,
        last_seen_at = now(),
        revoked_at = NULL,
        updated_at = now()
    WHERE id = p_device_id;
  ELSE
    INSERT INTO public.user_devices (
      id, user_id, platform, trusted, last_seen_at, revoked_at, updated_at
    ) VALUES (
      p_device_id, p_user_id, COALESCE(p_platform, 'unknown'), true, now(), NULL, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      platform = EXCLUDED.platform,
      trusted = true,
      last_seen_at = now(),
      revoked_at = NULL,
      updated_at = now();
  END IF;

  INSERT INTO public.refresh_tokens (
    id, user_id, device_id, token_hash, family, expires_at, created_at
  ) VALUES (
    p_refresh_id, p_user_id, p_device_id, p_token_hash, p_family, p_expires_at, now()
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.oncampus_create_auth_session(text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.oncampus_create_auth_session(text, text, text, text, text, text, timestamptz) TO service_role;

COMMIT;
