# DATAMODEL.md — Prisma schema blueprint

Postgres (Neon). Prisma. All timestamps UTC (`timestamptz`). Adjust field types where Prisma idioms demand, but keep names and relations.

## participants
- id (cuid)
- nickname — unique, case-insensitive unique index, 2–24 chars
- full_name — nullable
- show_full_name — boolean, default false
- pin_hash — bcrypt of 4-digit PIN
- created_at

## teams
- id
- api_team_id — provider's team id, unique
- fifa_code (e.g. NED, JPN)
- name_nl (e.g. "Nederland", "Japan") — mapping table for Dutch names lives in seed
- group_letter (A–L)
- flag_emoji or crest_url (provider supplies crest URLs)

## matches
- id
- api_match_id — unique
- stage — enum: GROUP, R32, R16, QF, SF, THIRD_PLACE, FINAL
- group_letter — nullable (group stage only)
- bracket_slot — nullable string, e.g. "R32-03", "QF-1" (knockout only; stable slot id derived from the official schedule's match numbers)
- home_team_id / away_team_id — nullable until known (knockout placeholders)
- kickoff_utc
- venue
- status — enum: SCHEDULED, LIVE, FINISHED
- home_score / away_score — full-time incl. extra time
- went_to_extra_time — boolean
- penalty_winner_team_id — nullable
- manually_overridden — boolean, default false (API never overwrites when true)
- updated_at

## predictions_group_match  (all eligible group matches, every group)
- participant_id + match_id (composite unique)
- home_goals / away_goals
(Outcome 1/X/2 derived, never stored. Eligible = kickoff_utc >= settings.group_lock_utc; enforce on write and in scoring.)

## predictions_group_rank
- participant_id + group_letter + position (composite unique)
- team_id
(For Poule F: positions 1–4. Other groups: positions 1–2 only. Enforce in app layer.)

## predictions_team_goals  (Poule F teams only)
- participant_id + team_id (composite unique)
- goals — int ≥ 0

## predictions_knockout
- participant_id + bracket_slot (composite unique)
- home_team_id / away_team_id — the user's predicted tie (R32 pre-filled with real teams, locked)
- home_goals / away_goals
- winner_team_id — must equal home or away; for drawn predicted scorelines this is the predicted shoot-out/ET winner

## scores  (cache, fully recomputable)
- participant_id (unique)
- points_group_f / points_other_groups / points_knockout / points_total
- exact_count (for tiebreak), computed_at

## settings  (key/value)
- group_lock_utc — default 2026-06-14T20:00:00Z
- knockout_open — boolean, default false
- knockout_lock_utc — nullable, set by admin from R32 schedule
- last_api_fetch_utc, api_provider

## r32_allocation  (static seed)
The official FIFA mapping from group results to R32 slots, including the third-place allocation table. Seed from FIFA's official schedule/regulations, cross-checked (see CLAUDE.md Hard rule 1). Structure: bracket_slot → { home_source: "1F" | "2C" | "3rd(pool of groups)" , away_source: ... } plus the third-place combination table.

## Integrity rules (app layer)
- Predictions writable only when `now < relevant lock` and PIN verifies.
- Nickname claim: first save creates participant; later edits require PIN.
- Group rank predictions: a team may appear in only one position per group per participant.
- Knockout: predicted teams for R16+ must be consistent with the participant's own upstream picks (the bracket UI guarantees this; validate server-side anyway).
- Score recompute is idempotent: wipe + recompute per participant from raw predictions + finished matches.
