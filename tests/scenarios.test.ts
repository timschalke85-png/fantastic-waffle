import { describe, it, expect } from "vitest";
import {
  summariseGroupF,
  nlR32Path,
  projectR32,
  type ScenarioMatch,
} from "../src/lib/scenarios";
import type { StandingRow, StandingTeam } from "../src/lib/standings";

const team = (id: string, code: string): StandingTeam => ({ id, nameNl: id, fifaCode: code });
const NL = team("nl", "NED");
const JP = team("jp", "JPN");
const SE = team("se", "SWE");
const TN = team("tn", "TUN");
const POULE_F = [NL, JP, SE, TN];

// Helper: a finished or remaining ScenarioMatch.
const fin = (h: StandingTeam, a: StandingTeam, hs: number, as: number): ScenarioMatch => ({
  id: `${h.id}-${a.id}`,
  homeId: h.id,
  awayId: a.id,
  homeScore: hs,
  awayScore: as,
  finished: true,
});
const rem = (h: StandingTeam, a: StandingTeam): ScenarioMatch => ({
  id: `${h.id}-${a.id}`,
  homeId: h.id,
  awayId: a.id,
  homeScore: null,
  awayScore: null,
  finished: false,
});

// Minimal StandingRow factory for projection/path tests.
const row = (t: StandingTeam, rank: number, pts = 0, gd = 0, gf = 0): StandingRow => ({
  team: t,
  played: 3,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: gf,
  goalsAgainst: gf - gd,
  goalDiff: gd,
  points: pts,
  rank,
  decidedByLots: false,
});

describe("summariseGroupF", () => {
  it("with nothing played, every position is possible and ties depend on doelsaldo", () => {
    const matches = [
      rem(NL, JP),
      rem(SE, TN),
      rem(NL, SE),
      rem(TN, JP),
      rem(JP, SE),
      rem(TN, NL),
    ];
    const s = summariseGroupF(POULE_F, matches, NL.id);
    expect(s.remainingCount).toBe(6);
    expect(s.position[1]).toBe("mogelijk");
    expect(s.position[4]).toBe("mogelijk");
    expect(s.advancementGuaranteed).toBe(false);
    expect(s.eliminationPossible).toBe(true);
    expect(s.tieDependent).toBe(true);
  });

  it("pins an exact position when all matches are finished and points are unique", () => {
    // NL 9, JP 6, SE 3, TN 0 -> NL first, no ties.
    const matches = [
      fin(NL, JP, 1, 0),
      fin(NL, SE, 1, 0),
      fin(TN, NL, 0, 1),
      fin(JP, SE, 1, 0),
      fin(JP, TN, 1, 0),
      fin(SE, TN, 1, 0),
    ];
    const s = summariseGroupF(POULE_F, matches, NL.id);
    expect(s.remainingCount).toBe(0);
    expect(s.position[1]).toBe("zeker");
    expect(s.position[2]).toBe("uitgesloten");
    expect(s.position[4]).toBe("uitgesloten");
    expect(s.advancementGuaranteed).toBe(true);
    expect(s.eliminationPossible).toBe(false);
    expect(s.tieDependent).toBe(false);
  });

  it("reports guaranteed advancement once Nederland clinches top 2 with one match left", () => {
    // After two rounds: NL 6 (won both), JP 3, SE 3, TN 0. One match left: JP-SE.
    // NL can be caught to at most 6 by one of JP/SE, but never overtaken on points
    // beyond rank 2 -> worstRank stays <= 2 in every outcome.
    const matches = [
      fin(NL, JP, 1, 0),
      fin(NL, SE, 1, 0),
      fin(TN, SE, 0, 1), // SE -> 3
      fin(TN, JP, 0, 1), // JP -> 3
      fin(TN, NL, 0, 1), // already counted NL? no: gives NL a 3rd win -> NL 9
      rem(JP, SE),
    ];
    const s = summariseGroupF(POULE_F, matches, NL.id);
    expect(s.advancementGuaranteed).toBe(true);
    expect(s.position[1]).toBe("zeker"); // NL on 9, max anyone else reaches is 6
    expect(s.position[3]).toBe("uitgesloten");
    expect(s.eliminationPossible).toBe(false);
  });
});

