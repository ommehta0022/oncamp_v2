-- OnCampus production extension.
-- Run after all_info_for_api_referance_only/supabase-sql-editor-migration.sql.
-- Adds role-gated institutional publishing, official posts, and group poster request workflow.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountType') THEN
    CREATE TYPE "AccountType" AS ENUM ('normal_user', 'institution_admin', 'platform_admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstitutionVerificationStatus') THEN
    CREATE TYPE "InstitutionVerificationStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostType') THEN
    CREATE TYPE "PostType" AS ENUM ('announcement', 'poster', 'event', 'notice', 'general', 'emergency');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostVisibility') THEN
    CREATE TYPE "PostVisibility" AS ENUM ('public', 'institution', 'group', 'city');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostStatus') THEN
    CREATE TYPE "PostStatus" AS ENUM ('draft', 'scheduled', 'published', 'archived', 'expired');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupPostingMode') THEN
    CREATE TYPE "GroupPostingMode" AS ENUM ('admins_only', 'members_can_request', 'members_can_post', 'institution_only');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PostRequestStatus') THEN
    CREATE TYPE "PostRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'needs_changes', 'scheduled', 'published', 'expired');
  END IF;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "account_type" "AccountType" NOT NULL DEFAULT 'normal_user',
  ADD COLUMN IF NOT EXISTS "can_create_posts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "can_create_groups" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "posting_mode" "GroupPostingMode" NOT NULL DEFAULT 'admins_only',
  ADD COLUMN IF NOT EXISTS "approval_required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allow_external_post_requests" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "post_request_instructions" TEXT;

CREATE TABLE IF NOT EXISTS "institution_admins" (
  "id" TEXT NOT NULL,
  "institution_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'admin',
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "institution_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "institution_admins_institution_user_key"
  ON "institution_admins"("institution_id", "user_id");

CREATE TABLE IF NOT EXISTS "institution_verification_requests" (
  "id" TEXT NOT NULL,
  "institution_id" TEXT,
  "submitted_by" TEXT,
  "institution_name" TEXT NOT NULL,
  "institution_type" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT,
  "country" TEXT,
  "official_email" TEXT NOT NULL,
  "phone" TEXT,
  "website" TEXT,
  "admin_name" TEXT NOT NULL,
  "designation" TEXT,
  "document_url" TEXT,
  "status" "InstitutionVerificationStatus" NOT NULL DEFAULT 'pending',
  "review_notes" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "institution_verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "posts" (
  "id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "institution_id" TEXT,
  "group_id" TEXT,
  "type" "PostType" NOT NULL DEFAULT 'general',
  "visibility" "PostVisibility" NOT NULL DEFAULT 'public',
  "status" "PostStatus" NOT NULL DEFAULT 'published',
  "title" TEXT,
  "content" TEXT NOT NULL,
  "media_url" TEXT,
  "media_type" TEXT,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "comments_enabled" BOOLEAN NOT NULL DEFAULT true,
  "reactions_enabled" BOOLEAN NOT NULL DEFAULT true,
  "scheduled_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "post_reactions" (
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reaction" TEXT NOT NULL DEFAULT 'like',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("post_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "post_comments" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "parent_comment_id" TEXT,
  "content" TEXT NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "group_post_requests" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "requester_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "poster_url" TEXT,
  "requested_publish_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "contact_name" TEXT NOT NULL,
  "contact_email" TEXT,
  "contact_phone" TEXT,
  "status" "PostRequestStatus" NOT NULL DEFAULT 'pending',
  "decision_note" TEXT,
  "decided_by" TEXT,
  "decided_at" TIMESTAMP(3),
  "published_post_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "group_post_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'general',
  "data" JSONB NOT NULL DEFAULT '{}',
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "users_account_type_idx" ON "users"("account_type");
CREATE INDEX IF NOT EXISTS "posts_group_created_idx" ON "posts"("group_id", "created_at");
CREATE INDEX IF NOT EXISTS "posts_institution_created_idx" ON "posts"("institution_id", "created_at");
CREATE INDEX IF NOT EXISTS "posts_status_created_idx" ON "posts"("status", "created_at");
CREATE INDEX IF NOT EXISTS "group_post_requests_group_status_idx" ON "group_post_requests"("group_id", "status");
CREATE INDEX IF NOT EXISTS "group_post_requests_requester_idx" ON "group_post_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications"("user_id", "created_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'institution_admins_institution_id_fkey') THEN
    ALTER TABLE "institution_admins" ADD CONSTRAINT "institution_admins_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'institution_admins_user_id_fkey') THEN
    ALTER TABLE "institution_admins" ADD CONSTRAINT "institution_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_author_id_fkey') THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_institution_id_fkey') THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_group_id_fkey') THEN
    ALTER TABLE "posts" ADD CONSTRAINT "posts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_post_requests_group_id_fkey') THEN
    ALTER TABLE "group_post_requests" ADD CONSTRAINT "group_post_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_post_requests_requester_id_fkey') THEN
    ALTER TABLE "group_post_requests" ADD CONSTRAINT "group_post_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
