// Pure aggregation layer (Fase 7, Stap 2). Turns raw predictions + match results
// into per-participant score totals, applying the gating rules from SCORING.md:
//  - only FINISHED matches count; unfilled predictions score 0;
//  - a group match scores per-match only if eligible (kickoff_utc >= group_lock);
//  - team-goals score only once that team's own group matches are all FINISHED;
//  - a group's eindstand (Poule F 1–4 / other nr.1-2) scores only once ALL of
//    THAT group's matches are FINISHED (per-group gating);
//  - knockout scores per FINISHED knockout match.
// No I/O — unit-tested in tests/scoring-aggregate.test.ts. recompute.ts wraps this
// with Prisma loading + score upserts. The leaderboard tiebreak (exactCount and
// the final sort) is intentionally NOT computed here yet (parked: SCORING.md).
import { computeStandings, type StandingTeam, type FinishedMatch } from "./standings";
import {
  scoreGroupMatch,
  scoreTeamGoals,
  scoreGroupRank,
  scoreKnockoutMatch,
  actualWinnerId,
  type KnockoutStageKey,
  type KnockoutActual,
} from "./scoring";

export interface TeamRow {
  id: string;
  nameNl: string;
  fifaCode: string;
  groupLetter: string;
}

export interface MatchRow {
  id: string;
  stage: string; // GROUP | R32 | R16 | QF | SF | THIRD_PLACE | FINAL
  groupLetter: string | null;
  bracketSlot: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  status: string; // SCHEDULED | LIVE | FINISHED
  homeScore: number | null;
  awayScore: number | null;
  penaltyWinnerTeamId: string | null;
  kickoffUtc: Date;
}

export interface ParticipantPredictions {
  participantId: string;
  groupMatch: { matchId: string; home: number; away: number }[];
  teamGoals: { teamId: string; goals: number }[];
  rank: { groupLetter: string; position: number; teamId: string }[];
  knockout: {
    bracketSlot: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeGoals: number | null;
    awayGoals: number | null;
    winnerTeamId: string | null;
  }[];
}

export interface ParticipantScore {
  participantId: string;
  pointsGroupF: number;
  pointsOtherGroups: number;
  pointsKnockout: number;
  pointsTotal: number;
  /** Tiebreak 1: # matches with the EXACT scoreline correct (Poule F + other
   *  groups + knockout). Independent of toto-only hits — see SCORING.md. */
  exactCount: number;
  /** Tiebreak 2: # of the 14 Poule F items (6 matches + 4 team-goals + 4 eindstand
   *  positions) that SCORED points. A match counts on exact OR toto. */
  groupFCorrectItems: number;
}

const isFinished = (m: MatchRow): boolean =>
  m.status === "FINISHED" &&
  m.homeScore != null &&
  m.awayScore != null &&
  m.homeTeamId != null &&
  m.awayTeamId != null;

interface GroupMatchActual {
  home: number;
  away: number;
  groupLetter: string;
  eligible: boolean;
}

interface GroupCtx {
  complete: boolean;
  actualByPosition: Record<number, string>;
  /** True if any position in this group was separated only by drawing of lots. */
  decidedByLots: boolean;
}

export interface ScoringContext {
  groupLock: Date | null;
  groupMatches: Map<string, GroupMatchActual>; // FINISHED group matches, with eligibility flag
  teamGoalsActual: Map<string, number | null>; // Poule F teamId -> total goals if complete, else null
  groups: Map<string, GroupCtx>;
  knockout: Map<string, KnockoutActual & { stage: KnockoutStageKey }>;
}

export function buildScoringContext(teams: TeamRow[], matches: MatchRow[], groupLock: Date | null): ScoringContext {
  const teamsByGroup = new Map<string, StandingTeam[]>();
  for (const t of teams) {
    const list = teamsByGroup.get(t.groupLetter) ?? [];
    list.push({ id: t.id, nameNl: t.nameNl, fifaCode: t.fifaCode });
    teamsByGroup.set(t.groupLetter, list);
  }

  const allGroupMatches = matches.filter((m) => m.stage === "GROUP" && m.groupLetter);

  // FINISHED group matches + eligibility.
  const groupMatches = new Map<string, GroupMatchActual>();
  for (const m of allGroupMatches) {
    if (!isFinished(m)) continue;
    const eligible = groupLock != null && m.kickoffUtc.getTime() >= groupLock.getTime();
    groupMatches.set(m.id, { home: m.homeScore!, away: m.awayScore!, groupLetter: m.groupLetter!, eligible });
  }

  // Per-group completeness + actual final standings (derived; see fair-play caveat).
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of allGroupMatches) {
    const list = byGroup.get(m.groupLetter!) ?? [];
    list.push(m);
    byGroup.set(m.groupLetter!, list);
  }
  const groups = new Map<string, GroupCtx>();
  for (const [letter, gMatches] of byGroup) {
    const complete = gMatches.length > 0 && gMatches.every(isFinished);
    const actualByPosition: Record<number, string> = {};
    let decidedByLots = false;
    if (complete) {
      const finished: FinishedMatch[] = gMatches.map((m) => ({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        homeScore: m.homeScore!,
        awayScore: m.awayScore!,
      }));
      for (const r of computeStandings(teamsByGroup.get(letter) ?? [], finished)) {
        actualByPosition[r.rank] = r.team.id;
        if (r.decidedByLots) decidedByLots = true;
      }
    }
    groups.set(letter, { complete, actualByPosition, decidedByLots });
  }

  // Poule F team goals: total per team across its own group matches, once all FINISHED.
  const teamGoalsActual = new Map<string, number | null>();
  for (const t of teamsByGroup.get("F") ?? []) {
    const tMatches = allGroupMatches.filter((m) => m.homeTeamId === t.id || m.awayTeamId === t.id);
    if (tMatches.length > 0 && tMatches.every(isFinished)) {
      let goals = 0;
      for (const m of tMatches) goals += m.homeTeamId === t.id ? m.homeScore! : m.awayScore!;
      teamGoalsActual.set(t.id, goals);
    } else {
      teamGoalsActual.set(t.id, null);
    }
  }

  // Knockout actuals (per FINISHED knockout match, keyed by bracket_slot).
  const knockout = new Map<string, KnockoutActual & { stage: KnockoutStageKey }>();
  for (const m of matches) {
    if (m.stage === "GROUP" || !m.bracketSlot || !isFinished(m)) continue;
    knockout.set(m.bracketSlot, {
      homeTeamId: m.homeTeamId!,
      awayTeamId: m.awayTeamId!,
      homeScore: m.homeScore!,
      awayScore: m.awayScore!,
      winnerId: actualWinnerId({
        homeTeamId: m.homeTeamId!,
        awayTeamId: m.awayTeamId!,
        homeScore: m.homeScore!,
        awayScore: m.awayScore!,
        penaltyWinnerTeamId: m.penaltyWinnerTeamId,
      }),
      stage: m.stage as KnockoutStageKey,
    });
  }

  return { groupLock, groupMatches, teamGoalsActual, groups, knockout };
}

