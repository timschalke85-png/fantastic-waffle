"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { signIn, signOut, isAdmin } from "@/lib/admin-auth";
import { setSetting } from "@/lib/settings";
import { amsterdamLocalToUtcIso } from "@/lib/datetime";
import { refreshMatchData } from "@/lib/refresh";
import { recomputeScores } from "@/lib/recompute";
import { applyR32Resolution } from "@/lib/r32-apply";
import { loadEveningForFreeze } from "@/lib/prijzenpoule-data";
import { computeEveningWinners } from "@/lib/prize-scoring";
import { withDbRetry, isTransientConnectionError } from "@/lib/db-retry";
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

/** Run a DB write with one transient-connection retry (Neon scale-to-zero). On a
 *  persistent connection failure, redirect to a clear "opslaan mislukt" notice
 *  instead of an error overlay — a failed write never looks successful. */
async function dbWrite<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await withDbRetry(fn);
  } catch (e) {
    if (isTransientConnectionError(e)) redirect("/beheer?error=db");
    throw e;
  }
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
  // Only write the status when the admin actually moved the dropdown. The select
  // defaults to the row's current status, so a score-only save would otherwise
  // re-persist whatever happened to be shown (e.g. a live API "LIVE") and — via
  // manuallyOverridden — freeze it forever. Comparing against the rendered value
  // keeps a score-only edit from silently capturing the status.
  const originalStatus = String(formData.get("originalStatus") ?? "");
  const statusChanged = status !== originalStatus;

  const homeScore = parseScore(formData.get("homeScore"));
  const awayScore = parseScore(formData.get("awayScore"));
  const halfTimeHome = parseScore(formData.get("halfTimeHome"));
  const halfTimeAway = parseScore(formData.get("halfTimeAway"));
  // A team can't have fewer goals at full time than at half time. Only check when
  // both are present (a LIVE match may have a ruststand but no final score yet).
  if (
    (halfTimeHome != null && homeScore != null && halfTimeHome > homeScore) ||
    (halfTimeAway != null && awayScore != null && halfTimeAway > awayScore)
  ) {
    redirect("/beheer?error=ruststand");
  }

  await dbWrite(() =>
    prisma.match.update({
      where: { id },
      data: {
        // Leave the stored status untouched on a score-only save (see above).
        ...(statusChanged ? { status } : {}),
        homeScore,
        awayScore,
        halfTimeHome,
        halfTimeAway,
        manuallyOverridden: true,
      },
    }),
  );
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
  await dbWrite(() =>
    prisma.match.update({ where: { id: String(formData.get("matchId")) }, data: { manuallyOverridden: false } }),
  );
  revalidatePath("/beheer");
  revalidatePath("/");
}

/**
 * Delete a participant. A single delete suffices: every participant relation
 * (the four prediction tables + the score row) has onDelete: Cascade in the
 * schema, so the DB removes them atomically — no orphans, no FK errors. Gated on
 * requireAdmin and reached only via the two-step confirm in the UI. No recompute
 * needed: other participants' scores are independent; the leaderboard re-ranks on
 * load.
 */
export async function deleteParticipantAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("participantId") ?? "");
  if (!id) redirect("/beheer?error=participant");
  const p = await dbWrite(() => prisma.participant.findUnique({ where: { id }, select: { nickname: true } }));
  if (!p) redirect("/beheer?error=participant");

  await dbWrite(() => prisma.participant.delete({ where: { id } })); // cascade removes predictions + score
  revalidatePath("/beheer");
  revalidatePath("/klassement");
  revalidatePath("/");
  redirect(`/beheer?deleted=${encodeURIComponent(p.nickname)}`);
}

