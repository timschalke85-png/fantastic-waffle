# FASEN.md — Build phases for Claude Code

Paste one phase prompt at a time into Claude Code. Each phase ends with its acceptance criteria green before moving on. **Priority: phases 1–5 must be live before the lock on 14 June 22:00 NL. Phases 6–7 must be live before 28 June.** Phase 8 is polish.

Standing instruction for every phase: read CLAUDE.md, SCORING.md and DATAMODEL.md first. Do not invent tournament facts; the API and the verified r32_allocation seed are the only sources.

---

## Fase 1 — Scaffold, API verification, schema, seed

**Prompt:**
> Read CLAUDE.md, DATAMODEL.md, SCORING.md. Scaffold a Next.js 15 App Router project with TypeScript, Tailwind and Prisma against the Neon DATABASE_URL in .env. Before building anything else, write a throwaway script that calls football-data.org v4 with FOOTBALL_DATA_API_KEY: GET /v4/competitions/WC/matches. Confirm it returns the 2026 World Cup fixtures (104 matches, group stage starting 2026-06-11). If the free tier does not return WC2026, stop and report; we switch the adapter to API-Football. If confirmed: implement the Prisma schema from DATAMODEL.md, run the migration, and write a seed script that (a) imports all teams and all 104 matches from the API, (b) maps team names to Dutch via a name_nl mapping you create for all 48 qualified teams, (c) seeds the r32_allocation table — fetch the official FIFA match schedule and the Wikipedia page "2026 FIFA World Cup knockout stage", cross-check the R32 slot sources (e.g. which slot gets winner Group F, runner-up Group F, and the third-place allocation combinations), and only commit the table if both sources agree; if they disagree, report the discrepancy instead of guessing. (d) Seed settings with group_lock_utc = 2026-06-14T20:00:00Z. Build the provider behind a FootballDataAdapter interface.

**Acceptance:** `prisma db seed` produces 48 teams, 104 matches, r32_allocation filled, Group F contains Nederland/Japan/Zweden/Tunesië, NL–Japan kickoff stored as 2026-06-14T20:00:00Z.

---

## Fase 2 — Live results layer + admin override

**Prompt:**
> Implement the on-demand revalidation described in CLAUDE.md: a server function refreshScores() that checks settings.last_api_fetch_utc, refetches matches from the adapter when stale (60s during live windows, 15min otherwise), and upserts status/scores into matches — skipping rows where manually_overridden = true. Wire it into the data loader of every public page. Build /beheer behind ADMIN_PASSWORD (env var, simple cookie session): table of all matches with inline editing of status and scores (sets manually_overridden), a "Herbereken klassement" button (no-op until Fase 7), settings editing (locks, knockout_open), and a "Forceer API-refresh" button showing the raw fetch result count and timestamp.

**Acceptance:** dashboard data updates within a minute during a live match without any cron; manual override survives the next API fetch; /beheer inaccessible without password.

---

## Fase 3 — Dashboard (Overzicht)

**Prompt:**
> Read /branding/brand.md and /branding/logo.* if present; follow CLAUDE.md branding rules. Build `/`: (1) tournament header with day/phase indicator and next NL match countdown; (2) the Poule F hero panel: standings table (Punten, Doelsaldo, Doelpunten voor), the six Group F matches with status/score, live matches marked with a pulsing dot; (3) a grid of the 11 other groups as compact cards: 4-row standings + matchday scores; (4) a "Beste nummers 3" widget ranking all third-placed teams by the official criteria (points, GD, goals, fair play — fair play data may be unavailable from the API; if so display the first three criteria and label the limitation honestly in the UI). Implement the full FIFA group tiebreaker order from CLAUDE.md in a pure, unit-tested standings function. Mobile-first; Poule F always first.

**Acceptance:** standings function passes unit tests covering points/GD/goals/head-to-head ties; Poule F visually dominant on a 375px viewport; live scores render from DB.

---

## Fase 4 — Scenario's tab

**Prompt:**
> Build `/scenarios`, client-side computation on top of current standings: (1) Poule F scenario-verkenner: interactive controls where the visitor sets hypothetical scores for the remaining Group F matches and instantly sees the resulting Poule F table, whether NL finishes 1/2/3/4, and — using r32_allocation — which R32 slot and possible opponents follow for each NL finishing position (for the third-place path, show it as conditional on the cross-group third-place ranking, computed from current real standings of other groups); (2) a qualification summary in plain Dutch: "Nederland is zeker van de volgende ronde als…", derived by enumerating all remaining Group F outcome combinations (W/D/L per match) and reporting guaranteed/possible/impossible per finishing position, with an honest note that exact ties depend on doelsaldo; (3) a tournament-wide projected R32 bracket based on current standings of all groups, clearly labelled "Projectie op basis van de huidige stand". No predictions are made for the user; this is purely informational.

