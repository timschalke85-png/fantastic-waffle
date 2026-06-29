// Pure derivation of the Round-of-32 team allocation from FINAL group standings.
//
// The provider (football-data) returns NULL teams for knockout slots, so once the
// group stage is complete we derive the R32 ties ourselves. Each slot's 1X/2X
// source reads straight off a group's table; the best-3rd slots resolve through
// the official FIFA combination table. This reuses projectR32 — the exact logic
// the Scenario's tab already uses — and tightens it into a DEFINITIVE allocation:
// an entry is produced only when BOTH teams are known, and `complete` is true only
// when all 16 ties resolve. No I/O — unit-tested in tests/r32-resolve.test.ts.
import { projectR32 } from "./scenarios";
import type { StandingRow } from "./standings";

export interface R32Assignment {
  bracketSlot: string; // FIFA match number as string, "73".."88"
  homeTeamId: string;
  awayTeamId: string;
}

export interface R32Resolution {
  assignments: R32Assignment[]; // only slots with BOTH teams known
  complete: boolean; // true iff all 16 ties resolved
}

/**
 * Resolve the 16 R32 ties from the (final) standings of all 12 groups. Slots whose
 * two teams aren't both determined are omitted; `complete` flags the all-16 case.
 * The caller is responsible for only persisting this once the group stage is final.
 */
export function resolveR32FromStandings(groupStandings: Record<string, StandingRow[]>): R32Resolution {
  const assignments: R32Assignment[] = [];
  for (const slot of projectR32(groupStandings)) {
    if (slot.home.team && slot.away.team) {
      assignments.push({
        bracketSlot: slot.bracketSlot,
        homeTeamId: slot.home.team.id,
        awayTeamId: slot.away.team.id,
      });
    }
  }
  return { assignments, complete: assignments.length === 16 };
}
