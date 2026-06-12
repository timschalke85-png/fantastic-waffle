import { describe, it, expect } from "vitest";
import { amsDateKey, isAmsToday, compareTodayMatches } from "../src/lib/today";

describe("amsDateKey (DST-safe Amsterdam calendar date)", () => {
  it("summer (CEST, UTC+2): late-evening UTC rolls into the next Amsterdam day", () => {
    expect(amsDateKey(new Date("2026-06-14T20:00:00Z"))).toBe("2026-06-14"); // 22:00 Ams
    expect(amsDateKey(new Date("2026-06-14T22:30:00Z"))).toBe("2026-06-15"); // 00:30 Ams next day
  });
  it("winter (CET, UTC+1): offset is one hour, still correct", () => {
    expect(amsDateKey(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02"); // 00:30 Ams
    expect(amsDateKey(new Date("2026-01-01T22:30:00Z"))).toBe("2026-01-01"); // 23:30 Ams
  });
});

describe("isAmsToday", () => {
  const now = new Date("2026-06-14T12:00:00Z"); // 14:00 Ams on 14 June
  it("is true for a kickoff on the same Amsterdam day", () => {
    expect(isAmsToday(new Date("2026-06-14T20:00:00Z"), now)).toBe(true); // 22:00 Ams, same day
  });
  it("is false for a kickoff the next Amsterdam day", () => {
    expect(isAmsToday(new Date("2026-06-14T23:30:00Z"), now)).toBe(false); // 01:30 Ams, 15 June
  });
});

describe("compareTodayMatches", () => {
  const m = (status: string, iso: string) => ({ status, kickoffUtc: new Date(iso) });
  it("orders LIVE, then SCHEDULED, then FINISHED", () => {
    const rows = [
      m("FINISHED", "2026-06-14T13:00:00Z"),
      m("SCHEDULED", "2026-06-14T19:00:00Z"),
      m("LIVE", "2026-06-14T18:00:00Z"),
    ];
    expect(rows.slice().sort(compareTodayMatches).map((r) => r.status)).toEqual(["LIVE", "SCHEDULED", "FINISHED"]);
  });
  it("within the same status, earlier kickoff first", () => {
    const rows = [m("SCHEDULED", "2026-06-14T21:00:00Z"), m("SCHEDULED", "2026-06-14T18:00:00Z")];
    expect(rows.slice().sort(compareTodayMatches).map((r) => r.kickoffUtc.toISOString())).toEqual([
      "2026-06-14T18:00:00.000Z",
      "2026-06-14T21:00:00.000Z",
    ]);
  });
});
