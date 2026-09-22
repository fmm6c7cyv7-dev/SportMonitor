import { describe, expect, it } from "vitest";

import {
  filterRouteItemsByFreshness,
  sortRouteItemsHybrid,
} from "@/lib/feed/freshness";
import { buildAcceptedItem } from "@/lib/feed/newsFeedRequest";
import { applyFavoritesFirstPresentation } from "@/lib/feed/rankingPresentation";
import type { RankedFeedItem } from "@/lib/feed/types";
import type {
  EngineFavorite,
  EntityHit,
  NormalizedArticle,
} from "@/lib/news-engine/types";
import type {
  AcceptedItem,
  DbItem,
} from "@/lib/news/newsTypes";
import type { RankingEntity } from "@/lib/ranking/rankingTypes";
import { scoreBaseArticle } from "@/lib/ranking-v2/scoreBase";

const NOW_MS = Date.parse("2026-09-21T12:00:00.000Z");
const PUBLISHED_AT = "2026-09-21T11:30:00.000Z";

function hit(
  name: string,
  overrides: Partial<EntityHit> = {},
): EntityHit {
  return {
    entityId: overrides.entityId ?? `entity-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    sport: overrides.sport ?? "football",
    type: overrides.type ?? "player",
    name,
    confidence: overrides.confidence ?? 0.99,
    isSwedish: overrides.isSwedish,
    isAbroadCore: overrides.isAbroadCore,
    origin: overrides.origin ?? "detected",
  };
}

function article(
  id: string,
  overrides: Partial<NormalizedArticle> = {},
): NormalizedArticle {
  return {
    id,
    sport: overrides.sport ?? "football",
    title: overrides.title ?? "Generic football story",
    url: overrides.url ?? `https://example.com/${id}`,
    source: overrides.source ?? "Example Football",
    publishedAt: overrides.publishedAt ?? PUBLISHED_AT,
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    urgency: overrides.urgency ?? 0,
    canonicalUrl: overrides.canonicalUrl ?? null,
    entityHits: overrides.entityHits ?? [],
    favoriteSignal: overrides.favoriteSignal,
    trustedFavoriteSignal: overrides.trustedFavoriteSignal,
    localSignal: overrides.localSignal,
    bigNewsSignal: overrides.bigNewsSignal,
  };
}

function abroadPlayerArticle(
  overrides: Partial<NormalizedArticle> = {},
): NormalizedArticle {
  return article("abroad", {
    title: "Alexander Isak discusses Liverpool preparations",
    tags: ["Premier League"],
    entityHits: [
      hit("Alexander Isak", {
        entityId: "player-isak",
        type: "player",
        isSwedish: true,
        isAbroadCore: true,
      }),
    ],
    ...overrides,
  });
}

function domesticPlayerArticle(
  overrides: Partial<NormalizedArticle> = {},
): NormalizedArticle {
  return article("domestic", {
    title: "Robin Olsen discusses Malmö preparations",
    tags: [],
    entityHits: [
      hit("Robin Olsen", {
        entityId: "player-robin-olsen",
        type: "player",
        isSwedish: true,
        isAbroadCore: false,
      }),
    ],
    ...overrides,
  });
}

function acceptedItem(
  id: string,
  ageMinutes: number,
  overrides: Partial<AcceptedItem> = {},
): AcceptedItem {
  return {
    id,
    sport: overrides.sport ?? "football",
    title: overrides.title ?? "Generic football story",
    url: overrides.url ?? `https://example.com/${id}`,
    source: overrides.source ?? "Example Football",
    published_at:
      overrides.published_at ??
      new Date(NOW_MS - ageMinutes * 60_000).toISOString(),
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
    favorite_context: overrides.favorite_context ?? false,
    favorite_context_score: overrides.favorite_context_score ?? 0,
    hasSwedishPlayer: overrides.hasSwedishPlayer ?? false,
    isPremierOrAllsvenskan: overrides.isPremierOrAllsvenskan ?? false,
    editorialTier: overrides.editorialTier ?? 3,
    editorialReasons: overrides.editorialReasons ?? [],
    entities: overrides.entities ?? [],
  };
}