export async function updateSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const groupLock = String(formData.get("group_lock_utc") ?? "").trim();
  const groupFloor = String(formData.get("group_eligibility_floor_utc") ?? "").trim();
  // The knockout lock is entered as an Amsterdam wall-clock time (datetime-local).
  const knockoutLockLocal = String(formData.get("knockout_lock_local") ?? "").trim();
  const knockoutOpen = formData.get("knockout_open") === "on";

  // Validate everything UP FRONT and report a clear error on a bad value. The old
  // code silently dropped an unparseable date while still redirecting to
  // "?saved=settings", so a mistyped lock looked saved but never persisted.
  let groupLockIso: string | null = null;
  if (groupLock) {
    const d = new Date(groupLock);
    if (Number.isNaN(d.getTime())) redirect("/beheer?error=group_lock_invalid");
    groupLockIso = d.toISOString();
  }
  let groupFloorIso: string | null = null;
  if (groupFloor) {
    const d = new Date(groupFloor);
    if (Number.isNaN(d.getTime())) redirect("/beheer?error=group_floor_invalid");
    groupFloorIso = d.toISOString();
  }
  let knockoutLockIso: string | null = null;
  if (knockoutLockLocal) {
    knockoutLockIso = amsterdamLocalToUtcIso(knockoutLockLocal);
    if (!knockoutLockIso) redirect("/beheer?error=ko_lock_invalid");
  }

  await dbWrite(async () => {
    if (groupLockIso) await setSetting("group_lock_utc", groupLockIso);
    if (groupFloorIso) await setSetting("group_eligibility_floor_utc", groupFloorIso);
    await setSetting("knockout_open", knockoutOpen ? "true" : "false");
    if (knockoutLockIso) await setSetting("knockout_lock_utc", knockoutLockIso);
  });
  revalidatePath("/beheer");
  redirect("/beheer?saved=settings");
}

/** Q5: derive knockout_lock_utc from the data = the earliest R32 kickoff. The
 *  manual override input (in the Instellingen form) is kept; this just fills it
 *  in from the real schedule. No-op with a notice if no R32 matches exist yet. */
export async function setKnockoutLockFromR32Action(): Promise<void> {
  await requireAdmin();
  const earliest = await dbWrite(() =>
    prisma.match.findFirst({ where: { stage: "R32" }, orderBy: { kickoffUtc: "asc" }, select: { kickoffUtc: true } }),
  );
  if (!earliest) redirect("/beheer?error=no_r32");
  await dbWrite(() => setSetting("knockout_lock_utc", earliest.kickoffUtc.toISOString()));
  revalidatePath("/beheer");
  redirect("/beheer?saved=ko_lock");
}

/**
 * Derive the R32 teams from the FINAL group standings and write them onto the R32
 * matches. The provider never delivers knockout teams, so this is the path that
 * makes the bracket (and the knockout picker) come alive. All-or-nothing and
 * refuses while the group stage is unfinished — see applyR32Resolution.
 */
export async function resolveR32Action(): Promise<void> {
  await requireAdmin();
  const r = await dbWrite(() => applyR32Resolution());
  revalidatePath("/beheer");
  revalidatePath("/");
  revalidatePath("/voorspellen");
  if (r.ok) redirect(`/beheer?saved=r32&n=${r.written}`);
  redirect(`/beheer?error=r32_${r.reason ?? "unknown"}`);
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

// --- Prijzenpoule: avond-beheer (admin) ------------------------------------

function revalidatePrijzenpoule(): void {
  revalidatePath("/beheer");
  revalidatePath("/win");
}

export async function createEveningAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) redirect("/beheer?error=evening_label");
  await dbWrite(() => prisma.evening.create({ data: { label } }));
  revalidatePrijzenpoule();
  redirect("/beheer?saved=evening");
}

export async function setEveningCodeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("eveningId") ?? "");
  if (!id) redirect("/beheer?error=evening");
  const code = String(formData.get("checkInCode") ?? "").trim();
  await dbWrite(() => prisma.evening.update({ where: { id }, data: { checkInCode: code || null } }));
  revalidatePrijzenpoule();
  redirect("/beheer?saved=evening");
}

/** Activate one evening as "vanavond". Exactly one stays active: clear all, then
 *  set this one — atomically in a single transaction. */
export async function activateEveningAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("eveningId") ?? "");
  if (!id) redirect("/beheer?error=evening");
  await dbWrite(() =>
    prisma.$transaction([
      prisma.evening.updateMany({ where: { isActive: true }, data: { isActive: false } }),
      prisma.evening.update({ where: { id }, data: { isActive: true } }),
    ]),
  );
  revalidatePrijzenpoule();
  redirect("/beheer?saved=evening");
}

