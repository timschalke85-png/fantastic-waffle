// READ-MOSTLY diagnose: reproduce the core of saveKnockoutPickAction server-side
// (load r32 -> pick a winner -> resolveTie -> upsert) for a single slot, against a
// real participant, then read it back and DELETE the test row again. Tells us
// whether the persistence path itself works or throws. No lasting writes.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { r32TeamsFromMatches } from "../src/lib/knockout";
import { resolveTie, cascadeClear, validateKnockoutPicks, type Picks } from "../src/lib/knockout-bracket";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.participant.count();
  console.log(`Deelnemers in deze DB: ${total}`);

  let participant = await prisma.participant.findFirst({ select: { id: true, nickname: true } });
  let tempCreated = false;
  if (!participant) {
    // Throwaway participant just to prove the write path; deleted at the end.
    participant = await prisma.participant.create({
      data: { nickname: "__diag_test__", nicknameKey: "__diag_test__", pinHash: "x" },
      select: { id: true, nickname: true },
    });
    tempCreated = true;
    console.log('Geen deelnemers — tijdelijke testdeelnemer "__diag_test__" aangemaakt.');
  }

  const r32Matches = await prisma.match.findMany({
    where: { stage: "R32" },
    select: { bracketSlot: true, homeTeamId: true, awayTeamId: true },
  });
  const r32 = r32TeamsFromMatches(r32Matches);
  console.log(`R32 ties bekend: ${Object.keys(r32).length}/16`);

  const slot = 73;
  const tie0 = resolveTie(slot, r32, {});
  console.log(`slot ${slot}: home=${tie0.home} away=${tie0.away}`);
  if (!tie0.home || !tie0.away) {
    console.log("slot 73 heeft geen teams — kan niet reproduceren.");
    return;
  }

  // Mirror the action: winner-pick = home team, score 2-1.
  const rawPicks: Picks = { [slot]: tie0.home };
  const picks = cascadeClear(r32, rawPicks);
  const valid = validateKnockoutPicks(r32, picks);
  console.log(`validateKnockoutPicks ok=${valid.ok} ${valid.ok ? "" : JSON.stringify(valid.violations)}`);
  const tie = resolveTie(slot, r32, picks);

  const existedBefore = await prisma.predictionKnockout.findUnique({
    where: { participantId_bracketSlot: { participantId: participant.id, bracketSlot: String(slot) } },
    select: { id: true },
  });

  try {
    await prisma.predictionKnockout.upsert({
      where: { participantId_bracketSlot: { participantId: participant.id, bracketSlot: String(slot) } },
      create: {
        participantId: participant.id,
        bracketSlot: String(slot),
        homeTeamId: tie.home,
        awayTeamId: tie.away,
        homeGoals: 2,
        awayGoals: 1,
        winnerTeamId: tie.home,
      },
      update: { homeTeamId: tie.home, awayTeamId: tie.away, homeGoals: 2, awayGoals: 1, winnerTeamId: tie.home },
    });
    const readBack = await prisma.predictionKnockout.findUnique({
      where: { participantId_bracketSlot: { participantId: participant.id, bracketSlot: String(slot) } },
    });
    console.log("UPSERT OK — teruggelezen rij:", JSON.stringify(readBack));
  } catch (e) {
    console.log("UPSERT GOOIDE FOUT:", (e as Error).message);
  } finally {
    if (tempCreated) {
      await prisma.participant.delete({ where: { id: participant.id } }); // cascade removes the pick
      console.log("Tijdelijke testdeelnemer + rij opgeruimd.");
    } else if (!existedBefore) {
      await prisma.predictionKnockout.deleteMany({
        where: { participantId: participant.id, bracketSlot: String(slot) },
      });
      console.log("Testrij opgeruimd.");
    }
  }
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
