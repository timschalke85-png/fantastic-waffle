/* Query the REAL database for Group F teams + the NL–Japan kickoff. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const teams = await prisma.team.findMany({
    where: { groupLetter: "F" },
    orderBy: { nameNl: "asc" },
    select: { fifaCode: true, nameNl: true, nameEn: true, groupLetter: true, apiTeamId: true },
  });
  console.log("Group F teams (teams table):");
  console.table(teams);

  const ned = teams.find((t) => t.fifaCode === "NED");
  const jpn = teams.find((t) => t.fifaCode === "JPN");
  const nlJapan = await prisma.match.findFirst({
    where: {
      groupLetter: "F",
      AND: [
        { OR: [{ homeTeam: { fifaCode: "NED" } }, { awayTeam: { fifaCode: "NED" } }] },
        { OR: [{ homeTeam: { fifaCode: "JPN" } }, { awayTeam: { fifaCode: "JPN" } }] },
      ],
    },
    include: { homeTeam: true, awayTeam: true },
  });

  console.log("\nNetherlands–Japan (matches table):");
  if (nlJapan) {
    console.log(`  ${nlJapan.homeTeam?.nameNl} – ${nlJapan.awayTeam?.nameNl}`);
    console.log(`  kickoff_utc : ${nlJapan.kickoffUtc.toISOString()}`);
    console.log(`  stage       : ${nlJapan.stage}`);
    console.log(`  status      : ${nlJapan.status}`);
    console.log(`  api_match_id: ${nlJapan.apiMatchId}`);
  } else {
    console.log("  NOT FOUND");
  }
  void ned;
  void jpn;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