export async function deactivateEveningAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("eveningId") ?? "");
  if (!id) redirect("/beheer?error=evening");
  await dbWrite(() => prisma.evening.update({ where: { id }, data: { isActive: false } }));
  revalidatePrijzenpoule();
  redirect("/beheer?saved=evening");
}

/** Assign the 1 or 2 broadcast matches of an evening (each = one dagspel).
 *  Replace-strategy: clear the evening's EveningMatch rows, then recreate. */
export async function setEveningMatchesAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("eveningId") ?? "");
  if (!id) redirect("/beheer?error=evening");
  const matchIds = [...new Set(formData.getAll("matchId").map(String).filter(Boolean))];
  if (matchIds.length < 1 || matchIds.length > 2) redirect("/beheer?error=evening_matches");
  await dbWrite(() =>
    prisma.$transaction([
      prisma.eveningMatch.deleteMany({ where: { eveningId: id } }),
      ...matchIds.map((matchId, i) =>
        prisma.eveningMatch.create({ data: { eveningId: id, matchId, ordinal: i + 1 } }),
      ),
    ]),
  );
  revalidatePrijzenpoule();
  redirect("/beheer?saved=evening");
}

export async function togglePollAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("eveningId") ?? "");
  if (!id) redirect("/beheer?error=evening");
  const open = String(formData.get("open") ?? "") === "true";
  await dbWrite(() => prisma.evening.update({ where: { id }, data: { pollOpen: open } }));
  revalidatePrijzenpoule();
  redirect("/beheer?saved=evening");
}

const PRIZE_TEXT_KEYS = [
  "prize_text_daywinner",
  "prize_text_luckyloser",
  "prize_text_first",
  "prize_text_second",
  "prize_text_third",
] as const;

/** Edit the prijzenpoule prize texts (settings) — admin fills in the real prizes. */
export async function updatePrizeTextsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  // Attendance requirement for the hoofdprijzen (positive integer; default 3).
  const raw = Number.parseInt(String(formData.get("prize_min_evenings") ?? ""), 10);
  await dbWrite(async () => {
    for (const key of PRIZE_TEXT_KEYS) {
      await setSetting(key, String(formData.get(key) ?? "").trim());
    }
    await setSetting("prize_min_evenings", Number.isInteger(raw) && raw > 0 ? String(raw) : "3");
  });
  revalidatePrijzenpoule();
  redirect("/beheer?saved=prizes");
}

/**
 * Close an evening: compute the dagwinnaar(s) per dagspel + the Lucky Loser ONCE
 * (pure engine) and FREEZE them — DailyWinner rows + Evening.luckyLoserId +
 * winnersFrozenAt. Only when every dagspel-match is FINISHED. Idempotent: a second
 * close is a no-op (winnersFrozenAt already set), so nothing is double-stored.
 */
export async function freezeEveningAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("eveningId") ?? "");
  if (!id) redirect("/beheer?error=evening");

  const data = await dbWrite(() => loadEveningForFreeze(id));
  if (!data) redirect("/beheer?error=evening");
  if (data.frozen) redirect("/beheer?saved=frozen"); // already closed -> no-op
  if (!data.hasMatches || !data.allFinished) redirect("/beheer?error=not_finished");

  const winners = computeEveningWinners({
    eveningId: data.eveningId,
    matches: data.matches,
    checkedInIds: data.checkedInIds,
    resultKey: data.resultKey,
  });
  const rows = winners.perMatch.flatMap((m) =>
    m.winnerIds.map((participantId) => ({ eveningMatchId: m.eveningMatchId, participantId })),
  );

  // createMany with an empty array is a valid no-op, so a fixed 2-tuple is safe.
  await dbWrite(() =>
    prisma.$transaction([
      prisma.dailyWinner.createMany({ data: rows }),
      prisma.evening.update({
        where: { id },
        data: { luckyLoserId: winners.luckyLoserId, winnersFrozenAt: new Date() },
      }),
    ]),
  );

  revalidatePrijzenpoule();
  redirect("/beheer?saved=frozen");
}
