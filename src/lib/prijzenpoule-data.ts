// Server loaders for the PRIJZENPOULE (read-only). The active evening drives both
// /win (participant: check-in + day-game) and /beheer (admin overview). Losse
// module — reads Participant/Match but never the poule scoring.
import "server-only";
import { prisma } from "./db";
import { getSettings } from "./settings";

export interface PrizeTexts {
  daywinner: string;
  luckyLoser: string;
  first: string;
  second: string;
  third: string;
}

const PRIZE_PLACEHOLDER = "Wordt nog bekendgemaakt";

/** Editable prize texts from `settings`, with a friendly placeholder when unset.
 *  Admin fills these in later (PRIJZENPOULE-PLAN.md §9) — never hard-coded. */
export async function getPrizeTexts(): Promise<PrizeTexts> {
  const s = await getSettings();
  const pick = (key: string) => s[key]?.trim() || PRIZE_PLACEHOLDER;
  return {
    daywinner: pick("prize_text_daywinner"),
    luckyLoser: pick("prize_text_luckyloser"),
    first: pick("prize_text_first"),
    second: pick("prize_text_second"),
    third: pick("prize_text_third"),
  };
}

/** The single active ("vanavond") evening, or null. */
export async function getActiveEvening() {
  return prisma.evening.findFirst({ where: { isActive: true } });
}

export interface WinDagspel {
  eveningMatchId: string;
  ordinal: number;
  matchId: string;
  homeName: string;
  awayName: string;
  homeCode: string;
  awayCode: string;
  homeCrest: string | null;
  awayCrest: string | null;
  kickoffIso: string;
  status: string;
}

export interface DailyPredictionValues {
  firstHalfHome: number;
  firstHalfAway: number;
  secondHalfHome: number;
  secondHalfAway: number;
}

export interface WinData {
  evening: { id: string; label: string; pollOpen: boolean; hasCode: boolean } | null;
  checkedIn: boolean;
  dagspellen: WinDagspel[];
  existing: Record<string, DailyPredictionValues>; // eveningMatchId -> saved prediction
}

/** Everything /win needs for the active evening + this participant. */
export async function loadWinData(participantId: string): Promise<WinData> {
  const evening = await getActiveEvening();
  if (!evening) return { evening: null, checkedIn: false, dagspellen: [], existing: {} };

  const [checkin, eveningMatches, preds] = await Promise.all([
    prisma.checkin.findUnique({
      where: { eveningId_participantId: { eveningId: evening.id, participantId } },
      select: { id: true },
    }),
    prisma.eveningMatch.findMany({
      where: { eveningId: evening.id },
      orderBy: { ordinal: "asc" },
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
    }),
    prisma.dailyPrediction.findMany({
      where: { participantId, eveningMatch: { eveningId: evening.id } },
      select: {
        eveningMatchId: true,
        firstHalfHome: true,
        firstHalfAway: true,
        secondHalfHome: true,
        secondHalfAway: true,
      },
    }),
  ]);

  const existing: Record<string, DailyPredictionValues> = Object.fromEntries(
    preds.map((p) => [
      p.eveningMatchId,
      {
        firstHalfHome: p.firstHalfHome,
        firstHalfAway: p.firstHalfAway,
        secondHalfHome: p.secondHalfHome,
        secondHalfAway: p.secondHalfAway,
      },
    ]),
  );

  const dagspellen: WinDagspel[] = eveningMatches.map((em) => ({
    eveningMatchId: em.id,
    ordinal: em.ordinal,
    matchId: em.matchId,
    homeName: em.match.homeTeam?.nameNl ?? "n.t.b.",
    awayName: em.match.awayTeam?.nameNl ?? "n.t.b.",
    homeCode: em.match.homeTeam?.fifaCode ?? "?",
    awayCode: em.match.awayTeam?.fifaCode ?? "?",
    homeCrest: em.match.homeTeam?.crestUrl ?? null,
    awayCrest: em.match.awayTeam?.crestUrl ?? null,
    kickoffIso: em.match.kickoffUtc.toISOString(),
    status: em.match.status,
  }));

  return {
    evening: { id: evening.id, label: evening.label, pollOpen: evening.pollOpen, hasCode: !!evening.checkInCode },
    checkedIn: !!checkin,
    dagspellen,
    existing,
  };
}

export interface AdminEveningRow {
  id: string;
  label: string;
  checkInCode: string | null;
  isActive: boolean;
  pollOpen: boolean;
  createdAtIso: string;
  checkinCount: number;
  dagspellen: { eveningMatchId: string; ordinal: number; matchId: string; label: string }[];
}

/** All evenings for the /beheer prijzenpoule section (newest first). */
export async function loadEveningsAdmin(): Promise<AdminEveningRow[]> {
  const evenings = await prisma.evening.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { checkins: true } },
      matches: {
        orderBy: { ordinal: "asc" },
        include: { match: { include: { homeTeam: true, awayTeam: true } } },
      },
    },
  });

  return evenings.map((e) => ({
    id: e.id,
    label: e.label,
    checkInCode: e.checkInCode,
    isActive: e.isActive,
    pollOpen: e.pollOpen,
    createdAtIso: e.createdAt.toISOString(),
    checkinCount: e._count.checkins,
    dagspellen: e.matches.map((em) => ({
      eveningMatchId: em.id,
      ordinal: em.ordinal,
      matchId: em.matchId,
      label: `${em.match.homeTeam?.nameNl ?? "?"} – ${em.match.awayTeam?.nameNl ?? "?"}`,
    })),
  }));
}
