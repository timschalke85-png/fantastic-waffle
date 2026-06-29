import { describe, it, expect } from "vitest";
import { amsterdamLocalToUtcIso, utcIsoToAmsterdamLocal } from "@/lib/datetime";

describe("amsterdamLocalToUtcIso", () => {
  it("converts a summer (CEST, +2) wall-clock to UTC", () => {
    // During the World Cup Amsterdam is CEST (+2): 20:00 local -> 18:00 UTC.
    expect(amsterdamLocalToUtcIso("2026-07-15T20:00")).toBe("2026-07-15T18:00:00.000Z");
  });

  it("converts a winter (CET, +1) wall-clock to UTC", () => {
    expect(amsterdamLocalToUtcIso("2026-01-15T20:00")).toBe("2026-01-15T19:00:00.000Z");
  });

  it("accepts an optional seconds component", () => {
    expect(amsterdamLocalToUtcIso("2026-07-15T20:00:30")).toBe("2026-07-15T18:00:30.000Z");
  });

  it("returns null on a malformed value", () => {
    expect(amsterdamLocalToUtcIso("20-07-2026 21:00")).toBeNull();
    expect(amsterdamLocalToUtcIso("")).toBeNull();
    expect(amsterdamLocalToUtcIso("2026-07-15")).toBeNull();
  });

  it("round-trips through utcIsoToAmsterdamLocal", () => {
    const local = "2026-06-28T21:00";
    const iso = amsterdamLocalToUtcIso(local)!;
    expect(utcIsoToAmsterdamLocal(iso)).toBe(local);
  });
});

describe("utcIsoToAmsterdamLocal", () => {
  it("renders a UTC instant as Amsterdam wall-clock", () => {
    // 18:00 UTC in July -> 20:00 CEST.
    expect(utcIsoToAmsterdamLocal("2026-07-15T18:00:00.000Z")).toBe("2026-07-15T20:00");
  });

  it("returns empty string on a bad input", () => {
    expect(utcIsoToAmsterdamLocal("not-a-date")).toBe("");
  });
});
