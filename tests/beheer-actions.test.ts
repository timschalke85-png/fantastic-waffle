// deleteParticipantAction: must be gated on admin and perform exactly one
// participant.delete (the schema's onDelete: Cascade removes predictions + score).
// redirect() throws in real Next, so the mock throws too and we assert on that.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, isAdmin, redirect, setSetting, loadEveningForFreeze } = vi.hoisted(() => ({
  prisma: {
    participant: { findUnique: vi.fn(), delete: vi.fn() },
    match: { update: vi.fn() },
    evening: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    eveningMatch: { deleteMany: vi.fn(), create: vi.fn() },
    dailyWinner: { createMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
  isAdmin: vi.fn(),
  setSetting: vi.fn(),
  loadEveningForFreeze: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/admin-auth", () => ({ isAdmin, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/settings", () => ({ setSetting }));
vi.mock("@/lib/prijzenpoule-data", () => ({ loadEveningForFreeze }));
vi.mock("@/lib/refresh", () => ({ refreshMatchData: vi.fn() }));
vi.mock("@/lib/recompute", () => ({ recomputeScores: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  deleteParticipantAction,
  updateMatchAction,
  createEveningAction,
  activateEveningAction,
  setEveningMatchesAction,
  togglePollAction,
  updatePrizeTextsAction,
  freezeEveningAction,
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

describe("updateMatchAction (ruststand)", () => {
  beforeEach(() => isAdmin.mockResolvedValue(true));

  it("rejects an impossible ruststand (more at half time than at full time)", async () => {
    await expect(
      updateMatchAction(fd({ matchId: "m1", status: "FINISHED", homeScore: "1", awayScore: "0", halfTimeHome: "2", halfTimeAway: "0" })),
    ).rejects.toThrow("REDIRECT:/beheer?error=ruststand");
    expect(prisma.match.update).not.toHaveBeenCalled();
  });

  it("saves a valid ruststand within the final score (flags manuallyOverridden)", async () => {
    await updateMatchAction(fd({ matchId: "m1", status: "FINISHED", homeScore: "2", awayScore: "1", halfTimeHome: "1", halfTimeAway: "0" }));
    expect(prisma.match.update).toHaveBeenCalledTimes(1);
    const call = prisma.match.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "m1" });
    expect(call.data).toMatchObject({
      status: "FINISHED",
      homeScore: 2,
      awayScore: 1,
      halfTimeHome: 1,
      halfTimeAway: 0,
      manuallyOverridden: true,
    });
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

  it("redirects to ?error=db when a write keeps failing with a connection error (after one retry)", async () => {
    prisma.evening.create.mockRejectedValue({ code: "57P01" });
    await expect(createEveningAction(fd({ label: "Avond 1" }))).rejects.toThrow("REDIRECT:/beheer?error=db");
    expect(prisma.evening.create).toHaveBeenCalledTimes(2); // original + one retry
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

  it("updatePrizeTexts rejects a non-admin and writes nothing", async () => {
    isAdmin.mockResolvedValue(false);
    await expect(updatePrizeTextsAction(fd({ prize_text_daywinner: "X" }))).rejects.toThrow("REDIRECT:/beheer?error=auth");
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("updatePrizeTexts writes the five prize-text keys (trimmed) + the min-evenings setting", async () => {
    await expect(
      updatePrizeTextsAction(fd({ prize_text_daywinner: " Voucher €50 ", prize_min_evenings: "4" })),
    ).rejects.toThrow("REDIRECT:/beheer?saved=prizes");
    expect(setSetting).toHaveBeenCalledWith("prize_text_daywinner", "Voucher €50");
    expect(setSetting).toHaveBeenCalledWith("prize_min_evenings", "4");
  });
});

describe("freezeEveningAction", () => {
  beforeEach(() => isAdmin.mockResolvedValue(true));

  const finished = (over: Record<string, unknown> = {}) => ({
    eveningId: "e1",
    label: "Avond 1",
    frozen: false,
    hasMatches: true,
    allFinished: true,
    resultKey: "em1=2-1",
    checkedInIds: ["a", "b", "c"],
    matches: [
      {
        eveningMatchId: "em1",
        actual: { halfTimeHome: 1, halfTimeAway: 0, fullTimeHome: 2, fullTimeAway: 1 },
        entries: [
          { participantId: "a", pred: { firstHalfHome: 1, firstHalfAway: 0, secondHalfHome: 1, secondHalfAway: 1 } }, // 9
          { participantId: "b", pred: { firstHalfHome: 0, firstHalfAway: 0, secondHalfHome: 0, secondHalfAway: 0 } }, // 1
        ],
      },
    ],
    matchLabels: {},
    nameOf: {},
    ...over,
  });

  it("rejects a non-admin and stores nothing", async () => {
    isAdmin.mockResolvedValue(false);
    await expect(freezeEveningAction(fd({ eveningId: "e1" }))).rejects.toThrow("REDIRECT:/beheer?error=auth");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the evening is not found", async () => {
    loadEveningForFreeze.mockResolvedValue(null);
    await expect(freezeEveningAction(fd({ eveningId: "x" }))).rejects.toThrow("REDIRECT:/beheer?error=evening");
  });

  it("is idempotent: an already-frozen evening is a no-op (no store)", async () => {
    loadEveningForFreeze.mockResolvedValue(finished({ frozen: true }));
    await expect(freezeEveningAction(fd({ eveningId: "e1" }))).rejects.toThrow("REDIRECT:/beheer?saved=frozen");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when not all matches are FINISHED", async () => {
    loadEveningForFreeze.mockResolvedValue(finished({ allFinished: false }));
    await expect(freezeEveningAction(fd({ eveningId: "e1" }))).rejects.toThrow("REDIRECT:/beheer?error=not_finished");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("freezes: stores the dagwinnaar rows + a lucky loser (excl. dagwinnaars) and redirects", async () => {
    loadEveningForFreeze.mockResolvedValue(finished());
    await expect(freezeEveningAction(fd({ eveningId: "e1" }))).rejects.toThrow("REDIRECT:/beheer?saved=frozen");
    expect(prisma.dailyWinner.createMany).toHaveBeenCalledWith({ data: [{ eveningMatchId: "em1", participantId: "a" }] });
    const upd = prisma.evening.update.mock.calls[0][0];
    expect(upd.where).toEqual({ id: "e1" });
    expect(["b", "c"]).toContain(upd.data.luckyLoserId); // dagwinnaar "a" excluded
    expect(upd.data.winnersFrozenAt).toBeInstanceOf(Date);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
