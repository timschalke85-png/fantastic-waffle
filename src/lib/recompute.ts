// Idempotent leaderboard recompute (Fase 7, Stap 2 — I/O wrapper around the pure
// scoring-aggregate layer). Loads everything once, computes in memory, and upserts
// the `scores` cache per participant. Running it again from the same DB state
// yields identical point totals (only computed_at changes). Far under the 2s/150
// budget: the heavy work is the pure computeAllScores (perf-tested), the I/O is a
// single batched read + one transaction of upserts.
import "server-only";
import { prisma } from "./db";
import { getGroupLockUtc } from "./settings";
import {
  buildScoringContext,
  computeAllScores,
  type MatchRow,
  type TeamRow,
  type ParticipantPredictions,
} from "./scoring-aggregate";

export interface RecomputeResult {
  participants: number;
  computedAtUtc: string;
}

export async function recomputeScores(): Promise<RecomputeResult> {
  const [groupLock, teams, matches, participants] = await Promise.all([
    getGroupLockUtc(),
    prisma.team.findMany({ select: { id: true, nameNl: true, fifaCode: true, groupLetter: true } }),
    prisma.match.findMany({
      select: {
        id: true,
        stage: true,
        groupLetter: true,
        bracketSlot: true,
        homeTeamId: true,
        awayTeamId: true,
        status: true,
        homeScore: true,
        awayScore: true,
        penaltyWinnerTeamId: true,
        kickoffUtc: true,
      },
    }),
    prisma.participant.findMany({
      select: {
        id: true,
        groupMatchPredictions: { select: { matchId: true, homeGoals: true, awayGoals: true } },
        teamGoalsPredictions: { select: { teamId: true, goals: true } },
        groupRankPredictions: { select: { groupLetter: true, position: true, teamId: true } },
        knockoutPredictions: {
          select: {
            bracketSlot: true,
            homeTeamId: true,
            awayTeamId: true,
            homeGoals: true,
            awayGoals: true,
            winnerTeamId: true,
          },
        },
      },
    }),
  ]);

  const ctx = buildScoringContext(teams as TeamRow[], matches as MatchRow[], groupLock);

  const bundles: ParticipantPredictions[] = participants.map((p) => ({
    participantId: p.id,
    groupMatch: p.groupMatchPredictions.map((x) => ({ matchId: x.matchId, home: x.homeGoals, away: x.awayGoals })),
    teamGoals: p.teamGoalsPredictions.map((x) => ({ teamId: x.teamId, goals: x.goals })),
    rank: p.groupRankPredictions.map((x) => ({ groupLetter: x.groupLetter, position: x.position, teamId: x.teamId })),
    knockout: p.knockoutPredictions.map((x) => ({
      bracketSlot: x.bracketSlot,
      homeTeamId: x.homeTeamId,
      awayTeamId: x.awayTeamId,
      homeGoals: x.homeGoals,
      awayGoals: x.awayGoals,
      winnerTeamId: x.winnerTeamId,
    })),
  }));

  const scores = computeAllScores(bundles, ctx);
  const computedAt = new Date();

  await prisma.$transaction(
    scores.map((s) =>
      prisma.score.upsert({
        where: { participantId: s.participantId },
        create: {
          participantId: s.participantId,
          pointsGroupF: s.pointsGroupF,
          pointsOtherGroups: s.pointsOtherGroups,
          pointsKnockout: s.pointsKnockout,
          pointsTotal: s.pointsTotal,
          exactCount: s.exactCount,
          groupFCorrectItems: s.groupFCorrectItems,
          computedAt,
        },
        update: {
          pointsGroupF: s.pointsGroupF,
          pointsOtherGroups: s.pointsOtherGroups,
          pointsKnockout: s.pointsKnockout,
          pointsTotal: s.pointsTotal,
          exactCount: s.exactCount,
          groupFCorrectItems: s.groupFCorrectItems,
          computedAt,
        },
      }),
    ),
  );

  return { participants: scores.length, computedAtUtc: computedAt.toISOString() };
}
