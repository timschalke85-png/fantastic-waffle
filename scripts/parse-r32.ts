/**
 * Parse the Round-of-32 third-place allocation table (495 combinations) from the
 * raw Wikipedia template wikitext, which reproduces FIFA Annex C of the WC2026
 * regulations. Validates HARD before emitting anything:
 *   - exactly 495 combinations
 *   - every combination has 8 distinct third-placed groups
 *   - every set of 8 groups is unique and is one of C(12,8) = 495 subsets
 *   - every assignment respects the bracket's allowed 5-group pool per slot
 *   - the assigned set equals the row's "qualifies from" indicator set
 *
 * Emits prisma/data/r32-allocation.generated.json on success. Throws otherwise.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

// --- Bracket structure, transcribed from the Wikipedia R32 list (lines 12–27),
// itself cited to the FIFA regulations. Cross-checked against the FIFA match
// schedule PDF separately. Winners that face a 3rd-placed team, in the table's
// column order, with their FIFA match number and allowed 3rd-place group pool.
const SLOT_COLUMNS = [
  { winner: "A", match: 79, pool: ["C", "E", "F", "H", "I"] },
  { winner: "B", match: 85, pool: ["E", "F", "G", "I", "J"] },
  { winner: "D", match: 81, pool: ["B", "E", "F", "I", "J"] },
  { winner: "E", match: 74, pool: ["A", "B", "C", "D", "F"] },
  { winner: "G", match: 82, pool: ["A", "E", "H", "I", "J"] },
  { winner: "I", match: 77, pool: ["C", "D", "F", "G", "H"] },
  { winner: "K", match: 87, pool: ["D", "E", "I", "J", "L"] },
  { winner: "L", match: 80, pool: ["E", "H", "I", "J", "K"] },
] as const;

const wikitext = readFileSync(resolve(ROOT, "wiki_3rd_template.wikitext"), "utf8");

// Split into per-row blocks at each `! scope="row" | N`.
const rowRegex = /!\s*scope="row"\s*\|\s*(\d+)([\s\S]*?)(?=!\s*scope="row"\s*\||\|\}|$)/g;

interface Combination {
  no: number;
  groups: string[]; // 8 qualifying third-place groups, sorted
  // assignment[winnerLetter] = third-place group, e.g. { A: "E", B: "J", ... }
  assignment: Record<string, string>;
}

const combos: Combination[] = [];
let m: RegExpExecArray | null;
while ((m = rowRegex.exec(wikitext)) !== null) {
  const no = Number(m[1]);
  const body = m[2];

  // The 8 assignment cells are the only "3X" tokens, in column order.
  const assignTokens = [...body.matchAll(/\b3([A-L])\b/g)].map((x) => x[1]);
  if (assignTokens.length !== 8) {
    throw new Error(`Combination ${no}: expected 8 assignment tokens, got ${assignTokens.length}`);
  }
  // The "qualifies from" indicators are bold bare letters '''X'''.
  const indicatorGroups = [...body.matchAll(/'''([A-L])'''/g)].map((x) => x[1]);

  const assignment: Record<string, string> = {};
  SLOT_COLUMNS.forEach((col, i) => {
    assignment[col.winner] = assignTokens[i];
  });

  combos.push({
    no,
    groups: [...assignTokens].sort(),
    assignment,
  });

  // --- validations per row ---
  const uniqueAssigned = new Set(assignTokens);
  if (uniqueAssigned.size !== 8) {
    throw new Error(`Combination ${no}: assigned third-place groups not distinct: ${assignTokens}`);
  }
  // Indicator set (if present) must equal assigned set.
  if (indicatorGroups.length === 8) {
    const indSet = [...indicatorGroups].sort().join("");
    const asgSet = [...assignTokens].sort().join("");
    if (indSet !== asgSet) {
      throw new Error(`Combination ${no}: indicator set ${indSet} != assigned set ${asgSet}`);
    }
  }
  // Each assignment must respect the slot's allowed pool.
  for (const col of SLOT_COLUMNS) {
    const g = assignment[col.winner];
    if (!(col.pool as readonly string[]).includes(g)) {
      throw new Error(
        `Combination ${no}: 3${g} assigned to Winner ${col.winner} (match ${col.match}) ` +
          `but pool is ${col.pool.join("/")}`,
      );
    }
  }
}

// --- global validations ---
if (combos.length !== 495) {
  throw new Error(`Expected 495 combinations, parsed ${combos.length}`);
}
const keys = new Set(combos.map((c) => c.groups.join("")));
if (keys.size !== 495) {
  throw new Error(`Expected 495 distinct group-sets, got ${keys.size}`);
}
// Every set must be a size-8 subset of A–L.
for (const c of combos) {
  if (c.groups.length !== 8) throw new Error(`Combination ${c.no}: ${c.groups.length} groups`);
}

console.log(`OK: parsed and validated ${combos.length} combinations.`);
console.log("Slot columns (winner -> match, pool):");
for (const c of SLOT_COLUMNS) console.log(`  1${c.winner} = Match ${c.match}: 3rd from ${c.pool.join("/")}`);
console.log("\nSpot checks:");
const byKey = (k: string) => combos.find((c) => c.groups.join("") === k);
for (const k of ["EFGHIJKL", "ABCDEFGH", "CDFGHIJL"]) {
  const c = byKey(k);
  console.log(`  thirds=${k} ->`, c ? JSON.stringify(c.assignment) : "NOT FOUND");
}

writeFileSync(
  resolve(ROOT, "prisma/data/r32-allocation.generated.json"),
  JSON.stringify({ slotColumns: SLOT_COLUMNS, combinations: combos }, null, 2),
);
console.log(`\nWrote prisma/data/r32-allocation.generated.json (${combos.length} rows).`);
