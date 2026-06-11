// Typed access to the key/value `settings` table.
import { prisma } from "./db";

export type SettingKey =
  | "group_lock_utc"
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

export async function getKnockoutLockUtc(): Promise<Date | null> {
  const v = await getSetting("knockout_lock_utc");
  return v ? new Date(v) : null;
}

export async function isKnockoutOpen(): Promise<boolean> {
  return (await getSetting("knockout_open")) === "true";
}
