"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { signIn, signOut, isAdmin } from "@/lib/admin-auth";
import { setSetting } from "@/lib/settings";
import { refreshMatchData } from "@/lib/refresh";
import { recomputeScores } from "@/lib/recompute";
import type { MatchStatus } from "@prisma/client";

export async function loginAction(formData: FormData): Promise<void> {
  const ok = await signIn(String(formData.get("password") ?? ""));
  redirect(ok ? "/beheer" : "/beheer?error=auth");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/beheer");
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/beheer?error=auth");
}

function parseScore(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Inline match edit. Setting any result here flags manually_overridden so the
 *  API never overwrites it (CLAUDE.md). */
export async function updateMatchAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("matchId"));
  const status = String(formData.get("status")) as MatchStatus;
  if (!["SCHEDULED", "LIVE", "FINISHED"].includes(status)) redirect("/beheer?error=status");
  await prisma.match.update({
    where: { id },
    data: {
      status,
      homeScore: parseScore(formData.get("homeScore")),
      awayScore: parseScore(formData.get("awayScore")),
      manuallyOverridden: true,
    },
  });
  // An admin result edit affects the leaderboard — recompute (Fase 7 trigger).
  // Scoring must not break the admin flow, so failures are swallowed.
  try {
    await recomputeScores();
  } catch {
    /* leaderboard recompute is best-effort here */
  }
  revalidatePath("/beheer");
  revalidatePath("/");
  revalidatePath("/klassement");
}

/** Clear a manual override so the API drives this match again. */
export async function clearOverrideAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.match.update({
    where: { id: String(formData.get("matchId")) },
    data: { manuallyOverridden: false },
  });
  revalidatePath("/beheer");
  revalidatePath("/");
}

export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupLock = String(formData.get("group_lock_utc") ?? "").trim();
  const knockoutLock = String(formData.get("knockout_lock_utc") ?? "").trim();
  const knockoutOpen = formData.get("knockout_open") === "on";

  if (groupLock) {
    const d = new Date(groupLock);
    if (!Number.isNaN(d.getTime())) await setSetting("group_lock_utc", d.toISOString());
  }
  await setSetting("knockout_open", knockoutOpen ? "true" : "false");
  if (knockoutLock) {
    const d = new Date(knockoutLock);
    if (!Number.isNaN(d.getTime())) await setSetting("knockout_lock_utc", d.toISOString());
  }
  revalidatePath("/beheer");
  redirect("/beheer?saved=settings");
}

export async function forceRefreshAction(): Promise<void> {
  await requireAdmin();
  const r = await refreshMatchData({ force: true });
  revalidatePath("/beheer");
  revalidatePath("/");
  const q = new URLSearchParams({
    refreshed: String(r.fetchedCount),
    updated: String(r.updated),
    skipped: String(r.skippedOverridden),
    at: r.lastFetchUtc ?? "",
    ...(r.error ? { err: r.error } : {}),
  });
  redirect(`/beheer?${q.toString()}`);
}

export async function recomputeAction(): Promise<void> {
  await requireAdmin();
  // Activated in Fase 7: rebuild the leaderboard from raw predictions + results.
  const r = await recomputeScores();
  revalidatePath("/beheer");
  revalidatePath("/klassement");
  redirect(`/beheer?recompute=${r.participants}`);
}
