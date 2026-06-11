// SINGLE SOURCE OF TRUTH for all point values (CLAUDE.md Hard rule 4).
// Mirrors SCORING.md exactly. Never scatter point values elsewhere; the scoring
// engine (Fase 7) and the theoretical-max display read only from here.

/** Poule F is double-weighted versus other groups — the focus of this pool. */
export const POULE_F = {
  /** Per match (6 matches). Highest single applicable bracket, not cumulative. */
  match: {
    exactScore: 5, // juiste score beide teams
    correctOutcome: 2, // anders: juiste toto (W/G/V)
  },
  /** Total goals scored by each of the 4 teams across their 3 group matches. */
  teamGoalsExact: 3, // per land
  /** Eindstand Poule F, positions 1–4. */
  standing: {
    perCorrectPosition: 2,
    allFourBonus: 3, // +3 when all four positions exact
  },
} as const;

/** Groups A–E, G–L. */
export const OTHER_GROUPS = {
  match: {
    exactScore: 3,
    correctOutcome: 1,
  },
  standing: {
    correctFirst: 2, // strict positional
    correctSecond: 2,
  },
} as const;

/**
 * Knock-out, predicted as one full bracket once R32 is known.
 * "matchup" = both predicted teams appear in the actual tie at that slot
 * (order irrelevant). R32 matchups are known, so no matchup points there.
 * "winner" requires the predicted winner to actually win that real match.
 * "exactBonus" only pays if the winner is also correct.
 */
export const KNOCKOUT = {
  R32: { matchup: 0, winner: 2, exactBonus: 3 },
  R16: { matchup: 2, winner: 3, exactBonus: 3 },
  QF: { matchup: 3, winner: 4, exactBonus: 4 },
  SF: { matchup: 4, winner: 5, exactBonus: 5 },
  THIRD_PLACE: { matchup: 4, winner: 5, exactBonus: 5 },
  FINAL: { matchup: 5, winner: 7, exactBonus: 6 },
} as const;

/**
 * Scores are judged on the official result (score at end of play, after extra
 * time if played). Penalty shoot-outs do NOT count toward the scoreline; the
 * shoot-out winner counts as the match winner / advancing team.
 */
export const RESULT_RULES = {
  penaltiesCountTowardScoreline: false,
  /** A prediction earns the highest single applicable bracket, not cumulative. */
  cumulative: false,
} as const;

/**
 * Leaderboard tiebreakers, in order:
 * 1) more exact scorelines predicted, 2) more correct Group F items,
 * 3) earliest first submission.
 */
export const TIEBREAKERS = [
  "exactScorelines",
  "correctGroupFItems",
  "earliestSubmission",
] as const;
