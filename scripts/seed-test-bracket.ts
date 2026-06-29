// Populate the dev DB with a FULL, internally-consistent knockout bracket for a
// throwaway participant, mirroring saveKnockoutPickAction (resolveTie -> upsert),
// then count the persisted picks per round. Proves the whole bracket — 1/16, 1/8,
// 1/4, 1/2, finale — autosaves end-to-end (the slot-89 regex gap is what broke 1/8).
//   npx tsx scripts/seed-test-bracket.ts          # write, verify, clean up
//   npx tsx scripts/seed-test-bracket.ts --keep   # keep the rows for DB inspection
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { r32TeamsFromMatches } from "../src/lib/knockout";
import { resolveTie, type Picks, type R32Teams, type TieTeams } from "../src/lib/knockout-bracket";

const KEEP = process.argv.includes("--keep");
const prisma = new PrismaClient();

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ALL_SLOTS = range(73, 104);
const ROUNDS = ["1/16 (R32)", "1/8 (R16)", "1/4 (QF)", "1/2 (SF)", "Finale/Troost"];
const roundOf = (s: number) => (s <= 88 ? ROUNDS[0] : s <= 96 ? ROUNDS[1] : s <= 100 ? ROUNDS[2] : s <= 102 ? ROUNDS[3] : ROUNDS[4]);

async function main() {
  const r32Matches = await prisma.match.findMany({
    where: { stage: "R32" },
    select: { bracketSlot: true, homeTeamId: true, awayTeamId: true },
  });
  const r32: R32Teams = r32TeamsFromMatches(r32Matches);
  if (Object.keys(r32).length !== 16) {
    console.log(`R32 niet compleet (${Object.keys(r32).length}/16) — draai eerst seed-test-r32.ts --write.`);
    return;
  }

  // Build a full consistent bracket top-down: the home team always advances 2-1.
  const picks: Picks = {};
  const memo = new Map<number, TieTeams>();
  const ties: Record<number, TieTeams> = {};
  for (const slot of ALL_SLOTS) {
    const tie = resolveTie(slot, r32, picks, memo);
    ties[slot] = tie;
    if (tie.home) picks[slot] = tie.home;
  }

  const nick = "__bracket_test__";
  let p = await prisma.participant.findUnique({ where: { nicknameKey: nick }, select: { id: true } });
  if (!p) p = await prisma.participant.create({ data: { nickname: nick, nicknameKey: nick, pinHash: "x" }, select: { id: true } });

  // Mirror saveKnockoutPickAction's persisted row exactly.
  let written = 0;
  for (const slot of ALL_SLOTS) {
    const tie = ties[slot];
    if (!tie.home || !tie.away) continue;
    await prisma.predictionKnockout.upsert({
      where: { participantId_bracketSlot: { participantId: p.id, bracketSlot: String(slot) } },
      create: { participantId: p.id, bracketSlot: String(slot), homeTeamId: tie.home, awayTeamId: tie.away, homeGoals: 2, awayGoals: 1, winnerTeamId: tie.home },
      update: { homeTeamId: tie.home, awayTeamId: tie.away, homeGoals: 2, awayGoals: 1, winnerTeamId: tie.home },
    });
    written++;
  }

  const rows = await prisma.predictionKnockout.findMany({ where: { participantId: p.id }, select: { bracketSlot: true } });
  const byRound = new Map<string, number>();
  for (const r of rows) byRound.set(roundOf(Number(r.bracketSlot)), (byRound.get(roundOf(Number(r.bracketSlot))) ?? 0) + 1);

  console.log(`Geschreven: ${written} picks. Per ronde teruggelezen uit de DB:`);
  const expected: Record<string, number> = { [ROUNDS[0]]: 16, [ROUNDS[1]]: 8, [ROUNDS[2]]: 4, [ROUNDS[3]]: 2, [ROUNDS[4]]: 2 };
  let allOk = true;
  for (const k of ROUNDS) {
    const got = byRound.get(k) ?? 0;
    const ok = got === expected[k];
    if (!ok) allOk = false;
    console.log(`  ${ok ? "OK " : "XX "} ${k}: ${got}/${expected[k]}`);
  }
  console.log(allOk ? "\n✅ Alle rondes persisteren correct." : "\n❌ Niet alle rondes compleet.");

  if (!KEEP) {
    await prisma.participant.delete({ where: { id: p.id } }); // cascade removes the picks
    console.log("Test-deelnemer opgeruimd.");
  } else {
    console.log('Bewaard onder bijnaam "__bracket_test__" (alleen voor DB-inspectie; dummy PIN).');
  }
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
