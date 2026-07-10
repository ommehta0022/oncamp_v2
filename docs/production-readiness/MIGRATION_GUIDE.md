# Database Migration Guide

All database changes must be executed via Supabase SQL scripts. Do not make schema changes directly in the UI for production environments.

## Local Development
1. Test your SQL in the local Supabase SQL editor or directly connected pgAdmin.
2. Verify that there are no data-loss scenarios.

## Production
1. Store SQL queries in the migrations folder (if applicable in the future).
2. For now, since the team uses the Supabase web dashboard, execute your schema changes in a transaction where possible:
   \\sql
   BEGIN;
   -- your schema changes
   COMMIT;
   \3. Always verify RLS (Row Level Security) policies after adding a new table.
