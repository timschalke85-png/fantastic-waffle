import { describe, it, expect } from "vitest";
import { NAME_NL } from "../prisma/data/name-nl";

describe("NAME_NL Dutch team-name mapping", () => {
  it("covers exactly the 48 qualified FIFA codes", () => {
    expect(Object.keys(NAME_NL)).toHaveLength(48);
  });

  it("has a non-empty Dutch name for every code", () => {
    for (const [code, nl] of Object.entries(NAME_NL)) {
      expect(code).toMatch(/^[A-Z]{3}$/);
      expect(nl.trim().length).toBeGreaterThan(0);
    }
  });

  it("translates Group F as specified in the acceptance criteria", () => {
    expect(NAME_NL.NED).toBe("Nederland");
    expect(NAME_NL.JPN).toBe("Japan");
    expect(NAME_NL.SWE).toBe("Zweden");
    expect(NAME_NL.TUN).toBe("Tunesië");
  });

  it("uses Dutch spellings for a spread of countries", () => {
    expect(NAME_NL.GER).toBe("Duitsland");
    expect(NAME_NL.ESP).toBe("Spanje");
    expect(NAME_NL.RSA).toBe("Zuid-Afrika");
    expect(NAME_NL.CIV).toBe("Ivoorkust");
    expect(NAME_NL.COD).toBe("DR Congo");
  });
});
