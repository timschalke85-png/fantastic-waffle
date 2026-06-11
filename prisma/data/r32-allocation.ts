// Round-of-32 allocation — STATIC SEED DATA (CLAUDE.md Hard rule 1).
//
// Source 1 (official): FIFA World Cup 26 Match Schedule (PDF, FIFA DigitalHub)
//   and FIFA WC2026 Regulations Annex C (495 third-place combinations).
// Source 2 (cross-check): Wikipedia "2026 FIFA World Cup knockout stage"
//   (R32 list + Template:2026 FIFA World Cup third-place table).
//
// Cross-check performed in Fase 1: all 16 R32 slot sources and all 8 third-place
// pools agree between the FIFA Match Schedule and Wikipedia. The 495 combinations
// were parsed from the Wikipedia template (a verbatim reproduction of FIFA Annex
// C) by scripts/parse-r32.ts and validated structurally (495 distinct group-sets;
// every assignment within its slot's allowed pool; assigned-set == indicator-set).
//
// bracket_slot convention: the canonical bracket_slot IS the FIFA match number
// as a string ("73".."88" for the R32). Same id used in matches, r32_allocation
// and predictions_knockout. See prisma/data/ko-schedule.ts.

import generated from "./r32-allocation.generated.json";

export interface R32Slot {
  bracketSlot: string; // FIFA match number as string, e.g. "75"
  matchNumber: number; // official FIFA match number (73–88)
  homeSource: string; // "1F" (winner F), "2A" (runner-up A)
  awaySource: string; // "2C", or "3:CEFHI" (best 3rd from pool)
  /** For slots fed by a 3rd-placed team: the winner letter + the 5-group pool. */
  thirdPlacePool: { winner: string; pool: string[] } | null;
}

// The 16 R32 slots, transcribed from the FIFA Match Schedule and cross-checked
// against Wikipedia (both agree). bracketSlot == String(matchNumber). Home is
// always the higher seed (winner, or the first runner-up listed); the 3rd-placed
// team is always the away source.
export const R32_SLOTS: R32Slot[] = [
  { bracketSlot: "73", matchNumber: 73, homeSource: "2A", awaySource: "2B", thirdPlacePool: null },
  { bracketSlot: "74", matchNumber: 74, homeSource: "1E", awaySource: "3:ABCDF", thirdPlacePool: { winner: "E", pool: ["A", "B", "C", "D", "F"] } },
  { bracketSlot: "75", matchNumber: 75, homeSource: "1F", awaySource: "2C", thirdPlacePool: null },
  { bracketSlot: "76", matchNumber: 76, homeSource: "1C", awaySource: "2F", thirdPlacePool: null },
  { bracketSlot: "77", matchNumber: 77, homeSource: "1I", awaySource: "3:CDFGH", thirdPlacePool: { winner: "I", pool: ["C", "D", "F", "G", "H"] } },
  { bracketSlot: "78", matchNumber: 78, homeSource: "2E", awaySource: "2I", thirdPlacePool: null },
  { bracketSlot: "79", matchNumber: 79, homeSource: "1A", awaySource: "3:CEFHI", thirdPlacePool: { winner: "A", pool: ["C", "E", "F", "H", "I"] } },
  { bracketSlot: "80", matchNumber: 80, homeSource: "1L", awaySource: "3:EHIJK", thirdPlacePool: { winner: "L", pool: ["E", "H", "I", "J", "K"] } },
  { bracketSlot: "81", matchNumber: 81, homeSource: "1D", awaySource: "3:BEFIJ", thirdPlacePool: { winner: "D", pool: ["B", "E", "F", "I", "J"] } },
  { bracketSlot: "82", matchNumber: 82, homeSource: "1G", awaySource: "3:AEHIJ", thirdPlacePool: { winner: "G", pool: ["A", "E", "H", "I", "J"] } },
  { bracketSlot: "83", matchNumber: 83, homeSource: "2K", awaySource: "2L", thirdPlacePool: null },
  { bracketSlot: "84", matchNumber: 84, homeSource: "1H", awaySource: "2J", thirdPlacePool: null },
  { bracketSlot: "85", matchNumber: 85, homeSource: "1B", awaySource: "3:EFGIJ", thirdPlacePool: { winner: "B", pool: ["E", "F", "G", "I", "J"] } },
  { bracketSlot: "86", matchNumber: 86, homeSource: "1J", awaySource: "2H", thirdPlacePool: null },
  { bracketSlot: "87", matchNumber: 87, homeSource: "1K", awaySource: "3:DEIJL", thirdPlacePool: { winner: "K", pool: ["D", "E", "I", "J", "L"] } },
  { bracketSlot: "88", matchNumber: 88, homeSource: "2D", awaySource: "2G", thirdPlacePool: null },
];

// Map a group-winner letter (the 8 that face a 3rd) to its R32 bracket slot.
export const WINNER_TO_SLOT: Record<string, string> = Object.fromEntries(
  R32_SLOTS.filter((s) => s.thirdPlacePool).map((s) => [s.thirdPlacePool!.winner, s.bracketSlot]),
);

export interface ThirdPlaceCombination {
  /** Sorted 8-letter key of the groups whose 3rd-placed team qualified, e.g. "ABCDEFGH". */
  groupsKey: string;
  /** bracket_slot -> the group letter whose 3rd-placed team fills that slot. */
  assignment: Record<string, string>;
}

interface GeneratedCombo {
  no: number;
  groups: string[];
  assignment: Record<string, string>; // winnerLetter -> 3rd group letter
}

// 495 combinations, re-keyed from winner-letter to bracket_slot for direct use.
export const THIRD_PLACE_COMBINATIONS: ThirdPlaceCombination[] = (
  generated.combinations as GeneratedCombo[]
).map((c) => ({
  groupsKey: c.groups.join(""),
  assignment: Object.fromEntries(
    Object.entries(c.assignment).map(([winner, thirdGroup]) => [WINNER_TO_SLOT[winner], thirdGroup]),
  ),
}));

const COMBO_BY_KEY = new Map(THIRD_PLACE_COMBINATIONS.map((c) => [c.groupsKey, c]));

/**
 * Given the 8 groups whose third-placed team qualified, return the mapping
 * bracket_slot -> group letter (which group's 3rd fills each best-3rd R32 slot).
 * Throws on an invalid set (not exactly 8 distinct A–L groups, or no combo).
 */
export function resolveThirdPlaceSlots(qualifyingGroups: string[]): Record<string, string> {
  const norm = [...new Set(qualifyingGroups.map((g) => g.toUpperCase()))];
  if (norm.length !== 8 || norm.some((g) => !/^[A-L]$/.test(g))) {
    throw new Error(`Expected 8 distinct group letters A–L, got: ${qualifyingGroups.join(",")}`);
  }
  const key = norm.sort().join("");
  const combo = COMBO_BY_KEY.get(key);
  if (!combo) throw new Error(`No third-place combination for groups ${key}`);
  return combo.assignment;
}
