-- Applied to production Supabase on 2026-08-21 as migration remaining_fk_covering_indexes_v1.
-- Covers the remaining foreign keys reported by the Supabase performance advisor.

create index if not exists idx_app_installations_user_id on public.app_installations(user_id);
create index if not exists idx_institution_content_drafts_created_by on public.institution_content_drafts(created_by);
create index if not exists idx_institution_content_publications_group_id on public.institution_content_publications(group_id);
create index if not exists idx_institution_content_publications_post_id on public.institution_content_publications(post_id);
create index if not exists idx_institution_content_publications_published_by on public.institution_content_publications(published_by);
create index if not exists idx_institution_content_publications_target_institution_id on public.institution_content_publications(target_institution_id);
create index if not exists idx_institution_content_request_events_actor_institution_id on public.institution_content_request_events(actor_institution_id);
create index if not exists idx_institution_content_request_events_actor_user_id on public.institution_content_request_events(actor_user_id);
create index if not exists idx_institution_content_requests_approved_by on public.institution_content_requests(approved_by);
create index if not exists idx_institution_content_requests_created_by on public.institution_content_requests(created_by);
create index if not exists idx_institution_content_requests_rejected_by on public.institution_content_requests(rejected_by);
create index if not exists idx_institution_content_requests_source_post_id on public.institution_content_requests(source_post_id);
create index if not exists idx_institution_content_requests_withdrawn_by on public.institution_content_requests(withdrawn_by);
create index if not exists idx_institution_departments_created_by on public.institution_departments(created_by);
create index if not exists idx_institution_media_assets_institution_id on public.institution_media_assets(institution_id);
create index if not exists idx_institution_media_assets_owner_user_id on public.institution_media_assets(owner_user_id);
create index if not exists idx_institution_roles_created_by on public.institution_roles(created_by);
