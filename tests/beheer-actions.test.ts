// deleteParticipantAction: must be gated on admin and perform exactly one
// participant.delete (the schema's onDelete: Cascade removes predictions + score).
// redirect() throws in real Next, so the mock throws too and we assert on that.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, isAdmin, redirect } = vi.hoisted(() => ({
  prisma: { participant: { findUnique: vi.fn(), delete: vi.fn() } },
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

import { deleteParticipantAction } from "../src/app/beheer/actions";

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
