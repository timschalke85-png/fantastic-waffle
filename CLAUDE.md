# WK 2026 Poule — Hotel van Saaze

Friendly (non-betting) FIFA World Cup 2026 prediction pool for ~100–150 friends. Live dashboard + prediction forms + leaderboard. UI language: **Dutch only**. Mobile-first (most users on phones).

## Hard rules

1. **No invented facts.** All teams, fixtures, kickoff times, venues and results come from the football data API (single source of truth). Never hard-code a result or fixture from memory. The only hard-coded tournament data allowed is the official FIFA Round-of-32 bracket allocation table, and it must be sourced from FIFA's official match schedule/regulations and cross-checked against Wikipedia's "2026 FIFA World Cup knockout stage" page before committing.
2. **Timezone**: store everything in UTC, display everything in Europe/Amsterdam.
3. **Dutch UI** throughout. See glossary at the bottom. Code, comments, commits in English.
4. **All scoring values live in one config file** (`src/config/scoring.ts`) mirroring `SCORING.md`. Never scatter point values through the code.
5. Read `SCORING.md`, `DATAMODEL.md` and `FASEN.md` before writing code. Work phase by phase; do not skip ahead.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Prisma + Neon Postgres (Vercel marketplace integration)
- Deployed on Vercel (existing account, Hobby plan — **no cron jobs**, see data strategy)
- No auth library. Identity = nickname + 4-digit PIN (bcrypt-hashed). Admin = single `ADMIN_PASSWORD` env var on `/beheer`.

## Live data strategy (no cron available)

On-demand revalidation: a server route checks a `data_cache` timestamp on every dashboard request.
- If any match is live or within a match window: refetch from the API when cache is older than **60s**.
- Otherwise: refetch when older than **15 min**.
- football-data.org free tier allows 10 req/min; this pattern stays far under it.
- Every fetched result is upserted into the `matches` table, so the DB is always the render source. The admin override page can correct any result manually; manually overridden matches are flagged and never overwritten by the API.

Primary API: football-data.org v4, competition code `WC`. **Phase 1 must verify** that WC2026 fixtures are actually returned on the free tier before building anything on top. Fallback if not: API-Football (api-sports.io) free tier. Abstract the fetcher behind one adapter interface so the provider can be swapped.

## Key dates (verify against API in Phase 1, do not trust this file over the API)

- Tournament: June 11 – July 19, 2026. Group stage ends June 27. R32 starts ~June 28. Final July 19, East Rutherford NJ.
- Group F: Netherlands, Japan, Sweden, Tunisia. NL–Japan June 14 20:00 UTC (Arlington), Sweden–Tunisia June 14/15 (Monterrey), NL–Sweden June 20 (Houston), Tunisia–Japan June 20/21 (Monterrey), Japan–Sweden + Tunisia–NL June 25 (Arlington / Kansas City).
- **Group prediction lock (global): 2026-06-14T20:00:00Z** (22:00 NL). Stored in `settings`, admin-editable.
- **Knockout prediction round**: opened by admin once all 72 group matches are final and the R32 bracket is set (~June 27/28); locks at first R32 kickoff (admin sets exact timestamp from the API).

## Tournament format facts (for standings + scenario logic)

- 48 teams, 12 groups (A–L) of 4. Top 2 per group advance + 8 best nr. 3's → Round of 32.
- Group tiebreakers in order: points, goal difference, goals scored, head-to-head (points, GD, goals), fair play, drawing of lots.
- Third-place ranking across groups: points, goal difference, goals scored, fair play.
- Knockout: R32 → R16 → QF → SF → 3rd-place match → Final. Extra time + penalties from R32 onward.
- R32 pairings involving third-placed teams depend on *which* groups the eight nr. 3's come from (FIFA allocation table — see Hard rule 1).

## Branding

Base identity: **Hotel van Saaze** with oranje/WK accents. Tim places assets in `/branding`:
- `logo.svg` (or .png) + `brand.md` containing the official hex codes and font names.
- Read `/branding/brand.md` before styling. If assets are missing, build with neutral tokens (`--brand-primary`, `--brand-accent: oranje #FF7A00`-class placeholder) and flag it; never approximate the logo or guess brand colors.

Design direction:
- The dashboard hero is **Poule F**: visually dominant panel (larger card, oranje accent border, NL flag emphasis), all other groups in a quieter grid below. Group F is pinned first regardless of sort.
- Scoreboard-style numerals for scores (tabular figures), restrained motion (a subtle live-pulse dot on matches in play is enough), strong typographic hierarchy over decoration.
- Quality floor: responsive to 360px, visible keyboard focus, `prefers-reduced-motion` respected.
- Avoid generic AI-design defaults (cream + serif + terracotta; black + acid green). Derive the palette from Van Saaze brand tokens + oranje.

## Privacy

- Mandatory: bijnaam (unique). Optional: volledige naam + checkbox "Toon mijn volledige naam op het klassement".
- Store nothing else personal. No e-mail, no tracking, no third-party analytics.
- One line under the form: "Alleen je bijnaam is zichtbaar voor anderen, tenzij je zelf je naam toont. Dit is een spel onder vrienden, geen kansspel."

## Dutch UI glossary (use consistently)

| Concept | Dutch |
|---|---|
| Dashboard / overview | Overzicht |
| Group | Poule (Poule F, etc.) |
| Standings | Stand |
| Match | Wedstrijd |
| Prediction | Voorspelling / Voorspellen |
| Knockout stage | Knock-outfase |
| Round of 32 / 16 | Achtste... nee: "Zestiende finale" (R32) / "Achtste finale" (R16) |
| Quarter/Semi/Final | Kwartfinale / Halve finale / Finale |
| 3rd place match | Troostfinale |
| Possible outcomes tab | Scenario's |
| Leaderboard | Klassement |
| Nickname | Bijnaam |
| Full name | Volledige naam |
| Lock/deadline | Deadline |
| Points | Punten |
| Goal difference | Doelsaldo |
| Goals scored | Doelpunten voor |
| Win/draw/loss | Winst / Gelijk / Verlies |
| Admin page | Beheer |
| Submit | Opslaan |
| Saved confirmation | Opgeslagen |

Routes: `/` (Overzicht), `/scenarios`, `/voorspellen`, `/klassement`, `/beheer`.
