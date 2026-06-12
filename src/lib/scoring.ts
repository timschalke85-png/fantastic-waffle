// Pure scoring rules (Fase 7). No I/O. Every point value comes from
// src/config/scoring.ts (CLAUDE.md Hard rule 4 — no magic numbers here). These
// functions score a SINGLE item; gating ("only FINISHED", "only once the whole
// group is finished", eligibility) and aggregation live in recompute.ts (Stap 2).
// Unit-tested in tests/scoring.test.ts.
import { POULE_F, OTHER_GROUPS, KNOCKOUT } from "../config/scoring";

export type Outcome = "H" | "D" | "A";

/** 1/X/2 from a scoreline (home win / draw / away win). */
export function outcome(home: number, away: number): Outcome {
  return home > away ? "H" : home < away ? "A" : "D";
}

/**
 * Group match: highest single bracket, NOT cumulative (exact includes outcome).
 * Poule F is double-weighted (5/2) vs other groups (3/1).
 */
export function scoreGroupMatch(
  pred: { home: number; away: number },
  actual: { home: number; away: number },
  isPouleF: boolean,
): number {
  const cfg = isPouleF ? POULE_F.match : OTHER_GROUPS.match;
  if (pred.home === actual.home && pred.away === actual.away) return cfg.exactScore;
  if (outcome(pred.home, pred.away) === outcome(actual.home, actual.away)) return cfg.correctOutcome;
  return 0;
}

/** Poule F team goals: exact total across the team's 3 group matches → 3, else 0. */
export function scoreTeamGoals(pred: number, actual: number): number {
  return pred === actual ? POULE_F.teamGoalsExact : 0;
}

/**
 * Group standing prediction (strict positional). `predicted` / `actual` map a
 * position to a teamId; only filled positions in `predicted` count. Poule F
 * scores positions 1–4 (2 each) + a +3 bonus when ALL FOUR are exactly right;
 * other groups score nr.1 and nr.2 (2 each). Unfilled positions score nothing
 * and forfeit the Poule F bonus.
 */
export function scoreGroupRank(
  predicted: Record<number, string | undefined>,
  actual: Record<number, string | undefined>,
  isPouleF: boolean,
): number {
  if (isPouleF) {
    let pts = 0;
    let correct = 0;
    for (const pos of [1, 2, 3, 4]) {
      if (predicted[pos] && predicted[pos] === actual[pos]) {
        pts += POULE_F.standing.perCorrectPosition;
        correct++;
      }
    }
    if (correct === 4) pts += POULE_F.standing.allFourBonus;
    return pts;
  }
  let pts = 0;
  if (predicted[1] && predicted[1] === actual[1]) pts += OTHER_GROUPS.standing.correctFirst;
  if (predicted[2] && predicted[2] === actual[2]) pts += OTHER_GROUPS.standing.correctSecond;
  return pts;
}

export type KnockoutStageKey = keyof typeof KNOCKOUT; // R32 | R16 | QF | SF | THIRD_PLACE | FINAL

/** Actual winner: by scoreline, or the shoot-out winner when drawn at end of play. */
export function actualWinnerId(m: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  penaltyWinnerTeamId: string | null;
}): string | null {
  if (m.homeScore > m.awayScore) return m.homeTeamId;
  if (m.awayScore > m.homeScore) return m.awayTeamId;
  return m.penaltyWinnerTeamId ?? null; // drawn at end of play → shoot-out winner
}

export interface KnockoutActual {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number; // end of play (incl. ET); shoot-outs excluded from the scoreline
  awayScore: number;
  winnerId: string | null;
}

export interface KnockoutPred {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  winnerTeamId: string | null;
}

export interface KnockoutScore {
  matchup: number;
  winner: number;
  exactBonus: number;
  total: number;
}

/**
 * Knock-out match: additive components per the round table (matchup + winner +
 * exact bonus), NOT highest-bracket — the three are distinct achievements.
 *  - matchup (R16+ only; R32 = 0): both predicted teams are the actual two
 *    teams in that tie, order irrelevant.
 *  - winner: the predicted winner actually won the real match (shoot-out winner
 *    counts). If the predicted winner isn't in the real tie, 0.
 *  - exactBonus: the predicted scoreline matches the real end-of-play scoreline
 *    AND the winner is correct. Compared per-team (orientation-independent), so
 *    a correctly predicted "2–1 to X" pays even if home/away are listed swapped.
 *    SCORING.md §3 "Orientation" locks this reading (confirmed by Tim): a
 *    prediction is a result between two teams, not home/away bookkeeping, and KO
 *    home/away is partly arbitrary.
 */
export function scoreKnockoutMatch(
  pred: KnockoutPred,
  actual: KnockoutActual,
  stage: KnockoutStageKey,
): KnockoutScore {
  const cfg = KNOCKOUT[stage];
  let matchup = 0;
  let winner = 0;
  let exactBonus = 0;

  if (cfg.matchup > 0 && pred.homeTeamId && pred.awayTeamId && pred.homeTeamId !== pred.awayTeamId) {
    const actualTeams = new Set([actual.homeTeamId, actual.awayTeamId]);
    if (actualTeams.has(pred.homeTeamId) && actualTeams.has(pred.awayTeamId)) matchup = cfg.matchup;
  }

  const winnerCorrect = pred.winnerTeamId != null && pred.winnerTeamId === actual.winnerId;
  if (winnerCorrect) winner = cfg.winner;

  if (winnerCorrect && pred.homeGoals != null && pred.awayGoals != null && pred.homeTeamId && pred.awayTeamId) {
    // Per-team goal comparison: requires both actual teams to be in the predicted tie.
    const byTeam = new Map<string, number>([
      [pred.homeTeamId, pred.homeGoals],
      [pred.awayTeamId, pred.awayGoals],
    ]);
    if (byTeam.get(actual.homeTeamId) === actual.homeScore && byTeam.get(actual.awayTeamId) === actual.awayScore) {
      exactBonus = cfg.exactBonus;
    }
  }

  return { matchup, winner, exactBonus, total: matchup + winner + exactBonus };
}
