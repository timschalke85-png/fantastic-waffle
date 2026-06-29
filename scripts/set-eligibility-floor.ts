// Set the required group_eligibility_floor_utc setting (group matches with
// kickoff >= this count toward points). Without it /voorspellen crashes by design
// (no silent fallback). Defaults to the documented value (NL-Japan kickoff).
//   npx tsx scripts/set-eligibility-floor.ts                       # 2026-06-14T20:00:00Z
//   npx tsx scripts/set-eligibility-floor.ts 2026-06-14T20:00:00Z  # explicit
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const value = process.argv[2] ?? "2026-06-14T20:00:00Z";
const prisma = new PrismaClient();

async function main() {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    console.error("Ongeldige datum:", value);
    process.exit(1);
  }
  await prisma.setting.upsert({
    where: { key: "group_eligibility_floor_utc" },
    create: { key: "group_eligibility_floor_utc", value: d.toISOString() },
    update: { value: d.toISOString() },
  });
  console.log(`group_eligibility_floor_utc = ${d.toISOString()}`);
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
