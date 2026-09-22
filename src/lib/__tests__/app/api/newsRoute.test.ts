// src/lib/__tests__/app/api/newsRoute.test.ts

import { describe, expect, it, vi } from "vitest";
import type {
  AcceptedItem,
  FavoriteMatchMode,
} from "@/lib/news/newsTypes";
import type {
  RankedArticle,
  FavoriteSignal as RankedFavoriteSignal,
  LocalSignal as RankedLocalSignal,
  ScoreComponentMap as RankedScoreComponents,
} from "@/lib/news-engine/types";

vi.mock("@/lib/supabase", () => {
  return {
    supabaseService: vi.fn(),
  };
});

const routeModule = await import("@/app/api/news/route");

const {
  filterRouteItemsByFreshness,
  filterAcceptedItemsByRegionalSourceEligibility,
  getArticleAgeHours,
  getPublishedAtMs,
  isAcceptedItemEligibleForRegionalSource,
  isRegionalSourceLocalToActiveRegion,
  mergeRankedArticlesIntoAccepted,
  sortRouteItemsHybrid,
  splitAcceptedItemsByFreshness,
} = routeModule;

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
    favorite_match_mode:
      overrides.favorite_match_mode ?? ("none" satisfies FavoriteMatchMode),
    favorite_entity_type: overrides.favorite_entity_type ?? null,
    favorite_entity_id: overrides.favorite_entity_id ?? null,
    favorite_entity_name: overrides.favorite_entity_name ?? null,
    hasSwedishPlayer: overrides.hasSwedishPlayer ?? false,
    isPremierOrAllsvenskan: overrides.isPremierOrAllsvenskan ?? false,
    editorialTier: overrides.editorialTier,
    editorialReasons: overrides.editorialReasons ?? [],
  };
}

function createFavoriteSignal(
  overrides: Partial<RankedFavoriteSignal> = {},
): RankedFavoriteSignal {
  return {
    matched: overrides.matched ?? false,
    score: overrides.score ?? 0,
    matchedFavoriteIds: overrides.matchedFavoriteIds ?? [],
    reasons: overrides.reasons ?? [],
  };
}

function createLocalSignal(
  overrides: Partial<RankedLocalSignal> = {},
): RankedLocalSignal {
  return {
    matched: overrides.matched ?? false,
    score: overrides.score ?? 0,
    region: overrides.region ?? null,
    reason: overrides.reason ?? null,
  };
}

function createScoreComponents(
  overrides: Partial<RankedScoreComponents> = {},
): RankedScoreComponents {
  return {
    recency: overrides.recency ?? 0,
    urgency: overrides.urgency ?? 0,
    swedishPlayer: overrides.swedishPlayer ?? 0,
    swedishAbroadCore: overrides.swedishAbroadCore ?? 0,
    swedishLeague: overrides.swedishLeague ?? 0,
    favoriteAffinity: overrides.favoriteAffinity ?? 0,
    localGeo: overrides.localGeo ?? 0,
    sourceAuthority: overrides.sourceAuthority ?? 0,
    sourceLeagueFit: overrides.sourceLeagueFit ?? 0,
    sourceCountryFit: overrides.sourceCountryFit ?? 0,
    bigNews: overrides.bigNews ?? 0,
    eventIntensity: overrides.eventIntensity ?? 0,
    priority: overrides.priority ?? 0,
    evergreenPenalty: overrides.evergreenPenalty ?? 0,
    stalenessPenalty: overrides.stalenessPenalty ?? 0,
    duplicatePenalty: overrides.duplicatePenalty ?? 0,
  };
}

