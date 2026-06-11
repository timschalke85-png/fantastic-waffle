// Pure knockout-bracket helpers (no I/O), shared by the seed and later phases.
//
// The FIFA match number (73–104) is the single canonical bracket_slot id. We map
// each provider knockout match to its FIFA number by exact (stage, kickoff)
// against the canonical KO_SCHEDULE — NOT by kickoff order, because FIFA numbers
// are not chronological (e.g. match 76 kicks off before 74 and 75).

import type { ProviderMatch } from "./adapters/types";
import { KO_BY_STAGE_KICKOFF } from "../../prisma/data/ko-schedule";

export type KoMatchInput = Pick<ProviderMatch, "apiMatchId" | "stage" | "kickoffUtc">;

/** Normalize a provider kickoff string to the canonical ISO key (drops ms, forces Z). */
function isoKey(kickoffUtc: string): string {
  return new Date(kickoffUtc).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Resolve a single provider knockout match to its FIFA match number, or null for
 * group matches. Throws if a knockout match has no canonical schedule entry
 * (i.e. the provider returned a kickoff we don't recognize) — we never guess.
 */
export function fifaMatchNumber(m: KoMatchInput): number | null {
  if (m.stage === "GROUP") return null;
  const n = KO_BY_STAGE_KICKOFF.get(`${m.stage}|${isoKey(m.kickoffUtc)}`);
  if (n == null) {
    throw new Error(
      `No canonical FIFA match number for ${m.stage} @ ${m.kickoffUtc} (apiMatchId ${m.apiMatchId})`,
    );
  }
  return n;
}

/**
 * Canonical bracket_slot per match: the FIFA match number as a string ("75"),
 * or null for group matches. Validates that knockout matches map bijectively
 * onto a contiguous set of FIFA numbers (no duplicates) — surfacing any schedule
 * drift loudly instead of silently mislabelling a slot.
 */
export function assignBracketSlots(matches: KoMatchInput[]): Map<number, string | null> {
  const out = new Map<number, string | null>();
  const usedNumbers = new Set<number>();
  for (const m of matches) {
    const n = fifaMatchNumber(m);
    if (n == null) {
      out.set(m.apiMatchId, null);
      continue;
    }
    if (usedNumbers.has(n)) {
      throw new Error(`FIFA match number ${n} resolved for two provider matches`);
    }
    usedNumbers.add(n);
    out.set(m.apiMatchId, String(n));
  }
  return out;
}
