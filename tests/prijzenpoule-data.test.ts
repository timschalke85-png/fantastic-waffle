// loadEveningWinnersView must show the STORED (frozen) winners after closing —
// never a recomputation — and flag divergence when the result was edited after.
// DB mocked; the pure engine (computeEveningWinners/winnersDiverged) runs for real.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { prisma } = vi.hoisted(() => ({ prisma: { evening: { findUnique: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma }));

import { loadEveningWinnersView } from "../src/lib/prijzenpoule-data";

// Real: ruststand 1-0, eindstand 2-1. "a" predicted perfectly (live winner),
// "b" badly. So a LIVE recompute would crown "a".
const matchFinished = {
  id: "em1",
  match: { status: "FINISHED", halfTimeHome: 1, halfTimeAway: 0, homeScore: 2, awayScore: 1, homeTeam: { nameNl: "Thuis" }, awayTeam: { nameNl: "Uit" } },
  predictions: [
    { participantId: "a", firstHalfHome: 1, firstHalfAway: 0, secondHalfHome: 1, secondHalfAway: 1 }, // perfect (9)
    { participantId: "b", firstHalfHome: 0, firstHalfAway: 0, secondHalfHome: 0, secondHalfAway: 0 }, // (1)
  ],
};
const checkins = [
  { participantId: "a", participant: { nickname: "Ann" } },
  { participantId: "b", participant: { nickname: "Bob" } },
  { participantId: "c", participant: { nickname: "Cas" } },
];

beforeEach(() => vi.clearAllMocks());

describe("loadEveningWinnersView", () => {
  it("after closing, shows the STORED winners (not the recomputation) and flags divergence", async () => {
    // Stored dagwinnaar = "b" while a live recompute would pick "a" (result edited
    // after freezing). Stored lucky loser = "c".
    prisma.evening.findUnique.mockResolvedValue({
      id: "e1",
      winnersFrozenAt: new Date(),
      luckyLoserId: "c",
      luckyLoser: { id: "c", nickname: "Cas" },
      checkins,
      matches: [{ ...matchFinished, winners: [{ participantId: "b", participant: { id: "b", nickname: "Bob" } }] }],
    });

    const view = await loadEveningWinnersView("e1");
    expect(view).not.toBeNull();
    expect(view!.frozen).toBe(true);
    expect(view!.perMatch[0].winnerNames).toEqual(["Bob"]); // stored, NOT the live "Ann"
    expect(view!.luckyLoserName).toBe("Cas");
    expect(view!.diverged).toBe(true); // result no longer matches the frozen winner
  });

  it("before closing, shows the live preview and does not flag divergence", async () => {
    prisma.evening.findUnique.mockResolvedValue({
      id: "e1",
      winnersFrozenAt: null,
      luckyLoserId: null,
      luckyLoser: null,
      checkins,
      matches: [{ ...matchFinished, winners: [] }],
    });

    const view = await loadEveningWinnersView("e1");
    expect(view!.frozen).toBe(false);
    expect(view!.diverged).toBe(false);
    expect(view!.perMatch[0].winnerNames).toEqual(["Ann"]); // live computation
  });

  it("returns null for an unknown evening", async () => {
    prisma.evening.findUnique.mockResolvedValue(null);
    expect(await loadEveningWinnersView("ghost")).toBeNull();
  });
});