describe("nlR32Path", () => {
  // Other groups: give C a clear winner and runner-up so opponents resolve.
  const cWinner = team("c1", "BRA");
  const cRunner = team("c2", "MAR");
  const otherStandings: Record<string, StandingRow[]> = {
    C: [row(cWinner, 1, 9), row(cRunner, 2, 6), row(team("c3", "CCC"), 3, 3), row(team("c4", "DDD"), 4, 0)],
  };
  const fStandings = [row(NL, 1, 9), row(JP, 2, 6), row(SE, 3, 3), row(TN, 4, 0)];

  it("1st place -> FIFA match 75 against runner-up of Poule C", () => {
    const r = nlR32Path(1, fStandings, otherStandings);
    expect(r.matchNumber).toBe(75);
    expect(r.slot).toBe("75");
    expect(r.qualifies).toBe(true);
    expect(r.opponent?.team?.fifaCode).toBe("MAR");
    expect(r.conditional).toBe(false);
  });

  it("2nd place -> FIFA match 76 against the winner of Poule C", () => {
    const r = nlR32Path(2, fStandings, otherStandings);
    expect(r.matchNumber).toBe(76);
    expect(r.opponent?.team?.fifaCode).toBe("BRA");
  });

  it("4th place -> not qualified, no slot", () => {
    const r = nlR32Path(4, fStandings, otherStandings);
    expect(r.qualifies).toBe(false);
    expect(r.slot).toBeNull();
  });
});

describe("projectR32", () => {
  // Build all 12 groups with deterministic, strictly-separated standings so the
  // projection is unambiguous: group winner has 9 pts, runner-up 6, 3rd 3, 4th 0,
  // and 3rd-place points descend A..L so the best-8 set is exactly A..H.
  const groupStandings: Record<string, StandingRow[]> = {};
  const letters = "ABCDEFGHIJKL".split("");
  letters.forEach((L, i) => {
    groupStandings[L] = [
      row(team(`${L}1`, `${L}W`), 1, 9, 5, 8),
      row(team(`${L}2`, `${L}R`), 2, 6, 2, 5),
      row(team(`${L}3`, `${L}T`), 3, 3, 0, 4 - i * 0.0), // points decide; keep equal GD
      row(team(`${L}4`, `${L}F`), 4, 0, -5, 1),
    ];
    // Make 3rd-place points strictly descending A..L to fix the best-8 set.
    groupStandings[L][2].points = 12 - i;
  });

  it("resolves a non-3rd slot directly from the group table", () => {
    const bracket = projectR32(groupStandings);
    // FIFA match 73: home 2A, away 2B.
    const m73 = bracket.find((s) => s.matchNumber === 73)!;
    expect(m73.home.team?.fifaCode).toBe("AR"); // runner-up A
    expect(m73.away.team?.fifaCode).toBe("BR"); // runner-up B
    // FIFA match 75: home 1F, away 2C.
    const m75 = bracket.find((s) => s.matchNumber === 75)!;
    expect(m75.home.team?.fifaCode).toBe("FW");
    expect(m75.away.team?.fifaCode).toBe("CR");
  });

  it("fills every best-3rd slot with an actual nr. 3 team", () => {
    const bracket = projectR32(groupStandings);
    const thirdSlots = bracket.filter((s) => s.home.label.startsWith("Nummer 3") || s.away.label.startsWith("Nummer 3"));
    expect(thirdSlots.length).toBe(8); // eight slots are fed by a 3rd-placed team
    for (const s of thirdSlots) {
      const ref = s.home.label.startsWith("Nummer 3") ? s.home : s.away;
      expect(ref.team).not.toBeNull();
      expect(ref.team?.fifaCode).toMatch(/T$/); // a "*T" = third-placed team
    }
  });

  it("returns all 16 R32 slots sorted by match number", () => {
    const bracket = projectR32(groupStandings);
    expect(bracket).toHaveLength(16);
    expect(bracket.map((s) => s.matchNumber)).toEqual(
      Array.from({ length: 16 }, (_, i) => 73 + i),
    );
  });
});
