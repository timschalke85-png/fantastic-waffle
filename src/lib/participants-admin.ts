// Server loader for the /beheer participants overview (read-only). Lists every
// registered participant with their registration/first-submission times, how many
// predictions they entered, and their points + position taken from the REAL
// leaderboard ranking (loadKlassement, same comparator as /klassement). A
// participant without a cached score row yet has points/rank = null ("—").
import "server-only";
import { prisma } from "./db";
import { loadKlassement } from "./klassement-data";

export interface ParticipantAdminRow {
  id: string;
  nickname: string;
  createdAtIso: string;
  firstSubmittedAtIso: string | null;
  predictionCount: number; // total across the four prediction tables
  points: number | null; // null = no score row computed yet
  rank: number | null; // position in the leaderboard, or null if unranked
}

export async function loadParticipantsAdmin(): Promise<ParticipantAdminRow[]> {
  const [participants, klass] = await Promise.all([
    prisma.participant.findMany({
      select: {
        id: true,
        nickname: true,
        createdAt: true,
        firstSubmittedAt: true,
        score: { select: { pointsTotal: true } },
        _count: {
          select: {
            groupMatchPredictions: true,
            groupRankPredictions: true,
            teamGoalsPredictions: true,
            knockoutPredictions: true,
          },
        },
      },
    }),
    loadKlassement(),
  ]);

  const rankById = new Map(klass.entries.map((e) => [e.participantId, e.rank]));

  const rows: ParticipantAdminRow[] = participants.map((p) => ({
    id: p.id,
    nickname: p.nickname,
    createdAtIso: p.createdAt.toISOString(),
    firstSubmittedAtIso: p.firstSubmittedAt?.toISOString() ?? null,
    predictionCount:
      p._count.groupMatchPredictions +
      p._count.groupRankPredictions +
      p._count.teamGoalsPredictions +
      p._count.knockoutPredictions,
    points: p.score?.pointsTotal ?? null,
    rank: rankById.get(p.id) ?? null,
  }));

  // Ranked participants first (by position), then the unranked by bijnaam.
  rows.sort((a, b) => {
    if (a.rank != null && b.rank != null) return a.rank - b.rank;
    if (a.rank != null) return -1;
    if (b.rank != null) return 1;
    return a.nickname.localeCompare(b.nickname, "nl");
  });

  return rows;
}
