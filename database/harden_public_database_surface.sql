BEGIN;

ALTER TABLE public.token_blacklist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.token_blacklist FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.token_blacklist TO service_role;

ALTER VIEW public.blacklisted_users SET (security_invoker = true);
ALTER VIEW public.active_group_members SET (security_invoker = true);

ALTER FUNCTION public.cleanup_expired_bans() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_blacklist() SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_expired_mutes() SET search_path = public, pg_temp;
ALTER FUNCTION public.can_user_post_in_group(text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_blacklist_on_user_delete() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_blacklist_on_user_ban() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_user_blacklisted(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.blacklist_user_tokens(text, text, text, timestamp with time zone, text) SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;

COMMIT;
