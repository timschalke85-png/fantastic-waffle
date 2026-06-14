// checkInAction: behind the participant identity; validates the shared daily code
// against the active evening server-side; idempotent. DB + auth mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, currentParticipant } = vi.hoisted(() => ({
  prisma: { evening: { findFirst: vi.fn() }, checkin: { findUnique: vi.fn(), create: vi.fn() } },
  currentParticipant: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/participant-auth", () => ({ currentParticipant }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { checkInAction } from "../src/app/win/actions";

const fd = (code?: string) => {
  const f = new FormData();
  if (code !== undefined) f.set("code", code);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe("checkInAction", () => {
  it("rejects when not signed in", async () => {
    currentParticipant.mockResolvedValue(null);
    expect(await checkInAction(fd("ABC"))).toEqual({ ok: false, error: "auth" });
    expect(prisma.checkin.create).not.toHaveBeenCalled();
  });

  it("rejects when there is no active evening", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue(null);
    expect(await checkInAction(fd("ABC"))).toEqual({ ok: false, error: "no_evening" });
  });

  it("rejects when the active evening has no code set", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue({ id: "e1", checkInCode: null });
    expect(await checkInAction(fd("ABC"))).toEqual({ ok: false, error: "no_code" });
  });

  it("rejects a wrong code without creating a check-in", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue({ id: "e1", checkInCode: "SAAZE" });
    expect(await checkInAction(fd("nope"))).toEqual({ ok: false, error: "wrong_code" });
    expect(prisma.checkin.create).not.toHaveBeenCalled();
  });

  it("rejects an empty code", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue({ id: "e1", checkInCode: "SAAZE" });
    expect(await checkInAction(fd(""))).toEqual({ ok: false, error: "wrong_code" });
  });

  it("checks in on a correct code (case-insensitive + trimmed)", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue({ id: "e1", checkInCode: "SAAZE" });
    prisma.checkin.findUnique.mockResolvedValue(null);
    prisma.checkin.create.mockResolvedValue({ id: "c1" });
    expect(await checkInAction(fd("  saaze "))).toEqual({ ok: true, already: false });
    expect(prisma.checkin.create).toHaveBeenCalledWith({ data: { eveningId: "e1", participantId: "p1" } });
  });

  it("is idempotent: a second check-in succeeds without creating again", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue({ id: "e1", checkInCode: "SAAZE" });
    prisma.checkin.findUnique.mockResolvedValue({ id: "c1" }); // already checked in
    expect(await checkInAction(fd("SAAZE"))).toEqual({ ok: true, already: true });
    expect(prisma.checkin.create).not.toHaveBeenCalled();
  });

  it("treats a race-condition unique violation as already checked in", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.evening.findFirst.mockResolvedValue({ id: "e1", checkInCode: "SAAZE" });
    prisma.checkin.findUnique.mockResolvedValue(null);
    prisma.checkin.create.mockRejectedValue({ code: "P2002" });
    expect(await checkInAction(fd("SAAZE"))).toEqual({ ok: true, already: true });
  });
});
