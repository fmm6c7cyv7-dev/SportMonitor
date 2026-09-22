import { describe, expect, it } from "vitest";
import type { AcceptedItem } from "@/lib/news/newsTypes";
import type { RankedArticle } from "@/lib/news-engine/types";
import {
  getArticleAgeHours,
  getPublishedAtMs,
  mergeRankedArticlesIntoAccepted,
  splitAcceptedItemsByFreshness,
} from "./route";

function createAcceptedItem(
  overrides: Partial<AcceptedItem> = {},
): AcceptedItem {
  return {
    id: overrides.id ?? "news-1",
    sport: overrides.sport ?? "football",
    title: overrides.title ?? "Test title",
    url: overrides.url ?? "https://example.com/news-1",
    source: overrides.source ?? "Test Source",
    published_at: overrides.published_at ?? "2026-04-02T10:00:00.000Z",
    fetched_at: overrides.fetched_at ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    isFavorite: overrides.isFavorite ?? false,
    isLocal: overrides.isLocal ?? false,
    favorite_match: overrides.favorite_match ?? false,
    favorite_score: overrides.favorite_score ?? 0,
    favorite_match_mode: overrides.favorite_match_mode ?? "none",
    favorite_entity_type: overrides.favorite_entity_type ?? null,
    favorite_entity_id: overrides.favorite_entity_id ?? null,
    favorite_entity_name: overrides.favorite_entity_name ?? null,
    hasSwedishPlayer: overrides.hasSwedishPlayer ?? false,
    isPremierOrAllsvenskan: overrides.isPremierOrAllsvenskan ?? false,
  };
}

function createRankedArticle(
  overrides: Partial<RankedArticle> = {},
): RankedArticle {
  return {
    id: overrides.id ?? "news-1",
    title: overrides.title ?? "Test title",
    url: overrides.url ?? "https://example.com/news-1",
    source: overrides.source ?? "Test Source",
    sport: overrides.sport ?? "football",
    publishedAt: overrides.publishedAt ?? "2026-04-02T10:00:00.000Z",
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    score: overrides.score ?? 42,
    favoriteSignal:
      overrides.favoriteSignal ?? {
        matched: false,
        score: 0,
        matchedEntityIds: [],
      },
    localSignal:
      overrides.localSignal ?? {
        matched: false,
        score: 0,
      },
    scoreComponents:
      overrides.scoreComponents ?? {
        freshness: 0,
        sourceQuality: 0,
        entityMatch: 0,
        favorites: 0,
        local: 0,
        hardNews: 0,
        swedishPlayer: 0,
        leaguePriority: 0,
        recency: 0,
      },
  } as RankedArticle;
}

describe("news route freshness helpers", () => {
  it("returns null for invalid published_at values", () => {
    expect(getPublishedAtMs(null)).toBeNull();
    expect(getPublishedAtMs(undefined)).toBeNull();
    expect(getPublishedAtMs("not-a-date")).toBeNull();
  });

  it("returns age in hours for valid published_at values", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const ageHours = getArticleAgeHours("2026-04-02T09:00:00.000Z", nowMs);

    expect(ageHours).toBe(3);
  });

  it("splits accepted items into fresh and fallback pools", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");

    const freshItem = createAcceptedItem({
      id: "fresh-1",
      url: "https://example.com/fresh-1",
      published_at: "2026-04-02T08:30:00.000Z",
    });

    const fallbackItem = createAcceptedItem({
      id: "fallback-1",
      url: "https://example.com/fallback-1",
      published_at: "2026-04-02T02:00:00.000Z",
    });

    const tooOldItem = createAcceptedItem({
      id: "old-1",
      url: "https://example.com/old-1",
      published_at: "2026-03-31T12:00:00.000Z",
    });

    const split = splitAcceptedItemsByFreshness(
      [freshItem, fallbackItem, tooOldItem],
      nowMs,
      6,
      24,
    );

    expect(split.fresh.map((item) => item.id)).toEqual(["fresh-1"]);
    expect(split.fallback.map((item) => item.id)).toEqual(["fallback-1"]);
  });
});

describe("mergeRankedArticlesIntoAccepted", () => {
  it("keeps local and favorite signals separate", () => {
    const accepted = [
      createAcceptedItem({
        id: "news-1",
        url: "https://example.com/news-1",
        isFavorite: false,
        isLocal: false,
        favorite_match: false,
      }),
    ];

    const rankedArticles = [
      createRankedArticle({
        id: "news-1",
        url: "https://example.com/news-1",
        favoriteSignal: {
          matched: false,
          score: 0,
          matchedEntityIds: [],
        },
        localSignal: {
          matched: true,
          score: 12,
        },
        score: 88,
      }),
    ];

    const merged = mergeRankedArticlesIntoAccepted(
      accepted,
      rankedArticles,
      "football",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].favorite_match).toBe(false);
    expect(merged[0].isFavorite).toBe(false);
    expect(merged[0].isLocal).toBe(true);
    expect(merged[0].is_local).toBe(true);
    expect(merged[0].ranking_total).toBe(88);
  });

  it("updates favorite signal from ranked article when matched", () => {
    const accepted = [
      createAcceptedItem({
        id: "news-2",
        url: "https://example.com/news-2",
        favorite_match: false,
        favorite_score: 0,
      }),
    ];

    const rankedArticles = [
      createRankedArticle({
        id: "news-2",
        url: "https://example.com/news-2",
        favoriteSignal: {
          matched: true,
          score: 9,
          matchedEntityIds: ["entity-1"],
        },
        localSignal: {
          matched: false,
          score: 0,
        },
      }),
    ];

    const merged = mergeRankedArticlesIntoAccepted(
      accepted,
      rankedArticles,
      "football",
    );

    expect(merged[0].favorite_match).toBe(true);
    expect(merged[0].isFavorite).toBe(true);
    expect(merged[0].favorite_score).toBe(9);
    expect(merged[0].isLocal).toBe(false);
  });
});