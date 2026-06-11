import { describe, it, expect } from "vitest";
import { computeStandings, rankThirdPlaced, type StandingTeam, type FinishedMatch } from "../src/lib/standings";

const team = (id: string, code: string): StandingTeam => ({ id, nameNl: id, fifaCode: code });
const A = team("a", "AAA");
const B = team("b", "BBB");
const C = team("c", "CCC");
const D = team("d", "DDD");
const match = (h: StandingTeam, a: StandingTeam, hs: number, as: number): FinishedMatch => ({
  homeTeamId: h.id,
  awayTeamId: a.id,
  homeScore: hs,
  awayScore: as,
});

const order = (rows: { team: StandingTeam }[]) => rows.map((r) => r.team.id);

describe("computeStandings", () => {
  it("ranks by points first", () => {
    const rows = computeStandings([A, B, C], [match(A, B, 1, 0), match(A, C, 1, 0), match(B, C, 1, 0)]);
    expect(order(rows)).toEqual(["a", "b", "c"]);
    expect(rows[0].points).toBe(6);
  });

  it("breaks a points tie by goal difference", () => {
    // P=a beats R=c 1-0 (GD+1); Q=b beats R=c 3-0 (GD+3). Equal points (3).
    const rows = computeStandings([A, B, C], [match(A, C, 1, 0), match(B, C, 3, 0)]);
    expect(order(rows)).toEqual(["b", "a", "c"]); // b ahead on GD
    expect(rows[0].goalDiff).toBe(3);
  });

  it("breaks a points+GD tie by goals scored", () => {
    // a beats c 3-1 (GD+2, GF3); b beats c 2-0 (GD+2, GF2). Equal points & GD.
    const rows = computeStandings([A, B, C], [match(A, C, 3, 1), match(B, C, 2, 0)]);
    expect(order(rows)).toEqual(["a", "b", "c"]); // a ahead on goals scored
  });

  it("breaks a points+GD+goals tie by head-to-head", () => {
    // Full round robin. a and b both finish 6/+2/4; a beat b head-to-head -> a first.
    // d also has 6/+2 but only 3 goals -> separated by the goals-scored criterion.
    const matches = [
      match(A, B, 1, 0),
      match(A, C, 3, 0),
      match(D, A, 2, 0),
      match(B, C, 3, 1),
      match(B, D, 1, 0),
      match(D, C, 1, 0),
    ];
    const rows = computeStandings([A, B, C, D], matches);
    expect(order(rows)).toEqual(["a", "b", "d", "c"]);
    // a and b: identical points/GD/goals, separated by head-to-head (not lots)
    expect(rows[0].points).toBe(6);
    expect(rows[1].points).toBe(6);
    expect(rows[0].goalDiff).toBe(rows[1].goalDiff);
    expect(rows[0].goalsFor).toBe(rows[1].goalsFor);
    expect(rows[0].decidedByLots).toBe(false);
    expect(rows[1].decidedByLots).toBe(false);
    // d separated by goals scored (3 < 4), also not by lots
    expect(rows[2].team.id).toBe("d");
    expect(rows[2].decidedByLots).toBe(false);
  });

  it("falls back to lots (deterministic by FIFA code) when fully tied, and flags it", () => {
    const rows = computeStandings([D, C, A, B], []); // no matches -> everyone 0/0/0
    expect(order(rows)).toEqual(["a", "b", "c", "d"]); // AAA < BBB < CCC < DDD
    expect(rows.every((r) => r.decidedByLots)).toBe(true);
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("assigns 1-based ranks", () => {
    const rows = computeStandings([A, B], [match(A, B, 2, 0)]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });
});

describe("rankThirdPlaced", () => {
  it("ranks third-placed teams by points, GD, goals; top 8 qualify", () => {
    // 12 third-placed teams with descending points; check the 8/4 split.
    const thirds = Array.from({ length: 12 }, (_, i) => ({
      groupLetter: String.fromCharCode(65 + i),
      row: {
        team: team(`t${i}`, `T${i}`),
        played: 3,
        won: 1,
        drawn: 0,
        lost: 2,
        goalsFor: 12 - i,
        goalsAgainst: 0,
        goalDiff: 12 - i,
        points: 12 - i, // strictly descending -> unambiguous order
        rank: 3,
        decidedByLots: false,
      },
    }));
    const ranked = rankThirdPlaced(thirds);
    expect(ranked).toHaveLength(12);
    expect(ranked.slice(0, 8).every((r) => r.qualifies)).toBe(true);
    expect(ranked.slice(8).every((r) => !r.qualifies)).toBe(true);
    expect(ranked[0].row.points).toBe(12);
  });

  it("uses GD then goals then lots for equal points", () => {
    const mk = (code: string, pts: number, gdv: number, gf: number) => ({
      groupLetter: code,
      row: {
        team: team(code.toLowerCase(), code),
        played: 3, won: 0, drawn: 0, lost: 0,
        goalsFor: gf, goalsAgainst: gf - gdv, goalDiff: gdv, points: pts,
        rank: 3, decidedByLots: false,
      },
    });
    const ranked = rankThirdPlaced([mk("AAA", 3, 0, 2), mk("BBB", 3, 2, 2), mk("CCC", 3, 0, 5)]);
    // BBB (GD+2) first; then CCC (GD0, GF5) ahead of AAA (GD0, GF2)
    expect(ranked.map((r) => r.row.team.fifaCode)).toEqual(["BBB", "CCC", "AAA"]);
  });
});
