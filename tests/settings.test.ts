// The eligibility floor drives the whole pool's scoring scope, so its getter
// must HARD-FAIL on a missing/invalid value (no silent fallback). The DB is mocked.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({ prisma: { setting: { findUnique: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma }));

import { getGroupEligibilityFloorUtc } from "../src/lib/settings";

beforeEach(() => vi.clearAllMocks());

describe("getGroupEligibilityFloorUtc", () => {
  it("returns the parsed date when the setting is present", async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: "group_eligibility_floor_utc", value: "2026-06-14T20:00:00Z" });
    const d = await getGroupEligibilityFloorUtc();
    expect(d.toISOString()).toBe("2026-06-14T20:00:00.000Z");
  });

  it("throws hard when the setting is missing (no silent fallback)", async () => {
    prisma.setting.findUnique.mockResolvedValue(null);
    await expect(getGroupEligibilityFloorUtc()).rejects.toThrow(/niet gezet/);
  });

  it("throws hard when the setting is not a valid date", async () => {
    prisma.setting.findUnique.mockResolvedValue({ key: "group_eligibility_floor_utc", value: "nonsense" });
    await expect(getGroupEligibilityFloorUtc()).rejects.toThrow(/ongeldig/);
  });
});
