-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('EDGE', 'CONFIDENCE', 'ORDER', 'HIGH_LOW');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('SUBMITTED', 'WRONG', 'CASHED_OUT', 'MAX_STEPS', 'TIMEOUT', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ActionKind" AS ENUM ('SUBMIT_SELECTION', 'PICK_NEXT', 'COMPARE', 'CASH_OUT', 'ABANDON', 'TIMEOUT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nickname_key" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "scope" TEXT NOT NULL,
    "subject_key" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ NOT NULL,
    "count" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("scope","subject_key","window_start")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "collectible_theme" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "width_px" INTEGER NOT NULL,
    "height_px" INTEGER NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collectible_tiers" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "tier_no" INTEGER NOT NULL,
    "threshold_amount" INTEGER NOT NULL,
    "tier_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "asset_id" UUID NOT NULL,
    "asset_alt" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collectible_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sets" (
    "id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "play_date" DATE NOT NULL,
    "status" "SetStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "published_at" TIMESTAMPTZ,

    CONSTRAINT "daily_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" UUID NOT NULL,
    "daily_set_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "half" INTEGER NOT NULL,
    "mode" "Mode" NOT NULL,
    "category_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "public_config" JSONB NOT NULL,
    "reward_rules" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "time_limit_sec" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "source_refs" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_options" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "numeric_value" BIGINT,
    "correct_flag" BOOLEAN,
    "order_rank" INTEGER,
    "explanation" TEXT,

    CONSTRAINT "challenge_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "end_reason" "EndReason",
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "state_json" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "final_reward" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_actions" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "request_id" UUID NOT NULL,
    "kind" "ActionKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banknotes" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "denomination" INTEGER NOT NULL,
    "earned_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "banknotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_totals" (
    "user_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "final_rank" INTEGER,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "season_totals_pkey" PRIMARY KEY ("user_id","season_id")
);

-- CreateTable
CREATE TABLE "user_collectibles" (
    "user_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "tier_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ NOT NULL,
    "final_amount" INTEGER NOT NULL,
    "final_rank" INTEGER NOT NULL,

    CONSTRAINT "user_collectibles_pkey" PRIMARY KEY ("user_id","season_id")
);

-- CreateTable
CREATE TABLE "admin_audit" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "job_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "details" JSONB NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_nickname_key_key" ON "users"("nickname_key");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "rate_limits_expires_at_idx" ON "rate_limits"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_year_month_key" ON "seasons"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_sha256_key" ON "media_assets"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "collectible_tiers_season_id_tier_no_key" ON "collectible_tiers"("season_id", "tier_no");

-- CreateIndex
CREATE UNIQUE INDEX "collectible_tiers_season_id_threshold_amount_key" ON "collectible_tiers"("season_id", "threshold_amount");

