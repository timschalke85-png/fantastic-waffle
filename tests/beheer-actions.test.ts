// deleteParticipantAction: must be gated on admin and perform exactly one
// participant.delete (the schema's onDelete: Cascade removes predictions + score).
// redirect() throws in real Next, so the mock throws too and we assert on that.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, isAdmin, redirect } = vi.hoisted(() => ({
  prisma: {
    participant: { findUnique: vi.fn(), delete: vi.fn() },
    evening: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    eveningMatch: { deleteMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  isAdmin: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/admin-auth", () => ({ isAdmin, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/settings", () => ({ setSetting: vi.fn() }));
vi.mock("@/lib/refresh", () => ({ refreshMatchData: vi.fn() }));
vi.mock("@/lib/recompute", () => ({ recomputeScores: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  deleteParticipantAction,
  createEveningAction,
  activateEveningAction,
  setEveningMatchesAction,
  togglePollAction,
} from "../src/app/beheer/actions";

const fd = (obj: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
};

beforeEach(() => vi.clearAllMocks());

describe("deleteParticipantAction", () => {
  it("rejects a non-admin and does not delete", async () => {
    isAdmin.mockResolvedValue(false);
    await expect(deleteParticipantAction(fd({ participantId: "p1" }))).rejects.toThrow("REDIRECT:/beheer?error=auth");
    expect(prisma.participant.delete).not.toHaveBeenCalled();
  });

  it("deletes the participant with a single cascade delete and redirects with the bijnaam", async () => {
    isAdmin.mockResolvedValue(true);
    prisma.participant.findUnique.mockResolvedValue({ nickname: "Oranje" });
    prisma.participant.delete.mockResolvedValue({});
    await expect(deleteParticipantAction(fd({ participantId: "p1" }))).rejects.toThrow("REDIRECT:/beheer?deleted=Oranje");
    expect(prisma.participant.delete).toHaveBeenCalledTimes(1);
    expect(prisma.participant.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
  });

  it("rejects an unknown participant id without deleting", async () => {
    isAdmin.mockResolvedValue(true);
    prisma.participant.findUnique.mockResolvedValue(null);
    await expect(deleteParticipantAction(fd({ participantId: "ghost" }))).rejects.toThrow(
      "REDIRECT:/beheer?error=participant",
    );
    expect(prisma.participant.delete).not.toHaveBeenCalled();
  });

  it("rejects a missing participant id without deleting", async () => {
    isAdmin.mockResolvedValue(true);
    await expect(deleteParticipantAction(fd({}))).rejects.toThrow("REDIRECT:/beheer?error=participant");
    expect(prisma.participant.findUnique).not.toHaveBeenCalled();
    expect(prisma.participant.delete).not.toHaveBeenCalled();
  });
});

describe("prijzenpoule avond-beheer", () => {
  beforeEach(() => isAdmin.mockResolvedValue(true));

  it("createEvening rejects a non-admin and does not create", async () => {
    isAdmin.mockResolvedValue(false);
    await expect(createEveningAction(fd({ label: "Avond 1" }))).rejects.toThrow("REDIRECT:/beheer?error=auth");
    expect(prisma.evening.create).not.toHaveBeenCalled();
  });

  it("createEvening rejects an empty label", async () => {
    await expect(createEveningAction(fd({ label: "  " }))).rejects.toThrow("REDIRECT:/beheer?error=evening_label");
    expect(prisma.evening.create).not.toHaveBeenCalled();
  });

  it("createEvening creates with the trimmed label", async () => {
    await expect(createEveningAction(fd({ label: " Avond 1 " }))).rejects.toThrow("REDIRECT:/beheer?saved=evening");
    expect(prisma.evening.create).toHaveBeenCalledWith({ data: { label: "Avond 1" } });
  });

  it("activateEvening clears all then activates exactly one (single transaction)", async () => {
    await expect(activateEveningAction(fd({ eveningId: "e1" }))).rejects.toThrow("REDIRECT:/beheer?saved=evening");
    expect(prisma.evening.updateMany).toHaveBeenCalledWith({ where: { isActive: true }, data: { isActive: false } });
    expect(prisma.evening.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { isActive: true } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("setEveningMatches rejects zero matches", async () => {
    const f = new FormData();
    f.set("eveningId", "e1");
    await expect(setEveningMatchesAction(f)).rejects.toThrow("REDIRECT:/beheer?error=evening_matches");
    expect(prisma.eveningMatch.create).not.toHaveBeenCalled();
  });

  it("setEveningMatches rejects more than two matches", async () => {
    const f = new FormData();
    f.set("eveningId", "e1");
    f.append("matchId", "m1");
    f.append("matchId", "m2");
    f.append("matchId", "m3");
    await expect(setEveningMatchesAction(f)).rejects.toThrow("REDIRECT:/beheer?error=evening_matches");
    expect(prisma.eveningMatch.create).not.toHaveBeenCalled();
  });

  it("setEveningMatches replaces with ordered EveningMatch rows (deleteMany + creates)", async () => {
    const f = new FormData();
    f.set("eveningId", "e1");
    f.append("matchId", "m1");
    f.append("matchId", "m2");
    await expect(setEveningMatchesAction(f)).rejects.toThrow("REDIRECT:/beheer?saved=evening");
    expect(prisma.eveningMatch.deleteMany).toHaveBeenCalledWith({ where: { eveningId: "e1" } });
    expect(prisma.eveningMatch.create).toHaveBeenCalledTimes(2);
    expect(prisma.eveningMatch.create).toHaveBeenNthCalledWith(1, { data: { eveningId: "e1", matchId: "m1", ordinal: 1 } });
    expect(prisma.eveningMatch.create).toHaveBeenNthCalledWith(2, { data: { eveningId: "e1", matchId: "m2", ordinal: 2 } });
  });

  it("togglePoll sets pollOpen from the 'open' field", async () => {
    await expect(togglePollAction(fd({ eveningId: "e1", open: "true" }))).rejects.toThrow("REDIRECT:/beheer?saved=evening");
    expect(prisma.evening.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { pollOpen: true } });
  });
});
