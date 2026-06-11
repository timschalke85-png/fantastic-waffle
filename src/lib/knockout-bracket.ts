// Pure knockout-bracket engine (Fase 6 framework). Given the real R32 ties
// (teams known once the group stage ends) and a participant's per-match winner
// picks, it resolves the composition of every later tie, detects impossible
// brackets (a predicted winner who isn't actually in that tie under the user's
// own upstream picks), and lists the downstream matches a changed pick
// invalidates (for cascade-clear). No I/O — unit-tested in
// tests/knockout-bracket.test.ts. The server save action gates on
// validateKnockoutPicks so impossible brackets can never persist.
import { KO_FEEDERS, type Feeder } from "../../prisma/data/ko-bracket";

/** matchNumber -> the team id the participant predicts to WIN that match. */
export type Picks = Record<number, string>;
/** R32 base ties (FIFA matches 73–88): the real, known teams. */
export type R32Teams = Record<number, { home: string; away: string }>;

export interface TieTeams {
  home: string | null; // null = not yet determined by upstream picks
  away: string | null;
}

const isR32 = (slot: number) => slot >= 73 && slot <= 88;

/** Resolve the two teams in a knockout slot, given the R32 base + the picks. */
export function resolveTie(
  slot: number,
  r32: R32Teams,
  picks: Picks,
  memo: Map<number, TieTeams> = new Map(),
): TieTeams {
  const cached = memo.get(slot);
  if (cached) return cached;

  let res: TieTeams;
  if (isR32(slot)) {
    const t = r32[slot];
    res = t ? { home: t.home, away: t.away } : { home: null, away: null };
  } else {
    const f = KO_FEEDERS[slot];
    res = f
      ? { home: teamFromFeeder(f.home, r32, picks, memo), away: teamFromFeeder(f.away, r32, picks, memo) }
      : { home: null, away: null };
  }
  memo.set(slot, res);
  return res;
}

function teamFromFeeder(f: Feeder, r32: R32Teams, picks: Picks, memo: Map<number, TieTeams>): string | null {
  const tie = resolveTie(f.match, r32, picks, memo);
  const winner = picks[f.match];
  if (winner == null) return null; // upstream not predicted yet
  // If the upstream tie is fully known, the pick must be one of its two teams.
  if (tie.home != null && tie.away != null) {
    if (winner !== tie.home && winner !== tie.away) return null; // inconsistent
    const loser = winner === tie.home ? tie.away : tie.home;
    return f.result === "W" ? winner : loser;
  }
  // Tie not fully known: we can pass the winner forward, but never infer a loser.
  return f.result === "W" ? winner : null;
}

export interface Violation {
  slot: number;
  reason: string;
}

/**
 * Validate a participant's bracket against their own picks. A bracket is
 * impossible when a slot's predicted winner is not one of the two teams that the
 * upstream picks place in that slot. R32 picks must name one of the real teams.
 */
export function validateKnockoutPicks(r32: R32Teams, picks: Picks): { ok: boolean; violations: Violation[] } {
  const memo = new Map<number, TieTeams>();
  const violations: Violation[] = [];
  for (const key of Object.keys(picks)) {
    const slot = Number(key);
    const winner = picks[slot];
    const tie = resolveTie(slot, r32, picks, memo);
    if (tie.home != null && tie.away != null) {
      if (winner !== tie.home && winner !== tie.away) {
        violations.push({ slot, reason: `Voorspelde winnaar staat niet in wedstrijd ${slot}` });
      }
    } else if (isR32(slot) && !r32[slot]) {
      violations.push({ slot, reason: `Wedstrijd ${slot} heeft nog geen bekende teams` });
    }
    // Partially-known ties: cannot prove an inconsistency, so do not flag.
  }
  return { ok: violations.length === 0, violations };
}

// Reverse adjacency: which later slots consume a given match's result.
const CHILDREN: Record<number, number[]> = (() => {
  const c: Record<number, number[]> = {};
  for (const [slotStr, f] of Object.entries(KO_FEEDERS)) {
    const slot = Number(slotStr);
    for (const feeder of [f.home, f.away]) {
      (c[feeder.match] ??= []).push(slot);
    }
  }
  return c;
})();

/**
 * All slots whose composition transitively depends on `slot`'s result — i.e. the
 * picks to clear (after confirmation) when the user changes the winner of `slot`.
 */
export function downstreamOf(slot: number): number[] {
  const out = new Set<number>();
  const stack = [...(CHILDREN[slot] ?? [])];
  while (stack.length) {
    const s = stack.pop()!;
    if (out.has(s)) continue;
    out.add(s);
    for (const child of CHILDREN[s] ?? []) stack.push(child);
  }
  return [...out].sort((a, b) => a - b);
}
