// READ-ONLY knockout diagnose. Geen writes. Print geen secrets.
// Run: npx tsx scripts/diag-knockout.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) R32-basisteams: de hele picker hangt hieraan (r32Complete-gate).
  const r32 = await prisma.match.findMany({
    where: { stage: "R32" },
    select: { bracketSlot: true, homeTeamId: true, awayTeamId: true, status: true, kickoffUtc: true },
    orderBy: { bracketSlot: "asc" },
  });
  const bothKnown = r32.filter((m) => m.homeTeamId && m.awayTeamId).length;

  console.log("=== R32 (slots 73-88) ===");
  console.log(`rows=${r32.length}  met beide teams=${bothKnown}/16  -> r32Complete=${bothKnown === 16}`);
  for (const m of r32) {
    console.log(
      `  slot ${m.bracketSlot ?? "?"}  ${m.homeTeamId ? "H+" : "H-"} ${m.awayTeamId ? "A+" : "A-"}  ${m.status}  ${m.kickoffUtc.toISOString()}`,
    );
  }

  // 2) Stage-verdeling van alle matches (zien of R32/R16/etc. überhaupt bestaan).
  const byStage = await prisma.match.groupBy({ by: ["stage"], _count: { _all: true } });
  console.log("\n=== Matches per stage ===");
  for (const s of byStage) console.log(`  ${s.stage}: ${s._count._all}`);

  // 3) Knockout-instellingen (open/lock).
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["knockout_open", "knockout_lock_utc", "group_lock_utc"] } },
  });
  console.log("\n=== Settings ===");
  for (const s of settings) console.log(`  ${s.key} = ${s.value}`);

  // 4) Hoeveel knockout-voorspellingen staan er al?
  const predCount = await prisma.predictionKnockout.count();
  const predWithNullTeams = await prisma.predictionKnockout.count({
    where: { OR: [{ homeTeamId: null }, { awayTeamId: null }] },
  });
  console.log("\n=== predictions_knockout ===");
  console.log(`  totaal=${predCount}  met null team(s)=${predWithNullTeams}`);

  // 5) Groepsfase-volledigheid: R32-teams zijn pas af te leiden als alle
  //    groepswedstrijden FINISHED zijn (met scores).
  const groupByStatus = await prisma.match.groupBy({
    by: ["status"],
    where: { stage: "GROUP" },
    _count: { _all: true },
  });
  console.log("\n=== GROUP-wedstrijden per status ===");
  for (const s of groupByStatus) console.log(`  ${s.status}: ${s._count._all}`);

  console.log("\nKlaar (read-only).");
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
