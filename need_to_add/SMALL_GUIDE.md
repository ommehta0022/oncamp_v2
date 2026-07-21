# Small Guide

1. Apply the normal project schema first.
2. Run `runtime_api_support.sql`.
3. Run `mobile_api_support.sql`.
4. Run `demo_oncampus_institution_seed.sql` only in a non-production Supabase project.
5. Start the backend with non-production credentials.
6. For demo login, use `DEV_MODE=true` and `DEV_OTP_CODE=123456`, then sign in with one of the demo phone numbers in `DEMO_ACCOUNTS_AND_INSTITUTIONS.md`.
7. Smoke test Feed, Groups, Discover, Search, Saved, Forward, Profile, group chat, pin/mute, join requests, comments, saves, shares, reposts, notifications, and institution dashboard.
8. Cleanup: remove demo data by running `remove_demo_oncampus_institution_seed.sql`.

Important: `runtime_api_support.sql` creates a `content_reports` compatibility view only when that relation is absent, backed by the canonical `reports` table.
