/**
 * THROWAWAY verification (Fase 1 gate). Confirms football-data.org's free tier
 * actually returns the WC2026 dataset before we build anything on it. If this
 * fails, STOP and switch the adapter to API-Football (CLAUDE.md data strategy).
 *
 * Run: npm run verify:wc
 */
import "dotenv/config";
import { getAdapter } from "../src/lib/adapters";

async function main() {
  const adapter = getAdapter();
  const snap = await adapter.getCompetitionSnapshot();

  const matches = snap.matches;
  const teams = snap.teams;
  const stages = matches.reduce<Record<string, number>>((acc, m) => {
    acc[m.stage] = (acc[m.stage] ?? 0) + 1;
    return acc;
  }, {});
  const sorted = [...matches].sort((a, b) => +new Date(a.kickoffUtc) - +new Date(b.kickoffUtc));

  const groupF = teams.filter((t) => t.groupLetter === "F").map((t) => t.fifaCode).sort();
  const nlJapan = matches.find(
    (m) =>
      m.groupLetter === "F" &&
      [m.homeApiTeamId, m.awayApiTeamId].includes(teams.find((t) => t.fifaCode === "NED")?.apiTeamId ?? -1) &&
      [m.homeApiTeamId, m.awayApiTeamId].includes(teams.find((t) => t.fifaCode === "JPN")?.apiTeamId ?? -1),
  );

  const checks: Array<[string, boolean, string]> = [
    ["provider", snap.provider === "football-data", snap.provider],
    ["104 matches", matches.length === 104, String(matches.length)],
    ["48 teams", teams.length === 48, String(teams.length)],
    ["72 group matches", stages.GROUP === 72, String(stages.GROUP)],
    ["16 R32", stages.R32 === 16, String(stages.R32)],
    ["group stage starts 2026-06-11", sorted[0]?.kickoffUtc.startsWith("2026-06-11"), sorted[0]?.kickoffUtc],
    ["Group F = JPN,NED,SWE,TUN", groupF.join(",") === "JPN,NED,SWE,TUN", groupF.join(",")],
    ["NL–Japan @ 2026-06-14T20:00:00Z", nlJapan?.kickoffUtc === "2026-06-14T20:00:00Z", nlJapan?.kickoffUtc ?? "—"],
  ];

  console.log(`Provider: ${snap.provider}`);
  let ok = true;
  for (const [name, pass, got] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${name}  (${got})`);
    if (!pass) ok = false;
  }

  if (!ok) {
    console.error("\nVERIFICATION FAILED — do not proceed on this provider.");
    process.exit(1);
  }
  console.log("\nVERIFIED: football-data.org free tier returns the full WC2026 dataset.");
}

main().catch((e) => {
  console.error("VERIFICATION ERROR:", e);
  process.exit(1);
});
