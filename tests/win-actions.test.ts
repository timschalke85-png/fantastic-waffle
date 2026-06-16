// checkInAction: behind the participant identity; validates the shared daily code
// against the active evening server-side; idempotent. DB + auth mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, currentParticipant } = vi.hoisted(() => ({
  prisma: {
    evening: { findFirst: vi.fn() },
    checkin: { findUnique: vi.fn(), create: vi.fn() },
    eveningMatch: { findUnique: vi.fn() },
    dailyPrediction: { upsert: vi.fn() },
  },
  currentParticipant: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/participant-auth", () => ({ currentParticipant }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { checkInAction, saveDailyPredictionAction, type DailyPredictionInput } from "../src/app/win/actions";

const FUTURE = new Date("2030-01-01T00:00:00Z");
const PAST = new Date("2020-01-01T00:00:00Z");
const dp = (over: Partial<DailyPredictionInput> = {}): DailyPredictionInput => ({
  eveningMatchId: "em1",
  firstHalfHome: "1",
  firstHalfAway: "0",
  secondHalfHome: "1",
  secondHalfAway: "1",
  ...over,
});

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

describe("saveDailyPredictionAction", () => {
  // Default happy context: signed in, checked in, future kickoff.
  beforeEach(() => {
    currentParticipant.mockResolvedValue({ id: "p1" });
    prisma.eveningMatch.findUnique.mockResolvedValue({ id: "em1", eveningId: "e1", match: { kickoffUtc: FUTURE, status: "SCHEDULED" } });
    prisma.checkin.findUnique.mockResolvedValue({ id: "c1" });
  });

  it("rejects when not signed in", async () => {
    currentParticipant.mockResolvedValue(null);
    expect(await saveDailyPredictionAction(dp())).toEqual({ ok: false, error: "auth" });
    expect(prisma.dailyPrediction.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown dagspel", async () => {
    prisma.eveningMatch.findUnique.mockResolvedValue(null);
    expect(await saveDailyPredictionAction(dp())).toEqual({ ok: false, error: "not_found" });
  });

  it("rejects when the participant is not checked in for that evening (O8)", async () => {
    prisma.checkin.findUnique.mockResolvedValue(null);
    expect(await saveDailyPredictionAction(dp())).toEqual({ ok: false, error: "not_checked_in" });
    expect(prisma.dailyPrediction.upsert).not.toHaveBeenCalled();
  });

  it("rejects after the match has kicked off (kickoff-lock)", async () => {
    prisma.eveningMatch.findUnique.mockResolvedValue({ id: "em1", eveningId: "e1", match: { kickoffUtc: PAST, status: "SCHEDULED" } });
    expect(await saveDailyPredictionAction(dp())).toEqual({ ok: false, error: "locked" });
    expect(prisma.dailyPrediction.upsert).not.toHaveBeenCalled();
  });

  it("rejects once the match is no longer SCHEDULED, even with a future kickoff (status-lock)", async () => {
    // The crux of BUG 2: a match marked LIVE/FINISHED before its stored kickoff
    // must lock the dagspel — otherwise you could predict on a known result.
    for (const status of ["LIVE", "FINISHED"]) {
      vi.clearAllMocks();
      currentParticipant.mockResolvedValue({ id: "p1" });
      prisma.checkin.findUnique.mockResolvedValue({ id: "c1" });
      prisma.eveningMatch.findUnique.mockResolvedValue({ id: "em1", eveningId: "e1", match: { kickoffUtc: FUTURE, status } });
      expect(await saveDailyPredictionAction(dp())).toEqual({ ok: false, error: "locked" });
      expect(prisma.dailyPrediction.upsert).not.toHaveBeenCalled();
    }
  });

  it("rejects invalid numbers (negative, non-integer, empty, or above the cap)", async () => {
    expect(await saveDailyPredictionAction(dp({ firstHalfHome: "-1" }))).toEqual({ ok: false, error: "invalid" });
    expect(await saveDailyPredictionAction(dp({ firstHalfAway: "1.5" }))).toEqual({ ok: false, error: "invalid" });
    expect(await saveDailyPredictionAction(dp({ secondHalfHome: "" }))).toEqual({ ok: false, error: "invalid" });
    expect(await saveDailyPredictionAction(dp({ secondHalfAway: "21" }))).toEqual({ ok: false, error: "invalid" });
    expect(prisma.dailyPrediction.upsert).not.toHaveBeenCalled();
  });

  it("upserts the four numbers before kickoff (overwritable)", async () => {
    const res = await saveDailyPredictionAction(dp({ firstHalfHome: "2", firstHalfAway: "1", secondHalfHome: "0", secondHalfAway: "3" }));
    expect(res).toEqual({ ok: true });
    expect(prisma.dailyPrediction.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.dailyPrediction.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ eveningMatchId_participantId: { eveningMatchId: "em1", participantId: "p1" } });
    expect(call.create).toMatchObject({ firstHalfHome: 2, firstHalfAway: 1, secondHalfHome: 0, secondHalfAway: 3 });
    expect(call.update).toEqual({ firstHalfHome: 2, firstHalfAway: 1, secondHalfHome: 0, secondHalfAway: 3 });
  });
});
