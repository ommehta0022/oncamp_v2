# OnCampus v1 Template Migration Tasks

Source template: `D:\automate\oncampuses-v1`
Target project: `D:\automate\oncamp_v2`

## Requirements

- Keep login and register UI unchanged.
- Preserve all existing v2 features and real API integrations.
- Port v1 visual template patterns into v2 screens without reintroducing mock APIs.
- Remove dummy frontend data from user-facing flows.
- Avoid WhatsApp-like group and read-receipt iconography.
- Add reversible demo SQL for institution-linked groups, chats, feed posts, and images.
- Keep task tracking files current for continuation work.

## Implementation Notes

- v2 already contains v1-style layouts for Feed, Groups, Discover, Notifications, Profile, create flows, and settings.
- The main remaining risk was data shape mismatch: v1 template screens expected mock fields like `members`, `image`, and `title`, while the real backend returns fields like `memberCount`, `avatarUrl`, and `name`.
- Shared mappers should remain the first place to solve real API/template field differences.
- Group create/edit, membership, join requests, chat messages, message search, read state, mute, pin, report, profile/settings, follow/block, notifications, saved posts, and post interaction actions now have FastAPI routes instead of frontend-only API calls.
- `database\mobile_api_support.sql` contains the schema support for newly real mobile routes such as pinned groups, user settings, user blocks, post shares, and push tokens.
- `database\runtime_api_support.sql` contains idempotent runtime/admin support tables and columns used by `server.py` and `admin_routes_simple.py`, plus a `content_reports` compatibility view backed by the canonical `reports` table when no existing relation is present.
- User blocking follows the existing extension schema column `user_blocks.blocked_user_id`; do not reintroduce the earlier `blocked_id` draft name.
- Demo content belongs in SQL seed files only, not in app runtime code.

## Useful Commands

- Type check frontend: `cd D:\automate\oncamp_v2\frontend; npx tsc --noEmit`
- Lint frontend: `cd D:\automate\oncamp_v2\frontend; npm run lint`
- Syntax check backend: `cd D:\automate\oncamp_v2; python -m py_compile server.py admin_routes_simple.py`
- Verify OpenAPI generation: `cd D:\automate\oncamp_v2; python -c "import warnings; warnings.simplefilter('error'); from server import app; app.openapi(); print('openapi ok', len(app.routes))"`
- Add demo data: run `database\demo_oncampus_institution_seed.sql` in Supabase SQL Editor or psql.
- Add runtime support schema: run `database\runtime_api_support.sql` after the base schema and production extension SQL files.
- Add support schema: run `database\mobile_api_support.sql` in Supabase SQL Editor or psql before demo data when these support tables/columns are missing.
- Remove demo data: run `database\remove_demo_oncampus_institution_seed.sql` in Supabase SQL Editor or psql.
