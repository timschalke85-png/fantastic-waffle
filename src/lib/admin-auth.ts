// Minimal admin session: a single ADMIN_PASSWORD gates /beheer via an httpOnly
// cookie holding a hash of the password (no library, per CLAUDE.md). Not a
// multi-user system — it's one shared admin for a friends' pool.
import "server-only";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";

const COOKIE = "vs_admin";
const MAX_AGE_S = 60 * 60 * 8; // 8h

function expectedToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return createHash("sha256").update(`vansaaze:${pw}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function isAdmin(): Promise<boolean> {
  const expected = expectedToken();
  if (!expected) return false; // no ADMIN_PASSWORD configured -> locked
  const got = (await cookies()).get(COOKIE)?.value;
  return !!got && safeEqual(got, expected);
}

/** Returns true and sets the session cookie on a correct password. */
export async function signIn(password: string): Promise<boolean> {
  const pw = process.env.ADMIN_PASSWORD;
  const expected = expectedToken();
  if (!pw || !expected || !safeEqual(password, pw)) return false;
  (await cookies()).set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
  return true;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
