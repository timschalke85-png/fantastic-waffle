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

## Fase 5

- **Participant session without a new env secret.** The session cookie carries
  `${id}.sha256(id+pin_hash)`. Because `pin_hash` is a server-only bcrypt digest,
  the token can't be forged without DB access — same shape as the existing
  admin-auth. Conservative: avoids assuming a `SESSION_SECRET` env var exists.
- **Eligibility applied uniformly, data-driven.** SCORING.md says ineligible group
  matches (kickoff < group_lock_utc) are "not shown in the form, never scored".
  FASEN Fase 5 phrases Poule F as "the six matches". Reconciled by rendering only
  matches with `kickoff_utc >= group_lock_utc` for *every* group including F, read
  from real kickoffs at runtime (no hard-coded assumption about which qualify). If
  all six Poule F matches are at/after the lock they all appear; any pre-lock one
  is excluded to honour the fairness rule. NL–Japan (at the lock) is eligible.
- **Identity name fields at registration.** `volledige naam` + "toon mijn naam"
  are captured on first save (account creation); returning users edit them via a
  separate profiel-sectie. The login form only applies them when creating.
- **Autosave semantics.** Each section autosaves debounced (800ms). A "partial"
  scoreline (exactly one side filled) is intentionally NOT saved and is not an
  error — it simply waits until both sides are entered. Empty clears the pick.
- **vitest.config.ts added** for the `@/*` path alias so the server-action layer
  can be unit-tested. Additive; existing relative-import tests are unaffected.
- **No live-DB integration run.** Server actions need a request/cookie context and
  writing to the production Neon DB would pollute real data, so Fase 5 was
  validated via pure unit tests (validation rules) + mocked action tests
  (auth/lock/eligibility/ranking guards) + the type-checking `next build`. A live
  end-to-end smoke test (register, save, reload, lock) is left for Tim — see
  NACHTRAPPORT.

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
