import { describe, it, expect } from "vitest";
import { KO_FEEDERS } from "../prisma/data/ko-bracket";
import {
  resolveTie,
  validateKnockoutPicks,
  downstreamOf,
  type R32Teams,
  type Picks,
} from "../src/lib/knockout-bracket";

describe("KO_FEEDERS structure", () => {
  it("covers exactly slots 89–104", () => {
    expect(Object.keys(KO_FEEDERS).map(Number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => 89 + i),
    );
  });

  it("consumes every R32 winner (73–88) exactly once in the R16", () => {
    const r16Feeders = [89, 90, 91, 92, 93, 94, 95, 96].flatMap((s) => [KO_FEEDERS[s].home, KO_FEEDERS[s].away]);
    const fromR32 = r16Feeders.filter((f) => f.match >= 73 && f.match <= 88);
    expect(fromR32.every((f) => f.result === "W")).toBe(true);
    expect([...new Set(fromR32.map((f) => f.match))].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, i) => 73 + i),
    );
  });

  it("feeds the third-place play-off from the two SF losers and the final from the two SF winners", () => {
    expect(KO_FEEDERS[103]).toEqual({ home: { result: "L", match: 101 }, away: { result: "L", match: 102 } });
    expect(KO_FEEDERS[104]).toEqual({ home: { result: "W", match: 101 }, away: { result: "W", match: 102 } });
  });
});

describe("resolveTie", () => {
  // Minimal real R32 base for the slots feeding R16 match 90 (W73 v W75).
  const r32: R32Teams = {
    73: { home: "a", away: "b" },
    75: { home: "c", away: "d" },
  };

  it("returns the real teams for an R32 slot", () => {
    expect(resolveTie(73, r32, {})).toEqual({ home: "a", away: "b" });
  });

  it("propagates the picked winners into the downstream R16 tie", () => {
    const picks: Picks = { 73: "a", 75: "d" };
    expect(resolveTie(90, r32, picks)).toEqual({ home: "a", away: "d" });
  });

  it("leaves a downstream team null until its feeder is predicted", () => {
    expect(resolveTie(90, r32, { 73: "a" })).toEqual({ home: "a", away: null });
  });
});

describe("validateKnockoutPicks", () => {
  const r32: R32Teams = {
    73: { home: "a", away: "b" },
    75: { home: "c", away: "d" },
  };

  it("accepts a consistent chain", () => {
    const picks: Picks = { 73: "a", 75: "c", 90: "a" }; // 90 = a v c, winner a ✓
    expect(validateKnockoutPicks(r32, picks).ok).toBe(true);
  });

  it("rejects an R32 winner who isn't in the real tie", () => {
    const res = validateKnockoutPicks(r32, { 73: "zz" });
    expect(res.ok).toBe(false);
    expect(res.violations[0].slot).toBe(73);
  });

  it("rejects a downstream winner not present under the user's own picks", () => {
    // 90 = a v c (from picks 73:a, 75:c); predicting d to win 90 is impossible.
    const res = validateKnockoutPicks(r32, { 73: "a", 75: "c", 90: "d" });
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.slot === 90)).toBe(true);
  });
});

describe("downstreamOf", () => {
  it("walks the full chain from an R32 slot to the final", () => {
    // 73 -> 90 -> 97 -> 101 -> {103,104}
    expect(downstreamOf(73)).toEqual([90, 97, 101, 103, 104]);
  });

  it("a semi-final feeds both the final and the third-place play-off", () => {
    expect(downstreamOf(101)).toEqual([103, 104]);
  });
});
