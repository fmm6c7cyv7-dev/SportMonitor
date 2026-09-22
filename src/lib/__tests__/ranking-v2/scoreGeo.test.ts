// src/lib/__tests__/ranking-v2/scoreGeo.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import { scoreGeoAffinity } from "@/lib/ranking-v2/scoreGeo";

describe("scoreGeoAffinity", () => {
  it("returns 0 when geo context is missing", () => {
    const result = scoreGeoAffinity(
      {
        title: "Lokalt derby ikväll",
        sport: "football",
        source: "VLT",
        tags: [],
      },
      {
        geo: null,
      },
    );

    expect(result).toBe(0);
  });

  it("scores explicit local signal", () => {
    const result = scoreGeoAffinity(
      {
        title: "Lokalt derby ikväll",
        sport: "football",
        source: "VLT",
        tags: [],
        localSignal: {
          score: 9,
          matched: true,
          reason: "same-region",
        },
      },
      {
        geo: {
          lat: 59.6,
          lng: 16.55,
          source: "browser",
        },
      },
    );

    expect(result).toBeGreaterThanOrEqual(9);
  });

  it("scores local wording and regional source names", () => {
    const result = scoreGeoAffinity(
      {
        title: "Lokalt drama nära dig",
        sport: "hockey",
        source: "VLT",
        tags: ["JUST_NU"],
      },
      {
        geo: {
          lat: 59.6,
          lng: 16.55,
          source: "browser",
        },
      },
    );

    expect(result).toBeGreaterThanOrEqual(10);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      scoreGeoAffinity(
        {
          title: "Rubrik",
          sport: "football",
          source: "VLT",
          tags: [],
        },
        {
          geo: {
            lat: Number.NaN,
            lng: 16.55,
            source: "browser",
          },
        },
      ),
    ).toThrow(EngineError);
  });
});