function createRankedArticle(
  overrides: Partial<RankedArticle> = {},
): RankedArticle {
  return {
    id: overrides.id ?? "news-1",
    sport: overrides.sport ?? "football",
    title: overrides.title ?? "Test title",
    url: overrides.url ?? "https://example.com/news-1",
    source: overrides.source ?? "Test Source",
    publishedAt: overrides.publishedAt ?? "2026-04-02T10:00:00.000Z",
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    urgency: overrides.urgency ?? 0,
    canonicalUrl: overrides.canonicalUrl ?? null,
    entityHits: overrides.entityHits ?? [],
    favoriteSignal: overrides.favoriteSignal ?? createFavoriteSignal(),
    localSignal: overrides.localSignal ?? createLocalSignal(),
    bigNewsSignal: overrides.bigNewsSignal,
    score: overrides.score ?? 42,
    scoreComponents:
      overrides.scoreComponents ?? createScoreComponents(),
    clusterId: overrides.clusterId ?? null,
  };
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

  it("treats future timestamps as 0 hours old", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const ageHours = getArticleAgeHours("2026-04-02T14:00:00.000Z", nowMs);

    expect(ageHours).toBe(0);
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
      3,
      6,
      72,
    );

    expect(split.fresh.map((item) => item.id)).toEqual([]);
    expect(split.fallback.map((item) => item.id)).toEqual(["fresh-1"]);
    expect(split.backfill.map((item) => item.id)).toEqual(["fallback-1", "old-1"]);
  });

  it("drops items with invalid published_at from both pools", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");

    const invalidItem = createAcceptedItem({
      id: "invalid-1",
      url: "https://example.com/invalid-1",
      published_at: "not-a-date",
    });

    const split = splitAcceptedItemsByFreshness([invalidItem], nowMs, 3, 6, 72);

    expect(split.fresh).toEqual([]);
    expect(split.fallback).toEqual([]);
    expect(split.backfill).toEqual([]);
  });

  it("places articles older than 6h into backfill only", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");

    const backfillItem = createAcceptedItem({
      id: "backfill-1",
      url: "https://example.com/backfill-1",
      published_at: "2026-04-02T05:00:00.000Z",
    });

    const tooOldItem = createAcceptedItem({
      id: "too-old-1",
      url: "https://example.com/too-old-1",
      published_at: "2026-03-29T12:00:00.000Z",
    });

    const split = splitAcceptedItemsByFreshness(
      [backfillItem, tooOldItem],
      nowMs,
      3,
      6,
      72,
    );

    expect(split.fresh).toEqual([]);
    expect(split.fallback).toEqual([]);
    expect(split.backfill.map((item) => item.id)).toEqual(["backfill-1"]);
  });

  it("excludes >6h articles from normal column candidates", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const within6h = createAcceptedItem({
      id: "within-6h",
      url: "https://example.com/within-6h",
      published_at: "2026-04-02T07:00:00.000Z",
    });
    const over6h = createAcceptedItem({
      id: "over-6h",
      url: "https://example.com/over-6h",
      published_at: "2026-04-02T05:30:00.000Z",
    });

    const filtered = filterRouteItemsByFreshness(
      [within6h, over6h].map((item) => ({
        ...item,
        ranking_total: 0,
        is_local: item.isLocal,
      })),
      nowMs,
      6,
    );

    expect(filtered.map((item) => item.id)).toEqual(["within-6h"]);
  });

  it("does not allow favorite/local items older than 6h to pin above fresher news", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const staleFavoriteLocal = createAcceptedItem({
      id: "stale-favorite-local",
      url: "https://example.com/stale-favorite-local",
      published_at: "2026-04-02T05:00:00.000Z",
      isFavorite: true,
      isLocal: true,
      favorite_match: true,
    });
    const freshRegular = createAcceptedItem({
      id: "fresh-regular",
      url: "https://example.com/fresh-regular",
      published_at: "2026-04-02T11:15:00.000Z",
    });

    const filtered = filterRouteItemsByFreshness(
      [staleFavoriteLocal, freshRegular].map((item) => ({
        ...item,
        ranking_total: 0,
        is_local: item.isLocal,
      })),
      nowMs,
      6,
    );

    expect(filtered.map((item) => item.id)).toEqual(["fresh-regular"]);
  });

  it("does not allow a Swedish core item older than 6h into the normal feed", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const staleSwedishCore = createAcceptedItem({
      id: "stale-swedish-core",
      url: "https://example.com/stale-swedish-core",
      published_at: "2026-04-02T05:00:00.000Z",
      priority: 100,
      hasSwedishPlayer: true,
    });
    const freshRelevant = createAcceptedItem({
      id: "fresh-relevant",
      url: "https://example.com/fresh-relevant",
      published_at: "2026-04-02T11:15:00.000Z",
      priority: 50,
    });

    const filtered = filterRouteItemsByFreshness(
      [staleSwedishCore, freshRelevant].map((item) => ({
        ...item,
        ranking_total: item.id === "stale-swedish-core" ? 200 : 30,
        is_local: item.isLocal,
      })),
      nowMs,
      6,
    );

    expect(filtered.map((item) => item.id)).toEqual(["fresh-relevant"]);
  });

  it("orders Tier 1 ahead of Tier 2 inside the same freshness bucket", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const tier2 = createAcceptedItem({
      id: "tier-2",
      url: "https://example.com/tier-2",
      published_at: "2026-04-02T11:45:00.000Z",
      priority: 50,
      editorialTier: 2,
    });
    const tier1 = createAcceptedItem({
      id: "tier-1",
      url: "https://example.com/tier-1",
      published_at: "2026-04-02T11:40:00.000Z",
      priority: 50,
      editorialTier: 1,
    });

    const sorted = sortRouteItemsHybrid(
      [
        {
          ...tier2,
          ranking_total: 30,
          is_local: false,
        },
        {
          ...tier1,
          ranking_total: 30,
          is_local: false,
        },
      ],
      nowMs,
    );

    expect(sorted.map((item) => item.id)).toEqual(["tier-1", "tier-2"]);
  });

  it("does not let favorite metadata reorder the feed when favorites-first is off", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const favorite = createAcceptedItem({
      id: "favorite-kalmar",
      url: "https://example.com/favorite-kalmar",
      published_at: "2026-04-02T11:40:00.000Z",
      favorite_match: true,
      isFavorite: true,
      favorite_score: 250,
    });
    const strongerRegular = createAcceptedItem({
      id: "regular-core",
      url: "https://example.com/regular-core",
      published_at: "2026-04-02T11:42:00.000Z",
    });

    const sorted = sortRouteItemsHybrid(
      [
        {
          ...favorite,
          ranking_total: 30,
          is_local: false,
        },
        {
          ...strongerRegular,
          ranking_total: 40,
          is_local: false,
        },
      ],
      nowMs,
      false,
    );

    expect(sorted.map((item) => item.id)).toEqual([
      "regular-core",
      "favorite-kalmar",
    ]);
  });

  it("does not let Tier 2 context jump a freshness bucket by itself", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const freshTier3 = createAcceptedItem({
      id: "fresh-tier-3",
      url: "https://example.com/fresh-tier-3",
      published_at: "2026-04-02T11:40:00.000Z",
      priority: 50,
      editorialTier: 3,
    });
    const olderTier2 = createAcceptedItem({
      id: "older-tier-2",
      url: "https://example.com/older-tier-2",
      published_at: "2026-04-02T11:05:00.000Z",
      priority: 50,
      editorialTier: 2,
    });

    const sorted = sortRouteItemsHybrid(
      [
        {
          ...olderTier2,
          ranking_total: 300,
          is_local: false,
        },
        {
          ...freshTier3,
          ranking_total: 20,
          is_local: false,
        },
      ],
      nowMs,
    );

    expect(sorted.map((item) => item.id)).toEqual([
      "fresh-tier-3",
      "older-tier-2",
    ]);
  });

  it("allows a strong core item to jump one adjacent freshness bucket", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const fresherGeneric = createAcceptedItem({
      id: "fresh-generic",
      url: "https://example.com/fresh-generic",
      published_at: "2026-04-02T11:40:00.000Z",
      priority: 50,
    });
    const olderSwedishCore = createAcceptedItem({
      id: "older-swedish-core",
      url: "https://example.com/older-swedish-core",
      published_at: "2026-04-02T11:05:00.000Z",
      priority: 100,
      hasSwedishPlayer: true,
    });

    const sorted = sortRouteItemsHybrid(
      [
        {
          ...fresherGeneric,
          ranking_total: 30,
          is_local: false,
        },
        {
          ...olderSwedishCore,
          ranking_total: 50,
          is_local: false,
        },
      ],
      nowMs,
    );

    expect(sorted.map((item) => item.id)).toEqual([
      "older-swedish-core",
      "fresh-generic",
    ]);
  });

  it("does not allow core relevance to jump two freshness buckets", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const fresherGeneric = createAcceptedItem({
      id: "fresh-generic-two-buckets",
      url: "https://example.com/fresh-generic-two-buckets",
      published_at: "2026-04-02T11:40:00.000Z",
      priority: 50,
    });
    const muchOlderSwedishCore = createAcceptedItem({
      id: "older-swedish-core-two-buckets",
      url: "https://example.com/older-swedish-core-two-buckets",
      published_at: "2026-04-02T10:00:00.000Z",
      priority: 100,
      hasSwedishPlayer: true,
    });

    const sorted = sortRouteItemsHybrid(
      [
        {
          ...muchOlderSwedishCore,
          ranking_total: 300,
          is_local: false,
        },
        {
          ...fresherGeneric,
          ranking_total: 20,
          is_local: false,
        },
      ],
      nowMs,
    );

    expect(sorted.map((item) => item.id)).toEqual([
      "fresh-generic-two-buckets",
      "older-swedish-core-two-buckets",
    ]);
  });

  it("applies the same 6h freshness discipline to football and hockey", () => {
    const nowMs = Date.parse("2026-04-02T12:00:00.000Z");
    const footballFresh = createAcceptedItem({
      id: "football-fresh",
      sport: "football",
      url: "https://example.com/football-fresh",
      published_at: "2026-04-02T10:30:00.000Z",
    });
    const hockeyFresh = createAcceptedItem({
      id: "hockey-fresh",
      sport: "hockey",
      url: "https://example.com/hockey-fresh",
      published_at: "2026-04-02T10:00:00.000Z",
    });
    const footballStale = createAcceptedItem({
      id: "football-stale",
      sport: "football",
      url: "https://example.com/football-stale",
      published_at: "2026-04-02T04:30:00.000Z",
    });
    const hockeyStale = createAcceptedItem({
      id: "hockey-stale",
      sport: "hockey",
      url: "https://example.com/hockey-stale",
      published_at: "2026-04-02T04:00:00.000Z",
    });

    const filtered = filterRouteItemsByFreshness(
      [footballFresh, hockeyFresh, footballStale, hockeyStale].map((item) => ({
        ...item,
        ranking_total: 0,
        is_local: item.isLocal,
      })),
      nowMs,
      6,
    );

    expect(filtered.map((item) => item.id)).toEqual([
      "football-fresh",
      "hockey-fresh",
    ]);
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
        favoriteSignal: createFavoriteSignal({
          matched: false,
          score: 0,
        }),
        localSignal: createLocalSignal({
          matched: true,
          score: 12,
        }),
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

  it("does not let ranked favorite signal redefine accepted favorite semantics", () => {
    const accepted = [
      createAcceptedItem({
        id: "news-2",
        url: "https://example.com/news-2",
        isFavorite: false,
        favorite_match: false,
        favorite_score: 0,
        favorite_match_mode: "none",
        favorite_entity_id: null,
        favorite_entity_name: null,
      }),
    ];

    const rankedArticles = [
      createRankedArticle({
        id: "news-2",
        url: "https://example.com/news-2",
        favoriteSignal: createFavoriteSignal({
          matched: true,
          score: 9,
        }),
        localSignal: createLocalSignal({
          matched: false,
          score: 0,
        }),
      }),
    ];

    const merged = mergeRankedArticlesIntoAccepted(
      accepted,
      rankedArticles,
      "football",
    );

    expect(merged[0].favorite_match).toBe(false);
    expect(merged[0].isFavorite).toBe(false);
    expect(merged[0].favorite_score).toBe(0);
    expect(merged[0].favorite_match_mode).toBe("none");
    expect(merged[0].favorite_entity_id).toBeNull();
    expect(merged[0].favorite_entity_name).toBeNull();
    expect(merged[0].isLocal).toBe(false);
  });

  it("preserves token-based favorite match from accepted item", () => {
    const accepted = [
      createAcceptedItem({
        id: "news-3",
        url: "https://example.com/news-3",
        title: "Price beats Van Veen for Premier League win in Manchester",
        isFavorite: true,
        favorite_match: true,
        favorite_score: 1,
        favorite_match_mode: "token",
      }),
    ];

    const rankedArticles = [
      createRankedArticle({
        id: "news-3",
        url: "https://example.com/news-3",
        favoriteSignal: createFavoriteSignal({
          matched: false,
          score: 0,
        }),
        localSignal: createLocalSignal({
          matched: false,
          score: 0,
        }),
        score: 77,
      }),
    ];

    const merged = mergeRankedArticlesIntoAccepted(
      accepted,
      rankedArticles,
      "football",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].favorite_match).toBe(true);
    expect(merged[0].isFavorite).toBe(true);
    expect(merged[0].favorite_match_mode).toBe("token");
    expect(merged[0].favorite_score).toBe(1);
  });

  it("preserves existing named favorite entity from accepted item", () => {
    const accepted = [
      createAcceptedItem({
        id: "news-4",
        url: "https://example.com/news-4",
        isFavorite: true,
        favorite_match: true,
        favorite_score: 215,
        favorite_match_mode: "entity",
        favorite_entity_type: "team",
        favorite_entity_id: "team-1",
        favorite_entity_name: "Västerås SK",
      }),
    ];

    const rankedArticles = [
      createRankedArticle({
        id: "news-4",
        url: "https://example.com/news-4",
        favoriteSignal: createFavoriteSignal({
          matched: false,
          score: 0,
        }),
        score: 91,
      }),
    ];

    const merged = mergeRankedArticlesIntoAccepted(
      accepted,
      rankedArticles,
      "football",
    );

    expect(merged[0].favorite_match).toBe(true);
    expect(merged[0].isFavorite).toBe(true);
    expect(merged[0].favorite_entity_type).toBe("team");
    expect(merged[0].favorite_entity_id).toBe("team-1");
    expect(merged[0].favorite_entity_name).toBe("Västerås SK");
    expect(merged[0].favorite_match_mode).toBe("entity");
  });

  it("normalizes merged result to the requested sport", () => {
    const accepted = [
      createAcceptedItem({
        id: "news-5",
        url: "https://example.com/news-5",
        sport: "hockey",
      }),
    ];

    const rankedArticles = [
      createRankedArticle({
        id: "news-5",
        url: "https://example.com/news-5",
        sport: "hockey",
        score: 55,
      }),
    ];

    const merged = mergeRankedArticlesIntoAccepted(
      accepted,
      rankedArticles,
      "football",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].sport).toBe("football");
    expect(merged[0].ranking_total).toBe(55);
  });
});


