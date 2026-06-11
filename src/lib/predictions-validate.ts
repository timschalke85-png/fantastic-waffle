// Pure validation helpers for the prediction layer (Fase 5). No I/O, so the
// server actions and the seed/tests can share exactly the same rules. The
// integrity rules from DATAMODEL.md / SCORING.md live here.

/** A 4-digit PIN: exactly four ASCII digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Nicknames are 2–24 characters after trimming (DATAMODEL.md). */
export function isValidNickname(nickname: string): boolean {
  const n = nickname.trim();
  return n.length >= 2 && n.length <= 24;
}

/** Case-insensitive uniqueness key: trimmed + lowercased (app-maintained). */
export function nicknameKey(nickname: string): string {
  return nickname.trim().toLowerCase();
}

/**
 * Parse a goals input. Returns:
 *  - { kind: "empty" }   for a blank field (allowed; clears the prediction),
 *  - { kind: "value", value } for a valid non-negative integer,
 *  - { kind: "invalid" } otherwise (negative, decimal, non-numeric).
 */
export type GoalsParse = { kind: "empty" } | { kind: "value"; value: number } | { kind: "invalid" };
export function parseGoals(raw: string): GoalsParse {
  const t = raw.trim();
  if (t === "") return { kind: "empty" };
  if (!/^\d+$/.test(t)) return { kind: "invalid" };
  const n = Number.parseInt(t, 10);
  if (!Number.isInteger(n) || n < 0) return { kind: "invalid" };
  return { kind: "value", value: n };
}

/**
 * A scoreline is complete only when BOTH sides are filled. Returns the parsed
 * pair, or "empty" (clear) / "invalid" / "partial" (exactly one side filled).
 */
export type ScorelineParse =
  | { kind: "empty" }
  | { kind: "partial" }
  | { kind: "invalid" }
  | { kind: "value"; home: number; away: number };
export function parseScoreline(homeRaw: string, awayRaw: string): ScorelineParse {
  const h = parseGoals(homeRaw);
  const a = parseGoals(awayRaw);
  if (h.kind === "empty" && a.kind === "empty") return { kind: "empty" };
  if (h.kind === "invalid" || a.kind === "invalid") return { kind: "invalid" };
  if (h.kind === "empty" || a.kind === "empty") return { kind: "partial" };
  return { kind: "value", home: h.value, away: a.value };
}

export interface RankEntry {
  position: number;
  teamId: string;
}

/**
 * Validate a (partial) group-rank prediction. Filled entries must use allowed
 * positions, distinct positions, distinct teams, and teams drawn from the group
 * pool. Empty/absent positions are allowed (partial saves).
 */
export function validateRanking(
  entries: RankEntry[],
  allowedPositions: number[],
  teamPool: string[],
): { ok: boolean; reason?: string } {
  const allowed = new Set(allowedPositions);
  const pool = new Set(teamPool);
  const seenPos = new Set<number>();
  const seenTeam = new Set<string>();
  for (const e of entries) {
    if (!allowed.has(e.position)) return { ok: false, reason: `Ongeldige positie ${e.position}` };
    if (seenPos.has(e.position)) return { ok: false, reason: "Dubbele positie" };
    seenPos.add(e.position);
    if (!pool.has(e.teamId)) return { ok: false, reason: "Team hoort niet bij deze poule" };
    if (seenTeam.has(e.teamId)) return { ok: false, reason: "Een team mag maar op één positie staan" };
    seenTeam.add(e.teamId);
  }
  return { ok: true };
}

/** A group match is predictable/scoreable iff it kicks off at or after the lock. */
export function isEligibleMatch(kickoffUtc: Date, groupLockUtc: Date): boolean {
  return kickoffUtc.getTime() >= groupLockUtc.getTime();
}
