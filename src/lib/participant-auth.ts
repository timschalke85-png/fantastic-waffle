// Participant identity: bijnaam (case-insensitive unique) + 4-digit PIN
// (bcrypt-hashed). No auth library (CLAUDE.md). The session cookie carries
// `${id}.${token}` where token = sha256(id + pin_hash); since pin_hash never
// leaves the server and is itself a bcrypt digest, the token is unforgeable
// without DB access — mirroring the admin-auth approach, no extra secret needed.
import "server-only";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { isValidNickname, isValidPin, nicknameKey } from "./predictions-validate";

const COOKIE = "vs_part";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function token(id: string, pinHash: string): string {
  return createHash("sha256").update(`vansaaze:part:${id}:${pinHash}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export interface SessionParticipant {
  id: string;
  nickname: string;
  fullName: string | null;
  showFullName: boolean;
}

async function setSession(p: { id: string; pinHash: string }): Promise<void> {
  (await cookies()).set(COOKIE, `${p.id}.${token(p.id, p.pinHash)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

/** The signed-in participant, or null. Verifies the cookie token against the DB. */
export async function currentParticipant(): Promise<SessionParticipant | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const tok = raw.slice(dot + 1);
  const p = await prisma.participant.findUnique({ where: { id } });
  if (!p) return null;
  if (!safeEqual(token(p.id, p.pinHash), tok)) return null;
  return { id: p.id, nickname: p.nickname, fullName: p.fullName, showFullName: p.showFullName };
}

export type AuthResult =
  | { ok: true; participant: SessionParticipant }
  | { ok: false; error: "nickname" | "pin" | "wrong_pin" | "taken" | "unknown" };

export interface SignInInput {
  nickname: string;
  pin: string;
  fullName?: string;
  showFullName?: boolean;
}

/**
 * Register a NEW participant (Registreren tab). Rejects with "taken" if the
 * bijnaam already exists (case-insensitive, trimmed) — even with the correct PIN:
 * registering never logs into an existing account. Concurrency-safe: a duplicate
 * insert (P2002) between the check and the create is also reported as "taken".
 */
export async function registerParticipant(input: SignInInput): Promise<AuthResult> {
  const nickname = input.nickname.trim();
  if (!isValidNickname(nickname)) return { ok: false, error: "nickname" };
  if (!isValidPin(input.pin)) return { ok: false, error: "pin" };

  const key = nicknameKey(nickname);
  const existing = await prisma.participant.findUnique({ where: { nicknameKey: key } });
  if (existing) return { ok: false, error: "taken" };

  const pinHash = await bcrypt.hash(input.pin, 10);
  try {
    const created = await prisma.participant.create({
      data: {
        nickname,
        nicknameKey: key,
        fullName: input.fullName?.trim() || null,
        showFullName: !!input.showFullName,
        pinHash,
      },
    });
    await setSession(created);
    return {
      ok: true,
      participant: { id: created.id, nickname: created.nickname, fullName: created.fullName, showFullName: created.showFullName },
    };
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002") {
      return { ok: false, error: "taken" };
    }
    throw e;
  }
}

/**
 * Sign in to an EXISTING participant (Inloggen tab). NEVER creates an account: an
 * unknown bijnaam returns "unknown", a wrong PIN returns "wrong_pin". This mirrors
 * the existing-account branch of the old signInOrRegister exactly (same
 * nicknameKey lookup + bcrypt.compare), so already-registered participants on the
 * live database keep logging in with the same bijnaam + PIN, unchanged.
 */
export async function signInParticipant(input: SignInInput): Promise<AuthResult> {
  const nickname = input.nickname.trim();
  if (!isValidNickname(nickname)) return { ok: false, error: "nickname" };
  if (!isValidPin(input.pin)) return { ok: false, error: "pin" };

  const key = nicknameKey(nickname);
  const existing = await prisma.participant.findUnique({ where: { nicknameKey: key } });
  if (!existing) return { ok: false, error: "unknown" };

  const match = await bcrypt.compare(input.pin, existing.pinHash);
  if (!match) return { ok: false, error: "wrong_pin" };

  await setSession(existing);
  return {
    ok: true,
    participant: { id: existing.id, nickname: existing.nickname, fullName: existing.fullName, showFullName: existing.showFullName },
  };
}

export async function updateProfile(
  id: string,
  fullName: string | null,
  showFullName: boolean,
): Promise<void> {
  await prisma.participant.update({
    where: { id },
    data: { fullName: fullName?.trim() || null, showFullName },
  });
}

/**
 * Tiebreak #3 (earliest first submission): stamp `first_submitted_at` exactly
 * once, on the first prediction save that writes real content. Idempotent — the
 * `IS NULL` guard makes it set-once and concurrency-safe. Raw SQL so it does not
 * depend on a regenerated Prisma client; the typed field follows after the
 * migration + `prisma generate`.
 *
 * REQUIRES migration 0002_add_first_submitted_at to be applied first, otherwise
 * the column does not exist and the save will throw.
 */
export async function markFirstSubmission(id: string): Promise<void> {
  await prisma.$executeRaw`UPDATE participants SET first_submitted_at = now() WHERE id = ${id} AND first_submitted_at IS NULL`;
}

export async function signOutParticipant(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
