// buildMatchUpsert must respect manual overrides: on UPDATE an overridden row
// keeps its result/status (only structural fields are refreshed), while a
// non-overridden row takes the full API snapshot. CREATE always seeds everything,
// including the ruststand (halfTime*).
import { describe, it, expect } from "vitest";
import { buildMatchUpsert, type SeedMatchRefs } from "../prisma/seed-match";
import type { ProviderMatch } from "../src/lib/adapters/types";

const m: ProviderMatch = {
  apiMatchId: 123,
  stage: "GROUP",
  groupLetter: "F",
  kickoffUtc: "2026-06-17T01:00:00Z",
  venue: "MetLife Stadium",
  status: "LIVE",
  homeApiTeamId: 1,
  awayApiTeamId: 2,
  homeScore: 2,
  awayScore: 2,
  halfTimeHome: 1,
  halfTimeAway: 1,
  paused: false,
  wentToExtraTime: false,
  penaltyWinnerApiTeamId: null,
};

const refs: Omit<SeedMatchRefs, "overridden"> = {
  homeTeamId: "home-id",
  awayTeamId: "away-id",
  penaltyWinnerTeamId: null,
  bracketSlot: null,
};

const RESULT_KEYS = ["status", "homeScore", "awayScore", "halfTimeHome", "halfTimeAway", "wentToExtraTime", "penaltyWinnerTeamId"];

describe("buildMatchUpsert", () => {
  it("CREATE seeds the full snapshot incl. ruststand", () => {
    const { create } = buildMatchUpsert(m, { ...refs, overridden: false });
    expect(create).toMatchObject({
      apiMatchId: 123,
      stage: "GROUP",
      kickoffUtc: new Date("2026-06-17T01:00:00Z"),
      status: "LIVE",
      homeScore: 2,
      halfTimeHome: 1,
      halfTimeAway: 1,
    });
  });

  it("UPDATE on an overridden row writes ONLY structural fields (never the result/status)", () => {
    const { update } = buildMatchUpsert(m, { ...refs, overridden: true });
    for (const k of RESULT_KEYS) expect(update).not.toHaveProperty(k);
    // structural fields are still refreshed
    expect(update).toMatchObject({
      stage: "GROUP",
      groupLetter: "F",
      kickoffUtc: new Date("2026-06-17T01:00:00Z"),
      venue: "MetLife Stadium",
      homeTeamId: "home-id",
      awayTeamId: "away-id",
    });
  });

  it("UPDATE on a non-overridden row takes the full API snapshot", () => {
    const { update } = buildMatchUpsert(m, { ...refs, overridden: false });
    expect(update).toMatchObject({
      status: "LIVE",
      homeScore: 2,
      awayScore: 2,
      halfTimeHome: 1,
      halfTimeAway: 1,
    });
  });
});
