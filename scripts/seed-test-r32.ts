// TEST-ONLY: populate the 16 R32 ties with plausible teams so the knockout picker
// can be exercised BEFORE the real group stage finishes. It builds a deterministic
// fake ranking per group (teams sorted by FIFA code) and runs the SAME resolver the
// real /beheer button uses (resolveR32FromStandings), then writes home/awayTeamId
// onto the R32 matches.
//
//   npx tsx scripts/seed-test-r32.ts            # DRY-RUN: print what it would write
//   npx tsx scripts/seed-test-r32.ts --write    # actually persist
//   npx tsx scripts/clear-test-r32.ts --write   # revert (teams back to null)
//
// Note: writes to the LIVE DB. R32 fixtures become visible on the public homepage.
// It does NOT flip knockout_open — opening the picker for participants is a separate
// deliberate step in /beheer. manually_overridden rows are never touched.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resolveR32FromStandings } from "../src/lib/r32-resolve";
import type { StandingRow, StandingTeam } from "../src/lib/standings";

const WRITE = process.argv.includes("--write");
const prisma = new PrismaClient();

function row(team: StandingTeam, rank: number, points: number): StandingRow {
  return {
    team,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points,
    rank,
    decidedByLots: false,
  };
}

async function main() {
  const allTeams = await prisma.team.findMany({
    select: { id: true, nameNl: true, fifaCode: true, crestUrl: true, groupLetter: true },
  });
  const teams = allTeams.filter((t) => t.groupLetter);

  const byGroup = new Map<string, typeof teams>();
  for (const t of teams) {
    const arr = byGroup.get(t.groupLetter!) ?? [];
    arr.push(t);
    byGroup.set(t.groupLetter!, arr);
  }

  // Deterministic fake ranking: sort each group by FIFA code, rank 1..4. Distinct
  // points per group keep the cross-group 3rd-place ranking deterministic too.
  const groupStandings: Record<string, StandingRow[]> = {};
  const letters = [...byGroup.keys()].sort();
  letters.forEach((letter, gi) => {
    const sorted = [...byGroup.get(letter)!].sort((a, b) => a.fifaCode.localeCompare(b.fifaCode));
    groupStandings[letter] = sorted
      .slice(0, 4)
      .map((t, i) =>
        row({ id: t.id, nameNl: t.nameNl, fifaCode: t.fifaCode, crestUrl: t.crestUrl }, i + 1, (4 - (i + 1)) * 10 + (letters.length - gi)),
      );
  });

  const { assignments, complete } = resolveR32FromStandings(groupStandings);
  const name = new Map(teams.map((t) => [t.id, t.nameNl]));
  console.log(`Groepen: ${letters.length} · R32 opgelost: ${assignments.length}/16 · compleet=${complete}\n`);
  for (const a of assignments.sort((x, y) => Number(x.bracketSlot) - Number(y.bracketSlot))) {
    console.log(`  slot ${a.bracketSlot}: ${name.get(a.homeTeamId)} vs ${name.get(a.awayTeamId)}`);
  }

  if (!complete) {
    console.log("\nNiet compleet — niets geschreven.");
    return;
  }
  if (!WRITE) {
    console.log("\nDRY-RUN. Voeg --write toe om dit echt naar de R32-matches te schrijven.");
    return;
  }

  const r32Rows = await prisma.match.findMany({
    where: { stage: "R32" },
    select: { id: true, bracketSlot: true, manuallyOverridden: true },
  });
  const rowBySlot = new Map(r32Rows.map((r) => [r.bracketSlot, r]));
  const updates = [];
  for (const a of assignments) {
    const m = rowBySlot.get(a.bracketSlot);
    if (!m || m.manuallyOverridden) continue;
    updates.push(prisma.match.update({ where: { id: m.id }, data: { homeTeamId: a.homeTeamId, awayTeamId: a.awayTeamId } }));
  }
  await prisma.$transaction(updates);
  console.log(`\nGeschreven: ${updates.length} R32-matches. Revert met: npx tsx scripts/clear-test-r32.ts --write`);
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
