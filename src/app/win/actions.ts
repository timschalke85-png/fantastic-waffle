"use server";

// Participant action for the prijzenpoule check-in. Behind the participant
// identity (currentParticipant). Validates the shared daily code against the
// active evening server-side and records an idempotent Checkin. No admin powers.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentParticipant } from "@/lib/participant-auth";
import { parseGoals, isDagspelOpen } from "@/lib/predictions-validate";
import { withDbRetry, isTransientConnectionError } from "@/lib/db-retry";

export type CheckInResult =
  | { ok: true; already: boolean }
  | { ok: false; error: "auth" | "no_evening" | "no_code" | "wrong_code" | "db" };

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

export async function checkInAction(formData: FormData): Promise<CheckInResult> {
  try {
    const p = await withDbRetry(() => currentParticipant());
    if (!p) return { ok: false, error: "auth" };

    const evening = await withDbRetry(() => prisma.evening.findFirst({ where: { isActive: true } }));
    if (!evening) return { ok: false, error: "no_evening" };
    if (!evening.checkInCode) return { ok: false, error: "no_code" };

    const submitted = String(formData.get("code") ?? "").trim().toLowerCase();
    if (submitted === "" || submitted !== evening.checkInCode.trim().toLowerCase()) {
      return { ok: false, error: "wrong_code" };
    }

    // Idempotent: a second check-in must not fail.
    const existing = await withDbRetry(() =>
      prisma.checkin.findUnique({
        where: { eveningId_participantId: { eveningId: evening.id, participantId: p.id } },
        select: { id: true },
      }),
    );
    if (existing) return { ok: true, already: true };

    try {
      await withDbRetry(() => prisma.checkin.create({ data: { eveningId: evening.id, participantId: p.id } }));
    } catch (e) {
      if (isUniqueViolation(e)) return { ok: true, already: true }; // race -> already in
      throw e;
    }
    revalidatePath("/win");
    return { ok: true, already: false };
  } catch (e) {
    if (isTransientConnectionError(e)) return { ok: false, error: "db" };
    throw e;
  }
}

// --- Dagvoorspelling (doelpunten per team per helft) -----------------------

export type DailySaveResult =
  | { ok: true }
  | { ok: false; error: "auth" | "not_found" | "not_checked_in" | "locked" | "invalid" | "db" };

export interface DailyPredictionInput {
  eveningMatchId: string;
  firstHalfHome: string;
  firstHalfAway: string;
  secondHalfHome: string;
  secondHalfAway: string;
}

const MAX_HALF_GOALS = 20; // ruim boven elke realistische helft

/** All four numbers required, non-negative integer, within a sane cap. */
function parseHalfGoals(raw: string): number | null {
  const g = parseGoals(raw);
  if (g.kind !== "value" || g.value > MAX_HALF_GOALS) return null;
  return g.value;
}

/**
 * Save (upsert) a participant's day-game prediction for one dagspel. Server-side:
 * must be signed in, CHECKED IN for that dagspel's evening (O8), and BEFORE the
 * match kickoff (per-match lock). Re-submitting before kickoff overwrites the
 * existing prediction (upsert on eveningMatchId+participantId).
 */
export async function saveDailyPredictionAction(input: DailyPredictionInput): Promise<DailySaveResult> {
  try {
    const p = await withDbRetry(() => currentParticipant());
    if (!p) return { ok: false, error: "auth" };

    const em = await withDbRetry(() =>
      prisma.eveningMatch.findUnique({
        where: { id: input.eveningMatchId },
        include: { match: { select: { kickoffUtc: true, status: true } } },
      }),
    );
    if (!em) return { ok: false, error: "not_found" };

    const checkin = await withDbRetry(() =>
      prisma.checkin.findUnique({
        where: { eveningId_participantId: { eveningId: em.eveningId, participantId: p.id } },
        select: { id: true },
      }),
    );
    if (!checkin) return { ok: false, error: "not_checked_in" };

    // Lock once the match has started: kicked off OR no longer SCHEDULED (status
    // is authoritative — a finished match must not stay predictable even if its
    // stored kickoff time is still in the future).
    if (!isDagspelOpen(em.match.kickoffUtc, em.match.status, Date.now())) return { ok: false, error: "locked" };

    const fhh = parseHalfGoals(input.firstHalfHome);
    const fha = parseHalfGoals(input.firstHalfAway);
    const shh = parseHalfGoals(input.secondHalfHome);
    const sha = parseHalfGoals(input.secondHalfAway);
    if (fhh === null || fha === null || shh === null || sha === null) return { ok: false, error: "invalid" };

    await withDbRetry(() =>
      prisma.dailyPrediction.upsert({
        where: { eveningMatchId_participantId: { eveningMatchId: em.id, participantId: p.id } },
        create: { eveningMatchId: em.id, participantId: p.id, firstHalfHome: fhh, firstHalfAway: fha, secondHalfHome: shh, secondHalfAway: sha },
        update: { firstHalfHome: fhh, firstHalfAway: fha, secondHalfHome: shh, secondHalfAway: sha },
      }),
    );
    revalidatePath("/win");
    return { ok: true };
  } catch (e) {
    if (isTransientConnectionError(e)) return { ok: false, error: "db" };
    throw e;
  }
}