function rankedFeedItem(
  id: string,
  ageMinutes: number,
  rankingTotal: number,
  overrides: Partial<AcceptedItem> = {},
): RankedFeedItem {
  const accepted = acceptedItem(id, ageMinutes, overrides);

  return {
    ...accepted,
    ranking_total: rankingTotal,
    is_local: accepted.isLocal,
  };
}

function scoreCore(articleValue: NormalizedArticle, favorites: EngineFavorite[] = []) {
  return scoreBaseArticle(articleValue, {
    nowMs: NOW_MS,
    favorites,
  });
}

describe("SportMonitor core priority regression lock", () => {
  it("CORE-01: Swedish abroad player outranks generic international content with zero favorites", () => {
    const abroad = scoreCore(abroadPlayerArticle());
    const generic = scoreCore(
      article("generic", {
        title: "Real Madrid prepare for weekend fixture",
        tags: ["La Liga"],
      }),
    );

    expect(abroad.scoreComponents.favoriteAffinity).toBe(0);
    expect(abroad.score).toBeGreaterThan(generic.score);
  });

  it("CORE-02A: Swedish abroad player outranks Swedish domestic player with matched context", () => {
    const abroad = scoreCore(
      abroadPlayerArticle({ source: "BBC Sport", tags: [] }),
    );
    const domestic = scoreCore(
      domesticPlayerArticle({ source: "BBC Sport", tags: [] }),
    );

    expect(abroad.score).toBeGreaterThan(domestic.score);
    expect(abroad.scoreComponents.swedishAbroadCore).toBeGreaterThan(0);
    expect(domestic.scoreComponents.swedishAbroadCore).toBe(0);
  });

  it("CORE-02B: realistic full domestic context must not overtake Swedish abroad player", () => {
    const abroad = scoreCore(
      abroadPlayerArticle({
        source: "BBC Sport",
        title: "Alexander Isak discusses Liverpool ahead of Premier League match",
        tags: ["Premier League"],
        entityHits: [
          hit("Alexander Isak", {
            entityId: "player-isak",
            type: "player",
            isSwedish: true,
            isAbroadCore: true,
          }),
          hit("Liverpool", {
            entityId: "team-liverpool",
            type: "team",
            isSwedish: false,
            isAbroadCore: false,
          }),
          hit("Premier League", {
            entityId: "league-premier-league",
            type: "league",
            isSwedish: false,
            isAbroadCore: false,
          }),
        ],
      }),
    );

    const domestic = scoreCore(
      domesticPlayerArticle({
        source: "BBC Sport",
        title: "Robin Olsen discusses Malmö FF ahead of Allsvenskan match",
        tags: ["Allsvenskan"],
        entityHits: [
          hit("Robin Olsen", {
            entityId: "player-robin-olsen",
            type: "player",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Malmö FF", {
            entityId: "team-malmo-ff",
            type: "team",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Allsvenskan", {
            entityId: "league-allsvenskan",
            type: "league",
            isSwedish: true,
            isAbroadCore: false,
          }),
        ],
      }),
    );

    expect(abroad.score).toBe(74);
    expect(domestic.score).toBe(60);
    expect(abroad.score).toBeGreaterThan(domestic.score);
  });

  it("CORE-02C: abroad priority survives an active Swedish-league component", () => {
    const abroad = scoreCore(
      abroadPlayerArticle({
        source: "BBC Sport",
        title: "Alexander Isak discusses Liverpool ahead of Premier League match",
        tags: ["Premier League"],
        entityHits: [
          hit("Alexander Isak", {
            entityId: "player-isak",
            type: "player",
            isSwedish: true,
            isAbroadCore: true,
          }),
          hit("Liverpool", {
            entityId: "team-liverpool",
            type: "team",
            isSwedish: false,
            isAbroadCore: false,
          }),
          hit("Premier League", {
            entityId: "league-premier-league",
            type: "league",
            isSwedish: false,
            isAbroadCore: false,
          }),
        ],
      }),
    );

    const domesticWithLeagueSignal = scoreCore(
      domesticPlayerArticle({
        source: "BBC Sport",
        title: "Robin Olsen discusses Malmö FF ahead of Allsvenskan match",
        tags: ["Allsvenskan"],
        entityHits: [
          hit("Robin Olsen", {
            entityId: "player-robin-olsen",
            type: "player",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Malmö FF", {
            entityId: "team-malmo-ff",
            type: "team",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("allsvenskan", {
            entityId: "league-allsvenskan",
            type: "league",
            isSwedish: true,
            isAbroadCore: false,
          }),
        ],
      }),
    );

    expect(domesticWithLeagueSignal.scoreComponents.swedishLeague).toBe(12);
    expect(abroad.score).toBe(74);
    expect(domesticWithLeagueSignal.score).toBe(72);
    expect(abroad.score).toBeGreaterThan(domesticWithLeagueSignal.score);
  });

  it("CORE-02D: bounded domestic player core remains above generic international fill", () => {
    const domestic = scoreCore(
      domesticPlayerArticle({
        source: "BBC Sport",
        title: "Robin Olsen discusses Malmö FF ahead of Allsvenskan match",
        tags: ["Allsvenskan"],
        entityHits: [
          hit("Robin Olsen", {
            entityId: "player-robin-olsen",
            type: "player",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Malmö FF", {
            entityId: "team-malmo-ff",
            type: "team",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Allsvenskan", {
            entityId: "league-allsvenskan",
            type: "league",
            isSwedish: true,
            isAbroadCore: false,
          }),
        ],
      }),
    );
    const generic = scoreCore(
      article("generic-core-02d", {
        source: "BBC Sport",
        title: "Juventus prepare for weekend fixture",
        tags: ["Serie A"],
      }),
    );

    expect(domestic.score).toBe(60);
    expect(domestic.score).toBeGreaterThan(generic.score);
  });

  it("CORE-02E: Swedish abroad scoring remains exactly unchanged", () => {
    const abroad = scoreCore(
      abroadPlayerArticle({
        source: "BBC Sport",
        title: "Alexander Isak discusses Liverpool ahead of Premier League match",
        tags: ["Premier League"],
        entityHits: [
          hit("Alexander Isak", {
            entityId: "player-isak",
            type: "player",
            isSwedish: true,
            isAbroadCore: true,
          }),
          hit("Liverpool", {
            entityId: "team-liverpool",
            type: "team",
            isSwedish: false,
            isAbroadCore: false,
          }),
          hit("Premier League", {
            entityId: "league-premier-league",
            type: "league",
            isSwedish: false,
            isAbroadCore: false,
          }),
        ],
      }),
    );

    expect(abroad.score).toBe(74);
    expect(abroad.scoreComponents).toMatchObject({
      recency: 18,
      urgency: 0,
      swedishPlayer: 8,
      swedishAbroadCore: 14,
      swedishLeague: 0,
      favoriteAffinity: 0,
      localGeo: 0,
      sourceAuthority: 10,
      sourceLeagueFit: 8,
      sourceCountryFit: 0,
      bigNews: 0,
      eventIntensity: 0,
      priority: 0,
      evergreenPenalty: 0,
      stalenessPenalty: 0,
      duplicatePenalty: 0,
    });
  });

  it("CORE-02F: domestic source components remain unchanged by identity bounding", () => {
    const domestic = scoreCore(
      domesticPlayerArticle({
        source: "BBC Sport",
        title: "Robin Olsen discusses Malmö FF ahead of Allsvenskan match",
        tags: ["Allsvenskan"],
        entityHits: [
          hit("Robin Olsen", {
            entityId: "player-robin-olsen",
            type: "player",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Malmö FF", {
            entityId: "team-malmo-ff",
            type: "team",
            isSwedish: true,
            isAbroadCore: false,
          }),
          hit("Allsvenskan", {
            entityId: "league-allsvenskan",
            type: "league",
            isSwedish: true,
            isAbroadCore: false,
          }),
        ],
      }),
    );

    expect(domestic.score).toBe(60);
    expect(domestic.scoreComponents.sourceAuthority).toBe(10);
    expect(domestic.scoreComponents.sourceLeagueFit).toBe(8);
    expect(domestic.scoreComponents.sourceCountryFit).toBe(4);
  });

  it("CORE-03: Swedish domestic player outranks generic international fill", () => {
    const domestic = scoreCore(domesticPlayerArticle());
    const generic = scoreCore(
      article("generic-domestic-comparison", {
        title: "Juventus prepare for weekend fixture",
        tags: ["Serie A"],
      }),
    );

    expect(domestic.score).toBeGreaterThan(generic.score);
  });

  it("CORE-04 / SOURCE-SAFETY-01: source prestige alone cannot beat Swedish abroad core", () => {
    const abroad = scoreCore(
      abroadPlayerArticle({
        source: "Example Football",
        tags: [],
      }),
    );
    const genericHighAuthority = scoreCore(
      article("generic-high-authority", {
        source: "BBC Sport",
        title: "Manchester City prepare for Premier League fixture",
        tags: ["Premier League"],
      }),
    );

    expect(abroad.score).toBeGreaterThan(genericHighAuthority.score);
  });

  it("CORE-05: zero favorites leaves favorite affinity at zero while Swedish core remains active", () => {
    const ranked = scoreCore(abroadPlayerArticle());

    expect(ranked.scoreComponents.favoriteAffinity).toBe(0);
    expect(ranked.scoreComponents.swedishPlayer).toBeGreaterThan(0);
    expect(ranked.scoreComponents.swedishAbroadCore).toBeGreaterThan(0);
  });

  it("CORE-06: Swedish core cannot bypass the six-hour normal-feed ceiling", () => {
    const staleCore = rankedFeedItem("stale-core", 7 * 60, 300, {
      hasSwedishPlayer: true,
      editorialTier: 1,
    });
    const freshGeneric = rankedFeedItem("fresh-generic", 30, 10);

    const result = filterRouteItemsByFreshness(
      [staleCore, freshGeneric],
      NOW_MS,
      6,
    );

    expect(result.map((item) => item.id)).toEqual(["fresh-generic"]);
  });

  it("CORE-07: strong core may jump one adjacent bucket but never two", () => {
    const fresherGeneric = rankedFeedItem("fresh", 20, 20);
    const adjacentCore = rankedFeedItem("adjacent-core", 55, 50, {
      hasSwedishPlayer: true,
      editorialTier: 1,
    });
    const twoBucketsOlderCore = rankedFeedItem("two-buckets-core", 120, 300, {
      hasSwedishPlayer: true,
      editorialTier: 1,
    });

    const adjacentResult = sortRouteItemsHybrid(
      [fresherGeneric, adjacentCore],
      NOW_MS,
      false,
    );
    const twoBucketResult = sortRouteItemsHybrid(
      [fresherGeneric, twoBucketsOlderCore],
      NOW_MS,
      false,
    );

    expect(adjacentResult.map((item) => item.id)).toEqual([
      "adjacent-core",
      "fresh",
    ]);
    expect(twoBucketResult.map((item) => item.id)).toEqual([
      "fresh",
      "two-buckets-core",
    ]);
  });

  it("CORE-08: canonical Swedish player survives route classification when only surname is visible", () => {
    const item: DbItem = {
      id: "core-08",
      sport: "football",
      title: "Isak kritiseras efter succén",
      url: "https://example.com/core-08",
      source: "BBC Sport",
      published_at: PUBLISHED_AT,
      tags: ["Premier League"],
      priority: 0,
    };

    const canonicalIsak: RankingEntity = {
      id: "player-isak",
      name: "Alexander Isak",
      type: "player",
      sport: "football",
      nationality: "Sweden",
      league: "Premier League",
      is_swedish: true,
      is_abroad: true,
    };

    const accepted = buildAcceptedItem({
      item,
      allFavoriteTokens: [],
      favoriteMatchByNewsId: new Map(),
      favoriteContextByNewsId: new Map(),
      directFavoriteEntityMetaById: new Map(),
      newsEntityIdsByNewsId: new Map([["core-08", ["player-isak"]]]),
      newsEntitiesByNewsId: new Map([["core-08", [canonicalIsak]]]),
      geoActiveRegion: null,
      normalizedTitle: "isak kritiseras efter succén",
    });

    expect(accepted.hasSwedishPlayer).toBe(true);
    expect(accepted.editorialTier).toBe(1);
    expect(accepted.editorialReasons).toContain("swedish-player");
  });

  it("CORE-08 guard: a visible different player prevents surname-shadow contamination", () => {
    const item: DbItem = {
      id: "core-08-shadow",
      sport: "football",
      title: "Isak Petrovic hyllas efter Atalantas seger",
      url: "https://example.com/core-08-shadow",
      source: "BBC Sport",
      published_at: PUBLISHED_AT,
      tags: [],
      priority: 0,
    };

    const pollutedIsak: RankingEntity = {
      id: "player-isak",
      name: "Alexander Isak",
      type: "player",
      sport: "football",
      is_swedish: true,
      is_abroad: true,
    };
    const hien: RankingEntity = {
      id: "player-isak-petrovic",
      name: "Isak Petrovic",
      type: "player",
      sport: "football",
      is_swedish: false,
      is_abroad: true,
    };

    const accepted = buildAcceptedItem({
      item,
      allFavoriteTokens: [],
      favoriteMatchByNewsId: new Map(),
      favoriteContextByNewsId: new Map(),
      directFavoriteEntityMetaById: new Map(),
      newsEntityIdsByNewsId: new Map([
        ["core-08-shadow", ["player-isak", "player-isak-petrovic"]],
      ]),
      newsEntitiesByNewsId: new Map([
        ["core-08-shadow", [pollutedIsak, hien]],
      ]),
      geoActiveRegion: null,
      normalizedTitle: "isak petrovic hyllas efter atalantas seger",
    });

    expect(accepted.hasSwedishPlayer).toBe(false);
  });

  it("FAV-CORE-01/02: favorites change favorite affinity, not Swedish core components", () => {
    const baseArticle = abroadPlayerArticle();
    const noFavorites = scoreCore(baseArticle);
    const unrelatedFavorite: EngineFavorite = {
      entityId: "team-manchester-united",
      sport: "football",
      type: "team",
      label: "Manchester United",
    };
    const directFavorite: EngineFavorite = {
      entityId: "player-isak",
      sport: "football",
      type: "player",
      label: "Alexander Isak",
    };

    const unrelated = scoreCore(baseArticle, [unrelatedFavorite]);
    const direct = scoreCore(baseArticle, [directFavorite]);

    for (const ranked of [unrelated, direct]) {
      expect(ranked.scoreComponents.swedishPlayer).toBe(
        noFavorites.scoreComponents.swedishPlayer,
      );
      expect(ranked.scoreComponents.swedishAbroadCore).toBe(
        noFavorites.scoreComponents.swedishAbroadCore,
      );
      expect(ranked.scoreComponents.swedishLeague).toBe(
        noFavorites.scoreComponents.swedishLeague,
      );
    }

    expect(unrelated.scoreComponents.favoriteAffinity).toBe(0);
    expect(direct.scoreComponents.favoriteAffinity).toBeGreaterThan(0);
  });

  it("FAV-CORE-03/04/05: context is not direct and favorites-first is only a stable partition", () => {
    const core = rankedFeedItem("core", 20, 100, {
      hasSwedishPlayer: true,
      editorialTier: 1,
    });
    const context = rankedFeedItem("context", 20, 90, {
      favorite_context: true,
      favorite_context_score: 6,
      favorite_match: false,
      isFavorite: false,
    });
    const direct = rankedFeedItem("direct", 20, 80, {
      favorite_match: true,
      isFavorite: true,
      favorite_score: 300,
      favorite_match_mode: "entity",
      favorite_entity_type: "player",
      favorite_entity_id: "player-isak",
      favorite_entity_name: "Alexander Isak",
    });

    const canonical = [core, context, direct];
    const off = applyFavoritesFirstPresentation(canonical, false);
    const on = applyFavoritesFirstPresentation(canonical, true);

    expect(off.map((item) => item.id)).toEqual(["core", "context", "direct"]);
    expect(on.map((item) => item.id)).toEqual(["direct", "core", "context"]);
    expect(on.find((item) => item.id === "context")?.favorite_match).toBe(false);

    const offById = new Map(off.map((item) => [item.id, item]));
    for (const item of on) {
      const baseline = offById.get(item.id);
      expect(item.ranking_total).toBe(baseline?.ranking_total);
      expect(item.hasSwedishPlayer).toBe(baseline?.hasSwedishPlayer);
      expect(item.editorialTier).toBe(baseline?.editorialTier);
      expect(item.favorite_match).toBe(baseline?.favorite_match);
      expect(item.favorite_context).toBe(baseline?.favorite_context);
      expect(item.favorite_score).toBe(baseline?.favorite_score);
      expect(item.favorite_entity_id).toBe(baseline?.favorite_entity_id);
    }
  });
});
