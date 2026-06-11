/* Verifies Fase 2 acceptance: a manually overridden match survives the next API
   fetch, while non-overridden matches are driven by the API. Restores state after. */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { refreshMatchData } from "../src/lib/refresh";
import { setSetting } from "../src/lib/settings";

async function main() {
  const victim = await prisma.match.findFirst({ where: { groupLetter: "A" }, orderBy: { kickoffUtc: "asc" } });
  const control = await prisma.match.findFirst({ where: { groupLetter: "B" }, orderBy: { kickoffUtc: "asc" } });
  if (!victim || !control) throw new Error("no test matches");

  // 1) Admin sets a manual result.
  await prisma.match.update({
    where: { id: victim.id },
    data: { status: "FINISHED", homeScore: 2, awayScore: 1, manuallyOverridden: true },
  });

  // 2) Force a stale cache so the refresh actually fetches.
  await setSetting("last_api_fetch_utc", "2000-01-01T00:00:00Z");
  const r = await refreshMatchData({ force: true });

  // 3) Inspect.
  const after = await prisma.match.findUnique({ where: { id: victim.id } });
  const ctrlAfter = await prisma.match.findUnique({ where: { id: control.id } });

  const overrideSurvived =
    after?.manuallyOverridden === true &&
    after?.homeScore === 2 &&
    after?.awayScore === 1 &&
    after?.status === "FINISHED";

  console.log("refresh result:", {
    refreshed: r.refreshed,
    fetchedCount: r.fetchedCount,
    updated: r.updated,
    skippedOverridden: r.skippedOverridden,
  });
  console.log(`\n${overrideSurvived ? "✓" : "✗"} manual override survived the API fetch (2-1 FINISHED, flag kept)`);
  console.log(
    `  control match (not overridden) reflects API: status=${ctrlAfter?.status}, override=${ctrlAfter?.manuallyOverridden}`,
  );
  console.log(`  skippedOverridden >= 1: ${r.skippedOverridden >= 1}`);

  // 4) Restore: clear the override and re-pull so the DB matches the API again.
  await prisma.match.update({
    where: { id: victim.id },
    data: { status: "SCHEDULED", homeScore: null, awayScore: null, manuallyOverridden: false },
  });
  await setSetting("last_api_fetch_utc", "2000-01-01T00:00:00Z");
  await refreshMatchData({ force: true });
  console.log("\nstate restored (override cleared, fresh API pull).");

  if (!overrideSurvived || r.skippedOverridden < 1) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
