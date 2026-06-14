// Pure scoring + winner engine for the PRIJZENPOULE day-game. No I/O, no DB, and
// completely separate from the main pool scoring. Unit-tested in
// tests/prize-scoring.test.ts. Point values come only from config/prize-scoring.ts.
import { createHash } from "node:crypto";
import { DAILY_SCORING } from "@/config/prize-scoring";

/** A participant's day-game prediction: goals per team per half. */
export interface DailyPrediction {
  firstHalfHome: number;
  firstHalfAway: number;
  secondHalfHome: number;
  secondHalfAway: number;
}

/** The real outcome, read from the Match: ruststand (half-time) + eindstand. */
export interface DailyActual {
  halfTimeHome: number;
  halfTimeAway: number;
  fullTimeHome: number;
  fullTimeAway: number;
}

export interface DailyScore {
  exactNumbers: number; // points from the 4 per-half goal numbers (0..4)
  halfTimePoints: number; // ruststand exact
  fullTimePoints: number; // eindstand exact
  outcomePoints: number; // juiste toto
  total: number;
}

type Outcome = "H" | "D" | "A";
function outcome(home: number, away: number): Outcome {
  return home > away ? "H" : home < away ? "A" : "D";
}

/**
 * Score one day-game prediction against the real result. Deelpunten-schema (see
 * config/prize-scoring.ts): +1 per exact half-goal number, +2 ruststand exact,
 * +2 eindstand exact (derived), +1 correct full-time toto. The actual 2nd half is
 * eindstand − ruststand; the predicted eindstand is 1e + 2e helft.
 */
export function scoreDailyPrediction(pred: DailyPrediction, actual: DailyActual): DailyScore {
  const actual2hHome = actual.fullTimeHome - actual.halfTimeHome;
  const actual2hAway = actual.fullTimeAway - actual.halfTimeAway;

  let exact = 0;
  if (pred.firstHalfHome === actual.halfTimeHome) exact++;
  if (pred.firstHalfAway === actual.halfTimeAway) exact++;
  if (pred.secondHalfHome === actual2hHome) exact++;
  if (pred.secondHalfAway === actual2hAway) exact++;
  const exactNumbers = exact * DAILY_SCORING.perExactHalfNumber;

  const halfTimePoints =
    pred.firstHalfHome === actual.halfTimeHome && pred.firstHalfAway === actual.halfTimeAway
      ? DAILY_SCORING.exactHalfTime
      : 0;

  const predFullHome = pred.firstHalfHome + pred.secondHalfHome;
  const predFullAway = pred.firstHalfAway + pred.secondHalfAway;
  const fullTimePoints =
    predFullHome === actual.fullTimeHome && predFullAway === actual.fullTimeAway
      ? DAILY_SCORING.exactFullTime
      : 0;

  const outcomePoints =
    outcome(predFullHome, predFullAway) === outcome(actual.fullTimeHome, actual.fullTimeAway)
      ? DAILY_SCORING.correctOutcome
      : 0;

  return {
    exactNumbers,
    halfTimePoints,
    fullTimePoints,
    outcomePoints,
    total: exactNumbers + halfTimePoints + fullTimePoints + outcomePoints,
  };
}

export interface DailyEntry {
  participantId: string;
  pred: DailyPrediction;
}

export interface DagwinnaarResult {
  winnerIds: string[]; // sorted; >1 = gedeelde pot ("gedeeld door X")
  score: number; // the winning score (0 if there are no entries)
}

/**
 * Dagwinnaar(s) for one day-game: the highest score wins; ties share the pot.
 * `entries` are the eligible participants (checked-in + predicted) — the caller
 * filters. Returns all participants on the top score, sorted by id.
 */
export function determineDagwinnaars(entries: DailyEntry[], actual: DailyActual): DagwinnaarResult {
  if (entries.length === 0) return { winnerIds: [], score: 0 };
  const scored = entries.map((e) => ({ id: e.participantId, total: scoreDailyPrediction(e.pred, actual).total }));
  const best = Math.max(...scored.map((s) => s.total));
  const winnerIds = scored.filter((s) => s.total === best).map((s) => s.id).sort();
  return { winnerIds, score: best };
}

export interface LuckyLoserInput {
  eveningId: string;
  /** Stable key of the FINAL scorelines, e.g. "73=2-1|90=0-0" — public, not
   *  controllable in advance. Built by the caller from the evening's matches. */
  resultKey: string;
  checkedInIds: string[];
  dagwinnaarIds: string[]; // excluded from the draw
}

/**
 * Provably-fair, deterministic Lucky Loser draw.
 *
 * Pool = checked-in participants MINUS the evening's dagwinnaars, sorted by id
 * (stable, not steerable). Seed = `eveningId|resultKey`, where resultKey is the
 * real final scoreline(s): data nobody knows or controls before the match ends.
 * We sha256 the seed, take the first 32 bits as an integer, and index into the
 * sorted pool. So:
 *   - reproducible: identical inputs -> identical winner (verifiable by anyone);
 *   - unsteerable: the outcome depends on the real result via a one-way hash, so
 *     aiming at a specific person would require brute-forcing a scoreline — and
 *     every scoreline is public;
 *   - frozen: the caller stores the winner at evening-close, so a later data
 *     change cannot move an already-awarded prize.
 * Returns the picked participant id, or null if the pool is empty.
 */
export function drawLuckyLoser(input: LuckyLoserInput): string | null {
  const excluded = new Set(input.dagwinnaarIds);
  const pool = input.checkedInIds.filter((id) => !excluded.has(id)).sort();
  if (pool.length === 0) return null;

  const digest = createHash("sha256").update(`${input.eveningId}|${input.resultKey}`).digest("hex");
  const n = Number.parseInt(digest.slice(0, 8), 16); // first 32 bits of the digest
  return pool[n % pool.length];
}
