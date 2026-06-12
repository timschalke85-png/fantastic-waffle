// Leaderboard ordering (Fase 7). The comparator is pure and unit-tested; the
// metrics it sorts on (pointsTotal, exactCount, groupFCorrectItems) are cached in
// `scores` during recompute, and first_submitted_at on `participants`, so
// /klassement only sorts — it never re-scores. Tiebreak order per SCORING.md:
//   1. pointsTotal              (desc)
//   2. exactCount               (desc) — # exact scorelines (matches only)
//   3. groupFCorrectItems       (desc) — # of the 14 Poule F items that scored
//   4. firstSubmittedAt         (asc, NULL last) — earliest first submission

export interface LeaderboardRow {
  participantId: string;
  pointsTotal: number;
  exactCount: number;
  groupFCorrectItems: number;
  firstSubmittedAt: Date | null;
}

const submittedMs = (d: Date | null): number => (d ? d.getTime() : Number.POSITIVE_INFINITY);

/** Strict total order for the leaderboard. Returns <0 if `a` ranks above `b`. */
export function compareForLeaderboard(a: LeaderboardRow, b: LeaderboardRow): number {
  if (b.pointsTotal !== a.pointsTotal) return b.pointsTotal - a.pointsTotal;
  if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount;
  if (b.groupFCorrectItems !== a.groupFCorrectItems) return b.groupFCorrectItems - a.groupFCorrectItems;
  return submittedMs(a.firstSubmittedAt) - submittedMs(b.firstSubmittedAt); // earliest first, NULL last
}

/** Sort a copy of the rows into leaderboard order (1-based rank is the index + 1). */
export function rankLeaderboard<T extends LeaderboardRow>(rows: T[]): T[] {
  return [...rows].sort(compareForLeaderboard);
}
