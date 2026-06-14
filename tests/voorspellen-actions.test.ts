// Server-action security tests (Fase 5 acceptance): writes must be rejected
// server-side — without a session, after the lock, for ineligible matches, for
// invalid integers, and for duplicate ranking teams — independent of the UI.
// The DB/session boundary is mocked; the real validation logic runs.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// vi.mock factories are hoisted above imports, so the mock objects must come
// from vi.hoisted (which also runs first) rather than plain top-level consts.
const {
  prisma,
  currentParticipant,
  getGroupLockUtc,
  getKnockoutLockUtc,
  isKnockoutOpen,
  eligibleGroupMatchIds,
} = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    team: { findMany: vi.fn() },
    match: { findMany: vi.fn() },
    predictionGroupMatch: { upsert: vi.fn(), deleteMany: vi.fn() },
    predictionTeamGoals: { upsert: vi.fn(), deleteMany: vi.fn() },
    predictionGroupRank: { create: vi.fn(), deleteMany: vi.fn() },
    predictionKnockout: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
  currentParticipant: vi.fn(),
  getGroupLockUtc: vi.fn(),
  getKnockoutLockUtc: vi.fn(),
  isKnockoutOpen: vi.fn(),
  eligibleGroupMatchIds: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/participant-auth", () => ({
  currentParticipant,
  registerParticipant: vi.fn(),
  signInParticipant: vi.fn(),
  signOutParticipant: vi.fn(),
  updateProfile: vi.fn(),
  markFirstSubmission: vi.fn(),
}));
vi.mock("@/lib/settings", () => ({ getGroupLockUtc, getKnockoutLockUtc, isKnockoutOpen }));
vi.mock("@/lib/predictions", () => ({ eligibleGroupMatchIds }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
// NB: @/lib/knockout-bracket and @/lib/knockout are pure and deliberately NOT
// mocked — the real cascade/resolve/validate logic runs in these tests.

import {
  saveGroupMatchesAction,
  saveRankAction,
  saveTeamGoalsAction,
  saveKnockoutPickAction,
  type KnockoutPickInput,
} from "../src/app/voorspellen/actions";

const FUTURE = new Date("2030-01-01T00:00:00Z");
const PAST = new Date("2020-01-01T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
});

describe("saveGroupMatchesAction", () => {
  beforeEach(() => {
    // Default: queried matches kick off in the future -> per-match editable.
    prisma.match.findMany.mockResolvedValue([
      { id: "m1", kickoffUtc: FUTURE },
      { id: "m2", kickoffUtc: FUTURE },
    ]);
  });

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

  it("rejects a write to a match that already kicked off (per-match lock), even before the global deadline", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE); // global deadline still open
    eligibleGroupMatchIds.mockResolvedValue(new Set(["m1"]));
    prisma.match.findMany.mockResolvedValue([{ id: "m1", kickoffUtc: PAST }]); // already started
    const res = await saveGroupMatchesAction([{ matchId: "m1", home: "1", away: "0" }]);
    expect(res).toEqual({ ok: false, error: "match_locked" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("saves an upcoming (not-yet-started) match normally under the per-match lock", async () => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    getGroupLockUtc.mockResolvedValue(FUTURE);
    eligibleGroupMatchIds.mockResolvedValue(new Set(["m2"]));
    prisma.match.findMany.mockResolvedValue([{ id: "m2", kickoffUtc: FUTURE }]);
    const res = await saveGroupMatchesAction([{ matchId: "m2", home: "2", away: "2" }]);
    expect(res).toEqual({ ok: true });
    expect(prisma.predictionGroupMatch.upsert).toHaveBeenCalledTimes(1);
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

describe("saveKnockoutPickAction", () => {
  // R32 base: 73 = a v b, 75 = c v d. R16 slot 90 = W73 v W75.
  const R32_ROWS = [
    { bracketSlot: "73", homeTeamId: "a", awayTeamId: "b" },
    { bracketSlot: "75", homeTeamId: "c", awayTeamId: "d" },
  ];
  const pick = (over: Partial<KnockoutPickInput> & { bracketSlot: string }): KnockoutPickInput => ({
    homeGoals: "",
    awayGoals: "",
    winnerTeamId: "",
    ...over,
  });
  // Find the `create` payload of the upsert for a given slot (undefined if none).
  const upserted = (slot: string) =>
    prisma.predictionKnockout.upsert.mock.calls
      .map((c) => c[0].create)
      .find((cr: { bracketSlot: string }) => cr.bracketSlot === slot);
  const clearedSlots = () =>
    prisma.predictionKnockout.deleteMany.mock.calls.map((c) => c[0].where.bracketSlot);

  beforeEach(() => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    isKnockoutOpen.mockResolvedValue(true);
    getKnockoutLockUtc.mockResolvedValue(FUTURE);
    prisma.match.findMany.mockResolvedValue(R32_ROWS);
  });

  it("rejects when no participant session", async () => {
    currentParticipant.mockResolvedValue(null);
    const res = await saveKnockoutPickAction([pick({ bracketSlot: "73", winnerTeamId: "a" })]);
    expect(res).toEqual({ ok: false, error: "auth" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects when the knockout round is not open", async () => {
    isKnockoutOpen.mockResolvedValue(false);
    const res = await saveKnockoutPickAction([pick({ bracketSlot: "73", winnerTeamId: "a" })]);
    expect(res).toEqual({ ok: false, error: "closed" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("enforces the lock server-side: writes after knockout_lock_utc are rejected", async () => {
    getKnockoutLockUtc.mockResolvedValue(PAST);
    const res = await saveKnockoutPickAction([pick({ bracketSlot: "73", winnerTeamId: "a" })]);
    expect(res).toEqual({ ok: false, error: "locked" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range bracket slot", async () => {
    const res = await saveKnockoutPickAction([pick({ bracketSlot: "999", winnerTeamId: "a" })]);
    expect(res).toEqual({ ok: false, error: "slot" });
  });

  // Requirement 1: an upstream winner change cascades — inconsistent downstream
  // picks are dropped (whole prediction, score included).
  it("drops a downstream pick made inconsistent by an upstream winner change", async () => {
    // 90 = W73 v W75. Change 73 to b -> 90 becomes b v c, so winner a is gone.
    const res = await saveKnockoutPickAction([
      pick({ bracketSlot: "73", winnerTeamId: "b" }),
      pick({ bracketSlot: "75", winnerTeamId: "c" }),
      pick({ bracketSlot: "90", winnerTeamId: "a", homeGoals: "2", awayGoals: "1" }),
    ]);
    expect(res).toEqual({ ok: true });
    expect(clearedSlots()).toContain("90"); // dropped
    expect(upserted("90")).toBeUndefined(); // not persisted
    // 73 persists with the real teams + new winner.
    expect(upserted("73")).toMatchObject({ homeTeamId: "a", awayTeamId: "b", winnerTeamId: "b" });
  });

  // Requirement 1 (half-formed): one side of the tie becomes unknown -> drop.
  it("drops a half-formed downstream pick (an upstream is unpredicted)", async () => {
    // 90 = W73 v W75, but 73 is not in the submission -> 90's home is null.
    const res = await saveKnockoutPickAction([
      pick({ bracketSlot: "75", winnerTeamId: "c" }),
      pick({ bracketSlot: "90", winnerTeamId: "c", homeGoals: "1", awayGoals: "1" }),
    ]);
    expect(res).toEqual({ ok: true });
    expect(clearedSlots()).toContain("90");
    expect(upserted("90")).toBeUndefined();
  });

  // Requirement 3 + re-derivation: client-sent teams are ignored; the server
  // writes the teams it resolves from the winner-picks.
  it("ignores client-sent home/awayTeamId and persists the server-resolved tie", async () => {
    // 90 = a v d (73:a, 75:d). Client lies about the away team ("c") — server must
    // write the re-derived "d".
    const res = await saveKnockoutPickAction([
      pick({ bracketSlot: "73", winnerTeamId: "a" }),
      pick({ bracketSlot: "75", winnerTeamId: "d" }),
      pick({
        bracketSlot: "90",
        winnerTeamId: "a",
        homeGoals: "3",
        awayGoals: "1",
        homeTeamId: "a",
        awayTeamId: "c", // bogus
      }),
    ]);
    expect(res).toEqual({ ok: true });
    expect(upserted("90")).toMatchObject({
      homeTeamId: "a",
      awayTeamId: "d", // re-derived, NOT the client's "c"
      winnerTeamId: "a",
      homeGoals: 3,
      awayGoals: 1,
    });
  });

  // Requirement 2: invariant on every persisted row.
  it("guarantees winnerTeamId ∈ {home, away} ∨ null on every upserted row", async () => {
    await saveKnockoutPickAction([
      pick({ bracketSlot: "73", winnerTeamId: "a", homeGoals: "1", awayGoals: "0" }),
      pick({ bracketSlot: "75", winnerTeamId: "d" }),
      pick({ bracketSlot: "90", winnerTeamId: "a" }), // 90 = a v d, winner a ✓
    ]);
    const creates = prisma.predictionKnockout.upsert.mock.calls.map((c) => c[0].create);
    expect(creates.length).toBeGreaterThan(0);
    for (const cr of creates) {
      const ok = cr.winnerTeamId == null || cr.winnerTeamId === cr.homeTeamId || cr.winnerTeamId === cr.awayTeamId;
      expect(ok).toBe(true);
    }
  });

  it("rejects an R32 winner who isn't one of the real teams", async () => {
    const res = await saveKnockoutPickAction([pick({ bracketSlot: "73", winnerTeamId: "zz" })]);
    expect(res).toEqual({ ok: false, error: "inconsistent" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a negative / non-integer score", async () => {
    const res = await saveKnockoutPickAction([
      pick({ bracketSlot: "73", winnerTeamId: "a", homeGoals: "-1", awayGoals: "0" }),
    ]);
    expect(res).toEqual({ ok: false, error: "invalid" });
  });
});
