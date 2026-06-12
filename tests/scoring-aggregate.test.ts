import { describe, it, expect } from "vitest";
import {
  buildScoringContext,
  scoreParticipant,
  computeAllScores,
  type TeamRow,
  type MatchRow,
  type ParticipantPredictions,
} from "../src/lib/scoring-aggregate";

const LOCK = new Date("2026-06-14T20:00:00Z");
const POST = "2026-06-20T17:00:00Z"; // after lock
const PRE = "2026-06-11T16:00:00Z"; // before lock

const team = (id: string, code: string, group: string): TeamRow => ({ id, nameNl: id, fifaCode: code, groupLetter: group });

const gm = (
  id: string,
  group: string,
  homeId: string,
  awayId: string,
  hs: number | null,
  as: number | null,
  kickoff = POST,
  status = "FINISHED",
): MatchRow => ({
  id,
  stage: "GROUP",
  groupLetter: group,
  bracketSlot: null,
  homeTeamId: homeId,
  awayTeamId: awayId,
  status,
  homeScore: status === "FINISHED" ? hs : null,
  awayScore: status === "FINISHED" ? as : null,
  penaltyWinnerTeamId: null,
  kickoffUtc: new Date(kickoff),
});

// Poule F: NL 9 (1st), JP 4 (2nd), SE 4 (3rd, lower GD), TN 0 (4th).
const NL = team("nl", "NED", "F");
const JP = team("jp", "JPN", "F");
const SE = team("se", "SWE", "F");
const TN = team("tn", "TUN", "F");
const POULE_F_TEAMS = [NL, JP, SE, TN];
function pouleFMatches(m6Status = "FINISHED"): MatchRow[] {
  return [
    gm("m1", "F", "nl", "jp", 2, 1),
    gm("m2", "F", "se", "tn", 1, 0),
    gm("m3", "F", "nl", "se", 2, 0),
    gm("m4", "F", "tn", "jp", 0, 3),
    gm("m5", "F", "jp", "se", 1, 1),
    gm("m6", "F", "tn", "nl", 0, 2, POST, m6Status),
  ];
}
// Actuals: NL goals 6, JP 5, SE 2, TN 0. Standing 1 nl, 2 jp, 3 se, 4 tn.

const emptyPreds = (id: string): ParticipantPredictions => ({
  participantId: id,
  groupMatch: [],
  teamGoals: [],
  rank: [],
  knockout: [],
});

describe("Poule F scoring (full group, double weight)", () => {
  const ctx = buildScoringContext(POULE_F_TEAMS, pouleFMatches(), LOCK);

  it("exact (5) + toto (2) + team goals (3) + full eindstand (11)", () => {
    const p: ParticipantPredictions = {
      ...emptyPreds("p1"),
      groupMatch: [
        { matchId: "m1", home: 2, away: 1 }, // exact -> 5
        { matchId: "m3", home: 1, away: 0 }, // toto (NL win) -> 2
      ],
      teamGoals: [
        { teamId: "nl", goals: 6 }, // exact -> 3
        { teamId: "jp", goals: 4 }, // wrong (actual 5) -> 0
      ],
      rank: [
        { groupLetter: "F", position: 1, teamId: "nl" },
        { groupLetter: "F", position: 2, teamId: "jp" },
        { groupLetter: "F", position: 3, teamId: "se" },
        { groupLetter: "F", position: 4, teamId: "tn" }, // all four -> 4*2 + 3 = 11
      ],
    };
    const s = scoreParticipant(p, ctx);
    expect(s.pointsGroupF).toBe(5 + 2 + 3 + 11);
    expect(s.pointsOtherGroups).toBe(0);
    expect(s.pointsTotal).toBe(21);
  });
});

describe("Only FINISHED matches count", () => {
  it("a prediction on a non-finished match scores 0", () => {
    const ctx = buildScoringContext(POULE_F_TEAMS, pouleFMatches("SCHEDULED"), LOCK);
    const p = { ...emptyPreds("p"), groupMatch: [{ matchId: "m6", home: 0, away: 2 }] }; // m6 not finished
    expect(scoreParticipant(p, ctx).pointsTotal).toBe(0);
  });
});

describe("Partial group completion (per-group + per-team gating)", () => {
  // m6 not finished -> Poule F group incomplete; NL incomplete; JP still complete.
  const ctx = buildScoringContext(POULE_F_TEAMS, pouleFMatches("SCHEDULED"), LOCK);

  it("eindstand does not score until the whole group is FINISHED", () => {
    const p: ParticipantPredictions = {
      ...emptyPreds("p"),
      rank: [
        { groupLetter: "F", position: 1, teamId: "nl" },
        { groupLetter: "F", position: 2, teamId: "jp" },
        { groupLetter: "F", position: 3, teamId: "se" },
        { groupLetter: "F", position: 4, teamId: "tn" },
      ],
    };
    expect(scoreParticipant(p, ctx).pointsGroupF).toBe(0);
  });

  it("team goals score per-team: JP (complete) scores, NL (incomplete) does not", () => {
    const p: ParticipantPredictions = {
      ...emptyPreds("p"),
      teamGoals: [
        { teamId: "jp", goals: 5 }, // JP's 3 matches all finished -> exact -> 3
        { teamId: "nl", goals: 6 }, // NL incomplete (m6 unplayed) -> 0
      ],
    };
    expect(scoreParticipant(p, ctx).pointsGroupF).toBe(3);
  });

  it("a finished match still scores while the group is incomplete", () => {
    const p = { ...emptyPreds("p"), groupMatch: [{ matchId: "m1", home: 2, away: 1 }] };
    expect(scoreParticipant(p, ctx).pointsGroupF).toBe(5);
  });
});

