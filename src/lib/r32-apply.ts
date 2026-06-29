// Server-side application of the derived R32 allocation onto the `match` rows.
//
// The provider never delivers knockout teams, so this is how slots 73–88 get their
// homeTeamId/awayTeamId: load the final group standings, derive the 16 ties
// (r32-resolve), and write them. Guards keep the bracket honest:
//  - the whole group stage must be FINISHED (else the standings — and thus the
//    best-3rd resolution — aren't definitive), unless `force` is set;
//  - all 16 ties must resolve (all-or-nothing) so the bracket never goes half-full;
//  - a manually_overridden R32 row is never touched.
import "server-only";
import { prisma } from "./db";
import { computeStandings, type FinishedMatch, type StandingRow, type StandingTeam } from "./standings";
import { resolveR32FromStandings } from "./r32-resolve";

export interface ApplyR32Result {
  ok: boolean;
  reason?: "group_incomplete" | "unresolved" | "no_r32_rows";
  groupFinished: number;
  groupTotal: number;
  resolved: number; // ties resolved (0..16)
  written: number; // R32 rows actually updated
}

export async function applyR32Resolution(opts: { force?: boolean } = {}): Promise<ApplyR32Result> {
  const [teams, groupMatches, r32Rows] = await Promise.all([
    prisma.team.findMany({
      select: { id: true, nameNl: true, fifaCode: true, crestUrl: true, groupLetter: true },
    }),
    prisma.match.findMany({
      where: { stage: "GROUP" },
      select: { status: true, homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    }),
    prisma.match.findMany({
      where: { stage: "R32" },
      select: { id: true, bracketSlot: true, manuallyOverridden: true },
    }),
  ]);

  const groupTotal = groupMatches.length;
  const groupFinished = groupMatches.filter((m) => m.status === "FINISHED").length;
  const allDone = groupTotal > 0 && groupFinished === groupTotal;
  if (!allDone && !opts.force) {
    return { ok: false, reason: "group_incomplete", groupFinished, groupTotal, resolved: 0, written: 0 };
  }

  // Ranked standings per group, computed from the FINISHED group matches. (computeStandings
  // ignores matches whose teams aren't in the group, so one finished[] list is safe for all.)
  const byGroup = new Map<string, StandingTeam[]>();
  for (const t of teams) {
    if (!t.groupLetter) continue;
    const arr = byGroup.get(t.groupLetter) ?? [];
    arr.push({ id: t.id, nameNl: t.nameNl, fifaCode: t.fifaCode, crestUrl: t.crestUrl });
    byGroup.set(t.groupLetter, arr);
  }
  const finished: FinishedMatch[] = groupMatches
    .filter((m) => m.status === "FINISHED" && m.homeTeamId && m.awayTeamId && m.homeScore != null && m.awayScore != null)
    .map((m) => ({ homeTeamId: m.homeTeamId!, awayTeamId: m.awayTeamId!, homeScore: m.homeScore!, awayScore: m.awayScore! }));

  const groupStandings: Record<string, StandingRow[]> = {};
  for (const [letter, gteams] of byGroup) groupStandings[letter] = computeStandings(gteams, finished);

  const { assignments, complete } = resolveR32FromStandings(groupStandings);
  if (!complete) {
    return { ok: false, reason: "unresolved", groupFinished, groupTotal, resolved: assignments.length, written: 0 };
  }

  const rowBySlot = new Map(r32Rows.map((r) => [r.bracketSlot, r]));
  if (rowBySlot.size === 0) {
    return { ok: false, reason: "no_r32_rows", groupFinished, groupTotal, resolved: assignments.length, written: 0 };
  }

  const updates = [];
  for (const a of assignments) {
    const row = rowBySlot.get(a.bracketSlot);
    if (!row || row.manuallyOverridden) continue;
    updates.push(
      prisma.match.update({
        where: { id: row.id },
        data: { homeTeamId: a.homeTeamId, awayTeamId: a.awayTeamId },
      }),
    );
  }

  await prisma.$transaction(updates);
  return { ok: true, groupFinished, groupTotal, resolved: assignments.length, written: updates.length };
}
