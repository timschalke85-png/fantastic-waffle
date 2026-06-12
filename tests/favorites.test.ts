import { describe, it, expect } from "vitest";
import { rankFavorites } from "../src/lib/favorites";

const picks = (...ids: string[]) => ids.map((teamId) => ({ teamId }));

describe("rankFavorites", () => {
  it("returns [] for no picks (empty state)", () => {
    expect(rankFavorites([])).toEqual([]);
  });

  it("counts nr.1 picks per team and ranks by count, with percentages of the total", () => {
    // 10 picks: NL x6, JP x3, SE x1.
    const result = rankFavorites(picks("nl", "nl", "nl", "nl", "nl", "nl", "jp", "jp", "jp", "se"));
    expect(result).toEqual([
      { teamId: "nl", count: 6, pct: 60 },
      { teamId: "jp", count: 3, pct: 30 },
      { teamId: "se", count: 1, pct: 10 },
    ]);
  });

  it("caps at the top 3", () => {
    const result = rankFavorites(picks("a", "a", "b", "b", "c", "d", "e"));
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.teamId)).toEqual(["a", "b", "c"]); // a=2,b=2,c=1 (c<->d<->e tie broken by id)
  });

  it("breaks ties deterministically by teamId", () => {
    const result = rankFavorites(picks("zz", "aa")); // both count 1
    expect(result.map((r) => r.teamId)).toEqual(["aa", "zz"]);
  });
});
