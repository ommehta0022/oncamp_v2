-- OnCampus reversible demo data seed.
-- Run after full_db_schema.sql plus production extension SQL files.
-- Every row is tagged with demo_oc_ IDs so it can be removed safely.
-- Cleanup command: run database/remove_demo_oncampus_institution_seed.sql.

BEGIN;

INSERT INTO users (
  id, phone_hash, name, city, course, avatar_url, verified, status, created_at, updated_at,
  account_type, can_create_posts, can_create_groups, handle, bio, profile_completed
) VALUES
  ('demo_oc_user_aarav', 'b6729c11b967be75b23841e2dee6e013c0a9fe757f75f8a6cf4c032ad05af217', 'Aarav Sharma', 'Mumbai', 'Computer Science 2026', 'https://images.unsplash.com/photo-1633112639964-f8c9d360dc75?w=200&q=80', true, 'active', NOW(), NOW(), 'normal_user', true, true, 'aarav.s', 'CSE student, robotics club, building campus tools.', true),
  ('demo_oc_user_priya', '670c2e3477ef4d159d9300643bdd428d1b482be478060f8deeedddd4692a02c0', 'Priya Nair', 'Mumbai', 'Mechanical Engineering 2025', 'https://images.unsplash.com/photo-1619431667975-e93b820cde63?w=200&q=80', true, 'active', NOW(), NOW(), 'normal_user', true, true, 'priya.n', 'Mechanical student and placement volunteer.', true),
  ('demo_oc_user_iyer', 'f9c51e7dd98d93c67d2fa2511147927b18a1db05c98f8052330eb603e15fa14b', 'Dr. Ramesh Iyer', 'Mumbai', 'Faculty', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80', true, 'active', NOW(), NOW(), 'institution_admin', true, true, 'r.iyer', 'Faculty coordinator for academic announcements.', true),
  ('demo_oc_user_zara', '4df71ec12d8cc5882a98ecbdd2157692ce605da4c2dd796deaf561a8282f6b7a', 'Zara Fernandes', 'Mumbai', 'Literature', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&q=80', true, 'active', NOW(), NOW(), 'normal_user', true, true, 'zara.f', 'Debate society and campus arts volunteer.', true)
ON CONFLICT (id) DO UPDATE SET
  phone_hash = EXCLUDED.phone_hash,
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  course = EXCLUDED.course,
  avatar_url = EXCLUDED.avatar_url,
  verified = EXCLUDED.verified,
  updated_at = NOW();

INSERT INTO institutions (
  id, name, city, verification_policy, created_at, institution_type, state, country,
  official_email, website, logo_url, cover_url, description, status, verified_at, created_by
) VALUES
  ('demo_oc_inst_iitb', 'IIT Bombay Demo Campus', 'Mumbai', '{"emailDomains":["iitb.demo"],"demo":true}'::jsonb, NOW(), 'University', 'Maharashtra', 'India', 'registrar@iitb.demo', 'https://www.iitb.ac.in', 'https://images.unsplash.com/photo-1562774053-701939374585?w=300&q=80', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&q=80', 'Demo institution for testing linked groups, posts, and chats.', 'approved', NOW(), 'demo_oc_user_iyer'),
  ('demo_oc_inst_xaviers', 'St. Xavier''s Demo College', 'Mumbai', '{"emailDomains":["xaviers.demo"],"demo":true}'::jsonb, NOW(), 'College', 'Maharashtra', 'India', 'office@xaviers.demo', 'https://xaviers.edu', 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=300&q=80', 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=1200&q=80', 'Demo college for cross-institution discovery testing.', 'approved', NOW(), 'demo_oc_user_zara')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  logo_url = EXCLUDED.logo_url,
  cover_url = EXCLUDED.cover_url,
  description = EXCLUDED.description,
  status = EXCLUDED.status;

INSERT INTO user_institutions (
  user_id, institution_id, verification_status, verified_at, created_at, role, department, year, official_email
) VALUES
  ('demo_oc_user_aarav', 'demo_oc_inst_iitb', 'approved', NOW(), NOW(), 'student', 'Computer Science', '2026', 'aarav@iitb.demo'),
  ('demo_oc_user_priya', 'demo_oc_inst_iitb', 'approved', NOW(), NOW(), 'student', 'Mechanical Engineering', '2025', 'priya@iitb.demo'),
  ('demo_oc_user_iyer', 'demo_oc_inst_iitb', 'approved', NOW(), NOW(), 'faculty', 'Computer Science', null, 'r.iyer@iitb.demo'),
  ('demo_oc_user_zara', 'demo_oc_inst_xaviers', 'approved', NOW(), NOW(), 'student', 'Literature', '2026', 'zara@xaviers.demo')
ON CONFLICT (user_id, institution_id) DO UPDATE SET
  verification_status = EXCLUDED.verification_status,
  verified_at = EXCLUDED.verified_at,
  role = EXCLUDED.role;

INSERT INTO institution_admins (id, institution_id, user_id, role, status, created_at)
VALUES
  ('demo_oc_admin_iitb_iyer', 'demo_oc_inst_iitb', 'demo_oc_user_iyer', 'admin', 'active', NOW()),
  ('demo_oc_admin_xaviers_zara', 'demo_oc_inst_xaviers', 'demo_oc_user_zara', 'admin', 'active', NOW())
ON CONFLICT (institution_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status;

INSERT INTO groups (
  id, institution_id, name, description, city, category, visibility, join_policy, member_limit,
  created_by, avatar_url, official, deleted_at, created_at, updated_at, posting_mode,
  approval_required, allow_external_post_requests, post_request_instructions
) VALUES
  ('demo_oc_group_cse_2026', 'demo_oc_inst_iitb', 'CSE Batch of 2026', 'Official batch group for notes, placements, labs, and campus life.', 'Mumbai', 'Batch', 'private', 'request_to_join', 300, 'demo_oc_user_iyer', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80', true, null, NOW(), NOW(), 'members_can_post', false, true, 'Share academic updates with source links.'),
  ('demo_oc_group_robotics', 'demo_oc_inst_iitb', 'IITB Robotics Club', 'Where wheels meet code. Build nights, demos, and workshops.', 'Mumbai', 'Clubs', 'public', 'auto_approve_verified', 1000, 'demo_oc_user_aarav', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80', true, null, NOW(), NOW(), 'members_can_request', true, true, 'Poster requests need event date and contact person.'),
  ('demo_oc_group_announcements', 'demo_oc_inst_iitb', 'Campus Announcements', 'Official announcements from IIT Bombay Demo Campus.', 'Mumbai', 'Official', 'public', 'auto_approve_verified', 10000, 'demo_oc_user_iyer', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80', true, null, NOW(), NOW(), 'institution_only', true, false, 'Only institution admins publish here.'),
  ('demo_oc_group_debate', 'demo_oc_inst_xaviers', 'Xavier''s Debate Society', 'Weekly parliamentary debates, adjudication practice, and event prep.', 'Mumbai', 'Clubs', 'public', 'request_to_join', 300, 'demo_oc_user_zara', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80', true, null, NOW(), NOW(), 'members_can_request', true, true, 'Include motion, venue, and speaker details.')
ON CONFLICT (id) DO UPDATE SET
  institution_id = EXCLUDED.institution_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  avatar_url = EXCLUDED.avatar_url,
  official = EXCLUDED.official,
  updated_at = NOW();

INSERT INTO group_members (group_id, user_id, role, status, joined_at, muted_at, last_read_at)
VALUES
  ('demo_oc_group_cse_2026', 'demo_oc_user_iyer', 'owner', 'active', NOW(), null, NOW()),
  ('demo_oc_group_cse_2026', 'demo_oc_user_aarav', 'member', 'active', NOW(), null, NOW()),
  ('demo_oc_group_cse_2026', 'demo_oc_user_priya', 'member', 'active', NOW(), null, NOW()),
  ('demo_oc_group_robotics', 'demo_oc_user_aarav', 'owner', 'active', NOW(), null, NOW()),
  ('demo_oc_group_robotics', 'demo_oc_user_priya', 'member', 'active', NOW(), null, NOW()),
  ('demo_oc_group_announcements', 'demo_oc_user_iyer', 'owner', 'active', NOW(), null, NOW()),
  ('demo_oc_group_announcements', 'demo_oc_user_aarav', 'member', 'active', NOW(), null, NOW()),
  ('demo_oc_group_debate', 'demo_oc_user_zara', 'owner', 'active', NOW(), null, NOW())
ON CONFLICT (group_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  last_read_at = EXCLUDED.last_read_at;

INSERT INTO messages (
  id, group_id, sender_id, client_message_id, type, content, media_url, media_type,
  parent_message_id, created_at, edited_at, deleted_at
) VALUES
  ('demo_oc_msg_cse_1', 'demo_oc_group_cse_2026', 'demo_oc_user_iyer', 'demo-client-cse-1', 'text', 'Placement orientation is tomorrow at 10 AM in LT-2. Bring your institute ID.', null, null, null, NOW() - INTERVAL '2 hours', null, null),
  ('demo_oc_msg_cse_2', 'demo_oc_group_cse_2026', 'demo_oc_user_priya', 'demo-client-cse-2', 'text', 'I uploaded the prep checklist in the shared drive. Please review before tonight.', null, null, null, NOW() - INTERVAL '90 minutes', null, null),
  ('demo_oc_msg_robotics_1', 'demo_oc_group_robotics', 'demo_oc_user_aarav', 'demo-client-robotics-1', 'text', 'Arm prototype v3 is ready for testing. Meet at the lab after dinner.', null, null, null, NOW() - INTERVAL '45 minutes', null, null),
  ('demo_oc_msg_robotics_2', 'demo_oc_group_robotics', 'demo_oc_user_priya', 'demo-client-robotics-2', 'image', 'Motor mount photo from the workshop.', 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=900&q=80', 'image', null, NOW() - INTERVAL '30 minutes', null, null),
  ('demo_oc_msg_debate_1', 'demo_oc_group_debate', 'demo_oc_user_zara', 'demo-client-debate-1', 'text', 'Friday practice motion is published. New speakers can observe before joining.', null, null, null, NOW() - INTERVAL '25 minutes', null, null)
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  media_url = EXCLUDED.media_url,
  media_type = EXCLUDED.media_type,
  deleted_at = null;

INSERT INTO posts (
  id, author_id, institution_id, group_id, type, visibility, status, title, content,
  media_url, media_type, pinned, comments_enabled, reactions_enabled, published_at,
  created_at, updated_at
) VALUES
  ('demo_oc_post_iitb_exam', 'demo_oc_user_iyer', 'demo_oc_inst_iitb', 'demo_oc_group_announcements', 'announcement', 'institution', 'published', 'Mid-semester timetable released', 'The mid-semester timetable is now available. Check your department notice board and confirm any clashes by Friday.', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80', 'image', true, true, true, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours', NOW()),
  ('demo_oc_post_robotics', 'demo_oc_user_aarav', 'demo_oc_inst_iitb', 'demo_oc_group_robotics', 'event', 'group', 'published', 'Robotics open lab', 'Open lab this Saturday: line followers, robotic arms, and onboarding for first-year students.', 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80', 'image', false, true, true, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours', NOW()),
  ('demo_oc_post_debate', 'demo_oc_user_zara', 'demo_oc_inst_xaviers', 'demo_oc_group_debate', 'general', 'group', 'published', 'Debate society trials', 'Speaker trials start next week. Bring one prepared speech and one extempore topic.', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&q=80', 'image', false, true, true, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  media_url = EXCLUDED.media_url,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO post_reactions (post_id, user_id, reaction, created_at)
VALUES
  ('demo_oc_post_iitb_exam', 'demo_oc_user_aarav', 'like', NOW()),
  ('demo_oc_post_iitb_exam', 'demo_oc_user_priya', 'like', NOW()),
  ('demo_oc_post_robotics', 'demo_oc_user_priya', 'like', NOW()),
  ('demo_oc_post_debate', 'demo_oc_user_zara', 'like', NOW())
ON CONFLICT (post_id, user_id) DO UPDATE SET
  reaction = EXCLUDED.reaction;

INSERT INTO post_comments (id, post_id, user_id, parent_comment_id, content, deleted_at, created_at)
VALUES
  ('demo_oc_comment_exam_1', 'demo_oc_post_iitb_exam', 'demo_oc_user_priya', null, 'Thank you, professor. Will the lab timetable be published separately?', null, NOW() - INTERVAL '3 hours'),
  ('demo_oc_comment_robotics_1', 'demo_oc_post_robotics', 'demo_oc_user_aarav', null, 'New members can come directly to the tinkering lab.', null, NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO UPDATE SET
  content = EXCLUDED.content,
  deleted_at = null;

INSERT INTO notifications (id, user_id, title, body, type, data, read_at, created_at)
VALUES
  ('demo_oc_notif_aarav_announcement', 'demo_oc_user_aarav', 'New campus announcement', 'Mid-semester timetable released by IIT Bombay Demo Campus.', 'announcement', '{"postId":"demo_oc_post_iitb_exam","groupId":"demo_oc_group_announcements","demo":true}'::jsonb, null, NOW() - INTERVAL '3 hours'),
  ('demo_oc_notif_priya_robotics', 'demo_oc_user_priya', 'Robotics open lab', 'Aarav posted a new event in IITB Robotics Club.', 'post', '{"postId":"demo_oc_post_robotics","groupId":"demo_oc_group_robotics","demo":true}'::jsonb, null, NOW() - INTERVAL '2 hours')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  data = EXCLUDED.data,
  read_at = null;

INSERT INTO user_pinned_groups (user_id, group_id, created_at)
VALUES
  ('demo_oc_user_aarav', 'demo_oc_group_robotics', NOW() - INTERVAL '1 hour'),
  ('demo_oc_user_priya', 'demo_oc_group_cse_2026', NOW() - INTERVAL '50 minutes')
ON CONFLICT (user_id, group_id) DO NOTHING;

INSERT INTO saved_posts (post_id, user_id, created_at)
VALUES
  ('demo_oc_post_iitb_exam', 'demo_oc_user_aarav', NOW() - INTERVAL '45 minutes'),
  ('demo_oc_post_robotics', 'demo_oc_user_priya', NOW() - INTERVAL '40 minutes')
ON CONFLICT (post_id, user_id) DO UPDATE SET
  created_at = EXCLUDED.created_at;

INSERT INTO post_shares (post_id, user_id, created_at)
VALUES
  ('demo_oc_post_iitb_exam', 'demo_oc_user_priya', NOW() - INTERVAL '35 minutes'),
  ('demo_oc_post_robotics', 'demo_oc_user_aarav', NOW() - INTERVAL '30 minutes')
ON CONFLICT (post_id, user_id) DO NOTHING;

INSERT INTO user_follows (follower_id, following_id, created_at)
VALUES
  ('demo_oc_user_aarav', 'demo_oc_user_priya', NOW() - INTERVAL '2 days'),
  ('demo_oc_user_priya', 'demo_oc_user_aarav', NOW() - INTERVAL '1 day')
ON CONFLICT (follower_id, following_id) DO NOTHING;

INSERT INTO user_settings (user_id, privacy, preferences, storage, created_at, updated_at)
VALUES
  ('demo_oc_user_aarav', '{"discoverable":true,"readReceipts":true}'::jsonb, '{"sound":true,"vibrate":true}'::jsonb, '{"autoDownloadImages":true}'::jsonb, NOW(), NOW()),
  ('demo_oc_user_priya', '{"discoverable":true,"showPhone":false}'::jsonb, '{"sound":false,"vibrate":true}'::jsonb, '{"autoDownloadImages":false}'::jsonb, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE SET
  privacy = EXCLUDED.privacy,
  preferences = EXCLUDED.preferences,
  storage = EXCLUDED.storage,
  updated_at = NOW();

COMMIT;