-- CreateIndex
CREATE UNIQUE INDEX "collectible_tiers_id_season_id_key" ON "collectible_tiers"("id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sets_play_date_key" ON "daily_sets"("play_date");

-- CreateIndex
CREATE INDEX "daily_sets_season_id_play_date_idx" ON "daily_sets"("season_id", "play_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sets_id_season_id_key" ON "daily_sets"("id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_daily_set_id_position_key" ON "challenges"("daily_set_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_id_season_id_key" ON "challenges"("id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_options_challenge_id_sort_order_key" ON "challenge_options"("challenge_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_options_challenge_id_order_rank_key" ON "challenge_options"("challenge_id", "order_rank");

-- CreateIndex
CREATE INDEX "attempts_status_expires_at_idx" ON "attempts"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_user_id_challenge_id_key" ON "attempts"("user_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_id_user_id_season_id_key" ON "attempts"("id", "user_id", "season_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_actions_attempt_id_sequence_no_key" ON "attempt_actions"("attempt_id", "sequence_no");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_actions_attempt_id_request_id_key" ON "attempt_actions"("attempt_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "banknotes_attempt_id_key" ON "banknotes"("attempt_id");

-- CreateIndex
CREATE INDEX "banknotes_user_id_season_id_denomination_idx" ON "banknotes"("user_id", "season_id", "denomination");

-- CreateIndex
CREATE UNIQUE INDEX "banknotes_attempt_id_user_id_season_id_key" ON "banknotes"("attempt_id", "user_id", "season_id");

-- CreateIndex
CREATE INDEX "season_totals_season_id_total_amount_idx" ON "season_totals"("season_id", "total_amount");

-- CreateIndex
CREATE INDEX "admin_audit_entity_type_entity_id_created_at_idx" ON "admin_audit"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_runs_job_type_job_key_key" ON "job_runs"("job_type", "job_key");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collectible_tiers" ADD CONSTRAINT "collectible_tiers_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collectible_tiers" ADD CONSTRAINT "collectible_tiers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sets" ADD CONSTRAINT "daily_sets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sets" ADD CONSTRAINT "daily_sets_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_daily_set_id_season_id_fkey" FOREIGN KEY ("daily_set_id", "season_id") REFERENCES "daily_sets"("id", "season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_options" ADD CONSTRAINT "challenge_options_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_challenge_id_season_id_fkey" FOREIGN KEY ("challenge_id", "season_id") REFERENCES "challenges"("id", "season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_actions" ADD CONSTRAINT "attempt_actions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banknotes" ADD CONSTRAINT "banknotes_attempt_id_user_id_season_id_fkey" FOREIGN KEY ("attempt_id", "user_id", "season_id") REFERENCES "attempts"("id", "user_id", "season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banknotes" ADD CONSTRAINT "banknotes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banknotes" ADD CONSTRAINT "banknotes_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_totals" ADD CONSTRAINT "season_totals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_totals" ADD CONSTRAINT "season_totals_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collectibles" ADD CONSTRAINT "user_collectibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collectibles" ADD CONSTRAINT "user_collectibles_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collectibles" ADD CONSTRAINT "user_collectibles_tier_id_season_id_fkey" FOREIGN KEY ("tier_id", "season_id") REFERENCES "collectible_tiers"("id", "season_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Domain invariants that Prisma cannot express.
ALTER TABLE users ADD CONSTRAINT users_session_version_check CHECK (session_version >= 0);
ALTER TABLE seasons ADD CONSTRAINT seasons_dates_check CHECK (month BETWEEN 1 AND 12 AND starts_at < ends_at);
ALTER TABLE media_assets ADD CONSTRAINT assets_size_check CHECK (byte_size BETWEEN 1 AND 5242880 AND byte_size = octet_length(bytes) AND width_px BETWEEN 1 AND 4096 AND height_px BETWEEN 1 AND 4096 AND mime_type IN ('image/png','image/jpeg','image/webp'));
ALTER TABLE collectible_tiers ADD CONSTRAINT tiers_threshold_check CHECK (tier_no >= 1 AND threshold_amount >= 0 AND threshold_amount % 10 = 0);
ALTER TABLE challenges ADD CONSTRAINT challenge_position_check CHECK (position BETWEEN 1 AND 8 AND half = CASE WHEN position <= 4 THEN 1 ELSE 2 END AND time_limit_sec BETWEEN 15 AND 180);
ALTER TABLE challenge_options ADD CONSTRAINT option_secret_check CHECK (num_nonnulls(numeric_value, correct_flag, order_rank) = 1 AND sort_order >= 1 AND (order_rank IS NULL OR order_rank > 0));
ALTER TABLE attempts ADD CONSTRAINT attempts_dates_check CHECK (started_at < expires_at AND revision >= 0 AND correct_count >= 0 AND (finished_at IS NULL OR finished_at >= started_at));
ALTER TABLE attempts ADD CONSTRAINT attempts_state_check CHECK ((status = 'ACTIVE' AND finished_at IS NULL AND final_reward IS NULL AND end_reason IS NULL) OR (status <> 'ACTIVE' AND finished_at IS NOT NULL AND final_reward IN (0,10,20,50,100,200,500,1000,2000,5000) AND end_reason IS NOT NULL));
ALTER TABLE attempts ADD CONSTRAINT attempts_failed_reward_check CHECK (status NOT IN ('FAILED','ABANDONED') OR final_reward = 0);
CREATE UNIQUE INDEX attempts_one_active_per_user ON attempts(user_id) WHERE status = 'ACTIVE';
ALTER TABLE banknotes ADD CONSTRAINT banknote_denomination_check CHECK (denomination IN (10,20,50,100,200,500,1000,2000,5000));
ALTER TABLE season_totals ADD CONSTRAINT totals_check CHECK (total_amount >= 0 AND total_amount % 10 = 0 AND completed_count BETWEEN 0 AND 248 AND (final_rank IS NULL OR final_rank > 0));
