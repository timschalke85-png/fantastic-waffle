-- Prijzenpoule (0005): losse module naast de bestaande poule/knock-out.
-- Zeven tabellen; haakt alleen lezend in op participants + matches.
-- Raakt GEEN bestaande kolom/tabel; geen wijziging aan de poule-scoring.

-- CreateTable
CREATE TABLE "evenings" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "check_in_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "poll_open" BOOLEAN NOT NULL DEFAULT false,
    "lucky_loser_id" TEXT,
    "winners_frozen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evening_matches" (
    "id" TEXT NOT NULL,
    "evening_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "evening_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL,
    "evening_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_predictions" (
    "id" TEXT NOT NULL,
    "evening_match_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "first_half_home" INTEGER NOT NULL,
    "first_half_away" INTEGER NOT NULL,
    "second_half_home" INTEGER NOT NULL,
    "second_half_away" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_winners" (
    "id" TEXT NOT NULL,
    "evening_match_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,

    CONSTRAINT "daily_winners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" TEXT NOT NULL,
    "evening_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "evening_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evening_matches_evening_id_match_id_key" ON "evening_matches"("evening_id", "match_id");

-- CreateIndex
CREATE INDEX "evening_matches_evening_id_idx" ON "evening_matches"("evening_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkins_evening_id_participant_id_key" ON "checkins"("evening_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_predictions_evening_match_id_participant_id_key" ON "daily_predictions"("evening_match_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_winners_evening_match_id_participant_id_key" ON "daily_winners"("evening_match_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_options_evening_id_match_id_key" ON "poll_options"("evening_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_evening_id_participant_id_key" ON "poll_votes"("evening_id", "participant_id");

-- AddForeignKey
ALTER TABLE "evenings" ADD CONSTRAINT "evenings_lucky_loser_id_fkey" FOREIGN KEY ("lucky_loser_id") REFERENCES "participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evening_matches" ADD CONSTRAINT "evening_matches_evening_id_fkey" FOREIGN KEY ("evening_id") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evening_matches" ADD CONSTRAINT "evening_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_evening_id_fkey" FOREIGN KEY ("evening_id") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_predictions" ADD CONSTRAINT "daily_predictions_evening_match_id_fkey" FOREIGN KEY ("evening_match_id") REFERENCES "evening_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_predictions" ADD CONSTRAINT "daily_predictions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_winners" ADD CONSTRAINT "daily_winners_evening_match_id_fkey" FOREIGN KEY ("evening_match_id") REFERENCES "evening_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_winners" ADD CONSTRAINT "daily_winners_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_evening_id_fkey" FOREIGN KEY ("evening_id") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_evening_id_fkey" FOREIGN KEY ("evening_id") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
