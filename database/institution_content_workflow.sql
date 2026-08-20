-- Institution-controlled publishing and cross-institution content collaboration.
-- This migration mirrors the production schema applied to Supabase.

create table if not exists public.institution_content_requests (
  id text primary key,
  source_institution_id text not null references public.institutions(id) on delete cascade,
  target_institution_id text not null references public.institutions(id) on delete cascade,
  created_by text not null references public.users(id) on delete restrict,
  source_post_id text null references public.posts(id) on delete set null,
  title text not null check (char_length(title) between 1 and 180),
  content text not null check (char_length(content) between 1 and 12000),
  category text not null default 'general' check (char_length(category) between 1 and 60),
  post_type text not null default 'general' check (post_type in ('general','announcement','event','notice','poster','emergency')),
  media_url text null,
  media_type text null check (media_type is null or media_type in ('image','video','document')),
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  requested_destination text not null default 'recipient_choice' check (requested_destination in ('recipient_choice','feed','groups')),
  requested_group_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(requested_group_ids) = 'array'),
  comments_enabled boolean not null default true,
  reactions_enabled boolean not null default true,
  pin_requested boolean not null default false,
  requested_publish_at timestamp without time zone null,
  expires_at timestamp without time zone null,
  status text not null default 'pending' check (status in ('draft','pending','changes_requested','revised','approved','rejected','withdrawn','partially_published','published','expired')),
  revision integer not null default 1 check (revision > 0),
  latest_message text null check (latest_message is null or char_length(latest_message) <= 2000),
  approved_by text null references public.users(id) on delete set null,
  approved_at timestamp without time zone null,
  rejected_by text null references public.users(id) on delete set null,
  rejected_at timestamp without time zone null,
  withdrawn_by text null references public.users(id) on delete set null,
  withdrawn_at timestamp without time zone null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamp without time zone not null default current_timestamp,
  updated_at timestamp without time zone not null default current_timestamp,
  check (source_institution_id <> target_institution_id),
  check (expires_at is null or requested_publish_at is null or expires_at > requested_publish_at)
);

create table if not exists public.institution_content_request_events (
  id text primary key,
  request_id text not null references public.institution_content_requests(id) on delete cascade,
  actor_user_id text not null references public.users(id) on delete restrict,
  actor_institution_id text not null references public.institutions(id) on delete cascade,
  event_type text not null check (event_type in ('created','message','changes_requested','revised','approved','rejected','withdrawn','published','expired')),
  message text null check (message is null or char_length(message) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamp without time zone not null default current_timestamp
);

create table if not exists public.institution_content_publications (
  id text primary key,
  request_id text not null references public.institution_content_requests(id) on delete cascade,
  target_institution_id text not null references public.institutions(id) on delete cascade,
  published_by text not null references public.users(id) on delete restrict,
  destination_type text not null check (destination_type in ('feed','group')),
  destination_key text not null,
  group_id text null references public.groups(id) on delete set null,
  post_id text not null references public.posts(id) on delete cascade,
  created_at timestamp without time zone not null default current_timestamp,
  unique (request_id, destination_key),
  check ((destination_type='feed' and group_id is null and destination_key='feed') or (destination_type='group' and group_id is not null))
);

create table if not exists public.institution_content_drafts (
  id text primary key,
  institution_id text not null references public.institutions(id) on delete cascade,
  created_by text not null references public.users(id) on delete cascade,
  title text not null default '',
  content text not null default '',
  category text not null default 'general',
  post_type text not null default 'general',
  media_url text null,
  media_type text null,
  tags jsonb not null default '[]'::jsonb,
  editor_state jsonb not null default '{}'::jsonb,
  created_at timestamp without time zone not null default current_timestamp,
  updated_at timestamp without time zone not null default current_timestamp,
  check (char_length(title) <= 180),
  check (char_length(content) <= 12000),
  check (jsonb_typeof(tags)='array'),
  check (jsonb_typeof(editor_state)='object')
);

create index if not exists idx_icr_source_status_created on public.institution_content_requests(source_institution_id,status,created_at desc);
create index if not exists idx_icr_target_status_created on public.institution_content_requests(target_institution_id,status,created_at desc);
create index if not exists idx_icr_expires on public.institution_content_requests(expires_at) where expires_at is not null;
create index if not exists idx_icre_request_created on public.institution_content_request_events(request_id,created_at asc);
create index if not exists idx_icp_request_created on public.institution_content_publications(request_id,created_at asc);
create index if not exists idx_icd_institution_updated on public.institution_content_drafts(institution_id,updated_at desc);

alter table public.institution_content_requests enable row level security;
alter table public.institution_content_request_events enable row level security;
alter table public.institution_content_publications enable row level security;
alter table public.institution_content_drafts enable row level security;

revoke all on table public.institution_content_requests from public, anon, authenticated;
revoke all on table public.institution_content_request_events from public, anon, authenticated;
revoke all on table public.institution_content_publications from public, anon, authenticated;
revoke all on table public.institution_content_drafts from public, anon, authenticated;
grant all on table public.institution_content_requests to service_role;
grant all on table public.institution_content_request_events to service_role;
grant all on table public.institution_content_publications to service_role;
grant all on table public.institution_content_drafts to service_role;