describe("Eligibility (kickoff < group_lock never scores)", () => {
  const A1 = team("a1", "AAA", "A");
  const A2 = team("a2", "BBB", "A");
  const A3 = team("a3", "CCC", "A");
  const A4 = team("a4", "DDD", "A");
  const matches = [
    gm("pre", "A", "a1", "a2", 1, 0, PRE), // before lock -> ineligible
    gm("post", "A", "a1", "a3", 2, 0, POST), // after lock -> eligible
  ];
  const ctx = buildScoringContext([A1, A2, A3, A4], matches, LOCK);

  it("the pre-lock match scores 0, the post-lock match scores (other group exact = 3)", () => {
    const p: ParticipantPredictions = {
      ...emptyPreds("p"),
      groupMatch: [
        { matchId: "pre", home: 1, away: 0 }, // exact but ineligible -> 0
        { matchId: "post", home: 2, away: 0 }, // exact, eligible -> 3
      ],
    };
    const s = scoreParticipant(p, ctx);
    expect(s.pointsOtherGroups).toBe(3);
  });
});

describe("Knockout aggregation", () => {
  const X = team("x", "XXX", "C");
  const Y = team("y", "YYY", "C");
  const koMatch: MatchRow = {
    id: "k75",
    stage: "R32",
    groupLetter: null,
    bracketSlot: "75",
    homeTeamId: "x",
    awayTeamId: "y",
    status: "FINISHED",
    homeScore: 2,
    awayScore: 1,
    penaltyWinnerTeamId: null,
    kickoffUtc: new Date("2026-06-30T01:00:00Z"),
  };
  const ctx = buildScoringContext([X, Y], [koMatch], LOCK);

  it("R32 winner + exact bonus lands in pointsKnockout", () => {
    const p: ParticipantPredictions = {
      ...emptyPreds("p"),
      knockout: [
        { bracketSlot: "75", homeTeamId: "x", awayTeamId: "y", homeGoals: 2, awayGoals: 1, winnerTeamId: "x" },
      ],
    };
    const s = scoreParticipant(p, ctx);
    expect(s.pointsKnockout).toBe(5); // winner 2 + exact 3
    expect(s.pointsTotal).toBe(5);
  });
});

describe("Knockout exactCount — penalty edge (one definition: needs the winner too)", () => {
  const X = team("x", "XXX", "C");
  const Y = team("y", "YYY", "C");
  // R16 tie, level 1-1 at end of play, decided on penalties by Y.
  const koMatch: MatchRow = {
    id: "k89",
    stage: "R16",
    groupLetter: null,
    bracketSlot: "89",
    homeTeamId: "x",
    awayTeamId: "y",
    status: "FINISHED",
    homeScore: 1,
    awayScore: 1,
    penaltyWinnerTeamId: "y",
    kickoffUtc: new Date("2026-07-04T21:00:00Z"),
  };
  const ctx = buildScoringContext([X, Y], [koMatch], LOCK);
  const koPred = (winnerTeamId: string): ParticipantPredictions => ({
    ...emptyPreds("p"),
    knockout: [{ bracketSlot: "89", homeTeamId: "x", awayTeamId: "y", homeGoals: 1, awayGoals: 1, winnerTeamId }],
  });

  it("correct scoreline + correct shoot-out winner -> exactCount counts", () => {
    const s = scoreParticipant(koPred("y"), ctx);
    expect(s.exactCount).toBe(1);
    expect(s.pointsKnockout).toBe(2 + 3 + 3); // matchup + winner + exact bonus
  });

  it("correct scoreline but WRONG shoot-out winner -> exactCount does NOT count", () => {
    const s = scoreParticipant(koPred("x"), ctx);
    expect(s.exactCount).toBe(0);
    expect(s.pointsKnockout).toBe(2); // matchup only; no winner, no exact bonus
  });
});

describe("Idempotency & performance", () => {
  const ctx = buildScoringContext(POULE_F_TEAMS, pouleFMatches(), LOCK);
  const base: ParticipantPredictions = {
    ...emptyPreds("seed"),
    groupMatch: [{ matchId: "m1", home: 2, away: 1 }],
    teamGoals: [{ teamId: "nl", goals: 6 }],
    rank: [
      { groupLetter: "F", position: 1, teamId: "nl" },
      { groupLetter: "F", position: 2, teamId: "jp" },
    ],
    knockout: [],
  };

  it("computeAllScores is deterministic (same input -> identical output)", () => {
    const a = computeAllScores([{ ...base, participantId: "p" }], ctx);
    const b = computeAllScores([{ ...base, participantId: "p" }], ctx);
    expect(a).toEqual(b);
  });

  it("scores 150 participants well under 2s", () => {
    const participants: ParticipantPredictions[] = Array.from({ length: 150 }, (_, i) => ({
      ...base,
      participantId: `p${i}`,
    }));
    const t0 = Date.now();
    const scores = computeAllScores(participants, ctx);
    const ms = Date.now() - t0;
    expect(scores).toHaveLength(150);
    expect(ms).toBeLessThan(2000);
  });
});
