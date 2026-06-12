// Pure helpers for the "Vandaag" scoreboard (no I/O). DST-safe: we compare the
// Europe/Amsterdam CALENDAR date of each match to today's, via Intl — no manual
// UTC offset. Unit-tested in tests/today.test.ts.

const AMS = "Europe/Amsterdam";

/** The Europe/Amsterdam calendar date of an instant, as "YYYY-MM-DD". */
export function amsDateKey(d: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AMS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** True if a kickoff falls on the same Amsterdam day as `now`. */
export function isAmsToday(kickoffUtc: Date, now: Date): boolean {
  return amsDateKey(kickoffUtc) === amsDateKey(now);
}

const STATUS_ORDER: Record<string, number> = { LIVE: 0, SCHEDULED: 1, FINISHED: 2 };

/**
 * Scoreboard order: LIVE first, then upcoming (SCHEDULED) by kickoff, then
 * finished, each by kickoff ascending.
 */
export function compareTodayMatches(
  a: { status: string; kickoffUtc: Date },
  b: { status: string; kickoffUtc: Date },
): number {
  const sa = STATUS_ORDER[a.status] ?? 3;
  const sb = STATUS_ORDER[b.status] ?? 3;
  if (sa !== sb) return sa - sb;
  return a.kickoffUtc.getTime() - b.kickoffUtc.getTime();
}
