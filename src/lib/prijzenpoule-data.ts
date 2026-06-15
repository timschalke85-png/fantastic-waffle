// Server loaders for the PRIJZENPOULE (read-only). The active evening drives both
// /win (participant: check-in + day-game) and /beheer (admin overview). Losse
// module — reads Participant/Match but never the poule scoring.
import "server-only";
import { prisma } from "./db";
import { getSettings, getSetting } from "./settings";
import { loadKlassement } from "./klassement-data";
import {
  assignHoofdprijzen,
  computeEveningWinners,
  type EveningMatchInput,
  type DailyActual,
} from "./prize-scoring";

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
  checkedInNames: string[]; // bijnamen of everyone checked in tonight (public, social)
  dagspellen: WinDagspel[];
  existing: Record<string, DailyPredictionValues>; // eveningMatchId -> saved prediction
}

/** Everything /win needs for the active evening + this participant. */
export async function loadWinData(participantId: string): Promise<WinData> {
  const evening = await getActiveEvening();
  if (!evening) return { evening: null, checkedIn: false, checkedInNames: [], dagspellen: [], existing: {} };

  const [checkin, eveningMatches, preds, allCheckins] = await Promise.all([
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
    prisma.checkin.findMany({
      where: { eveningId: evening.id },
      orderBy: { createdAt: "asc" },
      select: { participant: { select: { nickname: true } } },
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
    checkedInNames: allCheckins.map((c) => c.participant.nickname),
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
  checkinNames: string[]; // bijnamen of who checked in (admin view)
  dagspellen: { eveningMatchId: string; ordinal: number; matchId: string; label: string }[];
}

/** All evenings for the /beheer prijzenpoule section (newest first). */
export async function loadEveningsAdmin(): Promise<AdminEveningRow[]> {
  const evenings = await prisma.evening.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { checkins: true } },
      checkins: {
        orderBy: { createdAt: "asc" },
        select: { participant: { select: { nickname: true } } },
      },
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
    checkinNames: e.checkins.map((c) => c.participant.nickname),
    dagspellen: e.matches.map((em) => ({
      eveningMatchId: em.id,
      ordinal: em.ordinal,
      matchId: em.matchId,
      label: `${em.match.homeTeam?.nameNl ?? "?"} – ${em.match.awayTeam?.nameNl ?? "?"}`,
    })),
  }));
}

// --- Winnaars: freeze input, frozen overview, hoofdprijzen ------------------

export interface EveningFreezeData {
  eveningId: string;
  label: string;
  frozen: boolean;
  hasMatches: boolean;
  allFinished: boolean; // every dagspel-match is FINISHED
  resultKey: string; // stable key of the final scorelines (for the Lucky Loser draw)
  checkedInIds: string[];
  matches: EveningMatchInput[]; // input for computeEveningWinners
  matchLabels: Record<string, string>; // eveningMatchId -> "Home – Away"
  nameOf: Record<string, string>; // participantId -> bijnaam (for preview display)
}

/** Load + normalize an evening for winner computation (freeze + /beheer preview). */
export async function loadEveningForFreeze(eveningId: string): Promise<EveningFreezeData | null> {
  const evening = await prisma.evening.findUnique({
    where: { id: eveningId },
    include: {
      matches: { orderBy: { ordinal: "asc" }, include: { match: { include: { homeTeam: true, awayTeam: true } } } },
      checkins: { select: { participantId: true, participant: { select: { nickname: true } } } },
    },
  });
  if (!evening) return null;

  const checkedInIds = evening.checkins.map((c) => c.participantId);
  const checkedInSet = new Set(checkedInIds);
  const nameOf: Record<string, string> = Object.fromEntries(
    evening.checkins.map((c) => [c.participantId, c.participant.nickname]),
  );

  const eveningMatchIds = evening.matches.map((em) => em.id);
  const preds = eveningMatchIds.length
    ? await prisma.dailyPrediction.findMany({ where: { eveningMatchId: { in: eveningMatchIds } } })
    : [];

  const matches: EveningMatchInput[] = [];
  const matchLabels: Record<string, string> = {};
  const keyParts: string[] = [];
  let allFinished = evening.matches.length > 0;

  for (const em of evening.matches) {
    const m = em.match;
    matchLabels[em.id] = `${m.homeTeam?.nameNl ?? "?"} – ${m.awayTeam?.nameNl ?? "?"}`;
    const scoreable =
      m.status === "FINISHED" &&
      m.halfTimeHome != null &&
      m.halfTimeAway != null &&
      m.homeScore != null &&
      m.awayScore != null;
    if (m.status !== "FINISHED") allFinished = false;
    const actual: DailyActual | null = scoreable
      ? { halfTimeHome: m.halfTimeHome!, halfTimeAway: m.halfTimeAway!, fullTimeHome: m.homeScore!, fullTimeAway: m.awayScore! }
      : null;
    const entries = preds
      .filter((p) => p.eveningMatchId === em.id && checkedInSet.has(p.participantId))
      .map((p) => ({
        participantId: p.participantId,
        pred: {
          firstHalfHome: p.firstHalfHome,
          firstHalfAway: p.firstHalfAway,
          secondHalfHome: p.secondHalfHome,
          secondHalfAway: p.secondHalfAway,
        },
      }));
    matches.push({ eveningMatchId: em.id, actual, entries });
    keyParts.push(`${em.id}=${scoreable ? `${m.homeScore}-${m.awayScore}` : "na"}`);
  }

  return {
    eveningId: evening.id,
    label: evening.label,
    frozen: evening.winnersFrozenAt != null,
    hasMatches: evening.matches.length > 0,
    allFinished,
    resultKey: keyParts.join("|"),
    checkedInIds,
    matches,
    matchLabels,
    nameOf,
  };
}

