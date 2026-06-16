import { describe, it, expect } from "vitest";
import {
  scoreDailyPrediction,
  determineDagwinnaars,
  drawLuckyLoser,
  computeEveningWinners,
  winnersDiverged,
  assignHoofdprijzen,
  type DailyPrediction,
  type DailyActual,
  type EveningWinners,
} from "../src/lib/prize-scoring";
import { DAILY_MAX } from "../src/config/prize-scoring";

const pred = (a: number, b: number, c: number, d: number): DailyPrediction => ({
  firstHalfHome: a,
  firstHalfAway: b,
  secondHalfHome: c,
  secondHalfAway: d,
});

describe("scoreDailyPrediction", () => {
  // Real: ruststand 1-0, eindstand 2-1 -> 1e helft (1,0), 2e helft (1,1).
  const actual: DailyActual = { halfTimeHome: 1, halfTimeAway: 0, fullTimeHome: 2, fullTimeAway: 1 };

  it("gives the maximum (9) for a fully correct prediction", () => {
    const s = scoreDailyPrediction(pred(1, 0, 1, 1), actual);
    expect(s.total).toBe(9);
    expect(s.total).toBe(DAILY_MAX);
    expect(s).toMatchObject({ exactNumbers: 4, halfTimePoints: 2, fullTimePoints: 2, outcomePoints: 1 });
  });

  it("gives 1 point for a single correct half-goal number", () => {
    // only 1e-helft thuis (1) klopt; rest fout, geen toto.
    const s = scoreDailyPrediction(pred(1, 3, 4, 4), actual);
    expect(s).toMatchObject({ exactNumbers: 1, halfTimePoints: 0, fullTimePoints: 0, outcomePoints: 0 });
    expect(s.total).toBe(1);
  });

  it("rewards ruststand exact + correct toto even when the eindstand is wrong", () => {
    // Real: rust 1-1, eind 2-1 -> 1e helft (1,1), 2e helft (1,0).
    const a: DailyActual = { halfTimeHome: 1, halfTimeAway: 1, fullTimeHome: 2, fullTimeAway: 1 };
    const s = scoreDailyPrediction(pred(1, 1, 3, 0), a); // rust exact, 2e helft (3,0) -> eind 4-1 (fout), toto H goed
    expect(s).toMatchObject({ exactNumbers: 3, halfTimePoints: 2, fullTimePoints: 0, outcomePoints: 1 });
    expect(s.total).toBe(6);
  });

  it("rewards eindstand exact + toto when the half split is wrong (no ruststand)", () => {
    // Real: rust 0-1, eind 2-1 -> 2e helft (2,0).
    const a: DailyActual = { halfTimeHome: 0, halfTimeAway: 1, fullTimeHome: 2, fullTimeAway: 1 };
    const s = scoreDailyPrediction(pred(1, 0, 1, 1), a); // rust fout, eind 2-1 goed, toto H goed, geen exact getal
    expect(s).toMatchObject({ exactNumbers: 0, halfTimePoints: 0, fullTimePoints: 2, outcomePoints: 1 });
    expect(s.total).toBe(3);
  });

  it("gives only the toto point when nothing else matches", () => {
    // Real: rust 0-0, eind 1-0 -> 2e helft (1,0).
    const a: DailyActual = { halfTimeHome: 0, halfTimeAway: 0, fullTimeHome: 1, fullTimeAway: 0 };
    const s = scoreDailyPrediction(pred(3, 2, 2, 1), a); // eind 5-3 -> toto H goed, rest fout
    expect(s).toMatchObject({ exactNumbers: 0, halfTimePoints: 0, fullTimePoints: 0, outcomePoints: 1 });
    expect(s.total).toBe(1);
  });
});

describe("determineDagwinnaars", () => {
  const actual: DailyActual = { halfTimeHome: 1, halfTimeAway: 0, fullTimeHome: 2, fullTimeAway: 1 };

  it("picks the single highest scorer", () => {
    const res = determineDagwinnaars(
      [
        { participantId: "p1", pred: pred(1, 0, 1, 1) }, // 9
        { participantId: "p2", pred: pred(1, 3, 4, 4) }, // 1
      ],
      actual,
    );
    expect(res).toEqual({ winnerIds: ["p1"], score: 9 });
  });

  it("shares the pot on a tie (sorted ids)", () => {
    const res = determineDagwinnaars(
      [
        { participantId: "zoe", pred: pred(1, 0, 1, 1) }, // 9
        { participantId: "ann", pred: pred(1, 0, 1, 1) }, // 9
      ],
      actual,
    );
    expect(res).toEqual({ winnerIds: ["ann", "zoe"], score: 9 });
  });

  it("returns no winners for no entries", () => {
    expect(determineDagwinnaars([], actual)).toEqual({ winnerIds: [], score: 0 });
  });
});

