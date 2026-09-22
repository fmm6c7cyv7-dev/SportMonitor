// src/lib/__tests__/news-engine/types.test.ts

import { describe, expect, it } from "vitest";
import { createEmptyScoreComponents } from "@/lib/news-engine/types";

describe("createEmptyScoreComponents", () => {
  it("returns a fully zeroed score component map", () => {
    expect(createEmptyScoreComponents()).toEqual({
      recency: 0,
      urgency: 0,
      swedishPlayer: 0,
      swedishAbroadCore: 0,
      swedishLeague: 0,
      favoriteAffinity: 0,
      localGeo: 0,
      sourceAuthority: 0,
      sourceLeagueFit: 0,
      sourceCountryFit: 0,
      bigNews: 0,
      eventIntensity: 0,
      priority: 0,
      evergreenPenalty: 0,
      stalenessPenalty: 0,
      duplicatePenalty: 0,
    });
  });

  it("returns a new object each time", () => {
    const a = createEmptyScoreComponents();
    const b = createEmptyScoreComponents();

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});