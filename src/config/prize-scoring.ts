// SINGLE SOURCE OF TRUTH for the PRIJZENPOULE day-game point values. Completely
// SEPARATE from the main pool scoring (SCORING.md / src/config/scoring.ts) — the
// prijzenpoule is a losse module and must never affect the poule/knock-out score.
// Mirrors PRIJZENPOULE-PLAN.md §4.
//
// Het dagspel = doelpunten per team per helft (4 getallen): 1e helft thuis/uit,
// 2e helft thuis/uit. Deelpunten-schema (niet alles-of-niets), want 4 exacte
// getallen zijn lastig te raden:
//
//   +1  per exact goed goal-getal (4 stuks)            -> 0..4
//   +2  ruststand exact   (beide 1e-helft-getallen)
//   +2  eindstand exact   (beide eindstand-getallen, afgeleid uit beide helften)
//   +1  juiste toto       (winst/gelijk/verlies van de eindstand)
//   ------------------------------------------------------------------
//   max 9
export const DAILY_SCORING = {
  perExactHalfNumber: 1, // elk van de 4 getallen dat exact klopt
  exactHalfTime: 2, // ruststand exact (1e helft thuis én uit goed)
  exactFullTime: 2, // eindstand exact (afgeleid: 1e + 2e helft)
  correctOutcome: 1, // juiste toto van de eindstand
} as const;

/** Theoretisch maximum per dagspel (4*1 + 2 + 2 + 1). */
export const DAILY_MAX = 4 * DAILY_SCORING.perExactHalfNumber + DAILY_SCORING.exactHalfTime + DAILY_SCORING.exactFullTime + DAILY_SCORING.correctOutcome;
