/* Confirms the eligibility invariant: settings.group_lock_utc == NL–Japan kickoff_utc.
   Also exercises the POOLED runtime connection (datasource `url`). */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const lockSetting = await prisma.setting.findUnique({ where: { key: "group_lock_utc" } });
  if (!lockSetting) throw new Error("settings.group_lock_utc not found");

  const nlJapan = await prisma.match.findFirst({
    where: {
      groupLetter: "F",
      AND: [
        { OR: [{ homeTeam: { fifaCode: "NED" } }, { awayTeam: { fifaCode: "NED" } }] },
        { OR: [{ homeTeam: { fifaCode: "JPN" } }, { awayTeam: { fifaCode: "JPN" } }] },
      ],
    },
  });
  if (!nlJapan) throw new Error("NL–Japan match not found");

  const lockMs = new Date(lockSetting.value).getTime();
  const kickoffMs = nlJapan.kickoffUtc.getTime();
  const expected = Date.UTC(2026, 5, 14, 20, 0, 0); // 2026-06-14T20:00:00Z

  console.log("group_lock_utc (settings):     ", new Date(lockMs).toISOString(), `(raw "${lockSetting.value}")`);
  console.log("NL–Japan kickoff_utc (matches):", new Date(kickoffMs).toISOString());
  console.log("expected:                      ", new Date(expected).toISOString());

  const equal = lockMs === kickoffMs && lockMs === expected;
  console.log(`\n${equal ? "✓" : "✗"} group_lock_utc === NL–Japan kickoff_utc === 2026-06-14T20:00:00Z`);
  console.log(
    `  eligibility rule (kickoff >= lock) makes NL–Japan the FIRST eligible match: ${kickoffMs >= lockMs}`,
  );
  if (!equal) {
    console.error("MISMATCH — eligibility boundary is wrong.");
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
