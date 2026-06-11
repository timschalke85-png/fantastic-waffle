// Knockout bracket TREE (Fase 6 framework). For each knockout slot from the R16
// onward (FIFA matches 89–104), which earlier matches feed it and whether the
// feeder contributes its WINNER or its LOSER.
//
// SOURCE: transcribed verbatim from the per-match feeder annotations already in
// prisma/data/ko-schedule.ts (e.g. "89 = W74 v W77", "103 = L101 v L102"),
// which were sourced from the FIFA World Cup 26 Match Schedule and cross-checked
// against Wikipedia "2026 FIFA World Cup knockout stage" in Fase 1. This file
// adds NO new tournament facts — it only restructures verified data — and is
// structurally validated in tests/knockout-bracket.test.ts. (CLAUDE.md Hard
// rule 1: no invented facts; the R32 group→slot allocation lives in
// r32-allocation.ts, the only other hard-coded bracket data.)

export type FeederResult = "W" | "L";

export interface Feeder {
  result: FeederResult;
  match: number; // the earlier FIFA match number this team comes from
}

export interface BracketFeeders {
  home: Feeder;
  away: Feeder;
}

const W = (match: number): Feeder => ({ result: "W", match });
const L = (match: number): Feeder => ({ result: "L", match });

// Slots 89–104 only. R32 slots (73–88) are base nodes whose teams come from the
// real matches once the group stage is done (and from r32-allocation as a
// projection before that).
export const KO_FEEDERS: Record<number, BracketFeeders> = {
  // Round of 16 (89–96)
  89: { home: W(74), away: W(77) },
  90: { home: W(73), away: W(75) },
  91: { home: W(76), away: W(78) },
  92: { home: W(79), away: W(80) },
  93: { home: W(83), away: W(84) },
  94: { home: W(81), away: W(82) },
  95: { home: W(86), away: W(88) },
  96: { home: W(85), away: W(87) },
  // Quarter-finals (97–100)
  97: { home: W(89), away: W(90) },
  98: { home: W(93), away: W(94) },
  99: { home: W(91), away: W(92) },
  100: { home: W(95), away: W(96) },
  // Semi-finals (101–102)
  101: { home: W(97), away: W(98) },
  102: { home: W(99), away: W(100) },
  // Third-place play-off (103): the two SF losers. Final (104): the two SF winners.
  103: { home: L(101), away: L(102) },
  104: { home: W(101), away: W(102) },
};

/** Slots in bracket order with their FIFA stage, for rendering. */
export const KO_STAGE_OF: Record<number, "R32" | "R16" | "QF" | "SF" | "THIRD_PLACE" | "FINAL"> = (() => {
  const m: Record<number, "R32" | "R16" | "QF" | "SF" | "THIRD_PLACE" | "FINAL"> = {};
  for (let n = 73; n <= 88; n++) m[n] = "R32";
  for (let n = 89; n <= 96; n++) m[n] = "R16";
  for (let n = 97; n <= 100; n++) m[n] = "QF";
  for (let n = 101; n <= 102; n++) m[n] = "SF";
  m[103] = "THIRD_PLACE";
  m[104] = "FINAL";
  return m;
})();
