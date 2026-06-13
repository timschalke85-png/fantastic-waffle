import { describe, it, expect } from "vitest";
import {
  R32_SLOTS,
  r32TeamsFromMatches,
  isR32Complete,
  picksFromRows,
  type R32MatchRow,
  type KnockoutPickRow,
} from "../src/lib/knockout";

describe("r32TeamsFromMatches", () => {
  it("builds R32Teams from complete R32 rows", () => {
    const rows: R32MatchRow[] = [
      { bracketSlot: "73", homeTeamId: "a", awayTeamId: "b" },
      { bracketSlot: "88", homeTeamId: "c", awayTeamId: "d" },
    ];
    expect(r32TeamsFromMatches(rows)).toEqual({
      73: { home: "a", away: "b" },
      88: { home: "c", away: "d" },
    });
  });

  it("skips rows with an unknown team or no slot", () => {
    const rows: R32MatchRow[] = [
      { bracketSlot: "73", homeTeamId: "a", awayTeamId: null }, // away unknown
      { bracketSlot: null, homeTeamId: "a", awayTeamId: "b" }, // no slot
      { bracketSlot: "74", homeTeamId: "x", awayTeamId: "y" }, // valid
    ];
    expect(r32TeamsFromMatches(rows)).toEqual({ 74: { home: "x", away: "y" } });
  });

  it("ignores non-R32 slots (e.g. an R16 match)", () => {
    const rows: R32MatchRow[] = [{ bracketSlot: "89", homeTeamId: "a", awayTeamId: "b" }];
    expect(r32TeamsFromMatches(rows)).toEqual({});
  });
});

describe("isR32Complete", () => {
  it("is true only when all 16 ties are known", () => {
    const full = Object.fromEntries(R32_SLOTS.map((s) => [s, { home: `h${s}`, away: `a${s}` }]));
    expect(isR32Complete(full)).toBe(true);
  });

  it("is false while any tie is missing", () => {
    const full = Object.fromEntries(R32_SLOTS.map((s) => [s, { home: `h${s}`, away: `a${s}` }]));
    delete full[80];
    expect(isR32Complete(full)).toBe(false);
    expect(isR32Complete({})).toBe(false);
  });
});

describe("picksFromRows", () => {
  it("maps a winner to a numeric-keyed pick", () => {
    const rows: KnockoutPickRow[] = [
      { bracketSlot: "73", winnerTeamId: "a" },
      { bracketSlot: "90", winnerTeamId: "c" },
    ];
    expect(picksFromRows(rows)).toEqual({ 73: "a", 90: "c" });
  });

  it("omits rows without a winner (score-only / empty)", () => {
    const rows: KnockoutPickRow[] = [
      { bracketSlot: "73", winnerTeamId: null },
      { bracketSlot: "74", winnerTeamId: "b" },
    ];
    expect(picksFromRows(rows)).toEqual({ 74: "b" });
  });
});
