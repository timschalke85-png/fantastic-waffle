-- RUST-indicator: store the half-time score + a live "paused" (half-time break)
-- flag, so the UI can show "RUST" + the rust-stand from real API data.
ALTER TABLE "matches" ADD COLUMN "half_time_home" INTEGER;
ALTER TABLE "matches" ADD COLUMN "half_time_away" INTEGER;
ALTER TABLE "matches" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;
