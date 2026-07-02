-- AUTO-GENERATED FULL SCHEMA WITH IF NOT EXISTS

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
    CREATE TYPE "UserStatus" AS ENUM ('active', 'muted', 'banned');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GroupVisibility') THEN
    CREATE TYPE "GroupVisibility" AS ENUM ('public', 'private');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JoinPolicy') THEN
    CREATE TYPE "JoinPolicy" AS ENUM ('request_to_join', 'auto_approve_verified', 'invite_only');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MemberRole') THEN
    CREATE TYPE "MemberRole" AS ENUM ('owner', 'admin', 'moderator', 'member');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MemberStatus') THEN
    CREATE TYPE "MemberStatus" AS ENUM ('active', 'muted', 'removed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JoinRequestStatus') THEN
    CREATE TYPE "JoinRequestStatus" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportTargetType') THEN
    CREATE TYPE "ReportTargetType" AS ENUM ('user', 'message', 'group');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportStatus') THEN
    CREATE TYPE "ReportStatus" AS ENUM ('pending', 'resolved', 'dismissed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
    CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'moderator');
  END IF;
END $$;

-- OnCampus Supabase SQL Editor Migration
-- Run once in Supabase Dashboard > SQL Editor.

-- Backend schema
-- CreateEnum


-- CreateEnum


-- CreateEnum


-- CreateEnum


-- CreateEnum


-- CreateEnum


-- CreateEnum


-- CreateEnum


-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT,
    "course" TEXT,
    "avatar_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "push_token" TEXT,
    "trusted" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "otp_challenges" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "institutions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "verification_policy" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_institutions" (
    "user_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "verification_status" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_institutions_pkey" PRIMARY KEY ("user_id","institution_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "groups" (
    "id" TEXT NOT NULL,
    "institution_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "city" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "visibility" "GroupVisibility" NOT NULL,
    "join_policy" "JoinPolicy" NOT NULL,
    "member_limit" INTEGER NOT NULL DEFAULT 50000,
    "created_by" TEXT NOT NULL,
    "avatar_url" TEXT,
    "official" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "group_members" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "status" "MemberStatus" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "muted_at" TIMESTAMP(3),

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "join_requests" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "client_message_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "media_url" TEXT,
    "media_type" TEXT,
    "parent_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reports" (
    "id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "group_id" TEXT,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "resolution" TEXT,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "group_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "analytics_events" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "user_id" TEXT,
    "group_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_hash_key" ON "users"("phone_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_phone_hash_idx" ON "users"("phone_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_city_idx" ON "users"("city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_verified_idx" ON "users"("verified");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_devices_user_id_idx" ON "user_devices"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_devices_push_token_idx" ON "user_devices"("push_token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_device_id_idx" ON "refresh_tokens"("device_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON "refresh_tokens"("family");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "otp_challenges_phone_idx" ON "otp_challenges"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "institutions_city_idx" ON "institutions"("city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_institutions_institution_id_idx" ON "user_institutions"("institution_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "groups_institution_id_idx" ON "groups"("institution_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "groups_city_idx" ON "groups"("city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "groups_category_idx" ON "groups"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "groups_visibility_idx" ON "groups"("visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "groups_created_at_idx" ON "groups"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_members_role_idx" ON "group_members"("role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "group_members_status_idx" ON "group_members"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "join_requests_group_id_idx" ON "join_requests"("group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "join_requests_user_id_idx" ON "join_requests"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "join_requests_status_idx" ON "join_requests"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "join_requests_created_at_idx" ON "join_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "messages_group_id_client_message_id_key" ON "messages"("group_id", "client_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_group_id_created_at_idx" ON "messages"("group_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_group_id_idx" ON "reports"("group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_group_id_idx" ON "audit_logs"("group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_events_event_type_idx" ON "analytics_events"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx" ON "analytics_events"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_events_group_id_idx" ON "analytics_events"("group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "analytics_events_timestamp_idx" ON "analytics_events"("timestamp");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_devices_user_id_fkey') THEN
    ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_institutions_user_id_fkey') THEN
    ALTER TABLE "user_institutions" ADD CONSTRAINT "user_institutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_institutions_institution_id_fkey') THEN
    ALTER TABLE "user_institutions" ADD CONSTRAINT "user_institutions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_institution_id_fkey') THEN
    ALTER TABLE "groups" ADD CONSTRAINT "groups_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_created_by_fkey') THEN
    ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_members_group_id_fkey') THEN
    ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_members_user_id_fkey') THEN
    ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'join_requests_group_id_fkey') THEN
    ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'join_requests_user_id_fkey') THEN
    ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_group_id_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey') THEN
    ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_reporter_id_fkey') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_target_user_fk') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "report_target_user_fk" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_group_id_fkey') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;


-- Admin schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
    
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL,
  "two_factor_secret" TEXT,
  "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_email_key" ON "admin_users"("email");

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" TEXT NOT NULL,
  "admin_id" TEXT NOT NULL,
  "refresh_hash" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3),
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_sessions_admin_id_idx" ON "admin_sessions"("admin_id");

CREATE TABLE IF NOT EXISTS "action_logs" (
  "id" TEXT NOT NULL,
  "admin_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "action_logs_admin_id_idx" ON "action_logs"("admin_id");
CREATE INDEX IF NOT EXISTS "action_logs_action_type_idx" ON "action_logs"("action_type");
CREATE INDEX IF NOT EXISTS "action_logs_created_at_idx" ON "action_logs"("created_at");

CREATE TABLE IF NOT EXISTS "security_config" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "message_rate_limit_per_minute" INTEGER NOT NULL DEFAULT 30,
  "join_requests_per_hour" INTEGER NOT NULL DEFAULT 20,
  "otp_attempts_per_hour" INTEGER NOT NULL DEFAULT 5,
  "spam_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blocked_ips" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "suspicious_activity_alerts_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "message_aggregates" (
  "id" TEXT NOT NULL,
  "group_id" TEXT,
  "user_id" TEXT,
  "metric_date" TIMESTAMP(3) NOT NULL,
  "messages_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "message_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_aggregates_group_id_metric_date_idx" ON "message_aggregates"("group_id", "metric_date");
CREATE INDEX IF NOT EXISTS "message_aggregates_user_id_metric_date_idx" ON "message_aggregates"("user_id", "metric_date");

CREATE TABLE IF NOT EXISTS "user_activity_aggregates" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "metric_date" TIMESTAMP(3) NOT NULL,
  "active_daily" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "user_activity_aggregates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_activity_aggregates_metric_date_idx" ON "user_activity_aggregates"("metric_date");

CREATE TABLE IF NOT EXISTS "admin_outbox" (
  "id" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "admin_outbox_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_sessions_admin_id_fkey') THEN
    ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'action_logs_admin_id_fkey') THEN
    ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


-- Prisma migration bookkeeping for manual SQL Editor apply
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES ('20260630-init-manual-000000000001', '78e0b1705a96f17e9b1cec4fe3ea105be5a97e4bb934e3296d5a55a1ddcf30f5', now(), '20260630_init', NULL, NULL, now(), 1)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
VALUES ('20260630-admin-manual-00000001', 'aee8a542dd1a40a6ae0b231cd663a427d0b26b5a21fe33b2197f750a61fedda3', now(), '20260630_admin_init', NULL, NULL, now(), 1)
ON CONFLICT ("id") DO NOTHING;


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
