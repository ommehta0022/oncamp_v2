-- Server-only state for hashtags, mentions, versioning and content intelligence indexing.
BEGIN;

CREATE TABLE IF NOT EXISTS public.post_semantic_index_state (
  post_id text PRIMARY KEY REFERENCES public.posts(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  last_title text,
  last_content text,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_semantic_indexed_at
  ON public.post_semantic_index_state(indexed_at DESC);

ALTER TABLE public.post_semantic_index_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.post_semantic_index_state FROM public, anon, authenticated;
GRANT ALL ON TABLE public.post_semantic_index_state TO service_role;

COMMIT;
