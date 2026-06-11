-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD_PLACE', 'FINAL');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED');

-- CreateTable
CREATE TABLE "participants" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nickname_key" TEXT NOT NULL,
    "full_name" TEXT,
    "show_full_name" BOOLEAN NOT NULL DEFAULT false,
    "pin_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "api_team_id" INTEGER NOT NULL,
    "fifa_code" TEXT NOT NULL,
    "name_nl" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "group_letter" CHAR(1) NOT NULL,
    "crest_url" TEXT,
    "flag_emoji" TEXT,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "api_match_id" INTEGER NOT NULL,
    "stage" "Stage" NOT NULL,
    "group_letter" CHAR(1),
    "bracket_slot" TEXT,
    "home_team_id" TEXT,
    "away_team_id" TEXT,
    "kickoff_utc" TIMESTAMPTZ(6) NOT NULL,
    "venue" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "went_to_extra_time" BOOLEAN NOT NULL DEFAULT false,
    "penalty_winner_team_id" TEXT,
    "manually_overridden" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions_group_match" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "home_goals" INTEGER NOT NULL,
    "away_goals" INTEGER NOT NULL,

    CONSTRAINT "predictions_group_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions_group_rank" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "group_letter" CHAR(1) NOT NULL,
    "position" INTEGER NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "predictions_group_rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions_team_goals" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "goals" INTEGER NOT NULL,

    CONSTRAINT "predictions_team_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions_knockout" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "bracket_slot" TEXT NOT NULL,
    "home_team_id" TEXT,
    "away_team_id" TEXT,
    "home_goals" INTEGER,
    "away_goals" INTEGER,
    "winner_team_id" TEXT,

    CONSTRAINT "predictions_knockout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "points_group_f" INTEGER NOT NULL DEFAULT 0,
    "points_other_groups" INTEGER NOT NULL DEFAULT 0,
    "points_knockout" INTEGER NOT NULL DEFAULT 0,
    "points_total" INTEGER NOT NULL DEFAULT 0,
    "exact_count" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "r32_allocation" (
    "bracket_slot" TEXT NOT NULL,
    "match_number" INTEGER NOT NULL,
    "home_source" TEXT NOT NULL,
    "away_source" TEXT NOT NULL,
    "third_place_pool" JSONB,

    CONSTRAINT "r32_allocation_pkey" PRIMARY KEY ("bracket_slot")
);

-- CreateTable
CREATE TABLE "third_place_combinations" (
    "id" TEXT NOT NULL,
    "groups_key" TEXT NOT NULL,
    "assignment" JSONB NOT NULL,

    CONSTRAINT "third_place_combinations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participants_nickname_key" ON "participants"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "participants_nickname_key_key" ON "participants"("nickname_key");

-- CreateIndex
CREATE UNIQUE INDEX "teams_api_team_id_key" ON "teams"("api_team_id");

-- CreateIndex
CREATE INDEX "teams_group_letter_idx" ON "teams"("group_letter");

-- CreateIndex
CREATE UNIQUE INDEX "matches_api_match_id_key" ON "matches"("api_match_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_bracket_slot_key" ON "matches"("bracket_slot");

-- CreateIndex
CREATE INDEX "matches_stage_idx" ON "matches"("stage");

-- CreateIndex
CREATE INDEX "matches_group_letter_idx" ON "matches"("group_letter");

-- CreateIndex
CREATE INDEX "matches_kickoff_utc_idx" ON "matches"("kickoff_utc");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_group_match_participant_id_match_id_key" ON "predictions_group_match"("participant_id", "match_id");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_group_rank_participant_id_group_letter_position_key" ON "predictions_group_rank"("participant_id", "group_letter", "position");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_team_goals_participant_id_team_id_key" ON "predictions_team_goals"("participant_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "predictions_knockout_participant_id_bracket_slot_key" ON "predictions_knockout"("participant_id", "bracket_slot");

-- CreateIndex
CREATE UNIQUE INDEX "scores_participant_id_key" ON "scores"("participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "third_place_combinations_groups_key_key" ON "third_place_combinations"("groups_key");

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_penalty_winner_team_id_fkey" FOREIGN KEY ("penalty_winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_group_match" ADD CONSTRAINT "predictions_group_match_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_group_match" ADD CONSTRAINT "predictions_group_match_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_group_rank" ADD CONSTRAINT "predictions_group_rank_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_group_rank" ADD CONSTRAINT "predictions_group_rank_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_team_goals" ADD CONSTRAINT "predictions_team_goals_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_team_goals" ADD CONSTRAINT "predictions_team_goals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions_knockout" ADD CONSTRAINT "predictions_knockout_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

