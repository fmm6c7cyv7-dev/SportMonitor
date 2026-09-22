// src/lib/__tests__/news-engine/clusterSelection.test.ts

import { describe, expect, it } from "vitest";
import { selectClusterRepresentatives } from "@/lib/news-engine/clusterSelection";
import {
  createEmptyScoreComponents,
  type ArticleCluster,
  type RankedArticle,
} from "@/lib/news-engine/types";

function ranked(
  id: string,
  score: number,
  overrides: Partial<RankedArticle> = {},
): RankedArticle {
  return {
    id,
    sport: "football",
    title: `Article ${id}`,
    url: `https://example.com/${id}`,
    source: "Example Sport",
    publishedAt: "2026-09-20T10:00:00.000Z",
    summary: null,
    tags: [],
    priority: 0,
    urgency: 0,
    entityHits: [],
    score,
    scoreComponents: createEmptyScoreComponents(),
    ...overrides,
  };
}

function cluster(articleIds: string[]): ArticleCluster {
  return {
    clusterId: "event-1",
    sport: "football",
    representativeArticleId: articleIds[0],
    articleIds,
    eventKey: "football|player-isak|match-event",
    intensity: 2,
  };
}

describe("clusterSelection", () => {
  it("keeps the highest-scored article as cluster representative", () => {
    const result = selectClusterRepresentatives(
      [ranked("a1", 42), ranked("a2", 55), ranked("a3", 20)],
      [cluster(["a1", "a2"])],
    );

    expect(result.map((article) => article.id)).toEqual(["a2", "a3"]);
    expect(result[0].clusterId).toBe("event-1");
  });

  it("uses newer publication time as score tie-breaker", () => {
    const result = selectClusterRepresentatives(
      [
        ranked("a1", 50, {
          publishedAt: "2026-09-20T10:00:00.000Z",
        }),
        ranked("a2", 50, {
          publishedAt: "2026-09-20T10:30:00.000Z",
        }),
      ],
      [cluster(["a1", "a2"])],
    );

    expect(result.map((article) => article.id)).toEqual(["a2"]);
  });

  it("returns unclustered articles unchanged", () => {
    const items = [ranked("a1", 30), ranked("a2", 20)];

    expect(selectClusterRepresentatives(items, [])).toEqual(items);
  });
});
