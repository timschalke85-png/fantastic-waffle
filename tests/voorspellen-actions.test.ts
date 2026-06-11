// Server-action security tests (Fase 5 acceptance): writes must be rejected
// server-side — without a session, after the lock, for ineligible matches, for
// invalid integers, and for duplicate ranking teams — independent of the UI.
// The DB/session boundary is mocked; the real validation logic runs.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// vi.mock factories are hoisted above imports, so the mock objects must come
// from vi.hoisted (which also runs first) rather than plain top-level consts.
const { prisma, currentParticipant, getGroupLockUtc, eligibleGroupMatchIds } = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    team: { findMany: vi.fn() },
    predictionGroupMatch: { upsert: vi.fn(), deleteMany: vi.fn() },
    predictionTeamGoals: { upsert: vi.fn(), deleteMany: vi.fn() },
    predictionGroupRank: { create: vi.fn(), deleteMany: vi.fn() },
  },
  currentParticipant: vi.fn(),
  getGroupLockUtc: vi.fn(),
  eligibleGroupMatchIds: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/participant-auth", () => ({
  currentParticipant,
  signInOrRegister: vi.fn(),
  signOutParticipant: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({ getGroupLockUtc }));
vi.mock("@/lib/predictions", () => ({ eligibleGroupMatchIds }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { saveGroupMatchesAction, saveRankAction, saveTeamGoalsAction } from "../src/app/voorspellen/actions";

const FUTURE = new Date("2030-01-01T00:00:00Z");
const PAST = new Date("2020-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
});

describe("saveGroupMatchesAction", () => {
  it("rejects when no participant session", async () => {
    currentParticipant.mockResolvedValue(null);
    getGroupLockUtc.mockResolvedValue(FUTURE);
    const res = await saveGroupMatchesAction([{ matchId: "m1", home: "1", away: "0" }]);
    expect(res).toEqual({ ok: false, error: "auth" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects writes after the lock", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(PAST);
    const res = await saveGroupMatchesAction([{ matchId: "m1", home: "1", away: "0" }]);
    expect(res).toEqual({ ok: false, error: "locked" });
  });

  it("rejects an ineligible match even if unlocked", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE);
    eligibleGroupMatchIds.mockResolvedValue(new Set(["other"]));
    const res = await saveGroupMatchesAction([{ matchId: "m1", home: "1", away: "0" }]);
    expect(res).toEqual({ ok: false, error: "ineligible" });
  });

  it("rejects a negative / non-integer score", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE);
    eligibleGroupMatchIds.mockResolvedValue(new Set(["m1"]));
    const res = await saveGroupMatchesAction([{ matchId: "m1", home: "-1", away: "0" }]);
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("persists a valid scoreline (partial form allowed)", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE);
    eligibleGroupMatchIds.mockResolvedValue(new Set(["m1", "m2"]));
    const res = await saveGroupMatchesAction([
      { matchId: "m1", home: "2", away: "1" }, // saved
      { matchId: "m2", home: "", away: "" }, // cleared (partial save OK)
    ]);
    expect(res).toEqual({ ok: true });
    expect(prisma.predictionGroupMatch.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.predictionGroupMatch.deleteMany).toHaveBeenCalledTimes(1);
  });
});

describe("saveRankAction", () => {
  beforeEach(() => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE);
    prisma.team.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }, { id: "t3" }, { id: "t4" }]);
  });

  it("rejects a duplicate team across positions", async () => {
    const res = await saveRankAction({
      groupLetter: "F",
      entries: [
        { position: 1, teamId: "t1" },
        { position: 2, teamId: "t1" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a position outside the group's allowed set", async () => {
    const res = await saveRankAction({ groupLetter: "A", entries: [{ position: 3, teamId: "t3" }] });
    expect(res.ok).toBe(false);
  });

  it("persists a valid distinct ranking", async () => {
    const res = await saveRankAction({
      groupLetter: "F",
      entries: [
        { position: 1, teamId: "t1" },
        { position: 2, teamId: "t2" },
        { position: 3, teamId: "" }, // partial allowed
        { position: 4, teamId: "" },
      ],
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.predictionGroupRank.create).toHaveBeenCalledTimes(2);
  });

  it("rejects after the lock", async () => {
    getGroupLockUtc.mockResolvedValue(PAST);
    const res = await saveRankAction({ groupLetter: "F", entries: [{ position: 1, teamId: "t1" }] });
    expect(res).toEqual({ ok: false, error: "locked" });
  });
});

describe("saveTeamGoalsAction", () => {
  beforeEach(() => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE);
    prisma.team.findMany.mockResolvedValue([{ id: "t1" }, { id: "t2" }, { id: "t3" }, { id: "t4" }]);
  });

  it("rejects goals for a non-Poule-F team", async () => {
    const res = await saveTeamGoalsAction([{ teamId: "outsider", goals: "3" }]);
    expect(res).toEqual({ ok: false, error: "team" });
  });

  it("rejects a negative goal count", async () => {
    const res = await saveTeamGoalsAction([{ teamId: "t1", goals: "-2" }]);
    expect(res).toEqual({ ok: false, error: "invalid" });
  });

  it("persists valid team goals", async () => {
    const res = await saveTeamGoalsAction([
      { teamId: "t1", goals: "5" },
      { teamId: "t2", goals: "" },
    ]);
    expect(res).toEqual({ ok: true });
    expect(prisma.predictionTeamGoals.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.predictionTeamGoals.deleteMany).toHaveBeenCalledTimes(1);
  });
});
