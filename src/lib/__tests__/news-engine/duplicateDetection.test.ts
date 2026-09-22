// src/lib/__tests__/news-engine/duplicateDetection.test.ts

import { describe, expect, it } from "vitest";
import {
  analyzeDuplicates,
  titleSimilarity,
} from "@/lib/news-engine/duplicateDetection";
import type { NormalizedArticle } from "@/lib/news-engine/types";

function article(
  id: string,
  title: string,
  overrides: Partial<NormalizedArticle> = {},
): NormalizedArticle {
  return {
    id,
    sport: overrides.sport ?? "football",
    title,
    url: overrides.url ?? `https://example.com/${id}`,
    source: overrides.source ?? "Example Sport",
    publishedAt: overrides.publishedAt ?? "2026-09-20T10:00:00.000Z",
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    urgency: overrides.urgency ?? 0,
    entityHits: overrides.entityHits ?? [],
    ...overrides,
  };
}

describe("duplicateDetection", () => {
  it("groups the same canonical URL even with tracking parameters", () => {
    const analysis = analyzeDuplicates([
      article("a1", "Alexander Isak scores", {
        url: "https://example.com/story?utm_source=rss",
      }),
      article("a2", "Isak scores for Liverpool", {
        url: "https://example.com/story?ref=home#top",
      }),
    ]);

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].kind).toBe("canonical-url");
    expect(analysis.duplicateCountsByArticleId.a1).toBe(1);
    expect(analysis.duplicateCountsByArticleId.a2).toBe(1);
  });

  it("groups highly similar titles from different sources", () => {
    const analysis = analyzeDuplicates([
      article("a1", "JUST NU: Alexander Isak scores winner for Liverpool", {
        source: "BBC Sport",
      }),
      article("a2", "Alexander Isak scores winner for Liverpool", {
        source: "SVT Sport",
      }),
    ]);

    expect(analysis.groups).toHaveLength(1);
    expect(analysis.groups[0].kind).toBe("title-similarity");
  });

  it("does not group distinct stories merely because they share a player", () => {
    const analysis = analyzeDuplicates([
      article("a1", "Alexander Isak scores winner for Liverpool"),
      article("a2", "Alexander Isak discusses Sweden's next qualifier"),
    ]);

    expect(analysis.groups).toHaveLength(0);
  });

  it("does not group stories outside the duplicate time window", () => {
    const analysis = analyzeDuplicates(
      [
        article("a1", "Alexander Isak scores winner for Liverpool", {
          publishedAt: "2026-09-20T10:00:00.000Z",
        }),
        article("a2", "Alexander Isak scores winner for Liverpool", {
          publishedAt: "2026-09-19T22:00:00.000Z",
        }),
      ],
      {
        maxAgeDifferenceMinutes: 360,
      },
    );

    expect(analysis.groups).toHaveLength(0);
  });

  it("keeps football and hockey separate", () => {
    const analysis = analyzeDuplicates([
      article("a1", "Sweden win dramatic game", { sport: "football" }),
      article("a2", "Sweden win dramatic game", { sport: "hockey" }),
    ]);

    expect(analysis.groups).toHaveLength(0);
  });

  it("exposes a bounded title similarity score", () => {
    const same = titleSimilarity(
      "Alexander Isak scores winner",
      "Alexander Isak scores winner",
    );
    const different = titleSimilarity(
      "Alexander Isak scores winner",
      "SHL schedule released for next season",
    );

    expect(same).toBe(1);
    expect(different).toBeGreaterThanOrEqual(0);
    expect(different).toBeLessThan(same);
  });
});
