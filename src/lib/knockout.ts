// Pure (no I/O) helpers bridging the DB shape <-> the knockout-bracket engine.
// The server loader (knockout-data.ts) reads Prisma rows and feeds them through
// these; keeping the mapping pure makes it unit-testable without a database.
// Unit-tested in tests/knockout.test.ts.
import { type R32Teams, type Picks } from "./knockout-bracket";

/** FIFA match numbers for the Round of 32 — the bracket's base nodes (73–88). */
export const R32_SLOTS: number[] = Array.from({ length: 16 }, (_, i) => 73 + i);

const isR32Slot = (n: number) => n >= 73 && n <= 88;

export interface R32MatchRow {
  bracketSlot: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

/**
 * Build the engine's R32Teams from the real R32 matches. Only slots 73–88 with
 * BOTH teams known are included; a slot whose teams aren't resolved yet is
 * simply omitted (resolveTie treats a missing slot as {home:null, away:null}).
 */
export function r32TeamsFromMatches(matches: R32MatchRow[]): R32Teams {
  const r32: R32Teams = {};
  for (const m of matches) {
    if (!m.bracketSlot || !m.homeTeamId || !m.awayTeamId) continue;
    const slot = Number(m.bracketSlot);
    if (!isR32Slot(slot)) continue;
    r32[slot] = { home: m.homeTeamId, away: m.awayTeamId };
  }
  return r32;
}

/**
 * True once all 16 R32 ties (73–88) have both teams known — the Q6 gate: the
 * picker stays blocked until the whole Round of 32 is resolved.
 */
export function isR32Complete(r32: R32Teams): boolean {
  return R32_SLOTS.every((s) => r32[s]?.home != null && r32[s]?.away != null);
}

export interface KnockoutPickRow {
  bracketSlot: string;
  winnerTeamId: string | null;
}

/**
 * Engine Picks (matchNumber -> predicted winner) from the participant's stored
 * rows. Only rows with a winner contribute; the engine derives the rest. This is
 * the source of truth the cascade and resolveTie operate on — the stored
 * home/awayTeamId are a server-derived projection (see FASE6 §2 / Q8).
 */
export function picksFromRows(rows: KnockoutPickRow[]): Picks {
  const picks: Picks = {};
  for (const r of rows) {
    if (r.winnerTeamId == null) continue;
    picks[Number(r.bracketSlot)] = r.winnerTeamId;
  }
  return picks;
}
