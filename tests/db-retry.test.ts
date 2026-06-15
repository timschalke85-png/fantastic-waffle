import { describe, it, expect, vi } from "vitest";
import { withDbRetry, isTransientConnectionError } from "../src/lib/db-retry";

describe("isTransientConnectionError", () => {
  it("matches the PG 57P01 code and Prisma P1001/P1017 codes", () => {
    expect(isTransientConnectionError({ code: "57P01" })).toBe(true);
    expect(isTransientConnectionError({ code: "P1001" })).toBe(true);
    expect(isTransientConnectionError({ code: "P1017" })).toBe(true);
  });
  it("matches the 57P01 marker in the message", () => {
    expect(isTransientConnectionError(new Error("db error: SqlState(E57P01)"))).toBe(true);
    expect(isTransientConnectionError(new Error("terminating connection due to administrator command"))).toBe(true);
  });
  it("does not match an unrelated error", () => {
    expect(isTransientConnectionError({ code: "P2002" })).toBe(false);
    expect(isTransientConnectionError(new Error("Unique constraint failed"))).toBe(false);
    expect(isTransientConnectionError(null)).toBe(false);
  });
});

describe("withDbRetry", () => {
  it("returns the value without retrying on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await withDbRetry(fn, 0)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries once on a transient error (by code) and then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce({ code: "57P01" }).mockResolvedValue("ok");
    expect(await withDbRetry(fn, 0)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries once on a transient error (by message) and then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("...SqlState(E57P01)...")).mockResolvedValue("ok");
    expect(await withDbRetry(fn, 0)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a non-transient error (throws immediately)", async () => {
    const fn = vi.fn().mockRejectedValue({ code: "P2002" });
    await expect(withDbRetry(fn, 0)).rejects.toMatchObject({ code: "P2002" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propagates the error if both attempts fail transiently", async () => {
    const fn = vi.fn().mockRejectedValue({ code: "57P01" });
    await expect(withDbRetry(fn, 0)).rejects.toMatchObject({ code: "57P01" });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
