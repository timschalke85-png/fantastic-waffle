// Server loader for /klassement (Fase 7, Stap 4). Reads the cached `scores` +
// participant identity and orders them with the pure comparator — it never
// re-scores. "Laatst bijgewerkt" is the real max(computed_at), never "now".
//
// The tiebreak metrics group_f_correct_items (scores) and first_submitted_at
// (participants) are read from the typed Prisma fields; the comparator orders on
// them. Both columns were added in migrations 0002/0003.
import "server-only";
import { prisma } from "./db";
import { rankLeaderboard, type LeaderboardRow } from "./klassement";

export interface KlassementEntry extends LeaderboardRow {
  rank: number;
  nickname: string;
  displayName: string; // full name if opted in, else nickname
  pointsGroupF: number;
  pointsOtherGroups: number;
  pointsKnockout: number;
}

export interface KlassementData {
  entries: KlassementEntry[];
  lastUpdatedUtc: string | null;
}

export async function loadKlassement(): Promise<KlassementData> {
  const rows = await prisma.score.findMany({
    select: {
      pointsTotal: true,
      pointsGroupF: true,
      pointsOtherGroups: true,
      pointsKnockout: true,
      exactCount: true,
      groupFCorrectItems: true,
      computedAt: true,
      participant: {
        select: { id: true, nickname: true, fullName: true, showFullName: true, firstSubmittedAt: true },
      },
    },
  });

  const lrows: KlassementEntry[] = rows.map((r) => ({
    participantId: r.participant.id,
    pointsTotal: r.pointsTotal,
    exactCount: r.exactCount,
    groupFCorrectItems: r.groupFCorrectItems,
    firstSubmittedAt: r.participant.firstSubmittedAt,
    nickname: r.participant.nickname,
    displayName: r.participant.showFullName && r.participant.fullName ? r.participant.fullName : r.participant.nickname,
    pointsGroupF: r.pointsGroupF,
    pointsOtherGroups: r.pointsOtherGroups,
    pointsKnockout: r.pointsKnockout,
    rank: 0,
  }));

  const ranked = rankLeaderboard(lrows).map((r, i) => ({ ...r, rank: i + 1 }));
  const lastUpdated = rows.reduce<Date | null>(
    (max, r) => (!max || r.computedAt > max ? r.computedAt : max),
    null,
  );

  return { entries: ranked, lastUpdatedUtc: lastUpdated?.toISOString() ?? null };
}
