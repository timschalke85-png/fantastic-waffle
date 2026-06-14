// Typed access to the key/value `settings` table.
import { prisma } from "./db";

export type SettingKey =
  | "group_lock_utc"
  | "group_eligibility_floor_utc"
  | "knockout_open"
  | "knockout_lock_utc"
  | "last_api_fetch_utc"
  | "api_provider";

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function getSetting(key: SettingKey): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** group prediction lock (UTC). Eligibility: a group match scores iff kickoff >= this. */
export async function getGroupLockUtc(): Promise<Date | null> {
  const v = await getSetting("group_lock_utc");
  return v ? new Date(v) : null;
}

/**
 * Scoring-eligibility floor (group_eligibility_floor_utc): group matches with
 * kickoff >= this count toward points. This drives the scoring scope for the
 * WHOLE pool, so a missing or invalid value is a HARD ERROR by design — never a
 * silent fallback to some hard-coded date (a wrong/absent value would quietly
 * mis-score the entire group round). It MUST be set in /beheer (or seeded)
 * before the group round is scored. Decoupled from group_lock_utc (the input
 * deadline) on purpose.
 */
export async function getGroupEligibilityFloorUtc(): Promise<Date> {
  const v = await getSetting("group_eligibility_floor_utc");
  if (!v) {
    throw new Error(
      "group_eligibility_floor_utc is niet gezet. Zet de eligibiliteit-vloer in /beheer (of via de seed) " +
        "vóór de poule gescoord wordt — er is geen stille fallback.",
    );
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw new Error(
      `group_eligibility_floor_utc is ongeldig ("${v}"). Verwacht een ISO-tijd, bv. 2026-06-14T20:00:00Z.`,
    );
  }
  return d;
}

export async function getKnockoutLockUtc(): Promise<Date | null> {
  const v = await getSetting("knockout_lock_utc");
  return v ? new Date(v) : null;
}

export async function isKnockoutOpen(): Promise<boolean> {
  return (await getSetting("knockout_open")) === "true";
}
