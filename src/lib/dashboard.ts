// Server-side dashboard data: live matches from the DB + computed standings.
import { prisma } from "./db";
import { refreshMatchData } from "./refresh";
import {
  computeStandings,
  rankThirdPlaced,
  type StandingRow,
  type ThirdPlaceRow,
  type StandingTeam,
  type FinishedMatch,
} from "./standings";

export interface TeamLite {
  id: string;
  nameNl: string;
  fifaCode: string;
  crestUrl: string | null;
}

export interface MatchView {
  id: string;
  kickoffUtc: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
  home: TeamLite | null;
  away: TeamLite | null;
  groupLetter: string | null;
  bracketSlot: string | null;
}

export interface GroupView {
  letter: string;
  standings: StandingRow[];
  matches: MatchView[];
}

export interface DashboardData {
  pouleF: GroupView;
  otherGroups: GroupView[]; // A–E, G–L, in order
  thirdPlace: ThirdPlaceRow[];
  nextNlMatch: MatchView | null;
  phaseLabel: string;
  lastFetchUtc: string | null;
  fairPlayAvailable: boolean;
}

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

const STAGE_NL: Record<string, string> = {
  GROUP: "Groepsfase",
  R32: "Zestiende finales",
  R16: "Achtste finales",
  QF: "Kwartfinales",
  SF: "Halve finales",
  THIRD_PLACE: "Troostfinale",
  FINAL: "Finale",
};

function toView(m: {
  id: string;
  kickoffUtc: Date;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  groupLetter: string | null;
  bracketSlot: string | null;
  homeTeam: TeamLite | null;
  awayTeam: TeamLite | null;
}): MatchView {
  return {
    id: m.id,
    kickoffUtc: m.kickoffUtc,
    status: m.status as MatchView["status"],
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    home: m.homeTeam,
    away: m.awayTeam,
    groupLetter: m.groupLetter,
    bracketSlot: m.bracketSlot,
  };
}

function finishedFor(matches: MatchView[]): FinishedMatch[] {
  return matches
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        m.home != null &&
        m.away != null &&
        m.homeScore != null &&
        m.awayScore != null,
    )
    .map((m) => ({
      homeTeamId: m.home!.id,
      awayTeamId: m.away!.id,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
    }));
}

/** Loads everything the Overzicht renders, after a self-throttled API refresh. */
export async function loadDashboard(): Promise<DashboardData> {
  const refresh = await refreshMatchData();

  const teamSelect = { id: true, nameNl: true, fifaCode: true, crestUrl: true } as const;
  const [teams, matchesRaw] = await Promise.all([
    prisma.team.findMany({ select: { ...teamSelect, groupLetter: true } }),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      include: { homeTeam: { select: teamSelect }, awayTeam: { select: teamSelect } },
      orderBy: { kickoffUtc: "asc" },
    }),
  ]);

  const matches = matchesRaw.map(toView);
  const teamsByGroup = new Map<string, StandingTeam[]>();
  for (const t of teams) {
    const list = teamsByGroup.get(t.groupLetter) ?? [];
    list.push({ id: t.id, nameNl: t.nameNl, fifaCode: t.fifaCode, crestUrl: t.crestUrl });
    teamsByGroup.set(t.groupLetter, list);
  }

  const buildGroup = (letter: string): GroupView => {
    const gMatches = matches.filter((m) => m.groupLetter === letter);
    const standings = computeStandings(teamsByGroup.get(letter) ?? [], finishedFor(gMatches));
    return { letter, standings, matches: gMatches };
  };

  const pouleF = buildGroup("F");
  const otherGroups = GROUP_LETTERS.filter((l) => l !== "F").map(buildGroup);

  const thirdPlace = rankThirdPlaced(
    [pouleF, ...otherGroups]
      .map((g) => ({ groupLetter: g.letter, row: g.standings[2] }))
      .filter((t) => t.row != null),
  );

  // Next Netherlands match (group only for now; knockout teams resolve later).
  const ned = teams.find((t) => t.fifaCode === "NED");
  const now = Date.now();
  const nextNlMatch =
    ned == null
      ? null
      : matches
          .filter(
            (m) =>
              m.status !== "FINISHED" &&
              m.kickoffUtc.getTime() >= now - 2 * 60 * 60 * 1000 &&
              (m.home?.id === ned.id || m.away?.id === ned.id),
          )
          .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime())[0] ?? null;

  // Phase = stage of the next upcoming match across the whole tournament.
  const nextAny = await prisma.match.findFirst({
    where: { status: { not: "FINISHED" } },
    orderBy: { kickoffUtc: "asc" },
    select: { stage: true },
  });
  const phaseLabel = nextAny ? STAGE_NL[nextAny.stage] ?? "Toernooi" : "Toernooi afgelopen";

  return {
    pouleF,
    otherGroups,
    thirdPlace,
    nextNlMatch,
    phaseLabel,
    lastFetchUtc: refresh.lastFetchUtc,
    // football-data.org exposes no disciplinary data -> fair play unavailable.
    fairPlayAvailable: false,
  };
}
