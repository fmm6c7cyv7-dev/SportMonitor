// src/lib/__tests__/news-engine/eventClustering.test.ts

import { describe, expect, it } from "vitest";
import {
  buildEventClusters,
  classifyEventCategory,
} from "@/lib/news-engine/eventClustering";
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
    entityHits:
      overrides.entityHits ??
      [
        {
          entityId: "player-isak",
          sport: "football",
          type: "player",
          name: "Alexander Isak",
          confidence: 0.99,
          isSwedish: true,
          isAbroadCore: true,
          origin: "detected",
        },
      ],
    ...overrides,
  };
}

describe("eventClustering", () => {
  it("classifies common hard-news event categories", () => {
    expect(
      classifyEventCategory(article("a1", "Alexander Isak scores winner")),
    ).toBe("match-event");
    expect(
      classifyEventCategory(article("a2", "Alexander Isak signs for Liverpool")),
    ).toBe("transfer");
    expect(
      classifyEventCategory(article("a3", "Alexander Isak ruled out with injury")),
    ).toBe("injury");
    expect(
      classifyEventCategory(article("a4", "Confirmed lineup: Alexander Isak starts")),
    ).toBe("lineup");
  });

  it("clusters the same player and event category within the time window", () => {
    const analysis = buildEventClusters([
      article("a1", "Alexander Isak scores winner", {
        source: "BBC Sport",
        publishedAt: "2026-09-20T10:00:00.000Z",
      }),
      article("a2", "Isak scores late goal", {
        source: "SVT Sport",
        publishedAt: "2026-09-20T10:12:00.000Z",
      }),
    ]);

    expect(analysis.clusters).toHaveLength(1);
    expect(analysis.clusters[0].articleIds).toEqual(["a1", "a2"]);
    expect(analysis.clusters[0].intensity).toBe(2);
    expect(analysis.clusterIdByArticleId.a1).toBeDefined();
    expect(analysis.eventIntensityByArticleId.a2).toBe(2);
  });

  it("does not cluster different event categories for the same player", () => {
    const analysis = buildEventClusters([
      article("a1", "Alexander Isak scores winner"),
      article("a2", "Alexander Isak signs new contract"),
    ]);

    expect(analysis.clusters).toHaveLength(0);
  });

  it("does not create general entity clusters without a clear event", () => {
    const analysis = buildEventClusters([
      article("a1", "Alexander Isak discusses the season"),
      article("a2", "Alexander Isak reflects on Sweden"),
    ]);

    expect(analysis.clusters).toHaveLength(0);
  });

  it("does not cluster across the configured time window", () => {
    const analysis = buildEventClusters(
      [
        article("a1", "Alexander Isak scores winner", {
          publishedAt: "2026-09-20T10:00:00.000Z",
        }),
        article("a2", "Alexander Isak scores late goal", {
          publishedAt: "2026-09-19T20:00:00.000Z",
        }),
      ],
      { maxAgeDifferenceMinutes: 360 },
    );

    expect(analysis.clusters).toHaveLength(0);
  });

  it("caps media-swarm intensity", () => {
    const articles = Array.from({ length: 8 }, (_, index) =>
      article(`a${index}`, "Alexander Isak scores winner", {
        source: `Source ${index}`,
        publishedAt: `2026-09-20T10:0${index}:00.000Z`,
      }),
    );

    const analysis = buildEventClusters(articles);

    expect(analysis.clusters).toHaveLength(1);
    expect(analysis.clusters[0].intensity).toBe(8);
  });
});
