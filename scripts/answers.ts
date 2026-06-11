/* Answers the three verification questions with real output. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { getAdapter } from "../src/lib/adapters";
import { NAME_NL } from "../prisma/data/name-nl";
import { R32_SLOTS } from "../prisma/data/r32-allocation";

async function main() {
  const snap = await getAdapter().getCompetitionSnapshot();

  // (1) API verification result
  const group = snap.matches.filter((m) => m.stage === "GROUP");
  const earliest = [...group].sort((a, b) => +new Date(a.kickoffUtc) - +new Date(b.kickoffUtc))[0];
  console.log("=== (1) API verification (live football-data.org) ===");
  console.log(`matches returned:        ${snap.matches.length}`);
  console.log(`group-stage matches:     ${group.length}`);
  console.log(`earliest group kickoff:  ${earliest.kickoffUtc}`);

  // (2) DB query — attempt it for real, then fall back to source data
  console.log("\n=== (2) Group F teams + NL–Japan kickoff_utc ===");
  const prisma = new PrismaClient();
  try {
    const dbTeams = await Promise.race([
      prisma.team.findMany({ where: { groupLetter: "F" } }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout after 8s")), 8000)),
    ]);
    console.log("LIVE DB rows:", dbTeams);
  } catch (e) {
    console.log(`LIVE DB QUERY FAILED (database not seeded; .env DATABASE_URL is a placeholder):`);
    console.log(`  ${(e as Error).message.split("\n")[0]}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
  // Source-of-truth (what the seed WILL write), from the live API + name_nl map:
  const idToCode = new Map(snap.teams.map((t) => [t.apiTeamId, t.fifaCode]));
  console.log("\nFrom verified source (live API + name_nl), Group F:");
  for (const t of snap.teams.filter((t) => t.groupLetter === "F")) {
    console.log(`  ${t.fifaCode}  ${NAME_NL[t.fifaCode]}  (api id ${t.apiTeamId})`);
  }
  const nlJapan = snap.matches.find(
    (m) =>
      m.groupLetter === "F" &&
      [m.homeApiTeamId, m.awayApiTeamId].map((i) => idToCode.get(i ?? -1)).sort().join(",") === "JPN,NED",
  );
  console.log(`NL–Japan kickoff_utc:    ${nlJapan?.kickoffUtc}`);

  // (3) Full r32_allocation table
  console.log("\n=== (3) r32_allocation (16 slots, FIFA-sourced) ===");
  console.log("slot     match  home  away");
  for (const s of R32_SLOTS) {
    console.log(
      `${s.bracketSlot}   ${String(s.matchNumber).padEnd(5)}  ${s.homeSource.padEnd(4)}  ${s.awaySource}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
