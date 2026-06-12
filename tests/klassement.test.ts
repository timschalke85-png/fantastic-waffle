import { describe, it, expect } from "vitest";
import { compareForLeaderboard, rankLeaderboard, type LeaderboardRow } from "../src/lib/klassement";
import { buildScoringContext, scoreParticipant, type TeamRow, type MatchRow, type ParticipantPredictions } from "../src/lib/scoring-aggregate";

const row = (over: Partial<LeaderboardRow>): LeaderboardRow => ({
  participantId: "x",
  pointsTotal: 0,
  exactCount: 0,
  groupFCorrectItems: 0,
  firstSubmittedAt: null,
  ...over,
});

describe("compareForLeaderboard — tiebreak order", () => {
  it("1) points decide first (desc)", () => {
    const a = row({ participantId: "a", pointsTotal: 10 });
    const b = row({ participantId: "b", pointsTotal: 20 });
    expect(rankLeaderboard([a, b]).map((r) => r.participantId)).toEqual(["b", "a"]);
  });

  it("2) equal points -> more exactCount wins", () => {
    const a = row({ participantId: "a", pointsTotal: 10, exactCount: 1 });
    const b = row({ participantId: "b", pointsTotal: 10, exactCount: 3 });
    expect(rankLeaderboard([a, b]).map((r) => r.participantId)).toEqual(["b", "a"]);
  });

  it("3) equal through exactCount -> more Group F items wins", () => {
    const a = row({ participantId: "a", pointsTotal: 10, exactCount: 2, groupFCorrectItems: 5 });
    const b = row({ participantId: "b", pointsTotal: 10, exactCount: 2, groupFCorrectItems: 9 });
    expect(rankLeaderboard([a, b]).map((r) => r.participantId)).toEqual(["b", "a"]);
  });

  it("4) equal through all but submission -> earliest first; NULL sorts last", () => {
    const early = row({ participantId: "early", pointsTotal: 10, exactCount: 2, groupFCorrectItems: 5, firstSubmittedAt: new Date("2026-06-13T10:00:00Z") });
    const late = row({ participantId: "late", pointsTotal: 10, exactCount: 2, groupFCorrectItems: 5, firstSubmittedAt: new Date("2026-06-14T10:00:00Z") });
    const unset = row({ participantId: "unset", pointsTotal: 10, exactCount: 2, groupFCorrectItems: 5, firstSubmittedAt: null });
    expect(rankLeaderboard([unset, late, early]).map((r) => r.participantId)).toEqual(["early", "late", "unset"]);
  });

  it("is a strict, transitive order (full chain)", () => {
    const top = row({ participantId: "top", pointsTotal: 20 });
    const mid = row({ participantId: "mid", pointsTotal: 10, exactCount: 3 });
    const low = row({ participantId: "low", pointsTotal: 10, exactCount: 1, firstSubmittedAt: new Date("2026-06-13T00:00:00Z") });
    expect(rankLeaderboard([low, top, mid]).map((r) => r.participantId)).toEqual(["top", "mid", "low"]);
    expect(compareForLeaderboard(top, low)).toBeLessThan(0);
  });
});

describe("CRITICAL: tiebreak 1 (exact) and tiebreak 2 (Group F items) measure differently", () => {
  // One Poule F match. Player A predicts the exact score; player B gets the toto
  // (right winner, wrong score). Both earn a Poule F item, but only A has an exact.
  const NL = (id: string, code: string): TeamRow => ({ id, nameNl: id, fifaCode: code, groupLetter: "F" });
  const teams = [NL("nl", "NED"), NL("jp", "JPN"), NL("se", "SWE"), NL("tn", "TUN")];
  const match = (): MatchRow => ({
    id: "m1",
    stage: "GROUP",
    groupLetter: "F",
    bracketSlot: null,
    homeTeamId: "nl",
    awayTeamId: "jp",
    status: "FINISHED",
    homeScore: 2,
    awayScore: 1,
    penaltyWinnerTeamId: null,
    kickoffUtc: new Date("2026-06-14T20:00:00Z"),
  });
  const ctx = buildScoringContext(teams, [match()], new Date("2026-06-14T20:00:00Z"));
  const base: ParticipantPredictions = { participantId: "", groupMatch: [], teamGoals: [], rank: [], knockout: [] };

  it("an exact prediction: exactCount=1, groupFCorrectItems=1", () => {
    const s = scoreParticipant({ ...base, participantId: "A", groupMatch: [{ matchId: "m1", home: 2, away: 1 }] }, ctx);
    expect(s.pointsGroupF).toBe(5); // Poule F exact
    expect(s.exactCount).toBe(1);
    expect(s.groupFCorrectItems).toBe(1);
  });

  it("a TOTO-only prediction: exactCount=0 but groupFCorrectItems=1", () => {
    const s = scoreParticipant({ ...base, participantId: "B", groupMatch: [{ matchId: "m1", home: 3, away: 0 }] }, ctx);
    expect(s.pointsGroupF).toBe(2); // Poule F toto
    expect(s.exactCount).toBe(0); // NOT an exact scoreline
    expect(s.groupFCorrectItems).toBe(1); // but it IS a scoring Group F item
  });

  it("so the comparator separates two equal-point players by exact vs toto", () => {
    const exact = scoreParticipant({ ...base, participantId: "A", groupMatch: [{ matchId: "m1", home: 2, away: 1 }] }, ctx);
    const toto = scoreParticipant({ ...base, participantId: "B", groupMatch: [{ matchId: "m1", home: 3, away: 0 }] }, ctx);
    // Give the toto player extra points elsewhere so totals tie, isolating the exactCount tiebreak.
    const a: LeaderboardRow = { ...exact, pointsTotal: 5, firstSubmittedAt: null };
    const b: LeaderboardRow = { ...toto, pointsTotal: 5, firstSubmittedAt: null };
    expect(rankLeaderboard([b, a]).map((r) => r.participantId)).toEqual(["A", "B"]); // exact wins the tie
  });
});
