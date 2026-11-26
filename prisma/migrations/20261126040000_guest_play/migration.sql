ALTER TABLE "users"
  ADD COLUMN "is_guest" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guest_token_hash" TEXT,
  ADD COLUMN "guest_play_date" DATE;

CREATE UNIQUE INDEX "users_guest_token_hash_key" ON "users"("guest_token_hash");
CREATE INDEX "users_guest_play_date_idx" ON "users"("is_guest", "guest_play_date");
