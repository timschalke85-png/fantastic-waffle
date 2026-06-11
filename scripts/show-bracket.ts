import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const r32 = await p.match.findMany({
    where: { stage: "R32" },
    select: { bracketSlot: true, kickoffUtc: true },
    orderBy: { kickoffUtc: "asc" },
  });
  console.log("First 6 R32 matches in KICKOFF order (bracket_slot = FIFA number, NOT kickoff order):");
  for (const m of r32.slice(0, 6)) {
    console.log(`  bracket_slot ${m.bracketSlot}  @ ${m.kickoffUtc.toISOString()}`);
  }

  const a = await p.r32Allocation.findUnique({ where: { bracketSlot: "75" } });
  console.log(
    "\nr32_allocation slot 75:",
    a ? `${a.homeSource} vs ${a.awaySource} (FIFA match ${a.matchNumber})` : "MISSING",
  );

  console.log("\nrow counts:", {
    teams: await p.team.count(),
    matches: await p.match.count(),
    r32_allocation: await p.r32Allocation.count(),
    third_place_combinations: await p.thirdPlaceCombination.count(),
  });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
