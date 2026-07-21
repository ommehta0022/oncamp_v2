-- Remove only the reversible OnCampus demo data inserted by demo_oncampus_institution_seed.sql.
-- This script is safe to run more than once.

BEGIN;

DELETE FROM saved_posts WHERE user_id LIKE 'demo_oc_%' OR post_id LIKE 'demo_oc_%';
DELETE FROM post_views WHERE user_id LIKE 'demo_oc_%' OR post_id LIKE 'demo_oc_%';
DELETE FROM post_shares WHERE user_id LIKE 'demo_oc_%' OR post_id LIKE 'demo_oc_%';
DELETE FROM post_comments WHERE id LIKE 'demo_oc_%' OR post_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
DELETE FROM post_reactions WHERE post_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
DELETE FROM notifications WHERE id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
DELETE FROM group_post_requests WHERE id LIKE 'demo_oc_%' OR group_id LIKE 'demo_oc_%' OR requester_id LIKE 'demo_oc_%';
DO $$
BEGIN
  IF to_regclass('public.join_requests') IS NOT NULL THEN
    DELETE FROM join_requests WHERE id LIKE 'demo_oc_%' OR group_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
  END IF;
END $$;
DELETE FROM messages WHERE id LIKE 'demo_oc_%' OR group_id LIKE 'demo_oc_%' OR sender_id LIKE 'demo_oc_%';
DO $$
BEGIN
  IF to_regclass('public.message_reads') IS NOT NULL THEN
    DELETE FROM message_reads WHERE group_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
  END IF;
END $$;
DELETE FROM user_pinned_groups WHERE group_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
DELETE FROM group_members WHERE group_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
DELETE FROM institution_admins WHERE id LIKE 'demo_oc_%' OR institution_id LIKE 'demo_oc_%' OR user_id LIKE 'demo_oc_%';
DELETE FROM user_institutions WHERE user_id LIKE 'demo_oc_%' OR institution_id LIKE 'demo_oc_%';
DELETE FROM posts WHERE id LIKE 'demo_oc_%' OR author_id LIKE 'demo_oc_%' OR institution_id LIKE 'demo_oc_%' OR group_id LIKE 'demo_oc_%';
DELETE FROM groups WHERE id LIKE 'demo_oc_%' OR institution_id LIKE 'demo_oc_%' OR created_by LIKE 'demo_oc_%';
DELETE FROM institution_verification_requests WHERE id LIKE 'demo_oc_%' OR institution_id LIKE 'demo_oc_%' OR submitted_by LIKE 'demo_oc_%';
DELETE FROM institutions WHERE id LIKE 'demo_oc_%' OR created_by LIKE 'demo_oc_%';
DELETE FROM user_settings WHERE user_id LIKE 'demo_oc_%';
DELETE FROM notification_preferences WHERE user_id LIKE 'demo_oc_%';
DELETE FROM user_blocks WHERE blocker_id LIKE 'demo_oc_%' OR blocked_user_id LIKE 'demo_oc_%';
DELETE FROM user_follows WHERE follower_id LIKE 'demo_oc_%' OR following_id LIKE 'demo_oc_%';
DELETE FROM users WHERE id LIKE 'demo_oc_%';

COMMIT;
