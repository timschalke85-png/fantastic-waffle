import { describe, it, expect } from "vitest";
import {
  isValidPin,
  isValidNickname,
  nicknameKey,
  parseGoals,
  parseScoreline,
  validateRanking,
  isEligibleMatch,
} from "../src/lib/predictions-validate";

describe("isValidPin", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("1234")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
    expect(isValidPin(" 1234")).toBe(false);
  });
});

describe("nickname", () => {
  it("requires 2–24 trimmed chars", () => {
    expect(isValidNickname("Jo")).toBe(true);
    expect(isValidNickname("J")).toBe(false);
    expect(isValidNickname("  ")).toBe(false);
    expect(isValidNickname("x".repeat(24))).toBe(true);
    expect(isValidNickname("x".repeat(25))).toBe(false);
  });
  it("keys case-insensitively and trimmed", () => {
    expect(nicknameKey("  Oranje123 ")).toBe("oranje123");
    expect(nicknameKey("ORANJE")).toBe(nicknameKey("oranje"));
  });
});

describe("parseGoals", () => {
  it("classifies empty / value / invalid", () => {
    expect(parseGoals("")).toEqual({ kind: "empty" });
    expect(parseGoals("  ")).toEqual({ kind: "empty" });
    expect(parseGoals("0")).toEqual({ kind: "value", value: 0 });
    expect(parseGoals("3")).toEqual({ kind: "value", value: 3 });
    expect(parseGoals("-1")).toEqual({ kind: "invalid" });
    expect(parseGoals("1.5")).toEqual({ kind: "invalid" });
    expect(parseGoals("x")).toEqual({ kind: "invalid" });
  });
});

describe("parseScoreline", () => {
  it("needs both sides or neither", () => {
    expect(parseScoreline("", "")).toEqual({ kind: "empty" });
    expect(parseScoreline("2", "")).toEqual({ kind: "partial" });
    expect(parseScoreline("", "1")).toEqual({ kind: "partial" });
    expect(parseScoreline("2", "1")).toEqual({ kind: "value", home: 2, away: 1 });
    expect(parseScoreline("2", "-1")).toEqual({ kind: "invalid" });
  });
});

describe("validateRanking", () => {
  const pool = ["t1", "t2", "t3", "t4"];
  it("accepts a full distinct 1–4 ranking", () => {
    const entries = [
      { position: 1, teamId: "t1" },
      { position: 2, teamId: "t2" },
      { position: 3, teamId: "t3" },
      { position: 4, teamId: "t4" },
    ];
    expect(validateRanking(entries, [1, 2, 3, 4], pool).ok).toBe(true);
  });
  it("accepts a partial ranking (some positions empty)", () => {
    expect(validateRanking([{ position: 1, teamId: "t1" }], [1, 2, 3, 4], pool).ok).toBe(true);
  });
  it("rejects a team used twice", () => {
    const entries = [
      { position: 1, teamId: "t1" },
      { position: 2, teamId: "t1" },
    ];
    expect(validateRanking(entries, [1, 2, 3, 4], pool).ok).toBe(false);
  });
  it("rejects an out-of-pool team", () => {
    expect(validateRanking([{ position: 1, teamId: "xx" }], [1, 2, 3, 4], pool).ok).toBe(false);
  });
  it("rejects a disallowed position (e.g. position 3 for a 1–2 group)", () => {
    expect(validateRanking([{ position: 3, teamId: "t3" }], [1, 2], pool).ok).toBe(false);
  });
});

describe("isEligibleMatch", () => {
  const lock = new Date("2026-06-14T20:00:00Z");
  it("includes a match at exactly the lock (NL–Japan)", () => {
    expect(isEligibleMatch(new Date("2026-06-14T20:00:00Z"), lock)).toBe(true);
  });
  it("includes matches after the lock", () => {
    expect(isEligibleMatch(new Date("2026-06-20T16:00:00Z"), lock)).toBe(true);
  });
  it("excludes matches before the lock", () => {
    expect(isEligibleMatch(new Date("2026-06-11T16:00:00Z"), lock)).toBe(false);
  });
});