**Acceptance:** changing a hypothetical Group F score recalculates instantly without server round-trip; the projected bracket uses only r32_allocation + live standings; enumeration logic unit-tested.

---

## Fase 5 — Voorspellen (group round) + identity

**Prompt:**
> Build `/voorspellen`. Identity: bijnaam (mandatory, unique, case-insensitive) + 4-digit pincode (mandatory, bcrypt-hashed) + volledige naam (optional) + checkbox "Toon mijn volledige naam op het klassement". First save creates the participant; returning with the same bijnaam requires the PIN to load and edit. Form sections: (1) Poule F per wedstrijd: exact scoreline inputs for the six matches (toto derived and shown live); (2) Poule F doelpunten per land: integer per team; (3) Eindstand Poule F: drag-or-select ranking 1–4, each team used exactly once; (4) Overige poules, one collapsible accordion per group A–E/G–L containing (a) exact scoreline inputs for every *eligible* match in that group (eligible per SCORING.md: kickoff_utc >= group_lock_utc; ineligible matches are not rendered) and (b) the nr. 1 / nr. 2 picks (distinct). Only the bijnaam is mandatory: partial saves are always allowed and unfilled items score 0. Show an overall progress bar plus per-group completion badges so people see what's still open. Everything editable until settings.group_lock_utc, then read-only with a clear "Deadline verstreken" state showing the user's locked predictions. Validate server-side: locks, PIN, eligibility, ranking uniqueness, non-negative integers. Include the privacy line from CLAUDE.md. Keep it fast on a phone: numeric keypad inputs, autosave per section.

**Acceptance:** two participants cannot share a bijnaam; wrong PIN cannot read or write another's predictions; writes rejected server-side after lock or for ineligible matches even if the UI is bypassed; a partial save persists correctly; the full form is navigable on a phone without scrolling fatigue (accordions collapsed by default).

---

## Fase 6 — Knock-out voorspelronde (opens ~28 June)

**Prompt:**
> Build the knockout prediction flow inside `/voorspellen`, visible only when settings.knockout_open = true and before knockout_lock_utc. Render the real R32 bracket from matches (teams now known). The user predicts per R32 match: exact score + winner (winner selector appears when the predicted score is a draw, representing ET/penalties). Winners auto-flow into the user's R16 ties, then QF, SF, troostfinale (the user's two predicted SF losers) and finale — at every later round the user fills exact score + winner. Persist as predictions_knockout per bracket_slot. Editing an upstream pick cascades: clear downstream picks that are no longer consistent, with a confirmation dialog. Same PIN identity; same lock behavior as Fase 5.

**Acceptance:** impossible brackets cannot be saved (server-side consistency check against the user's own picks); R32 ties are read-only teams; after knockout_lock_utc everything is frozen.

---

## Fase 7 — Scoring engine + Klassement

**Prompt:**
> Implement the scoring engine exactly per SCORING.md, all constants in src/config/scoring.ts. recomputeScores() is idempotent: for every participant, score Poule F matches (exact 5 else toto 2), other groups' eligible matches (exact 3 else toto 1), team goals (3), Poule F eindstand (2/position +3 bonus), other groups' nr. 1/2 (2+2), and knockout per the round table including the matchup slot rule for R16+. Only FINISHED matches count; unfilled predictions score 0; ineligible matches (kickoff before group_lock_utc) never score; eindstand and team-goals items only score once all relevant group matches are finished. Trigger recompute automatically whenever a match transitions to FINISHED (API or admin) and from the /beheer button. Build `/klassement`: rank, bijnaam (volledige naam if opted in), totaal, expandable breakdown (Poule F / Overige poules / Knock-out), tiebreak per SCORING.md, plus a small "laatst bijgewerkt" timestamp. Write unit tests for every scoring rule including the not-cumulative rule, the eligibility rule and the penalty/ET winner rule.

**Acceptance:** scoring unit tests green for all rules and edge cases (draw + shoot-out winner, matchup-correct-but-winner-wrong, partial group completion); recompute runs < 2s for 150 participants; leaderboard updates after an admin override without manual steps.

---

## Fase 8 — Polish + deploy

**Prompt:**
> Final pass: Dutch copy review across all pages against the CLAUDE.md glossary; loading/empty/error states in interface voice (no apologies, state what happened and what to do); Lighthouse mobile pass on / and /voorspellen; OG/share image so the link previews nicely in WhatsApp (this will be shared in group chats); favicon from the Van Saaze logo; verify prefers-reduced-motion; deploy to Vercel production, run the seed against production Neon, smoke-test the live API refresh, and print a launch checklist with the production URL.

**Acceptance:** production URL live; WhatsApp link preview shows title + image; a test participant can submit and appear on the klassement end-to-end in production.
