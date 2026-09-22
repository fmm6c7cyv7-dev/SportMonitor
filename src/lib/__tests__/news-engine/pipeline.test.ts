// src/lib/__tests__/news-engine/pipeline.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import type { NormalizedArticle } from "@/lib/news-engine/types";
import { runRankingPipeline } from "@/lib/news-engine/pipeline";

function makeArticle(
  id: string,
  overrides: Partial<NormalizedArticle> = {},
): NormalizedArticle {
  return {
    id,
    sport: "football",
    title: "Alexander Isak avgör för Newcastle",
    url: `https://example.com/${id}`,
    source: "BBC Sport",
    publishedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    summary: null,
    tags: ["JUST_NU"],
    priority: 85,
    urgency: 18,
    canonicalUrl: null,
    entityHits: [
      {
        entityId: "player-isak",
        sport: "football",
        type: "player",
        name: "Alexander Isak",
        confidence: 0.98,
        isSwedish: true,
        isAbroadCore: true,
      },
    ],
    favoriteSignal: undefined,
    localSignal: {
      score: 5,
      matched: true,
      reason: "regional-interest",
    },
    bigNewsSignal: undefined,
    ...overrides,
  };
}

describe("runRankingPipeline", () => {
  it("scores and returns ranked football articles", () => {
    const result = runRankingPipeline(
      [
        makeArticle("a1"),
        makeArticle("a2", {
          title: "Inför helgens omgång",
          urgency: 0,
          priority: 0,
          tags: [],
          entityHits: [],
          localSignal: undefined,
        }),
      ],
      {
        sport: "football",
        nowMs: Date.now(),
        favorites: [
          {
            entityId: "player-isak",
            sport: "football",
            type: "player",
            label: "Alexander Isak",
          },
        ],
        geo: {
          lat: 59.6,
          lng: 16.55,
          source: "browser",
        },
        duplicateCountsByArticleId: {
          a1: 0,
          a2: 0,
        },
        eventIntensityByArticleId: {
          a1: 4,
          a2: 0,
        },
        hardNewsArticleIds: ["a1"],
      },
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].score).toBeGreaterThanOrEqual(result[result.length - 1].score);
  });

  it("enriches missing Swedish core entities before scoring", () => {
    const result = runRankingPipeline(
      [
        makeArticle("core-from-catalog", {
          title: "Kim Hellberg reacts after Middlesbrough win",
          entityHits: [],
          priority: 0,
          urgency: 0,
          tags: [],
          localSignal: undefined,
        }),
      ],
      {
        sport: "football",
        nowMs: Date.now(),
      },
    );

    expect(result).toHaveLength(1);
    expect(
      result[0].entityHits.some(
        (hit) =>
          hit.type === "staff" &&
          hit.name === "Kim Hellberg" &&
          hit.isSwedish === true,
      ),
    ).toBe(true);
  });

  it("adds duplicate penalties automatically when the caller provides none", () => {
    const publishedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const result = runRankingPipeline(
      [
        makeArticle("dup-1", {
          title: "Alexander Isak scores winner for Liverpool",
          url: "https://example.com/story?utm_source=one",
          publishedAt,
          source: "BBC Sport",
        }),
        makeArticle("dup-2", {
          title: "Alexander Isak scores winner for Liverpool",
          url: "https://example.com/story?utm_source=two",
          publishedAt,
          source: "SVT Sport",
        }),
      ],
      {
        sport: "football",
        nowMs: Date.now(),
      },
    );

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.scoreComponents.duplicatePenalty > 0)).toBe(
      true,
    );
  });

  it("adds bounded event intensity and cluster ids without collapsing by default", () => {
    const publishedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const result = runRankingPipeline(
      [
        makeArticle("event-1", {
          title: "Alexander Isak scores winner",
          source: "BBC Sport",
          publishedAt,
        }),
        makeArticle("event-2", {
          title: "Isak scores late goal",
          source: "SVT Sport",
          publishedAt,
        }),
      ],
      {
        sport: "football",
        nowMs: Date.now(),
      },
    );

    expect(result).toHaveLength(2);
    expect(result.every((item) => item.clusterId != null)).toBe(true);
    expect(result.every((item) => item.scoreComponents.eventIntensity === 2)).toBe(
      true,
    );
  });

  it("can collapse event clusters only when explicitly requested", () => {
    const publishedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const result = runRankingPipeline(
      [
        makeArticle("event-collapse-1", {
          title: "Alexander Isak scores winner",
          source: "BBC Sport",
          publishedAt,
        }),
        makeArticle("event-collapse-2", {
          title: "Isak scores late goal",
          source: "SVT Sport",
          publishedAt,
        }),
      ],
      {
        sport: "football",
        nowMs: Date.now(),
        collapseEventClusters: true,
      },
    );

    expect(result).toHaveLength(1);
    expect(result[0].clusterId).toBeDefined();
  });

  it("filters to requested sport", () => {
    const result = runRankingPipeline(
      [
        makeArticle("f1", { sport: "football" }),
        makeArticle("h1", { sport: "hockey", title: "SHL-drama ikväll" }),
      ],
      {
        sport: "hockey",
        nowMs: Date.now(),
      },
    );

    expect(result.every((item) => item.sport === "hockey")).toBe(true);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      runRankingPipeline(null as never, {
        sport: "football",
        nowMs: Date.now(),
      }),
    ).toThrow(EngineError);
  });
});