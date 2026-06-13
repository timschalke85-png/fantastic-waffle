// Server loader for the knockout prediction round (Fase 6, Stap 2). Gathers
// everything the picker needs in one place: the real R32 ties, whether the
// Round of 32 is fully resolved (the Q6 gate), the participant's existing picks,
// the open/lock state, and a team lookup for rendering. No migration — every
// field already exists. Mirrors the predictions.ts / klassement-data.ts pattern.
import "server-only";
import { prisma } from "./db";
import { getKnockoutLockUtc, isKnockoutOpen } from "./settings";
import { r32TeamsFromMatches, isR32Complete, picksFromRows } from "./knockout";
import { type R32Teams, type Picks } from "./knockout-bracket";

export interface KnockoutTeam {
  id: string;
  nameNl: string;
  fifaCode: string;
  crestUrl: string | null;
}

/** One stored knockout row, as the picker pre-fills it. */
export interface ExistingKnockoutPick {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerTeamId: string | null;
}

export interface KnockoutData {
  open: boolean; // settings.knockout_open
  locked: boolean; // now >= knockout_lock_utc
  lockIso: string | null;
  r32: R32Teams; // real R32 ties (only resolved slots)
  r32Complete: boolean; // Q6 gate: all 16 ties known
  picks: Picks; // engine winner-picks derived from the rows (source of truth)
  existing: Record<string, ExistingKnockoutPick>; // bracketSlot -> stored pick
  teams: Record<string, KnockoutTeam>; // id -> team, for rendering crests/names
}

export async function loadKnockoutData(participantId: string): Promise<KnockoutData> {
  const [lock, open, r32Matches, pickRows, teams] = await Promise.all([
    getKnockoutLockUtc(),
    isKnockoutOpen(),
    prisma.match.findMany({
      where: { stage: "R32" },
      select: { bracketSlot: true, homeTeamId: true, awayTeamId: true },
    }),
    prisma.predictionKnockout.findMany({ where: { participantId } }),
    prisma.team.findMany({ select: { id: true, nameNl: true, fifaCode: true, crestUrl: true } }),
  ]);

  const now = Date.now();
  const locked = lock != null && now >= lock.getTime();
  const r32 = r32TeamsFromMatches(r32Matches);

  const existing: Record<string, ExistingKnockoutPick> = Object.fromEntries(
    pickRows.map((p) => [
      p.bracketSlot,
      {
        homeTeamId: p.homeTeamId,
        awayTeamId: p.awayTeamId,
        homeGoals: p.homeGoals,
        awayGoals: p.awayGoals,
        winnerTeamId: p.winnerTeamId,
      },
    ]),
  );

  return {
    open,
    locked,
    lockIso: lock?.toISOString() ?? null,
    r32,
    r32Complete: isR32Complete(r32),
    picks: picksFromRows(pickRows),
    existing,
    teams: Object.fromEntries(teams.map((t) => [t.id, t])),
  };
}
