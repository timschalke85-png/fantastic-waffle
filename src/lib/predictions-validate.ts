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

/**
 * Scoring-eligibility floor: a group match counts toward points iff it kicks off
 * at or after the eligibility floor (group_eligibility_floor_utc). This is the
 * fixed fairness anchor (matches played before the pool opened are excluded) and
 * is deliberately DECOUPLED from the input deadline — see isMatchEditable.
 */
export function isEligibleMatch(kickoffUtc: Date, eligibilityFloorUtc: Date): boolean {
  return kickoffUtc.getTime() >= eligibilityFloorUtc.getTime();
}

/**
 * Per-match input lock: a group match is editable iff it has NOT kicked off yet
 * AND the global input deadline (group_lock_utc) has not passed. Either bound
 * closes it. `globalLockUtc === null` means no global deadline is set, so only
 * the per-match kickoff applies. Enforced server-side in the save action, not
 * just the UI.
 */
export function isMatchEditable(kickoffUtc: Date, nowMs: number, globalLockUtc: Date | null): boolean {
  if (nowMs >= kickoffUtc.getTime()) return false;
  if (globalLockUtc !== null && nowMs >= globalLockUtc.getTime()) return false;
  return true;
}

/**
 * Day-game (prijzenpoule) input lock. A dagspel is open ONLY while its match has
 * not started — meaning BOTH: it is still SCHEDULED *and* it has not reached its
 * kickoff time. The match STATUS is the authoritative "has started" signal: once
 * the admin or the API marks a match LIVE/FINISHED it is locked even if the
 * stored kickoff time is still in the future (e.g. an early result entry, or the
 * real kickoff differing from the seeded time). The plain kickoff-time check
 * missed exactly that case, so a finished match stayed predictable. Enforced
 * server-side in saveDailyPredictionAction, mirrored in the /win UI.
 */
export function isDagspelOpen(kickoffUtc: Date, status: string, nowMs: number): boolean {
  if (status !== "SCHEDULED") return false;
  if (nowMs >= kickoffUtc.getTime()) return false;
  return true;
}
