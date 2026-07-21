# Remaining Template Migration Tasks

- Manually smoke test Feed, Groups, Discover, Search, a group chat, and Profile in Expo with an authenticated test user.
- Confirm Forward and Saved screens against authenticated API data.
- Verify group create/edit, Discover join, join-request approval, message send/delete, mute, pin/unpin, save/share/repost, and notifications against a live Supabase project with an authenticated test user.
- Run `database\runtime_api_support.sql` and `database\mobile_api_support.sql` in Supabase before the demo seed if those support tables/columns are not already present.
- Run the demo seed SQL in a non-production Supabase project first; do not run it against the production-flavored credentials in `important\all_set`.
- Confirm cleanup SQL removes only `demo_oc_%` rows.
- Do an authenticated visual pass on mobile widths for long institution/group names and populated group/feed data.
- Continue replacing any remaining icon choices that product considers too close to WhatsApp.
