// Canonical FIFA knockout schedule: FIFA match number (73–104) -> kickoff UTC.
//
// WHY this exists: the FIFA match number is the single canonical bracket_slot
// identifier across the app. The provider (football-data.org) returns knockout
// matches with NULL teams and NO match number — only stage + kickoff. And FIFA
// match number order is NOT kickoff order (e.g. on 29 June, match 76 kicks off
// at 17:00Z, before 74 at 20:30Z and 75 the next day at 01:00Z), so we cannot
// derive the number from kickoff ordering. Instead we map each provider match
// to its FIFA number by exact (stage, kickoff) against this table.
//
// SOURCE: FIFA World Cup 26 Match Schedule (kickoff times, all Eastern Time) +
// Wikipedia "2026 FIFA World Cup knockout stage" bracket (per-match dates,
// identified by group sources / "Winner Match N"). Each UTC value below =
// (date) + (ET time) + 4h (EDT). Cross-checked: this table is a perfect
// bijection with the provider's 32 knockout (stage, utcDate) pairs (verified in
// the seed at runtime and in tests/bracket.test.ts).

import type { ProviderStage } from "../../src/lib/adapters/types";

export interface KoScheduleEntry {
  matchNumber: number; // FIFA match number, 73–104
  stage: Exclude<ProviderStage, "GROUP">;
  kickoffUtc: string; // ISO-8601 UTC
}

export const KO_SCHEDULE: KoScheduleEntry[] = [
  // Round of 32 (73–88)
  { matchNumber: 73, stage: "R32", kickoffUtc: "2026-06-28T19:00:00Z" }, // 2A v 2B
  { matchNumber: 74, stage: "R32", kickoffUtc: "2026-06-29T20:30:00Z" }, // 1E v 3·ABCDF
  { matchNumber: 75, stage: "R32", kickoffUtc: "2026-06-30T01:00:00Z" }, // 1F v 2C
  { matchNumber: 76, stage: "R32", kickoffUtc: "2026-06-29T17:00:00Z" }, // 1C v 2F
  { matchNumber: 77, stage: "R32", kickoffUtc: "2026-06-30T21:00:00Z" }, // 1I v 3·CDFGH
  { matchNumber: 78, stage: "R32", kickoffUtc: "2026-06-30T17:00:00Z" }, // 2E v 2I
  { matchNumber: 79, stage: "R32", kickoffUtc: "2026-07-01T01:00:00Z" }, // 1A v 3·CEFHI
  { matchNumber: 80, stage: "R32", kickoffUtc: "2026-07-01T16:00:00Z" }, // 1L v 3·EHIJK
  { matchNumber: 81, stage: "R32", kickoffUtc: "2026-07-02T00:00:00Z" }, // 1D v 3·BEFIJ
  { matchNumber: 82, stage: "R32", kickoffUtc: "2026-07-01T20:00:00Z" }, // 1G v 3·AEHIJ
  { matchNumber: 83, stage: "R32", kickoffUtc: "2026-07-02T23:00:00Z" }, // 2K v 2L
  { matchNumber: 84, stage: "R32", kickoffUtc: "2026-07-02T19:00:00Z" }, // 1H v 2J
  { matchNumber: 85, stage: "R32", kickoffUtc: "2026-07-03T03:00:00Z" }, // 1B v 3·EFGIJ
  { matchNumber: 86, stage: "R32", kickoffUtc: "2026-07-03T22:00:00Z" }, // 1J v 2H
  { matchNumber: 87, stage: "R32", kickoffUtc: "2026-07-04T01:30:00Z" }, // 1K v 3·DEIJL
  { matchNumber: 88, stage: "R32", kickoffUtc: "2026-07-03T18:00:00Z" }, // 2D v 2G
  // Round of 16 (89–96)
  { matchNumber: 89, stage: "R16", kickoffUtc: "2026-07-04T21:00:00Z" }, // W74 v W77
  { matchNumber: 90, stage: "R16", kickoffUtc: "2026-07-04T17:00:00Z" }, // W73 v W75
  { matchNumber: 91, stage: "R16", kickoffUtc: "2026-07-05T20:00:00Z" }, // W76 v W78
  { matchNumber: 92, stage: "R16", kickoffUtc: "2026-07-06T00:00:00Z" }, // W79 v W80
  { matchNumber: 93, stage: "R16", kickoffUtc: "2026-07-06T19:00:00Z" }, // W83 v W84
  { matchNumber: 94, stage: "R16", kickoffUtc: "2026-07-07T00:00:00Z" }, // W81 v W82
  { matchNumber: 95, stage: "R16", kickoffUtc: "2026-07-07T16:00:00Z" }, // W86 v W88
  { matchNumber: 96, stage: "R16", kickoffUtc: "2026-07-07T20:00:00Z" }, // W85 v W87
  // Quarter-finals (97–100)
  { matchNumber: 97, stage: "QF", kickoffUtc: "2026-07-09T20:00:00Z" }, // W89 v W90
  { matchNumber: 98, stage: "QF", kickoffUtc: "2026-07-10T19:00:00Z" }, // W93 v W94
  { matchNumber: 99, stage: "QF", kickoffUtc: "2026-07-11T21:00:00Z" }, // W91 v W92
  { matchNumber: 100, stage: "QF", kickoffUtc: "2026-07-12T01:00:00Z" }, // W95 v W96
  // Semi-finals (101–102)
  { matchNumber: 101, stage: "SF", kickoffUtc: "2026-07-14T19:00:00Z" }, // W97 v W98
  { matchNumber: 102, stage: "SF", kickoffUtc: "2026-07-15T19:00:00Z" }, // W99 v W100
  // Third place (103) + Final (104)
  { matchNumber: 103, stage: "THIRD_PLACE", kickoffUtc: "2026-07-18T21:00:00Z" }, // L101 v L102
  { matchNumber: 104, stage: "FINAL", kickoffUtc: "2026-07-19T19:00:00Z" }, // W101 v W102
];

/** Lookup key: `${stage}|${kickoffUtc}`. */
export const KO_BY_STAGE_KICKOFF = new Map(
  KO_SCHEDULE.map((e) => [`${e.stage}|${e.kickoffUtc}`, e.matchNumber]),
);