describe("drawLuckyLoser (provably-fair, deterministic)", () => {
  const base = { eveningId: "ev1", resultKey: "73=2-1", checkedInIds: ["a", "b", "c", "d", "e"], dagwinnaarIds: ["a"] };

  it("is reproducible: identical inputs give the identical winner", () => {
    expect(drawLuckyLoser(base)).toBe(drawLuckyLoser(base));
  });

  it("never picks a dagwinnaar and always picks from the remaining pool", () => {
    const picked = drawLuckyLoser(base);
    expect(picked).not.toBeNull();
    expect(["b", "c", "d", "e"]).toContain(picked);
    expect(picked).not.toBe("a");
  });

  it("returns null when the pool is empty (everyone present is a dagwinnaar)", () => {
    expect(drawLuckyLoser({ ...base, checkedInIds: ["a", "b"], dagwinnaarIds: ["a", "b"] })).toBeNull();
  });

  it("depends on the seed: a different result key still yields a valid, stable pick", () => {
    const other = { ...base, resultKey: "73=0-0" };
    const p1 = drawLuckyLoser(other);
    expect(["b", "c", "d", "e"]).toContain(p1);
    expect(drawLuckyLoser(other)).toBe(p1); // still deterministic
  });
});

describe("computeEveningWinners", () => {
  // Real: rust 1-0, eind 2-1.
  const actual: DailyActual = { halfTimeHome: 1, halfTimeAway: 0, fullTimeHome: 2, fullTimeAway: 1 };
  const perfect = pred(1, 0, 1, 1); // scores 9

  it("computes dagwinnaars per match and a Lucky Loser excluding them", () => {
    const res = computeEveningWinners({
      eveningId: "ev1",
      resultKey: "73=2-1",
      checkedInIds: ["a", "b", "c", "d"],
      matches: [
        { eveningMatchId: "em1", actual, entries: [{ participantId: "a", pred: perfect }, { participantId: "b", pred: pred(0, 0, 0, 0) }] },
      ],
    });
    expect(res.perMatch[0]).toMatchObject({ eveningMatchId: "em1", winnerIds: ["a"], scoreable: true });
    expect(res.luckyLoserId).not.toBeNull();
    expect(res.luckyLoserId).not.toBe("a"); // dagwinnaar excluded
    expect(["b", "c", "d"]).toContain(res.luckyLoserId);
  });

  it("shares the pot on a tie", () => {
    const res = computeEveningWinners({
      eveningId: "ev1",
      resultKey: "73=2-1",
      checkedInIds: ["a", "b"],
      matches: [{ eveningMatchId: "em1", actual, entries: [{ participantId: "a", pred: perfect }, { participantId: "b", pred: perfect }] }],
    });
    expect(res.perMatch[0].winnerIds).toEqual(["a", "b"]);
  });

  it("yields no dagwinnaars for a non-scoreable match (actual null)", () => {
    const res = computeEveningWinners({
      eveningId: "ev1",
      resultKey: "73=na",
      checkedInIds: ["a", "b"],
      matches: [{ eveningMatchId: "em1", actual: null, entries: [{ participantId: "a", pred: perfect }] }],
    });
    expect(res.perMatch[0]).toMatchObject({ winnerIds: [], scoreable: false });
  });
});

describe("winnersDiverged", () => {
  const live: EveningWinners = {
    perMatch: [{ eveningMatchId: "em1", winnerIds: ["a"], score: 9, scoreable: true }],
    luckyLoserId: "b",
  };

  it("is false when stored equals the current computation", () => {
    expect(winnersDiverged({ perMatch: [{ eveningMatchId: "em1", winnerIds: ["a"] }], luckyLoserId: "b" }, live)).toBe(false);
  });

  it("is false regardless of winner-id order within a dagspel", () => {
    const live2: EveningWinners = { perMatch: [{ eveningMatchId: "em1", winnerIds: ["a", "c"], score: 9, scoreable: true }], luckyLoserId: "b" };
    expect(winnersDiverged({ perMatch: [{ eveningMatchId: "em1", winnerIds: ["c", "a"] }], luckyLoserId: "b" }, live2)).toBe(false);
  });

  it("is true when a dagwinnaar differs (result edited after freezing)", () => {
    expect(winnersDiverged({ perMatch: [{ eveningMatchId: "em1", winnerIds: ["x"] }], luckyLoserId: "b" }, live)).toBe(true);
  });

  it("is true when the Lucky Loser differs", () => {
    expect(winnersDiverged({ perMatch: [{ eveningMatchId: "em1", winnerIds: ["a"] }], luckyLoserId: "z" }, live)).toBe(true);
  });
});

describe("assignHoofdprijzen (doorschuiven)", () => {
  const ranked = [
    { participantId: "p1", nickname: "Een" },
    { participantId: "p2", nickname: "Twee" },
    { participantId: "p3", nickname: "Drie" },
    { participantId: "p4", nickname: "Vier" },
    { participantId: "p5", nickname: "Vijf" },
  ];

  it("gives the three prizes to the top three when all meet the requirement", () => {
    const out = assignHoofdprijzen(ranked, { p1: 5, p2: 4, p3: 3, p4: 3, p5: 3 }, 3);
    expect(out.map((w) => w.nickname)).toEqual(["Een", "Twee", "Drie"]);
    expect(out.map((w) => w.rank)).toEqual([1, 2, 3]);
  });

  it("skips a top-ranked participant below the requirement (prize shifts down)", () => {
    // p2 only attended 1 evening -> skipped; p4 takes the third prize.
    const out = assignHoofdprijzen(ranked, { p1: 5, p2: 1, p3: 3, p4: 4, p5: 0 }, 3);
    expect(out.map((w) => w.nickname)).toEqual(["Een", "Drie", "Vier"]);
  });

  it("returns fewer than three when not enough participants qualify", () => {
    const out = assignHoofdprijzen(ranked, { p1: 5 }, 3);
    expect(out.map((w) => w.nickname)).toEqual(["Een"]);
  });
});
