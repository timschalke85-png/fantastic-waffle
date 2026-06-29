// Toggle the knockout_open setting. Reversible companion to the test seed.
//   npx tsx scripts/set-knockout-open.ts true     # open the knockout round
//   npx tsx scripts/set-knockout-open.ts false    # close it again
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const arg = (process.argv[2] ?? "").toLowerCase();
if (arg !== "true" && arg !== "false") {
  console.error("Gebruik: npx tsx scripts/set-knockout-open.ts <true|false>");
  process.exit(1);
}
const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: { key: "knockout_open" },
    create: { key: "knockout_open", value: arg },
    update: { value: arg },
  });
  console.log(`knockout_open = ${arg}`);
}

main()
  .catch((e) => {
    console.error("FOUT:", e?.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
