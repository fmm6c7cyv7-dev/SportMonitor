// src/lib/__tests__/app/api/favoritesRoute.test.ts

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => {
  return {
    supabaseService: vi.fn(),
  };
});

import {
  getDeviceIdFromRequest,
  isFavoriteLookupSport,
  isFavoriteLookupType,
  pickBestEntityLookupMatch,
  shouldClearAllFavorites,
} from "@/app/api/favorites/route";

describe("favorites route helpers", () => {
  it("accepts valid favorite lookup types", () => {
    expect(isFavoriteLookupType("team")).toBe(true);
    expect(isFavoriteLookupType("league")).toBe(true);
    expect(isFavoriteLookupType("player")).toBe(true);
    expect(isFavoriteLookupType("all")).toBe(false);
  });

  it("accepts valid favorite lookup sports", () => {
    expect(isFavoriteLookupSport("football")).toBe(true);
    expect(isFavoriteLookupSport("hockey")).toBe(true);
    expect(isFavoriteLookupSport("basket")).toBe(false);
  });

  it("prefers exact normalized entity name match", () => {
    const picked = pickBestEntityLookupMatch(
      [
        {
          id: "1",
          name: "Allsvenska",
          type: "league",
          sport: "football",
        },
        {
          id: "2",
          name: "Allsvenskan",
          type: "league",
          sport: "football",
        },
      ],
      "Allsvenskan",
    );

    expect(picked?.id).toBe("2");
  });

  it("falls back to first row when no exact normalized match exists", () => {
    const picked = pickBestEntityLookupMatch(
      [
        {
          id: "10",
          name: "Svenska Fotbollförbundet",
          type: "team",
          sport: "football",
        },
      ],
      "Allsvenskan",
    );

    expect(picked?.id).toBe("10");
  });

  it("reads device_id from request query", () => {
    const request = new Request(
      "http://localhost/api/favorites?device_id=sm_device_1",
    );

    expect(getDeviceIdFromRequest(request)).toBe("sm_device_1");
  });

  it("detects clear-all query flag", () => {
    const request = new Request(
      "http://localhost/api/favorites?device_id=sm_device_1&all=1",
    );

    expect(shouldClearAllFavorites(request)).toBe(true);
  });
});
