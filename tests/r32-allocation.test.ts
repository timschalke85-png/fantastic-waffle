import { describe, it, expect } from "vitest";
import {
  R32_SLOTS,
  WINNER_TO_SLOT,
  THIRD_PLACE_COMBINATIONS,
  resolveThirdPlaceSlots,
} from "../prisma/data/r32-allocation";

// Pools per winner-slot, used to cross-validate every combination assignment.
const POOL_BY_SLOT = Object.fromEntries(
  R32_SLOTS.filter((s) => s.thirdPlacePool).map((s) => [s.bracketSlot, s.thirdPlacePool!.pool]),
);

describe("R32_SLOTS (FIFA-sourced, cross-checked)", () => {
  it("has 16 slots for FIFA matches 73–88", () => {
    expect(R32_SLOTS).toHaveLength(16);
    expect(R32_SLOTS.map((s) => s.matchNumber)).toEqual(
      Array.from({ length: 16 }, (_, i) => 73 + i),
    );
  });

  it("has unique bracket slots", () => {
    expect(new Set(R32_SLOTS.map((s) => s.bracketSlot)).size).toBe(16);
  });

  it("R32 slot 75 = 1F vs 2C (Group F winner), and slot 76 = 1C vs 2F (Group F runner-up)", () => {
    const s75 = R32_SLOTS.find((s) => s.bracketSlot === "75");
    expect(s75?.homeSource).toBe("1F");
    expect(s75?.awaySource).toBe("2C");
    const s76 = R32_SLOTS.find((s) => s.bracketSlot === "76");
    expect(s76?.homeSource).toBe("1C");
    expect(s76?.awaySource).toBe("2F");
  });

  it("uses the FIFA match number as the bracket_slot string", () => {
    for (const s of R32_SLOTS) expect(s.bracketSlot).toBe(String(s.matchNumber));
  });

  it("has exactly 8 third-place slots, away source always the 3rd", () => {
    const thirds = R32_SLOTS.filter((s) => s.thirdPlacePool);
    expect(thirds).toHaveLength(8);
    for (const s of thirds) {
      expect(s.awaySource.startsWith("3:")).toBe(true);
      expect(s.homeSource).toBe(`1${s.thirdPlacePool!.winner}`);
    }
  });

  it("maps each winner to the right slot (FIFA match number)", () => {
    expect(WINNER_TO_SLOT).toMatchObject({
      A: "79", B: "85", D: "81", E: "74",
      G: "82", I: "77", K: "87", L: "80",
    });
  });
});

describe("THIRD_PLACE_COMBINATIONS (495, FIFA Annex C)", () => {
  it("has exactly 495 unique group-sets", () => {
    expect(THIRD_PLACE_COMBINATIONS).toHaveLength(495);
    expect(new Set(THIRD_PLACE_COMBINATIONS.map((c) => c.groupsKey)).size).toBe(495);
  });

  it("every combination assigns 8 third-placed teams, each within its slot's pool", () => {
    for (const c of THIRD_PLACE_COMBINATIONS) {
      const entries = Object.entries(c.assignment);
      expect(entries).toHaveLength(8);
      // assigned groups are exactly the qualifying group-set
      expect([...Object.values(c.assignment)].sort().join("")).toBe(c.groupsKey);
      for (const [slot, group] of entries) {
        expect(POOL_BY_SLOT[slot]).toContain(group);
      }
    }
  });

  it("each group-set is 8 distinct letters A–L", () => {
    for (const c of THIRD_PLACE_COMBINATIONS) {
      expect(c.groupsKey).toMatch(/^[A-L]{8}$/);
      expect(new Set(c.groupsKey).size).toBe(8);
    }
  });
});

describe("resolveThirdPlaceSlots", () => {
  it("resolves a known combination (E,F,G,H,I,J,K,L)", () => {
    const a = resolveThirdPlaceSlots(["E", "F", "G", "H", "I", "J", "K", "L"]);
    // From FIFA Annex C row 1 (verified by scripts/parse-r32.ts). Keys are FIFA
    // match numbers: 74=1E, 77=1I, 79=1A, 80=1L, 81=1D, 82=1G, 85=1B, 87=1K.
    expect(a).toMatchObject({
      "74": "F", "77": "G", "79": "E", "80": "K",
      "81": "I", "82": "H", "85": "J", "87": "L",
    });
  });

  it("is order-insensitive", () => {
    const a = resolveThirdPlaceSlots(["L", "K", "J", "I", "H", "G", "F", "E"]);
    const b = resolveThirdPlaceSlots(["E", "F", "G", "H", "I", "J", "K", "L"]);
    expect(a).toEqual(b);
  });

  it("rejects an invalid number of groups", () => {
    expect(() => resolveThirdPlaceSlots(["A", "B", "C"])).toThrow();
    expect(() => resolveThirdPlaceSlots(["A", "B", "C", "D", "E", "F", "G", "H", "I"])).toThrow();
  });

  it("rejects a non-existent letter", () => {
    expect(() => resolveThirdPlaceSlots(["A", "B", "C", "D", "E", "F", "G", "Z"])).toThrow();
  });
});
