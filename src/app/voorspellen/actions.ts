"use server";

// Server actions for /voorspellen. Every write re-checks, server-side and
// independent of the UI: a valid participant session, the group lock, match
// eligibility, ranking uniqueness, and non-negative integers (Fase 5 acceptance:
// writes must be rejected even if the client is bypassed).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getGroupLockUtc } from "@/lib/settings";
import {
  signInOrRegister,
  signOutParticipant,
  currentParticipant,
  updateProfile,
  markFirstSubmission,
} from "@/lib/participant-auth";
import { eligibleGroupMatchIds } from "@/lib/predictions";
import { parseScoreline, parseGoals, validateRanking } from "@/lib/predictions-validate";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function loginAction(formData: FormData): Promise<void> {
  const res = await signInOrRegister({
    nickname: String(formData.get("nickname") ?? ""),
    pin: String(formData.get("pin") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    showFullName: formData.get("showFullName") === "on",
  });
  if (res.ok) redirect("/voorspellen");
  redirect(`/voorspellen?error=${res.error}`);
}

export async function logoutAction(): Promise<void> {
  await signOutParticipant();
  redirect("/voorspellen");
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const p = await currentParticipant();
  if (!p) redirect("/voorspellen?error=auth");
  await updateProfile(p!.id, String(formData.get("fullName") ?? ""), formData.get("showFullName") === "on");
  redirect("/voorspellen?saved=profiel");
}

/** Common guard: returns the participant id if signed-in and still unlocked. */
async function writableParticipant(): Promise<{ id: string } | { error: string }> {
  const p = await currentParticipant();
  if (!p) return { error: "auth" };
  const lock = await getGroupLockUtc();
  if (lock && Date.now() >= lock.getTime()) return { error: "locked" };
  return { id: p.id };
}

export async function saveGroupMatchesAction(
  items: { matchId: string; home: string; away: string }[],
): Promise<SaveResult> {
  const guard = await writableParticipant();
  if ("error" in guard) return { ok: false, error: guard.error };
  const eligible = await eligibleGroupMatchIds();

  const toUpsert: { matchId: string; home: number; away: number }[] = [];
  const toClear: string[] = [];
  for (const it of items) {
    if (!eligible.has(it.matchId)) return { ok: false, error: "ineligible" };
    const p = parseScoreline(it.home, it.away);
    if (p.kind === "invalid") return { ok: false, error: "invalid" };
    if (p.kind === "empty") toClear.push(it.matchId);
    else if (p.kind === "value") toUpsert.push({ matchId: it.matchId, home: p.home, away: p.away });
    // "partial" -> incomplete, leave untouched
  }

  await prisma.$transaction([
    ...toClear.map((matchId) =>
      prisma.predictionGroupMatch.deleteMany({ where: { participantId: guard.id, matchId } }),
    ),
    ...toUpsert.map((u) =>
      prisma.predictionGroupMatch.upsert({
        where: { participantId_matchId: { participantId: guard.id, matchId: u.matchId } },
        create: { participantId: guard.id, matchId: u.matchId, homeGoals: u.home, awayGoals: u.away },
        update: { homeGoals: u.home, awayGoals: u.away },
      }),
    ),
  ]);
  if (toUpsert.length > 0) await markFirstSubmission(guard.id); // set-once on real content
  revalidatePath("/voorspellen");
  return { ok: true };
}

export async function saveTeamGoalsAction(
  items: { teamId: string; goals: string }[],
): Promise<SaveResult> {
  const guard = await writableParticipant();
  if ("error" in guard) return { ok: false, error: guard.error };

  // Only Poule F teams may receive a team-goals prediction.
  const pouleFTeamIds = new Set(
    (await prisma.team.findMany({ where: { groupLetter: "F" }, select: { id: true } })).map((t) => t.id),
  );

  const toUpsert: { teamId: string; goals: number }[] = [];
  const toClear: string[] = [];
  for (const it of items) {
    if (!pouleFTeamIds.has(it.teamId)) return { ok: false, error: "team" };
    const g = parseGoals(it.goals);
    if (g.kind === "invalid") return { ok: false, error: "invalid" };
    if (g.kind === "empty") toClear.push(it.teamId);
    else toUpsert.push({ teamId: it.teamId, goals: g.value });
  }

  await prisma.$transaction([
    ...toClear.map((teamId) =>
      prisma.predictionTeamGoals.deleteMany({ where: { participantId: guard.id, teamId } }),
    ),
    ...toUpsert.map((u) =>
      prisma.predictionTeamGoals.upsert({
        where: { participantId_teamId: { participantId: guard.id, teamId: u.teamId } },
        create: { participantId: guard.id, teamId: u.teamId, goals: u.goals },
        update: { goals: u.goals },
      }),
    ),
  ]);
  if (toUpsert.length > 0) await markFirstSubmission(guard.id); // set-once on real content
  revalidatePath("/voorspellen");
  return { ok: true };
}

export async function saveRankAction(payload: {
  groupLetter: string;
  entries: { position: number; teamId: string }[]; // teamId "" = cleared
}): Promise<SaveResult> {
  const guard = await writableParticipant();
  if ("error" in guard) return { ok: false, error: guard.error };

  const letter = payload.groupLetter.toUpperCase();
  if (!/^[A-L]$/.test(letter)) return { ok: false, error: "group" };
  const allowedPositions = letter === "F" ? [1, 2, 3, 4] : [1, 2];

  const teamPool = (
    await prisma.team.findMany({ where: { groupLetter: letter }, select: { id: true } })
  ).map((t) => t.id);

  const filled = payload.entries.filter((e) => e.teamId !== "");
  const check = validateRanking(filled, allowedPositions, teamPool);
  if (!check.ok) return { ok: false, error: check.reason ?? "ranking" };

  await prisma.$transaction([
    prisma.predictionGroupRank.deleteMany({ where: { participantId: guard.id, groupLetter: letter } }),
    ...filled.map((e) =>
      prisma.predictionGroupRank.create({
        data: { participantId: guard.id, groupLetter: letter, position: e.position, teamId: e.teamId },
      }),
    ),
  ]);
  if (filled.length > 0) await markFirstSubmission(guard.id); // set-once on real content
  revalidatePath("/voorspellen");
  return { ok: true };
}
