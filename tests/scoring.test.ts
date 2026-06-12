import { describe, it, expect } from "vitest";
import {
  outcome,
  scoreGroupMatch,
  scoreTeamGoals,
  scoreGroupRank,
  actualWinnerId,
  scoreKnockoutMatch,
  type KnockoutPred,
  type KnockoutActual,
} from "../src/lib/scoring";

describe("outcome", () => {
  it("classifies home/draw/away", () => {
    expect(outcome(2, 0)).toBe("H");
    expect(outcome(1, 1)).toBe("D");
    expect(outcome(0, 3)).toBe("A");
  });
});

describe("scoreGroupMatch — Poule F (5/2) vs other (3/1), highest bracket only", () => {
  it("Poule F exact = 5", () => {
    expect(scoreGroupMatch({ home: 2, away: 1 }, { home: 2, away: 1 }, true)).toBe(5);
  });
  it("Poule F correct toto only = 2 (not 5, not 5+2)", () => {
    expect(scoreGroupMatch({ home: 3, away: 1 }, { home: 2, away: 1 }, true)).toBe(2);
  });
  it("Poule F wrong = 0", () => {
    expect(scoreGroupMatch({ home: 0, away: 1 }, { home: 2, away: 1 }, true)).toBe(0);
  });
  it("other group exact = 3, toto = 1, wrong = 0", () => {
    expect(scoreGroupMatch({ home: 1, away: 0 }, { home: 1, away: 0 }, false)).toBe(3);
    expect(scoreGroupMatch({ home: 2, away: 0 }, { home: 1, away: 0 }, false)).toBe(1);
    expect(scoreGroupMatch({ home: 0, away: 0 }, { home: 1, away: 0 }, false)).toBe(0);
  });
});

describe("scoreTeamGoals — exact total or 0", () => {
  it("exact = 3", () => expect(scoreTeamGoals(4, 4)).toBe(3));
  it("off by one = 0", () => expect(scoreTeamGoals(3, 4)).toBe(0));
});

describe("scoreGroupRank — strict positional", () => {
  const actual = { 1: "a", 2: "b", 3: "c", 4: "d" };

  it("Poule F all four correct = 4*2 + 3 bonus = 11", () => {
    expect(scoreGroupRank({ 1: "a", 2: "b", 3: "c", 4: "d" }, actual, true)).toBe(11);
  });
  it("Poule F three correct, one wrong = 6 (no bonus)", () => {
    expect(scoreGroupRank({ 1: "a", 2: "b", 3: "c", 4: "x" }, actual, true)).toBe(6);
  });
  it("Poule F partial (two filled, both correct) = 4 (no bonus)", () => {
    expect(scoreGroupRank({ 1: "a", 2: "b" }, actual, true)).toBe(4);
  });
  it("Poule F strict: right team wrong position scores 0 for that slot", () => {
    // predicting 'b' first (b is actually 2nd) → pos1 wrong.
    expect(scoreGroupRank({ 1: "b", 2: "a", 3: "c", 4: "d" }, actual, true)).toBe(4); // only pos3,pos4 right
  });
  it("other group nr.1 + nr.2 = 2+2, only positions 1/2 count", () => {
    expect(scoreGroupRank({ 1: "a", 2: "b" }, actual, false)).toBe(4);
    expect(scoreGroupRank({ 1: "a" }, actual, false)).toBe(2);
    expect(scoreGroupRank({ 1: "x", 2: "b" }, actual, false)).toBe(2);
    expect(scoreGroupRank({ 1: "a", 2: "b", 3: "c", 4: "d" }, actual, false)).toBe(4); // pos3/4 ignored
  });
});

describe("actualWinnerId — official result incl. shoot-out", () => {
  const base = { homeTeamId: "h", awayTeamId: "a", penaltyWinnerTeamId: null as string | null };
  it("home win", () => expect(actualWinnerId({ ...base, homeScore: 2, awayScore: 1 })).toBe("h"));
  it("away win", () => expect(actualWinnerId({ ...base, homeScore: 0, awayScore: 1 })).toBe("a"));
  it("draw → shoot-out winner", () =>
    expect(actualWinnerId({ ...base, homeScore: 1, awayScore: 1, penaltyWinnerTeamId: "a" })).toBe("a"));
});

describe("scoreKnockoutMatch", () => {
  const actual = (over: Partial<KnockoutActual> = {}): KnockoutActual => ({
    homeTeamId: "x",
    awayTeamId: "y",
    homeScore: 2,
    awayScore: 1,
    winnerId: "x",
    ...over,
  });
  const pred = (over: Partial<KnockoutPred> = {}): KnockoutPred => ({
    homeTeamId: "x",
    awayTeamId: "y",
    homeGoals: 2,
    awayGoals: 1,
    winnerTeamId: "x",
    ...over,
  });

  it("R32: winner only = 2; winner + exact = 5; no matchup at R32", () => {
    expect(scoreKnockoutMatch(pred({ homeGoals: 3, awayGoals: 1 }), actual(), "R32")).toEqual({
      matchup: 0,
      winner: 2,
      exactBonus: 0,
      total: 2,
    });
    expect(scoreKnockoutMatch(pred(), actual(), "R32")).toEqual({ matchup: 0, winner: 2, exactBonus: 3, total: 5 });
  });

  it("R16 perfect: matchup 2 + winner 3 + exact 3 = 8", () => {
    expect(scoreKnockoutMatch(pred(), actual(), "R16")).toEqual({ matchup: 2, winner: 3, exactBonus: 3, total: 8 });
  });

  it("R16 matchup-correct-but-winner-wrong = matchup only (2)", () => {
    // both teams right, but predicted the loser 'y' to win.
    expect(scoreKnockoutMatch(pred({ winnerTeamId: "y" }), actual(), "R16")).toEqual({
      matchup: 2,
      winner: 0,
      exactBonus: 0,
      total: 2,
    });
  });

  it("winner not in the real tie = 0 everywhere", () => {
    expect(scoreKnockoutMatch(pred({ homeTeamId: "p", awayTeamId: "q", winnerTeamId: "p" }), actual(), "R16")).toEqual({
      matchup: 0,
      winner: 0,
      exactBonus: 0,
      total: 0,
    });
  });

  it("draw + shoot-out: exact bonus uses the drawn end-of-play score, winner = shoot-out winner", () => {
    const a = actual({ homeScore: 1, awayScore: 1, winnerId: "y" }); // drawn 1-1, y wins on pens
    // correct: predicted 1-1 with y as winner
    expect(scoreKnockoutMatch(pred({ homeGoals: 1, awayGoals: 1, winnerTeamId: "y" }), a, "R16")).toEqual({
      matchup: 2,
      winner: 3,
      exactBonus: 3,
      total: 8,
    });
    // wrong shoot-out winner: score still drawn-correct but winner wrong → no winner, no exact bonus
    expect(scoreKnockoutMatch(pred({ homeGoals: 1, awayGoals: 1, winnerTeamId: "x" }), a, "R16")).toEqual({
      matchup: 2,
      winner: 0,
      exactBonus: 0,
      total: 2,
    });
  });

  it("exact bonus is orientation-independent (per-team goals)", () => {
    // Actual: x 2 – y 1 (x home). Prediction lists y as home, x as away, but goals per team match.
    const p = pred({ homeTeamId: "y", awayTeamId: "x", homeGoals: 1, awayGoals: 2, winnerTeamId: "x" });
    expect(scoreKnockoutMatch(p, actual(), "QF")).toEqual({ matchup: 3, winner: 4, exactBonus: 4, total: 11 });
  });
});
