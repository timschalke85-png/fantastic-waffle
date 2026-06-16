// Pure helper for the match upsert in seed.ts — split out so the
// override-respecting merge can be unit-tested without a database.
//
// Two field groups:
//  - STRUCTURAL (identity/schedule): stage, group, bracket slot, teams, kickoff,
//    venue. Always safe to refresh on a re-seed.
//  - RESULT (the API's outcome): status, scores, ruststand, ET, penalty winner.
//    On UPDATE these are skipped for a manually overridden row, so a re-seed can
//    never clobber an admin correction (CLAUDE.md hard rule 1). A brand-new row
//    has no manual data yet, so CREATE always seeds the full snapshot.
import type { Prisma } from "@prisma/client";
import type { ProviderMatch } from "../src/lib/adapters/types";

export interface SeedMatchRefs {
  homeTeamId: string | null;
  awayTeamId: string | null;
  penaltyWinnerTeamId: string | null;
  bracketSlot: string | null;
  /** True if the existing DB row is manually overridden (skip result fields). */
  overridden: boolean;
}

export function buildMatchUpsert(
  m: ProviderMatch,
  refs: SeedMatchRefs,
): { create: Prisma.MatchUncheckedCreateInput; update: Prisma.MatchUncheckedUpdateInput } {
  const structural = {
    stage: m.stage,
    groupLetter: m.groupLetter,
    bracketSlot: refs.bracketSlot,
    homeTeamId: refs.homeTeamId,
    awayTeamId: refs.awayTeamId,
    kickoffUtc: new Date(m.kickoffUtc),
    venue: m.venue,
  } satisfies Prisma.MatchUncheckedUpdateInput;

  const result = {
    status: m.status,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    halfTimeHome: m.halfTimeHome,
    halfTimeAway: m.halfTimeAway,
    wentToExtraTime: m.wentToExtraTime,
    penaltyWinnerTeamId: refs.penaltyWinnerTeamId,
  } satisfies Prisma.MatchUncheckedUpdateInput;

  return {
    create: { apiMatchId: m.apiMatchId, ...structural, ...result },
    // Overridden row: structural-only update leaves the manual result/status intact.
    update: refs.overridden ? structural : { ...structural, ...result },
  };
}
