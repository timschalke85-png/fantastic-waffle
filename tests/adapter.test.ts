import { describe, it, expect, vi, afterEach } from "vitest";
import { FootballDataOrgAdapter } from "../src/lib/adapters/football-data";

// Minimal synthetic football-data.org payload covering the mapping edge cases.
const RAW = {
  matches: [
    {
      id: 100,
      utcDate: "2026-06-14T20:00:00Z",
      status: "TIMED",
      stage: "GROUP_STAGE",
      group: "GROUP_F",
      homeTeam: { id: 8601, name: "Netherlands", shortName: "Netherlands", tla: "NED", crest: "https://crests/8601.svg" },
      awayTeam: { id: 766, name: "Japan", shortName: "Japan", tla: "JPN", crest: "https://crests/766.svg" },
      score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
    },
    {
      id: 101,
      utcDate: "2026-06-12T16:00:00Z",
      status: "IN_PLAY",
      stage: "GROUP_STAGE",
      group: "GROUP_A",
      homeTeam: { id: 1, name: "Alpha", shortName: "Alpha", tla: "ALP", crest: null },
      awayTeam: { id: 2, name: "Beta", shortName: "Beta", tla: "BET", crest: null },
      score: { winner: "HOME_TEAM", duration: "REGULAR", fullTime: { home: 2, away: 1 } },
    },
    {
      id: 102,
      utcDate: "2026-06-30T19:00:00Z",
      status: "FINISHED",
      stage: "LAST_32",
      group: null,
      homeTeam: { id: 1, name: "Alpha", shortName: "Alpha", tla: "ALP", crest: null },
      awayTeam: { id: 2, name: "Beta", shortName: "Beta", tla: "BET", crest: null },
      score: { winner: "AWAY_TEAM", duration: "PENALTY_SHOOTOUT", fullTime: { home: 1, away: 1 } },
    },
    {
      id: 103,
      utcDate: "2026-07-01T19:00:00Z",
      status: "FINISHED",
      stage: "QUARTER_FINALS",
      group: null,
      homeTeam: { id: 1, name: "Alpha", shortName: "Alpha", tla: "ALP", crest: null },
      awayTeam: { id: 2, name: "Beta", shortName: "Beta", tla: "BET", crest: null },
      score: { winner: "HOME_TEAM", duration: "EXTRA_TIME", fullTime: { home: 3, away: 2 } },
    },
    {
      id: 104,
      utcDate: "2026-06-28T19:00:00Z",
      status: "TIMED",
      stage: "LAST_32",
      group: null,
      homeTeam: { id: null, name: null, shortName: null, tla: null, crest: null },
      awayTeam: { id: null, name: null, shortName: null, tla: null, crest: null },
      score: { winner: null, duration: "REGULAR", fullTime: { home: null, away: null } },
    },
  ],
};

function stubFetchOk(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => body, text: async () => "" })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("FootballDataOrgAdapter normalization", () => {
  it("maps stages, statuses, ET/penalties and extracts teams from group matches", async () => {
    stubFetchOk(RAW);
    const snap = await new FootballDataOrgAdapter("test-key").getCompetitionSnapshot();

    // teams: only the 4 distinct group-stage teams (knockout nulls ignored)
    expect(snap.teams.map((t) => t.fifaCode).sort()).toEqual(["ALP", "BET", "JPN", "NED"]);

    const byId = new Map(snap.matches.map((m) => [m.apiMatchId, m]));
    // status mapping
    expect(byId.get(100)!.status).toBe("SCHEDULED"); // TIMED
    expect(byId.get(101)!.status).toBe("LIVE"); // IN_PLAY
    expect(byId.get(102)!.status).toBe("FINISHED");
    // stage mapping
    expect(byId.get(102)!.stage).toBe("R32");
    expect(byId.get(103)!.stage).toBe("QF");
    // group letter
    expect(byId.get(100)!.groupLetter).toBe("F");
    expect(byId.get(102)!.groupLetter).toBeNull();
    // penalties: shoot-out winner captured, scoreline is end-of-play (1-1)
    expect(byId.get(102)!.wentToExtraTime).toBe(true);
    expect(byId.get(102)!.penaltyWinnerApiTeamId).toBe(2);
    expect(byId.get(102)!.homeScore).toBe(1);
    // extra time without penalties: no penalty winner
    expect(byId.get(103)!.wentToExtraTime).toBe(true);
    expect(byId.get(103)!.penaltyWinnerApiTeamId).toBeNull();
    // unresolved knockout placeholder -> null teams
    expect(byId.get(104)!.homeApiTeamId).toBeNull();
    expect(byId.get(104)!.awayApiTeamId).toBeNull();
    // venue is null (provider gives no real stadium)
    expect(byId.get(100)!.venue).toBeNull();
  });

  it("sorts matches ascending by kickoff", async () => {
    stubFetchOk(RAW);
    const snap = await new FootballDataOrgAdapter("test-key").getCompetitionSnapshot();
    const times = snap.matches.map((m) => m.kickoffUtc);
    expect(times).toEqual([...times].sort());
    expect(times[0]).toBe("2026-06-12T16:00:00Z");
  });

  it("throws on a non-OK HTTP response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}), text: async () => "forbidden" })),
    );
    await expect(new FootballDataOrgAdapter("test-key").getCompetitionSnapshot()).rejects.toThrow(/403/);
  });
});
