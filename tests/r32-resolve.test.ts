import { describe, it, expect } from "vitest";
import { resolveR32FromStandings } from "@/lib/r32-resolve";
import type { StandingRow, StandingTeam } from "@/lib/standings";

const LETTERS = "ABCDEFGHIJKL".split("");

function team(letter: string, rank: number): StandingTeam {
  const code = `${letter}${rank}`;
  return { id: code, nameNl: code, fifaCode: code, crestUrl: null };
}

function row(letter: string, rank: number, points: number): StandingRow {
  return {
    team: team(letter, rank),
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points,
    rank,
    decidedByLots: false,
  };
}

/** 12 complete groups, each pre-sorted rank 1..4. Distinct points per group keep
 *  the cross-group 3rd-place ranking deterministic. */
function fullStandings(): Record<string, StandingRow[]> {
  const gs: Record<string, StandingRow[]> = {};
  LETTERS.forEach((letter, gi) => {
    gs[letter] = [1, 2, 3, 4].map((r) => row(letter, r, (4 - r) * 10 + (LETTERS.length - gi)));
  });
  return gs;
}

describe("resolveR32FromStandings", () => {
  it("resolves all 16 ties from complete standings", () => {
    const { assignments, complete } = resolveR32FromStandings(fullStandings());
    expect(complete).toBe(true);
    expect(assignments).toHaveLength(16);
    const slots = assignments.map((a) => a.bracketSlot).sort((a, b) => Number(a) - Number(b));
    expect(slots).toEqual(Array.from({ length: 16 }, (_, i) => String(73 + i)));
  });

  it("maps the direct (1X/2X) slot sources to the right group ranks", () => {
    const { assignments } = resolveR32FromStandings(fullStandings());
    const bySlot = Object.fromEntries(assignments.map((a) => [a.bracketSlot, a]));
    // slot 73 = home 2A vs away 2B; slot 75 = 1F vs 2C; slot 88 = 2D vs 2G.
    expect(bySlot["73"]).toMatchObject({ homeTeamId: "A2", awayTeamId: "B2" });
    expect(bySlot["75"]).toMatchObject({ homeTeamId: "F1", awayTeamId: "C2" });
    expect(bySlot["88"]).toMatchObject({ homeTeamId: "D2", awayTeamId: "G2" });
  });

  it("fills every best-3rd slot with a real 3rd-placed team", () => {
    const { assignments } = resolveR32FromStandings(fullStandings());
    const bySlot = Object.fromEntries(assignments.map((a) => [a.bracketSlot, a]));
    // The 8 slots fed by a 3rd-placed team (away source "3:..."): 74,77,79,80,81,82,85,87.
    for (const slot of ["74", "77", "79", "80", "81", "82", "85", "87"]) {
      expect(bySlot[slot].awayTeamId).toMatch(/^[A-L]3$/); // a real "<group>3" team
    }
  });

  it("is not complete when groups are missing", () => {
    const partial = fullStandings();
    delete partial["L"];
    delete partial["K"];
    const { complete, assignments } = resolveR32FromStandings(partial);
    expect(complete).toBe(false);
    expect(assignments.length).toBeLessThan(16);
  });
});
