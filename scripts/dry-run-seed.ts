/**
 * Dry run — proves the seed's DATA exactly meets the Fase 1 acceptance criteria
 * WITHOUT a database (the .env DATABASE_URL is a placeholder). Runs the real
 * adapter + the real Dutch-name + r32_allocation data, and asserts:
 *   48 teams, 104 matches, r32_allocation filled (16 slots + 495 combinations),
 *   Group F = Nederland/Japan/Zweden/Tunesië, NL–Japan @ 2026-06-14T20:00:00Z.
 *
 * Run: npm run seed:dry-run
 */
import "dotenv/config";
import { getAdapter } from "../src/lib/adapters";
import { NAME_NL } from "../prisma/data/name-nl";
import { R32_SLOTS, THIRD_PLACE_COMBINATIONS } from "../prisma/data/r32-allocation";

function assert(name: string, cond: boolean, got: unknown): boolean {
  console.log(`  ${cond ? "✓" : "✗"} ${name}  ->  ${String(got)}`);
  return cond;
}

async function main() {
  const snap = await getAdapter().getCompetitionSnapshot();

  const teams = snap.teams;
  const matches = snap.matches;

  // Dutch names for Group F, in finishing-table-irrelevant sorted order.
  const groupFNames = teams
    .filter((t) => t.groupLetter === "F")
    .map((t) => NAME_NL[t.fifaCode])
    .sort();

  const ned = teams.find((t) => t.fifaCode === "NED");
  const jpn = teams.find((t) => t.fifaCode === "JPN");
  const nlJapan = matches.find(
    (m) =>
      m.groupLetter === "F" &&
      [m.homeApiTeamId, m.awayApiTeamId].includes(ned?.apiTeamId ?? -1) &&
      [m.homeApiTeamId, m.awayApiTeamId].includes(jpn?.apiTeamId ?? -1),
  );

  const allHaveDutch = teams.every((t) => NAME_NL[t.fifaCode]);
  const r32Filled = R32_SLOTS.length === 16 && THIRD_PLACE_COMBINATIONS.length === 495;

  console.log(`Provider: ${snap.provider}\nFase 1 acceptance (data layer):`);
  const results = [
    assert("48 teams", teams.length === 48, teams.length),
    assert("104 matches", matches.length === 104, matches.length),
    assert("all 48 teams have a Dutch name", allHaveDutch, allHaveDutch),
    assert(
      "r32_allocation filled (16 slots + 495 combos)",
      r32Filled,
      `${R32_SLOTS.length} slots / ${THIRD_PLACE_COMBINATIONS.length} combos`,
    ),
    assert(
      "Group F = Japan, Nederland, Tunesië, Zweden",
      groupFNames.join(", ") === "Japan, Nederland, Tunesië, Zweden",
      groupFNames.join(", "),
    ),
    assert(
      "NL–Japan kickoff = 2026-06-14T20:00:00Z",
      nlJapan?.kickoffUtc === "2026-06-14T20:00:00Z",
      nlJapan?.kickoffUtc ?? "—",
    ),
  ];

  // Bonus: show how the R32 allocation reads for Group F.
  const f1 = R32_SLOTS.find((s) => s.homeSource === "1F");
  const f2 = R32_SLOTS.find((s) => s.awaySource === "2F");
  console.log(
    `\n  Group F winner  -> ${f1?.bracketSlot} (FIFA match ${f1?.matchNumber}): ${f1?.homeSource} vs ${f1?.awaySource}`,
  );
  console.log(
    `  Group F runner-up -> ${f2?.bracketSlot} (FIFA match ${f2?.matchNumber}): ${f2?.homeSource} vs ${f2?.awaySource}`,
  );

  if (results.some((r) => !r)) {
    console.error("\nDRY RUN FAILED.");
    process.exit(1);
  }
  console.log("\nDRY RUN PASSED — seed will satisfy the Fase 1 acceptance criteria once a real DATABASE_URL is set.");
}

main().catch((e) => {
  console.error("DRY RUN ERROR:", e);
  process.exit(1);
});