export interface WinnerDagspel {
  matchLabel: string;
  winnerNames: string[]; // stored DailyWinner -> bijnamen (gedeeld bij meerdere)
}

export interface FrozenEveningWinners {
  id: string;
  label: string;
  frozenAtIso: string;
  dagspellen: WinnerDagspel[];
  luckyLoserName: string | null;
}

/** Frozen (afgesloten) evenings with their STORED winners — the public overview. */
export async function loadWinnersOverview(): Promise<FrozenEveningWinners[]> {
  const evenings = await prisma.evening.findMany({
    where: { winnersFrozenAt: { not: null } },
    orderBy: { winnersFrozenAt: "desc" },
    include: {
      luckyLoser: { select: { nickname: true } },
      matches: {
        orderBy: { ordinal: "asc" },
        include: {
          match: { include: { homeTeam: true, awayTeam: true } },
          winners: { include: { participant: { select: { nickname: true } } } },
        },
      },
    },
  });

  return evenings.map((e) => ({
    id: e.id,
    label: e.label,
    frozenAtIso: e.winnersFrozenAt!.toISOString(),
    luckyLoserName: e.luckyLoser?.nickname ?? null,
    dagspellen: e.matches.map((em) => ({
      matchLabel: `${em.match.homeTeam?.nameNl ?? "?"} – ${em.match.awayTeam?.nameNl ?? "?"}`,
      winnerNames: em.winners.map((w) => w.participant.nickname),
    })),
  }));
}

/** The attendance requirement for the hoofdprijzen (prize_min_evenings, default 3). */
export async function getPrizeMinEvenings(): Promise<number> {
  const v = await getSetting("prize_min_evenings");
  const n = v ? Number.parseInt(v, 10) : NaN;
  return Number.isInteger(n) && n > 0 ? n : 3;
}

export interface HoofdprijzenData {
  minEvenings: number;
  winners: { rank: number; nickname: string }[];
}

/** Top-3 hoofdprijzen from the existing leaderboard, with the >=N-avonden check
 *  and doorschuiven (assignHoofdprijzen). Reads the poule scoring unchanged. */
export async function loadHoofdprijzen(): Promise<HoofdprijzenData> {
  const [klass, counts, minEvenings] = await Promise.all([
    loadKlassement(),
    prisma.checkin.groupBy({ by: ["participantId"], _count: { participantId: true } }),
    getPrizeMinEvenings(),
  ]);
  const attended: Record<string, number> = Object.fromEntries(
    counts.map((c) => [c.participantId, c._count.participantId]),
  );
  const ranked = klass.entries.map((e) => ({ participantId: e.participantId, nickname: e.displayName }));
  const winners = assignHoofdprijzen(ranked, attended, minEvenings).map((w) => ({ rank: w.rank, nickname: w.nickname }));
  return { minEvenings, winners };
}

export interface EveningWinnersPreview {
  hasMatches: boolean;
  allFinished: boolean;
  frozen: boolean;
  perMatch: { matchLabel: string; winnerNames: string[]; scoreable: boolean }[];
  luckyLoserName: string | null;
}

/** Live (computed, NOT stored) winners for the /beheer preview before freezing.
 *  After freezing the same computation matches the stored values (data is static). */
export async function loadEveningWinnersPreview(eveningId: string): Promise<EveningWinnersPreview | null> {
  const data = await loadEveningForFreeze(eveningId);
  if (!data) return null;
  const w = computeEveningWinners({
    eveningId: data.eveningId,
    matches: data.matches,
    checkedInIds: data.checkedInIds,
    resultKey: data.resultKey,
  });
  return {
    hasMatches: data.hasMatches,
    allFinished: data.allFinished,
    frozen: data.frozen,
    perMatch: w.perMatch.map((pm) => ({
      matchLabel: data.matchLabels[pm.eveningMatchId] ?? "",
      winnerNames: pm.winnerIds.map((id) => data.nameOf[id] ?? id),
      scoreable: pm.scoreable,
    })),
    luckyLoserName: w.luckyLoserId ? data.nameOf[w.luckyLoserId] ?? w.luckyLoserId : null,
  };
}
