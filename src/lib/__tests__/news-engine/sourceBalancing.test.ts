// src/lib/__tests__/news-engine/sourceBalancing.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import type { RankedArticle } from "@/lib/news-engine/types";
import { balanceSources } from "@/lib/news-engine/sourceBalancing";

function makeRankedArticle(
  id: string,
  source: string,
  score: number,
): RankedArticle {
  return {
    id,
    sport: "football",
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

describe("balanceSources", () => {
  it("spreads identical sources when score drop is acceptable", () => {
    const items = [
      makeRankedArticle("a1", "Source A", 100),
      makeRankedArticle("a2", "Source A", 98),
      makeRankedArticle("b1", "Source B", 95),
      makeRankedArticle("c1", "Source C", 93),
    ];

    const result = balanceSources(items, {
      protectTop: 1,
      minGap: 1,
      lookahead: 4,
      maxScoreDropForReorder: 5,
    });

    expect(result[0].id).toBe("a1");
    expect(result[1].source).not.toBe(result[0].source);
  });

  it("does not reorder too aggressively when score drop is too large", () => {
    const items = [
      makeRankedArticle("a1", "Source A", 100),
      makeRankedArticle("a2", "Source A", 96),
      makeRankedArticle("b1", "Source B", 80),
    ];

    const result = balanceSources(items, {
      protectTop: 1,
      minGap: 1,
      lookahead: 3,
      maxScoreDropForReorder: 4,
    });

    expect(result[1].id).toBe("a2");
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      balanceSources(null as never),
    ).toThrow(EngineError);
  });
});