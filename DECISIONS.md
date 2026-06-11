# DECISIONS.md — unattended session (Fase 3–5)

Conservative choices made where the specs were silent, per the session rules.
Newest first.

## Session setup

- **Git repo initialized.** The project directory was not a git repo. Created one
  (`main` branch) and made a baseline commit of the existing Fase 1+2 work so each
  fase commit is clean and reviewable. Staying on `main` (the "current branch").
- **Research artifacts ignored.** `wiki_*.wikitext` (raw Wikipedia source used to
  parse the R32 table) are gitignored; the validated output
  `prisma/data/r32-allocation.generated.json` is committed as the source of truth.

## Session resume (Fase 3 already complete)

- **Fase 3 was already built and committed** (`957a607`) in a prior unattended
  session; the working tree was clean and the full suite (41 tests) green on
  re-run. This session's brief listed Fase 3→4→5, but re-implementing a verified,
  committed phase from scratch would risk regressing working code for no benefit.
  Conservative choice: re-verify Fase 3's acceptance (tests + build green) and
  proceed to Fase 4 and Fase 5. No Fase 3 changes made.

## Fase 3

- **Branding fallback.** `/branding` is absent (no `brand.md`, no `logo.*`). Per
  CLAUDE.md, building with neutral tokens (`--brand-primary` navy, `--brand-accent`
  oranje #FF7A00) and flagging it, rather than guessing Van Saaze colours/logo.
  Hero/accents use the oranje token so a later swap is one CSS change.
- **Fair play unavailable.** football-data.org exposes no disciplinary data, so
  the FIFA "fair play" tiebreaker can't be computed. Standings use points → GD →
  goals → head-to-head → (fair play skipped) → drawing of lots (deterministic by
  FIFA code), and the "Beste nummers 3" widget states this limitation honestly.
- **Verification method (allowlist constraint).** The session `settings.json`
  allowlist does not include `curl`/`ls`/`node -e`/`mkdir`, so runtime HTTP
  smoke-tests via `curl` prompt (and would block an unattended run). Fase 3 was
  verified via `next build` (green), full `vitest` (41 passing), and the
  already-proven DB read path from Fase 2. The night run verifies pages through
  `npx next build` + `npx vitest` + `npx tsx` scripts only — never `curl`/`next
  start`, and only allowlisted tools (Edit/Write, npm/npx, git add/commit/status/diff).
