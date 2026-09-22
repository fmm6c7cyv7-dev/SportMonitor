// src/lib/__tests__/data/swedishStaffAbroad.test.ts

import { describe, expect, it } from "vitest";
import {
  swedishFootballStaffAbroad,
  swedishHockeyStaffAbroad,
  swedishStaffAbroad,
} from "@/data/swedishStaffAbroad";

describe("swedishStaffAbroad catalog", () => {
  it("contains the verified initial football and hockey scope", () => {
    expect(swedishFootballStaffAbroad).toHaveLength(13);
    expect(swedishHockeyStaffAbroad).toHaveLength(6);
    expect(swedishStaffAbroad).toHaveLength(19);
  });

  it("uses unique stable ids", () => {
    const ids = swedishStaffAbroad.map((staff) => staff.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every entry active, Swedish, senior and verification-dated", () => {
    for (const staff of swedishStaffAbroad) {
      expect(staff.active).toBe(true);
      expect(staff.nationality).toBe("Sweden");
      expect(staff.scope).toBe("men-senior");
      expect(staff.verifiedAt).toBe("2026-09-20");
    }
  });

  it("requires a concrete organization and HTTPS verification source", () => {
    for (const staff of swedishStaffAbroad) {
      expect(staff.organization.trim().length).toBeGreaterThan(0);
      expect(staff.sourceUrl.startsWith("https://")).toBe(true);
    }
  });

  it("avoids deliberately broad two-letter aliases", () => {
    for (const staff of swedishStaffAbroad) {
      const aliases = [
        ...staff.aliases,
        ...staff.organizationAliases,
        ...staff.competitionAliases,
      ];

      expect(aliases.some((alias) => alias.trim().length <= 2)).toBe(false);
    }
  });
});
