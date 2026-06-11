// Server-side loading of the prediction form for one participant: the eligible
// matches per group, the four Poule F teams, the participant's existing picks,
// and the lock state. Eligibility (SCORING.md): a group match is shown/scoreable
// only if kickoff_utc >= group_lock_utc. Eindstand (rank) predictions are shown
// for every group regardless, since no final standing is known at lock time.
import "server-only";
import { prisma } from "./db";
import { getGroupLockUtc } from "./settings";
import { isEligibleMatch } from "./predictions-validate";

export interface FormTeam {
  id: string;
  nameNl: string;
  fifaCode: string;
}

export interface FormMatch {
  id: string;
  groupLetter: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeCode: string;
  awayCode: string;
  kickoffIso: string;
}

export interface FormGroup {
  letter: string;
  teams: FormTeam[];
  matches: FormMatch[]; // eligible only
}

export interface ExistingPredictions {
  groupMatch: Record<string, { home: number; away: number }>; // matchId -> score
  teamGoals: Record<string, number>; // teamId -> goals
  rank: Record<string, string>; // `${letter}:${position}` -> teamId
}

export interface PredictionFormData {
  pouleF: FormGroup;
  otherGroups: FormGroup[];
  existing: ExistingPredictions;
  locked: boolean;
  lockIso: string | null;
}

const GROUP_LETTERS = "ABCDEFGHIJKL".split("");

/** Eligible group match ids (kickoff >= lock). Shared by the loader and the save
 *  actions so the UI and the server agree on what is writable. */
export async function eligibleGroupMatchIds(): Promise<Set<string>> {
  const lock = await getGroupLockUtc();
  if (!lock) return new Set();
  const matches = await prisma.match.findMany({
    where: { stage: "GROUP" },
    select: { id: true, kickoffUtc: true },
  });
  return new Set(matches.filter((m) => isEligibleMatch(m.kickoffUtc, lock)).map((m) => m.id));
}

export async function loadPredictionForm(participantId: string): Promise<PredictionFormData> {
  const lock = await getGroupLockUtc();
  const now = Date.now();
  const locked = lock != null && now >= lock.getTime();

  const [teams, matchesRaw, gmPreds, tgPreds, rankPreds] = await Promise.all([
    prisma.team.findMany({
      select: { id: true, nameNl: true, fifaCode: true, groupLetter: true },
      orderBy: { nameNl: "asc" },
    }),
    prisma.match.findMany({
      where: { stage: "GROUP", homeTeamId: { not: null }, awayTeamId: { not: null } },
      select: {
        id: true,
        groupLetter: true,
        kickoffUtc: true,
        homeTeamId: true,
        awayTeamId: true,
      },
      orderBy: { kickoffUtc: "asc" },
    }),
    prisma.predictionGroupMatch.findMany({ where: { participantId } }),
    prisma.predictionTeamGoals.findMany({ where: { participantId } }),
    prisma.predictionGroupRank.findMany({ where: { participantId } }),
  ]);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamsByGroup = new Map<string, FormTeam[]>();
  for (const t of teams) {
    const list = teamsByGroup.get(t.groupLetter) ?? [];
    list.push({ id: t.id, nameNl: t.nameNl, fifaCode: t.fifaCode });
    teamsByGroup.set(t.groupLetter, list);
  }

  const eligible = lock ? matchesRaw.filter((m) => isEligibleMatch(m.kickoffUtc, lock)) : [];
  const matchesByGroup = new Map<string, FormMatch[]>();
  for (const m of eligible) {
    if (!m.groupLetter) continue;
    const home = teamById.get(m.homeTeamId!);
    const away = teamById.get(m.awayTeamId!);
    if (!home || !away) continue;
    const list = matchesByGroup.get(m.groupLetter) ?? [];
    list.push({
      id: m.id,
      groupLetter: m.groupLetter,
      homeId: home.id,
      awayId: away.id,
      homeName: home.nameNl,
      awayName: away.nameNl,
      homeCode: home.fifaCode,
      awayCode: away.fifaCode,
      kickoffIso: m.kickoffUtc.toISOString(),
    });
    matchesByGroup.set(m.groupLetter, list);
  }

  const buildGroup = (letter: string): FormGroup => ({
    letter,
    teams: teamsByGroup.get(letter) ?? [],
    matches: matchesByGroup.get(letter) ?? [],
  });

  const existing: ExistingPredictions = {
    groupMatch: Object.fromEntries(gmPreds.map((p) => [p.matchId, { home: p.homeGoals, away: p.awayGoals }])),
    teamGoals: Object.fromEntries(tgPreds.map((p) => [p.teamId, p.goals])),
    rank: Object.fromEntries(rankPreds.map((p) => [`${p.groupLetter}:${p.position}`, p.teamId])),
  };

  return {
    pouleF: buildGroup("F"),
    otherGroups: GROUP_LETTERS.filter((l) => l !== "F").map(buildGroup),
    existing,
    locked,
    lockIso: lock?.toISOString() ?? null,
  };
}
