"use server";

// Participant action for the prijzenpoule check-in. Behind the participant
// identity (currentParticipant). Validates the shared daily code against the
// active evening server-side and records an idempotent Checkin. No admin powers.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentParticipant } from "@/lib/participant-auth";

export type CheckInResult =
  | { ok: true; already: boolean }
  | { ok: false; error: "auth" | "no_evening" | "no_code" | "wrong_code" };

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

export async function checkInAction(formData: FormData): Promise<CheckInResult> {
  const p = await currentParticipant();
  if (!p) return { ok: false, error: "auth" };

  const evening = await prisma.evening.findFirst({ where: { isActive: true } });
  if (!evening) return { ok: false, error: "no_evening" };
  if (!evening.checkInCode) return { ok: false, error: "no_code" };

  const submitted = String(formData.get("code") ?? "").trim().toLowerCase();
  if (submitted === "" || submitted !== evening.checkInCode.trim().toLowerCase()) {
    return { ok: false, error: "wrong_code" };
  }

  // Idempotent: a second check-in must not fail.
  const existing = await prisma.checkin.findUnique({
    where: { eveningId_participantId: { eveningId: evening.id, participantId: p.id } },
    select: { id: true },
  });
  if (existing) return { ok: true, already: true };

  try {
    await prisma.checkin.create({ data: { eveningId: evening.id, participantId: p.id } });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, already: true }; // race -> already in
    throw e;
  }
  revalidatePath("/win");
  return { ok: true, already: false };
}