export function scoreParticipant(p: ParticipantPredictions, ctx: ScoringContext): ParticipantScore {
  let groupF = 0;
  let other = 0;
  let knockout = 0;
  let exactCount = 0; // tiebreak 1: exact scorelines (matches only)
  let groupFCorrectItems = 0; // tiebreak 2: Poule F items that scored

  // Group-match predictions (only FINISHED + eligible score).
  for (const gm of p.groupMatch) {
    const actual = ctx.groupMatches.get(gm.matchId);
    if (!actual || !actual.eligible) continue;
    const isF = actual.groupLetter === "F";
    const pts = scoreGroupMatch({ home: gm.home, away: gm.away }, { home: actual.home, away: actual.away }, isF);
    if (isF) groupF += pts;
    else other += pts;
    // Tiebreak metrics: exact = the literal scoreline; a Poule F item counts on any score (exact OR toto).
    if (gm.home === actual.home && gm.away === actual.away) exactCount++;
    if (isF && pts > 0) groupFCorrectItems++;
  }

  // Poule F team goals (only once that team is complete). Not a scoreline → not in exactCount.
  for (const tg of p.teamGoals) {
    const actual = ctx.teamGoalsActual.get(tg.teamId);
    if (actual == null) continue;
    const pts = scoreTeamGoals(tg.goals, actual);
    groupF += pts;
    if (pts > 0) groupFCorrectItems++;
  }

  // Group eindstand (per-group gating: only once that whole group is FINISHED).
  const ranksByGroup = new Map<string, Record<number, string>>();
  for (const r of p.rank) {
    const m = ranksByGroup.get(r.groupLetter) ?? {};
    m[r.position] = r.teamId;
    ranksByGroup.set(r.groupLetter, m);
  }
  for (const [letter, predicted] of ranksByGroup) {
    const g = ctx.groups.get(letter);
    if (!g || !g.complete) continue;
    const isF = letter === "F";
    const pts = scoreGroupRank(predicted, g.actualByPosition, isF);
    if (isF) groupF += pts;
    else other += pts;
    // Each correctly predicted Poule F position is one item (the +3 bonus is not an item).
    if (isF) {
      for (const pos of [1, 2, 3, 4]) {
        if (predicted[pos] && predicted[pos] === g.actualByPosition[pos]) groupFCorrectItems++;
      }
    }
  }

  // Knockout (per FINISHED knockout match).
  for (const k of p.knockout) {
    const actual = ctx.knockout.get(k.bracketSlot);
    if (!actual) continue;
    const ks = scoreKnockoutMatch(
      {
        homeTeamId: k.homeTeamId,
        awayTeamId: k.awayTeamId,
        homeGoals: k.homeGoals,
        awayGoals: k.awayGoals,
        winnerTeamId: k.winnerTeamId,
      },
      actual,
      actual.stage,
    );
    knockout += ks.total;
    // One definition of "exact" across scoring + tiebreaks (SCORING.md item 1): a
    // knockout match counts for exactCount exactly when it earned the exact-score
    // bonus — i.e. scoreline correct AND winner correct. So a tie decided on
    // penalties needs the right shoot-out winner too.
    if (ks.exactBonus > 0) exactCount++;
  }

  return {
    participantId: p.participantId,
    pointsGroupF: groupF,
    pointsOtherGroups: other,
    pointsKnockout: knockout,
    pointsTotal: groupF + other + knockout,
    exactCount,
    groupFCorrectItems,
  };
}

export function computeAllScores(participants: ParticipantPredictions[], ctx: ScoringContext): ParticipantScore[] {
  return participants.map((p) => scoreParticipant(p, ctx));
}
