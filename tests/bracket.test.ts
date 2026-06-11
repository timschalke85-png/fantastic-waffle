import { describe, it, expect } from "vitest";
import { assignBracketSlots, fifaMatchNumber } from "../src/lib/bracket";
import { KO_SCHEDULE } from "../prisma/data/ko-schedule";
import type { ProviderMatch } from "../src/lib/adapters/types";

type M = Pick<ProviderMatch, "apiMatchId" | "stage" | "kickoffUtc">;
const m = (apiMatchId: number, stage: ProviderMatch["stage"], kickoffUtc: string): M => ({
  apiMatchId,
  stage,
  kickoffUtc,
});

describe("fifaMatchNumber", () => {
  it("returns null for group matches", () => {
    expect(fifaMatchNumber(m(1, "GROUP", "2026-06-11T19:00:00Z"))).toBeNull();
  });

  it("maps knockout matches to FIFA numbers by (stage, kickoff), NOT by kickoff order", () => {
    // On 29 June, match 76 kicks off (17:00Z) BEFORE 74 (20:30Z), and 75 is the
    // next day (01:00Z) — so number order is not kickoff order.
    expect(fifaMatchNumber(m(101, "R32", "2026-06-29T17:00:00Z"))).toBe(76);
    expect(fifaMatchNumber(m(102, "R32", "2026-06-29T20:30:00Z"))).toBe(74);
    expect(fifaMatchNumber(m(103, "R32", "2026-06-30T01:00:00Z"))).toBe(75);
    // last/first overall
    expect(fifaMatchNumber(m(104, "R32", "2026-06-28T19:00:00Z"))).toBe(73);
    expect(fifaMatchNumber(m(105, "FINAL", "2026-07-19T19:00:00Z"))).toBe(104);
  });

  it("tolerates non-normalized kickoff strings (ms / +00:00)", () => {
    expect(fifaMatchNumber(m(1, "R32", "2026-06-28T19:00:00.000Z"))).toBe(73);
    expect(fifaMatchNumber(m(1, "R32", "2026-06-28T19:00:00+00:00"))).toBe(73);
  });

  it("throws on an unrecognized knockout kickoff (never guesses)", () => {
    expect(() => fifaMatchNumber(m(1, "R32", "2026-06-28T18:00:00Z"))).toThrow();
  });
});

describe("assignBracketSlots", () => {
  it("assigns the FIFA match number as the bracket_slot string; null for group", () => {
    const slots = assignBracketSlots([
      m(10, "GROUP", "2026-06-11T19:00:00Z"),
      m(11, "R32", "2026-06-29T17:00:00Z"),
      m(12, "FINAL", "2026-07-19T19:00:00Z"),
    ]);
    expect(slots.get(10)).toBeNull();
    expect(slots.get(11)).toBe("76");
    expect(slots.get(12)).toBe("104");
  });

  it("maps the full canonical schedule bijectively onto 73–104", () => {
    const matches = KO_SCHEDULE.map((e, i) => m(1000 + i, e.stage, e.kickoffUtc));
    const slots = assignBracketSlots(matches);
    const numbers = [...slots.values()].map(Number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 32 }, (_, i) => 73 + i));
  });

  it("throws if two matches resolve to the same FIFA number", () => {
    expect(() =>
      assignBracketSlots([
        m(1, "R32", "2026-06-28T19:00:00Z"),
        m(2, "R32", "2026-06-28T19:00:00.000Z"),
      ]),
    ).toThrow(/73/);
  });
});
