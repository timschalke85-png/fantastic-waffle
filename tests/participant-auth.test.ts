// Split identity: registerParticipant (create-only) + signInParticipant (never
// creates). The DB + cookie store are mocked; bcryptjs is REAL so the
// hash/compare path is exercised exactly as in production. The signIn block is
// the regression guard: already-registered accounts must keep logging in.
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("server-only", () => ({}));

const { prisma, cookieSet } = vi.hoisted(() => ({
  prisma: { participant: { findUnique: vi.fn(), create: vi.fn() } },
  cookieSet: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSet, get: vi.fn(), delete: vi.fn() })),
}));

import { registerParticipant, signInParticipant } from "../src/lib/participant-auth";

beforeEach(() => vi.clearAllMocks());

describe("registerParticipant (create-only)", () => {
  it("rejects an invalid nickname", async () => {
    expect(await registerParticipant({ nickname: "x", pin: "1234" })).toEqual({ ok: false, error: "nickname" });
    expect(prisma.participant.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid pin", async () => {
    expect(await registerParticipant({ nickname: "Oranje", pin: "12" })).toEqual({ ok: false, error: "pin" });
  });

  it("rejects an existing bijnaam with 'taken' and does NOT create (even with a valid pin)", async () => {
    prisma.participant.findUnique.mockResolvedValue({ id: "p1", nickname: "Oranje", nicknameKey: "oranje" });
    const res = await registerParticipant({ nickname: " Oranje ", pin: "1234" });
    expect(res).toEqual({ ok: false, error: "taken" });
    expect(prisma.participant.create).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("creates a new account (normalized key, trimmed name) and sets the session", async () => {
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.participant.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "new1", ...data }));
    const res = await registerParticipant({ nickname: "Nieuw", pin: "1234", fullName: " Jan ", showFullName: true });
    expect(res.ok).toBe(true);
    const created = prisma.participant.create.mock.calls[0][0].data;
    expect(created.nicknameKey).toBe("nieuw");
    expect(created.fullName).toBe("Jan");
    expect(created.showFullName).toBe(true);
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });

  it("maps a race-condition duplicate (P2002) to 'taken'", async () => {
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.participant.create.mockRejectedValue({ code: "P2002" });
    expect(await registerParticipant({ nickname: "Race", pin: "1234" })).toEqual({ ok: false, error: "taken" });
  });
});

describe("signInParticipant (never creates — regression: existing accounts keep working)", () => {
  let pinHash: string;
  beforeAll(async () => {
    pinHash = await bcrypt.hash("1234", 10); // a real stored hash, as on the live DB
  });

  it("rejects an unknown bijnaam with 'unknown' and NEVER creates an account", async () => {
    prisma.participant.findUnique.mockResolvedValue(null);
    const res = await signInParticipant({ nickname: "Typfout", pin: "1234" });
    expect(res).toEqual({ ok: false, error: "unknown" });
    expect(prisma.participant.create).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("rejects a wrong pin for an existing account (no session)", async () => {
    prisma.participant.findUnique.mockResolvedValue({
      id: "p1", nickname: "Oranje", nicknameKey: "oranje", pinHash, fullName: null, showFullName: false,
    });
    const res = await signInParticipant({ nickname: "Oranje", pin: "9999" });
    expect(res).toEqual({ ok: false, error: "wrong_pin" });
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("logs in an existing account with the correct pin via the same nicknameKey + bcrypt route", async () => {
    prisma.participant.findUnique.mockResolvedValue({
      id: "p1", nickname: "Oranje", nicknameKey: "oranje", pinHash, fullName: "Jan", showFullName: true,
    });
    const res = await signInParticipant({ nickname: "  ORANJE  ", pin: "1234" }); // case-insensitive + trimmed
    expect(res).toEqual({
      ok: true,
      participant: { id: "p1", nickname: "Oranje", fullName: "Jan", showFullName: true },
    });
    expect(prisma.participant.findUnique).toHaveBeenCalledWith({ where: { nicknameKey: "oranje" } });
    expect(prisma.participant.create).not.toHaveBeenCalled();
    expect(cookieSet).toHaveBeenCalledTimes(1);
  });
});
