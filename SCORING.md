# SCORING.md — Puntentelling WK Poule 2026

Approved by Tim, 11 June 2026. Implemented in `src/config/scoring.ts` as the single source of truth. Leaderboard is recomputed server-side whenever a result is finalized (API or admin override).

## General rules

- Scores are judged on the **official result**: the score at the end of play (after extra time if played). Penalty shoot-outs do not count toward the scoreline; the shoot-out winner counts as the match winner / advancing team.
- A prediction earns the highest single applicable score bracket per item, not cumulative (e.g. exact score includes the correct outcome; you get 5, not 5+2).
- All group predictions lock at the global deadline (2026-06-14 20:00 UTC). Knockout predictions lock at first R32 kickoff.
- Ties on total points in the leaderboard: broken by (1) more exact scorelines predicted, (2) more correct Group F items, (3) earliest first submission.

## 1. Poule F

**Per wedstrijd** (6 matches, double-weighted versus other groups — Poule F is the focus of this pool):
| Item | Punten |
|---|---|
| Exacte uitslag (juiste score beide teams) | 5 |
| Anders: juiste toto (winst/gelijk/verlies) | 2 |

**Doelpunten per land** (total goals scored by each of the 4 teams across their 3 group matches):
| Item | Punten |
|---|---|
| Exact aantal, per land | 3 |

**Eindstand Poule F** (positions 1–4):
| Item | Punten |
|---|---|
| Per exact juiste positie | 2 |
| Bonus: alle vier exact | +3 |

## 2. Overige poules (A–E, G–L)

**Per wedstrijd** (all group matches outside Poule F that kick off at or after the global lock — see eligibility rule below):
| Item | Punten |
|---|---|
| Exacte uitslag | 3 |
| Anders: juiste toto (winst/gelijk/verlies) | 1 |

**Eindstand per poule:**
| Item | Punten |
|---|---|
| Juiste nr. 1 (exact die positie) | 2 |
| Juiste nr. 2 (exact die positie) | 2 |

Strict positional: predicting a team 1st that finishes 2nd scores 0.

**Eligibility rule (fairness):** a group match is predictable and scoreable only if `kickoff_utc >= group_lock_utc`. Matches played before the lock (the tournament started 11 June, lock is 14 June 20:00 UTC) are excluded entirely: not shown in the form, never scored. NL–Japan kicks off exactly at the lock and is therefore the first eligible match. Poule eindstand predictions (nr. 1/2, and Poule F 1–4) remain fully scoreable for all groups regardless, since no final standing is known at lock time.

**Partial submissions:** only the bijnaam is mandatory. Any unfilled prediction item simply scores 0; nothing blocks saving an incomplete form.

## 3. Knock-outfase (predicted as one full bracket once R32 is known)

The bracket picker auto-fills later rounds from the user's own picks, so a "matchup" prediction for R16 onward means: **both predicted teams appear in the actual tie at that bracket slot** (order within the tie irrelevant). R32 matchups are known, so no matchup points there.

| Ronde | Matchup | Winnaar | Exacte uitslag (bonus) | # matches |
|---|---|---|---|---|
| Zestiende finale (R32) | — | 2 | +3 | 16 |
| Achtste finale (R16) | 2 | 3 | +3 | 8 |
| Kwartfinale | 3 | 4 | +4 | 4 |
| Halve finale | 4 | 5 | +5 | 2 |
| Troostfinale | 4 | 5 | +5 | 1 |
| Finale | 5 | 7 | +6 | 1 |

Winner points require the predicted winner to actually win that real match; if the predicted winner isn't in the real tie, 0. Exact-score bonus only pays if the winner is also correct.

**Orientation (clarified for the Fase 7 engine):** the exact-score bonus is judged on the result *between the two teams*, independent of home/away order. A predicted "X 2–1 Y" counts as exact when the real match ends X 2–1 Y, even if the bracket lists Y as the home side. Knockout home/away assignment is partly arbitrary, and a player predicts a result between two teams — not a home/away administration.

Theoretical maximum depends on how many group matches fall after the lock; let the engine compute and display it, do not hard-code.

## Display

Klassement shows: positie, bijnaam (or full name if opted in), totaal, and a breakdown on tap: Poule F / Overige poules / Knock-out.
