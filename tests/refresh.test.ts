import { describe, it, expect } from "vitest";
import { isInLiveWindow, STALE_LIVE_MS, STALE_IDLE_MS } from "../src/lib/refresh";

const now = Date.UTC(2026, 5, 14, 20, 30, 0); // 2026-06-14T20:30:00Z
const at = (iso: string, status = "SCHEDULED") => ({ status, kickoffUtc: new Date(iso) });

describe("isInLiveWindow (drives 60s vs 15min refresh cadence)", () => {
  it("thresholds are 60s live / 15min idle", () => {
    expect(STALE_LIVE_MS).toBe(60_000);
    expect(STALE_IDLE_MS).toBe(15 * 60_000);
  });

  it("is false when all matches are far from kickoff and none live", () => {
    expect(isInLiveWindow([at("2026-06-14T17:00:00Z"), at("2026-06-20T17:00:00Z")], now)).toBe(false);
  });

  it("is true when a match kicked off recently (within the window)", () => {
    // kickoff 20:00Z, now 20:30Z -> inside [kickoff-10m, kickoff+150m]
    expect(isInLiveWindow([at("2026-06-14T20:00:00Z")], now)).toBe(true);
  });

  it("is true just before kickoff (10min pre-window)", () => {
    expect(isInLiveWindow([at("2026-06-14T20:35:00Z")], now)).toBe(true); // 5min before -> inside
    expect(isInLiveWindow([at("2026-06-14T20:45:00Z")], now)).toBe(false); // 15min before -> outside
  });

  it("is true whenever any match status is LIVE, regardless of clock", () => {
    expect(isInLiveWindow([at("2020-01-01T00:00:00Z", "LIVE")], now)).toBe(true);
  });

  it("is false after the window closes (>150min past kickoff)", () => {
    expect(isInLiveWindow([at("2026-06-14T17:00:00Z")], now)).toBe(false); // 3.5h before now
  });
});
