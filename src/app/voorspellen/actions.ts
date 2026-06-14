"use server";

// Server actions for /voorspellen. Every write re-checks, server-side and
// independent of the UI: a valid participant session, the group lock, match
// eligibility, ranking uniqueness, and non-negative integers (Fase 5 acceptance:
// writes must be rejected even if the client is bypassed).
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getGroupLockUtc, getKnockoutLockUtc, isKnockoutOpen } from "@/lib/settings";
import {
  registerParticipant,
  signInParticipant,
  signOutParticipant,
  currentParticipant,
  updateProfile,
  markFirstSubmission,
} from "@/lib/participant-auth";
import { eligibleGroupMatchIds } from "@/lib/predictions";
import { parseScoreline, parseGoals, validateRanking, isMatchEditable } from "@/lib/predictions-validate";
import {
  resolveTie,
  validateKnockoutPicks,
  cascadeClear,
  type Picks,
  type R32Teams,
} from "@/lib/knockout-bracket";
import { r32TeamsFromMatches } from "@/lib/knockout";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Registreren-tab: create a NEW account. Never logs into an existing one. */
export async function registerAction(formData: FormData): Promise<void> {
  const res = await registerParticipant({
    nickname: String(formData.get("nickname") ?? ""),
    pin: String(formData.get("pin") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
    showFullName: formData.get("showFullName") === "on",
  });
  if (res.ok) redirect("/voorspellen");
  redirect(`/voorspellen?tab=register&error=${res.error}`);
}

/** Inloggen-tab: sign in to an EXISTING account. Never creates one. */
export async function signInAction(formData: FormData): Promise<void> {
  const res = await signInParticipant({
    nickname: String(formData.get("nickname") ?? ""),
    pin: String(formData.get("pin") ?? ""),
  });
  if (res.ok) redirect("/voorspellen");
  redirect(`/voorspellen?tab=login&error=${res.error}`);
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

  // Per-match input lock: a match is writable only while it has not kicked off.
  // The global deadline (group_lock_utc) is already enforced by writableParticipant,
  // so here we pass null and check the per-match kickoff bound only.
  const now = Date.now();
  const kickoffById = new Map<string, Date>(
    (
      await prisma.match.findMany({
        where: { id: { in: items.map((i) => i.matchId) }, stage: "GROUP" },
        select: { id: true, kickoffUtc: true },
      })
    ).map((m) => [m.id, m.kickoffUtc]),
  );

  const toUpsert: { matchId: string; home: number; away: number }[] = [];
  const toClear: string[] = [];
  for (const it of items) {
    if (!eligible.has(it.matchId)) return { ok: false, error: "ineligible" };
    const ko = kickoffById.get(it.matchId);
    if (!ko || !isMatchEditable(ko, now, null)) return { ok: false, error: "match_locked" };
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

// --- Knockout round (Fase 6) -------------------------------------------------

export interface KnockoutPickInput {
  bracketSlot: string; // FIFA match number "73".."104"
  homeGoals: string; // "" = empty (partial saves allowed)
  awayGoals: string;
  winnerTeamId: string; // "" = no winner picked yet
  // The client may send these, but the server IGNORES them: home/awayTeamId are a
  // server-derived projection of the winner-picks (Q8). Re-deriving them here is
  // the reason a winner-pick can never diverge from the stored teams.
  homeTeamId?: string;
  awayTeamId?: string;
}

const KO_SLOT_RE = /^(7[3-9]|8[0-8]|9[0-9]|10[0-4])$/; // 73..104

/** Knockout guard: signed in, round open, and still before the knockout lock.
 *  All three are enforced server-side, independent of the UI (Fase 5 discipline). */
async function writableKnockoutParticipant(): Promise<{ id: string } | { error: string }> {
  const p = await currentParticipant();
  if (!p) return { error: "auth" };
  if (!(await isKnockoutOpen())) return { error: "closed" };
  const lock = await getKnockoutLockUtc();
  if (lock && Date.now() >= lock.getTime()) return { error: "locked" };
  return { id: p.id };
}

/**
 * Save a participant's full knockout bracket (idempotent replace, like the group
 * saves). The winner-picks are the source of truth; everything else is derived
 * server-side so a bypassed or stale client cannot persist an inconsistent row:
 *  - cascadeClear (policy B) drops any inconsistent OR half-formed downstream
 *    winner before persisting — and the whole prediction (score included) for a
 *    slot whose winner it clears.
 *  - home/awayTeamId are re-derived via resolveTie; client-sent teams are ignored.
 *  - the per-row invariant winnerTeamId ∈ {home, away} ∨ null is asserted.
 */
export async function saveKnockoutPickAction(items: KnockoutPickInput[]): Promise<SaveResult> {
  const guard = await writableKnockoutParticipant();
  if ("error" in guard) return { ok: false, error: guard.error };

  for (const it of items) {
    if (!KO_SLOT_RE.test(it.bracketSlot)) return { ok: false, error: "slot" };
  }

  // Real R32 ties — the only source for slots 73–88 (client teams are ignored).
  const r32Matches = await prisma.match.findMany({
    where: { stage: "R32" },
    select: { bracketSlot: true, homeTeamId: true, awayTeamId: true },
  });
  const r32: R32Teams = r32TeamsFromMatches(r32Matches);

  // Winner-picks = the source of truth. Cascade-clear (policy B) drops any
  // inconsistent/half-formed downstream winner BEFORE persisting.
  const rawPicks: Picks = {};
  for (const it of items) {
    if (it.winnerTeamId !== "") rawPicks[Number(it.bracketSlot)] = it.winnerTeamId;
  }
  const picks = cascadeClear(r32, rawPicks);

  // Vangnet: an R32 winner must be a real team; nothing should be inconsistent
  // after the cascade (it leaves R32 picks untouched, so this catches those).
  if (!validateKnockoutPicks(r32, picks).ok) return { ok: false, error: "inconsistent" };

  const toUpsert: {
    bracketSlot: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeGoals: number | null;
    awayGoals: number | null;
    winnerTeamId: string | null;
  }[] = [];
  const toClear: string[] = [];

  for (const it of items) {
    const slot = Number(it.bracketSlot);
    const score = parseScoreline(it.homeGoals, it.awayGoals);
    if (score.kind === "invalid") return { ok: false, error: "invalid" };

    const winner = picks[slot] ?? null;
    const cascadeDropped = rawPicks[slot] != null && winner == null;
    const hasScore = score.kind === "value";

    // Whole prediction goes when the cascade dropped its winner, or when the slot
    // is otherwise empty (no winner and no complete scoreline; partial = empty).
    if (cascadeDropped || (winner == null && !hasScore)) {
      toClear.push(it.bracketSlot);
      continue;
    }

    // Server-derived tie — client home/awayTeamId are intentionally ignored.
    const tie = resolveTie(slot, r32, picks);
    // Invariant: a stored winner is always one of the tie's two teams.
    if (winner != null && winner !== tie.home && winner !== tie.away) {
      return { ok: false, error: "inconsistent" };
    }

    toUpsert.push({
      bracketSlot: it.bracketSlot,
      homeTeamId: tie.home,
      awayTeamId: tie.away,
      homeGoals: hasScore ? score.home : null,
      awayGoals: hasScore ? score.away : null,
      winnerTeamId: winner,
    });
  }

  await prisma.$transaction([
    ...toClear.map((bracketSlot) =>
      prisma.predictionKnockout.deleteMany({ where: { participantId: guard.id, bracketSlot } }),
    ),
    ...toUpsert.map((u) =>
      prisma.predictionKnockout.upsert({
        where: { participantId_bracketSlot: { participantId: guard.id, bracketSlot: u.bracketSlot } },
        create: { participantId: guard.id, ...u },
        update: {
          homeTeamId: u.homeTeamId,
          awayTeamId: u.awayTeamId,
          homeGoals: u.homeGoals,
          awayGoals: u.awayGoals,
          winnerTeamId: u.winnerTeamId,
        },
      }),
    ),
  ]);
  if (toUpsert.length > 0) await markFirstSubmission(guard.id); // set-once on real content
  revalidatePath("/voorspellen");
  return { ok: true };
}