describe("regional source local classification", () => {
  it("treats Pressgurkan as local in Västerås even when the title has no VSK token", () => {
    const local = isRegionalSourceLocalToActiveRegion("Pressgurkan", {
      city: "Västerås",
      lat: 59.6099,
      lng: 16.5448,
      terms: ["vsk", "västerås"],
    });

    expect(local).toBe(true);
  });

  it("does not treat Pressgurkan as local in Stockholm", () => {
    const local = isRegionalSourceLocalToActiveRegion("Pressgurkan", {
      city: "Stockholm",
      lat: 59.3293,
      lng: 18.0686,
      terms: ["aik", "hammarby"],
    });

    expect(local).toBe(false);
  });

  it("does not make Kalmar FF official local for a Västerås user", () => {
    const local = isRegionalSourceLocalToActiveRegion(
      "Kalmar FF (officiell)",
      {
        city: "Västerås",
        lat: 59.6099,
        lng: 16.5448,
        terms: ["vsk", "västerås"],
      },
    );

    expect(local).toBe(false);
  });
});

describe("regional source eligibility policy", () => {
  it("allows Kalmar regional source for Kalmar region users", () => {
    const item = createAcceptedItem({
      id: "kalmar-local-1",
      url: "https://example.com/kalmar-local-1",
      source: "Kalmar FF officiella nyheter",
    });

    const allowed = isAcceptedItemEligibleForRegionalSource(item, {
      regionKey: "kalmar",
      favoriteEntityIds: new Set<string>(),
      favoriteTokens: new Set<string>(),
      hardNewsItemKeys: new Set<string>(),
    });

    expect(allowed).toBe(true);
  });

  it("allows Kalmar regional source for users outside region with relevant favorite", () => {
    const item = createAcceptedItem({
      id: "kalmar-favorite-1",
      url: "https://example.com/kalmar-favorite-1",
      source: "Kalmar FF officiella nyheter",
    });

    const allowed = isAcceptedItemEligibleForRegionalSource(item, {
      regionKey: "vaxjo",
      favoriteEntityIds: new Set<string>(["football-team-kalmar"]),
      favoriteTokens: new Set<string>(),
      hardNewsItemKeys: new Set<string>(),
    });

    expect(allowed).toBe(true);
  });

  it("allows Nybro regional source when user resolves to Kalmar region", () => {
    const item = createAcceptedItem({
      id: "nybro-local-1",
      url: "https://example.com/nybro-local-1",
      source: "Nybro Vikings officiell",
    });

    const allowed = isAcceptedItemEligibleForRegionalSource(item, {
      regionKey: "kalmar",
      favoriteEntityIds: new Set<string>(),
      favoriteTokens: new Set<string>(),
      hardNewsItemKeys: new Set<string>(),
    });

    expect(allowed).toBe(true);
  });

  it("blocks Kalmar regional source for neutral non-local users without favorites", () => {
    const item = createAcceptedItem({
      id: "kalmar-neutral-1",
      url: "https://example.com/kalmar-neutral-1",
      source: "Kalmar FF officiella nyheter",
    });

    const allowed = isAcceptedItemEligibleForRegionalSource(item, {
      regionKey: "jonkoping",
      favoriteEntityIds: new Set<string>(),
      favoriteTokens: new Set<string>(),
      hardNewsItemKeys: new Set<string>(),
    });

    expect(allowed).toBe(false);
  });

  it("keeps hard-news override for regional source even when user is neutral and non-local", () => {
    const item = createAcceptedItem({
      id: "kalmar-hard-news-1",
      url: "https://example.com/kalmar-hard-news-1",
      source: "Kalmar FF officiella nyheter",
    });

    const allowed = isAcceptedItemEligibleForRegionalSource(item, {
      regionKey: "jonkoping",
      favoriteEntityIds: new Set<string>(),
      favoriteTokens: new Set<string>(),
      hardNewsItemKeys: new Set<string>(["kalmar-hard-news-1"]),
    });

    expect(allowed).toBe(true);
  });

  it("filters regional sources while keeping global sources visible", () => {
    const kalmarRegionalBlocked = createAcceptedItem({
      id: "kalmar-regional-blocked",
      url: "https://example.com/kalmar-regional-blocked",
      source: "Kalmar FF officiella nyheter",
    });

    const globalSource = createAcceptedItem({
      id: "global-source-1",
      url: "https://example.com/global-source-1",
      source: "SVT Sport",
    });

    const filtered = filterAcceptedItemsByRegionalSourceEligibility(
      [kalmarRegionalBlocked, globalSource],
      {
        regionKey: "vaxjo",
        favoriteEntityIds: new Set<string>(),
        favoriteTokens: new Set<string>(),
        hardNewsItemKeys: new Set<string>(),
      },
    );

    expect(filtered.map((item) => item.id)).toEqual(["global-source-1"]);
  });
});
