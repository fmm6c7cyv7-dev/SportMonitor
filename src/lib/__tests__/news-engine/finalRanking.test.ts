// src/lib/__tests__/news-engine/finalRanking.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import type { RankedArticle } from "@/lib/news-engine/types";
import { finalizeRanking } from "@/lib/news-engine/finalRanking";

function makeRankedArticle(
  id: string,
  sport: "football" | "hockey",
  score: number,
  source = "BBC Sport",
): RankedArticle {
  return {
    id,
    sport,
    title: `Title ${id}`,
    url: `https://example.com/${id}`,
    source,
    publishedAt: new Date().toISOString(),
    summary: null,
    tags: [],
    priority: 0,
    urgency: 0,
    canonicalUrl: null,
    entityHits: [],
    score,
    scoreComponents: {
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
    },
    favoriteSignal: undefined,
    localSignal: undefined,
    bigNewsSignal: undefined,
  };
}

describe("finalizeRanking", () => {
  it("filters by sport and sorts by score", () => {
    const items = [
      makeRankedArticle("f1", "football", 20),
      makeRankedArticle("h1", "hockey", 30),
      makeRankedArticle("f2", "football", 25),
    ];

    const result = finalizeRanking(items, {
      sport: "football",
    });

    expect(result.map((item) => item.id)).toEqual(["f2", "f1"]);
  });

  it("allows hard news to pass lower sport floor", () => {
    const items = [
      makeRankedArticle("h1", "hockey", -2),
      makeRankedArticle("h2", "hockey", -4),
    ];

    const result = finalizeRanking(items, {
      sport: "hockey",
      hardNewsArticleIds: ["h1"],
    });

    expect(result.map((item) => item.id)).toEqual(["h1"]);
  });

  it("respects limit", () => {
    const items = [
      makeRankedArticle("f1", "football", 30),
      makeRankedArticle("f2", "football", 25),
      makeRankedArticle("f3", "football", 20),
    ];

    const result = finalizeRanking(items, {
      sport: "football",
      limit: 2,
    });

    expect(result).toHaveLength(2);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      finalizeRanking(null as never, {
        sport: "football",
      }),
    ).toThrow(EngineError);
  });
});