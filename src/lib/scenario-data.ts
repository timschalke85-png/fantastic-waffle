// Server-side data for the Scenario's tab (Fase 4). Loads current standings of
// all 12 groups (after a self-throttled API refresh, like the dashboard), and
// returns serializable shapes the client verkenner recomputes on top of. The
// projected R32 bracket and the Poule F qualification summary are pure given the
// current standings, so they are computed here and rendered server-side.
import { prisma } from "./db";
import { refreshMatchData } from "./refresh";
import {
  computeStandings,
  type StandingRow,
  type StandingTeam,
  type FinishedMatch,
} from "./standings";
import {
  projectR32,
  summariseGroupF,
  type BracketSlotProjection,
  type QualificationSummary,
  type ScenarioMatch,
} from "./scenarios";

export interface ScenarioPouleFMatch {
  id: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeCode: string;
  awayCode: string;
  kickoffIso: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED";
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
}

export interface ScenarioGroupStanding {
  letter: string;
  standings: StandingRow[];
}

export interface ScenarioData {
  pouleFTeams: StandingTeam[];
  pouleFMatches: ScenarioPouleFMatch[];
  pouleFStandings: StandingRow[];
  /** Current standings for every group except F (A–E, G–L). */
  otherGroups: ScenarioGroupStanding[];
  projectedBracket: BracketSlotProjection[];
  summary: QualificationSummary;
  nlId: string | null;
  lastFetchUtc: string | null;
}

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

export async function loadScenarioData(): Promise<ScenarioData> {
  const refresh = await refreshMatchData();

  const teamSelect = { id: true, nameNl: true, fifaCode: true, crestUrl: true } as const;
  const [teams, matchesRaw] = await Promise.all([
    prisma.team.findMany({ select: { ...teamSelect, groupLetter: true } }),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: {
        id: true,
        kickoffUtc: true,
        status: true,
        homeScore: true,
        awayScore: true,
        groupLetter: true,
        homeTeamId: true,
        awayTeamId: true,
      },
      orderBy: { kickoffUtc: "asc" },
    }),
  ]);

  const teamsByGroup = new Map<string, StandingTeam[]>();
  const teamById = new Map<string, (typeof teams)[number]>();
  for (const t of teams) {
    teamById.set(t.id, t);
    const list = teamsByGroup.get(t.groupLetter) ?? [];
    list.push({ id: t.id, nameNl: t.nameNl, fifaCode: t.fifaCode, crestUrl: t.crestUrl });
    teamsByGroup.set(t.groupLetter, list);
  }

  const finishedFor = (letter: string): FinishedMatch[] =>
    matchesRaw
      .filter(
        (m) =>
          m.groupLetter === letter &&
          m.status === "FINISHED" &&
          m.homeTeamId != null &&
          m.awayTeamId != null &&
          m.homeScore != null &&
          m.awayScore != null,
      )
      .map((m) => ({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        homeScore: m.homeScore!,
        awayScore: m.awayScore!,
      }));

  const standingsByGroup = new Map<string, StandingRow[]>();
  for (const letter of GROUP_LETTERS) {
    standingsByGroup.set(letter, computeStandings(teamsByGroup.get(letter) ?? [], finishedFor(letter)));
  }

  // Poule F matches (all six) for the verkenner.
  const pouleFMatches: ScenarioPouleFMatch[] = matchesRaw
    .filter((m) => m.groupLetter === "F" && m.homeTeamId != null && m.awayTeamId != null)
    .map((m) => {
      const home = teamById.get(m.homeTeamId!)!;
      const away = teamById.get(m.awayTeamId!)!;
      return {
        id: m.id,
        homeId: home.id,
        awayId: away.id,
        homeName: home.nameNl,
        awayName: away.nameNl,
        homeCode: home.fifaCode,
        awayCode: away.fifaCode,
        kickoffIso: m.kickoffUtc.toISOString(),
        status: m.status as ScenarioPouleFMatch["status"],
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        finished: m.status === "FINISHED" && m.homeScore != null && m.awayScore != null,
      };
    });

  const groupStandingsRecord: Record<string, StandingRow[]> = {};
  for (const letter of GROUP_LETTERS) groupStandingsRecord[letter] = standingsByGroup.get(letter) ?? [];

  const nl = teams.find((t) => t.fifaCode === "NED") ?? null;
  const scenarioMatches: ScenarioMatch[] = pouleFMatches.map((m) => ({
    id: m.id,
    homeId: m.homeId,
    awayId: m.awayId,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    finished: m.finished,
  }));

  const summary = nl
    ? summariseGroupF(teamsByGroup.get("F") ?? [], scenarioMatches, nl.id)
    : { remainingCount: 0, position: { 1: "uitgesloten", 2: "uitgesloten", 3: "uitgesloten", 4: "uitgesloten" }, advancementGuaranteed: false, eliminationPossible: false, tieDependent: false };

  return {
    pouleFTeams: teamsByGroup.get("F") ?? [],
    pouleFMatches,
    pouleFStandings: standingsByGroup.get("F") ?? [],
    otherGroups: GROUP_LETTERS.filter((l) => l !== "F").map((letter) => ({
      letter,
      standings: standingsByGroup.get(letter) ?? [],
    })),
    projectedBracket: projectR32(groupStandingsRecord),
    summary: summary as QualificationSummary,
    nlId: nl?.id ?? null,
    lastFetchUtc: refresh.lastFetchUtc,
  };
}
