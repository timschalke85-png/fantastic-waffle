// Revert the test R32 seed: set R32 home/awayTeamId back to null. Never touches a
// manually_overridden row. DRY-RUN by default; pass --write to apply.
//   npx tsx scripts/clear-test-r32.ts            # show what it would clear
//   npx tsx scripts/clear-test-r32.ts --write    # actually clear
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const WRITE = process.argv.includes("--write");
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.match.findMany({
    where: { stage: "R32" },
    select: { id: true, bracketSlot: true, manuallyOverridden: true, homeTeamId: true, awayTeamId: true },
  });
  const target = rows.filter((r) => !r.manuallyOverridden && (r.homeTeamId || r.awayTeamId));
  console.log(`R32-rijen met teams (niet handmatig): ${target.length}`);

  if (!WRITE) {
    console.log("DRY-RUN. Voeg --write toe om de R32-teams terug op null te zetten.");
    return;
  }
  await prisma.$transaction(
    target.map((r) => prisma.match.update({ where: { id: r.id }, data: { homeTeamId: null, awayTeamId: null } })),
  );
  console.log(`Teruggezet naar null: ${target.length} R32-matches.`);
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
