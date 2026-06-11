/**
 * Seed — Fase 1.
 *   (a) import all teams + all 104 matches from the verified provider
 *   (b) map team names to Dutch via NAME_NL (keyed by FIFA code)
 *   (c) seed r32_allocation (FIFA-sourced, cross-checked) + the 495 third-place
 *       combinations
 *   (d) seed settings, incl. group_lock_utc = 2026-06-14T20:00:00Z
 *
 * Idempotent: every write is an upsert keyed on the provider's stable ids, so
 * re-running converges rather than duplicating.
 *
 * Requires a real DATABASE_URL (the placeholder in .env will fail to connect).
 * To verify the data layer WITHOUT a database, run `npm run seed:dry-run`.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { getAdapter } from "../src/lib/adapters";
import { assignBracketSlots } from "../src/lib/bracket";
import { NAME_NL } from "./data/name-nl";
import {
  R32_SLOTS,
  THIRD_PLACE_COMBINATIONS,
} from "./data/r32-allocation";

const prisma = new PrismaClient();

export const GROUP_LOCK_UTC = "2026-06-14T20:00:00Z";

async function main() {
  const adapter = getAdapter();
  console.log(`Provider: ${adapter.providerName} — fetching WC2026 snapshot...`);
  const snap = await adapter.getCompetitionSnapshot();

  // --- guardrails: refuse to seed a wrong/partial dataset ---
  if (snap.teams.length !== 48) throw new Error(`Expected 48 teams, got ${snap.teams.length}`);
  if (snap.matches.length !== 104) throw new Error(`Expected 104 matches, got ${snap.matches.length}`);
  const missingNl = snap.teams.filter((t) => !NAME_NL[t.fifaCode]);
  if (missingNl.length) {
    throw new Error(`No Dutch name for: ${missingNl.map((t) => `${t.fifaCode}/${t.nameEn}`).join(", ")}`);
  }

  // --- (a)+(b) teams ---
  const teamIdByApiId = new Map<number, string>();
  for (const t of snap.teams) {
    const team = await prisma.team.upsert({
      where: { apiTeamId: t.apiTeamId },
      create: {
        apiTeamId: t.apiTeamId,
        fifaCode: t.fifaCode,
        nameNl: NAME_NL[t.fifaCode],
        nameEn: t.nameEn,
        groupLetter: t.groupLetter ?? "?",
        crestUrl: t.crestUrl,
      },
      update: {
        fifaCode: t.fifaCode,
        nameNl: NAME_NL[t.fifaCode],
        nameEn: t.nameEn,
        groupLetter: t.groupLetter ?? "?",
        crestUrl: t.crestUrl,
      },
    });
    teamIdByApiId.set(t.apiTeamId, team.id);
  }
  console.log(`Teams upserted: ${teamIdByApiId.size}`);

  // --- (a) matches ---
  const slots = assignBracketSlots(snap.matches);
  let matchCount = 0;
  for (const m of snap.matches) {
    const homeTeamId = m.homeApiTeamId != null ? teamIdByApiId.get(m.homeApiTeamId) ?? null : null;
    const awayTeamId = m.awayApiTeamId != null ? teamIdByApiId.get(m.awayApiTeamId) ?? null : null;
    const penaltyWinnerTeamId =
      m.penaltyWinnerApiTeamId != null ? teamIdByApiId.get(m.penaltyWinnerApiTeamId) ?? null : null;
    const data = {
      stage: m.stage,
      groupLetter: m.groupLetter,
      bracketSlot: slots.get(m.apiMatchId) ?? null,
      homeTeamId,
      awayTeamId,
      kickoffUtc: new Date(m.kickoffUtc),
      venue: m.venue,
      status: m.status,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      wentToExtraTime: m.wentToExtraTime,
      penaltyWinnerTeamId,
    } satisfies Prisma.MatchUncheckedUpdateInput;
    await prisma.match.upsert({
      where: { apiMatchId: m.apiMatchId },
      create: { apiMatchId: m.apiMatchId, ...data } as Prisma.MatchUncheckedCreateInput,
      // never clobber a manually overridden result with API data
      update: { ...data },
    });
    matchCount++;
  }
  console.log(`Matches upserted: ${matchCount}`);

  // --- (c) r32_allocation (static, FIFA-sourced, cross-checked) ---
  for (const s of R32_SLOTS) {
    await prisma.r32Allocation.upsert({
      where: { bracketSlot: s.bracketSlot },
      create: {
        bracketSlot: s.bracketSlot,
        matchNumber: s.matchNumber,
        homeSource: s.homeSource,
        awaySource: s.awaySource,
        thirdPlacePool: s.thirdPlacePool ?? Prisma.JsonNull,
      },
      update: {
        matchNumber: s.matchNumber,
        homeSource: s.homeSource,
        awaySource: s.awaySource,
        thirdPlacePool: s.thirdPlacePool ?? Prisma.JsonNull,
      },
    });
  }
  console.log(`r32_allocation rows: ${R32_SLOTS.length}`);

  for (const c of THIRD_PLACE_COMBINATIONS) {
    await prisma.thirdPlaceCombination.upsert({
      where: { groupsKey: c.groupsKey },
      create: { groupsKey: c.groupsKey, assignment: c.assignment },
      update: { assignment: c.assignment },
    });
  }
  console.log(`third_place_combinations rows: ${THIRD_PLACE_COMBINATIONS.length}`);

  // --- (d) settings ---
  const settings: Record<string, string> = {
    group_lock_utc: GROUP_LOCK_UTC,
    knockout_open: "false",
    api_provider: snap.provider,
    last_api_fetch_utc: snap.fetchedAtUtc,
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  console.log(`settings: ${Object.keys(settings).join(", ")}`);

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("SEED FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
