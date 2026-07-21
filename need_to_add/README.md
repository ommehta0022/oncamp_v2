# OnCampus Supabase Add Pack

This folder contains the SQL and short setup notes needed after deploying the OnCampus v2 migration.

## Run Order

Run these files in a non-production Supabase project first:

1. Existing project base schema and production extension SQL files.
2. `runtime_api_support.sql`
3. `mobile_api_support.sql`
4. `demo_oncampus_institution_seed.sql`

To remove only demo rows later, run:

```sql
\i remove_demo_oncampus_institution_seed.sql
```

In the Supabase SQL Editor, open the cleanup file and run it directly instead of using `\i`.

## Files

- `runtime_api_support.sql`: API/admin support tables, columns, and the `content_reports` compatibility view used by `server.py` and `admin_routes_simple.py`.
- `mobile_api_support.sql`: mobile app support tables and columns for settings, blocks, pinned groups, shares, and push devices.
- `demo_oncampus_institution_seed.sql`: reversible demo users, institutions, linked groups, chats, image posts, reactions, comments, notifications, saved posts, and pinned groups.
- `remove_demo_oncampus_institution_seed.sql`: cleanup script for rows whose IDs start with `demo_oc_`.
- `SMALL_GUIDE.md`: one-page setup and verification guide.
- `DEMO_ACCOUNTS_AND_INSTITUTIONS.md`: demo login numbers and institution/group IDs.

Do not run demo seed data against production.
