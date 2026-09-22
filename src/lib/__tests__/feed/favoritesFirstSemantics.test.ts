import { describe, expect, it } from "vitest";

import {
  applyFavoritesFirstPresentation,
  mergeRankedArticlesIntoAccepted,
} from "@/lib/feed/rankingPresentation";
import { toNormalizedArticle } from "@/lib/news-engine/candidateLoader";
import type {
  EngineFavorite,
  NormalizedArticle,
  RankedArticle,
} from "@/lib/news-engine/types";
import type { AcceptedItem } from "@/lib/news/newsTypes";
import { scoreBaseArticle } from "@/lib/ranking-v2/scoreBase";

const NOW_MS = Date.parse("2026-09-21T10:00:00.000Z");

const ISAK_FAVORITE: EngineFavorite = {
  entityId: "player-isak",
  sport: "football",
  type: "player",
  label: "Alexander Isak",
};

function acceptedItem(
  id: string,
  overrides: Partial<AcceptedItem> = {},
): AcceptedItem {
  return {
    id,
    sport: "football",
    title: overrides.title ?? "Generic football story",
    url: overrides.url ?? `https://example.com/${id}`,
    source: overrides.source ?? "BBC Sport",
    published_at: overrides.published_at ?? "2026-09-21T09:30:00.000Z",
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

function rankedArticle(
  id: string,
  favoriteMatched: boolean,
): RankedArticle {
  return {
    id,
    sport: "football",
    title: "Ranked article",
    url: `https://example.com/${id}`,
    source: "BBC Sport",
    publishedAt: "2026-09-21T09:30:00.000Z",
    summary: null,
    tags: [],
    priority: 0,
    urgency: 0,
    entityHits: [],
    favoriteSignal: {
      score: favoriteMatched ? 18 : 0,
      matched: favoriteMatched,
      matchedFavoriteIds: favoriteMatched ? ["player-isak"] : [],
      reasons: favoriteMatched ? ["raw-entity-hit"] : [],
    },
    score: 42,
    scoreComponents: {
      recency: 18,
      urgency: 0,
      swedishPlayer: 0,
      swedishAbroadCore: 0,
      swedishLeague: 0,
      favoriteAffinity: favoriteMatched ? 18 : 0,
      localGeo: 0,
      sourceAuthority: 8,
      sourceLeagueFit: 0,
      sourceCountryFit: 0,
      bigNews: 0,
      eventIntensity: 0,
      priority: 0,
      evergreenPenalty: 0,
      stalenessPenalty: 0,
      duplicatePenalty: 0,
    },
  };
}

function normalizedForScore(args: {
  id: string;
  title: string;
  favoriteMatch?: boolean;
  favoriteContext?: boolean;
  favoriteContextScore?: number;
  favoriteEntityType?: "player" | "team" | "league" | "staff";
  favoriteEntityId?: string;
  entities?: Array<{
    id?: string;
    name?: string;
    type?: "player" | "team" | "league" | "staff";
    sport?: "football" | "hockey";
    is_swedish?: boolean;
    is_abroad?: boolean;
  }>;
}): NormalizedArticle {
  return toNormalizedArticle(
    {
      id: args.id,
      sport: "football",
      title: args.title,
      url: `https://example.com/${args.id}`,
      source: "BBC Sport",
      published_at: "2026-09-21T09:30:00.000Z",
      tags: [],
      priority: 0,
      entities: args.entities ?? [],
      favorite_match: args.favoriteMatch ?? false,
      favorite_context: args.favoriteContext ?? false,
      favorite_context_score: args.favoriteContextScore ?? 0,
      favorite_entity_type: args.favoriteEntityType ?? null,
      favorite_entity_id: args.favoriteEntityId ?? null,
    },
    { sport: "football" },
  );
}

describe("favorites-first semantic invariants", () => {
  it("never lets ranked favoriteSignal manufacture a visible favorite badge", () => {
    const original = acceptedItem("context", {
      title: "Liverpool prepare for another major match",
      favorite_match: false,
      isFavorite: false,
      favorite_context: true,
      favorite_context_score: 6,
    });

    const [merged] = mergeRankedArticlesIntoAccepted(
      [original],
      [rankedArticle("context", true)],
      "football",
    );

    expect(merged.favorite_match).toBe(false);
    expect(merged.isFavorite).toBe(false);
    expect(merged.favorite_entity_id).toBeNull();
    expect(merged.favorite_entity_name).toBeNull();
    expect(merged.favorite_match_mode).toBe("none");
    expect(merged.favorite_context).toBe(true);
  });

  it("preserves a validated direct favorite exactly through ranking presentation", () => {
    const original = acceptedItem("direct-isak", {
      title: "Isak kritiseras efter succén",
      favorite_match: true,
      isFavorite: true,
      favorite_score: 300,
      favorite_match_mode: "entity",
      favorite_entity_type: "player",
      favorite_entity_id: "player-isak",
      favorite_entity_name: "Alexander Isak",
    });

    const [merged] = mergeRankedArticlesIntoAccepted(
      [original],
      [rankedArticle("direct-isak", false)],
      "football",
    );

    expect(merged.favorite_match).toBe(true);
    expect(merged.isFavorite).toBe(true);
    expect(merged.favorite_score).toBe(300);
    expect(merged.favorite_match_mode).toBe("entity");
    expect(merged.favorite_entity_id).toBe("player-isak");
    expect(merged.favorite_entity_name).toBe("Alexander Isak");
  });

  it("does not create favorite metadata when no AcceptedItem exists", () => {
    const [merged] = mergeRankedArticlesIntoAccepted(
      [],
      [rankedArticle("ranked-only", true)],
      "football",
    );

    expect(merged.favorite_match).toBe(false);
    expect(merged.isFavorite).toBe(false);
    expect(merged.favorite_score).toBe(0);
    expect(merged.favorite_match_mode).toBe("none");
    expect(merged.favorite_entity_id).toBeNull();
    expect(merged.favorite_entity_name).toBeNull();
  });

  it("uses validated direct/context decisions instead of polluted entity hits", () => {
    const pollutedIsakEntity = [
      {
        id: "player-isak",
        name: "Alexander Isak",
        type: "player" as const,
        sport: "football" as const,
        is_swedish: true,
        is_abroad: true,
      },
    ];

    const unrelated = normalizedForScore({
      id: "juventus-atalanta",
      title: "Juventus claim first home win over Atalanta since 2018",
      entities: pollutedIsakEntity,
    });

    const context = normalizedForScore({
      id: "liverpool-context",
      title: "Liverpool star faces fresh transfer decision",
      favoriteContext: true,
      favoriteContextScore: 6,
      entities: pollutedIsakEntity,
    });

    const direct = normalizedForScore({
      id: "direct-isak",
      title: "Isak kritiseras efter succén",
      favoriteMatch: true,
      favoriteEntityType: "player",
      favoriteEntityId: "player-isak",
      entities: pollutedIsakEntity,
    });

    const unrelatedRanked = scoreBaseArticle(unrelated, {
      nowMs: NOW_MS,
      favorites: [ISAK_FAVORITE],
    });
    const contextRanked = scoreBaseArticle(context, {
      nowMs: NOW_MS,
      favorites: [ISAK_FAVORITE],
    });
    const directRanked = scoreBaseArticle(direct, {
      nowMs: NOW_MS,
      favorites: [ISAK_FAVORITE],
    });

    expect(unrelatedRanked.scoreComponents.favoriteAffinity).toBe(0);
    expect(unrelatedRanked.favoriteSignal?.matched).toBe(false);

    expect(contextRanked.scoreComponents.favoriteAffinity).toBe(6);
    expect(contextRanked.favoriteSignal?.matched).toBe(false);
    expect(contextRanked.favoriteSignal?.reasons).toContain(
      "trusted-related-context",
    );

    expect(directRanked.scoreComponents.favoriteAffinity).toBe(18);
    expect(directRanked.favoriteSignal?.matched).toBe(true);
    expect(directRanked.favoriteSignal?.reasons).toContain(
      "trusted-direct-favorite",
    );
  });

  it("keeps favorite relevance in the canonical engine independent of presentation mode", () => {
    const direct = normalizedForScore({
      id: "direct-no-urgency",
      title: "Alexander Isak discusses Liverpool",
      favoriteMatch: true,
      favoriteEntityType: "player",
      favoriteEntityId: "player-isak",
    });

    expect(direct.urgency).toBe(0);

    const ranked = scoreBaseArticle(direct, {
      nowMs: NOW_MS,
      favorites: [ISAK_FAVORITE],
    });

    expect(ranked.scoreComponents.favoriteAffinity).toBe(18);
    expect(ranked.favoriteSignal?.matched).toBe(true);
  });

  it("favorites-first is a stable presentation partition with identical metadata and scores", () => {
    const canonical = [
      {
        ...acceptedItem("swedish-core", {
          title: "Swedish core story",
        }),
        ranking_total: 100,
        is_local: false,
      },
      {
        ...acceptedItem("isak-direct", {
          title: "Isak kritiseras efter succén",
          isFavorite: true,
          favorite_match: true,
          favorite_score: 300,
          favorite_match_mode: "entity",
          favorite_entity_type: "player",
          favorite_entity_id: "player-isak",
          favorite_entity_name: "Alexander Isak",
        }),
        ranking_total: 95,
        is_local: false,
      },
      {
        ...acceptedItem("liverpool-context", {
          title: "Liverpool teammate story",
          favorite_context: true,
          favorite_context_score: 6,
        }),
        ranking_total: 90,
        is_local: false,
      },
      {
        ...acceptedItem("man-utd-direct", {
          title: "Manchester United story",
          isFavorite: true,
          favorite_match: true,
          favorite_score: 200,
          favorite_match_mode: "entity",
          favorite_entity_type: "team",
          favorite_entity_id: "team-manchester-united",
          favorite_entity_name: "Manchester United",
        }),
        ranking_total: 85,
        is_local: false,
      },
      {
        ...acceptedItem("juventus-atalanta", {
          title: "Juventus claim first home win over Atalanta since 2018",
        }),
        ranking_total: 80,
        is_local: false,
      },
    ];

    const off = applyFavoritesFirstPresentation(canonical, false);
    const on = applyFavoritesFirstPresentation(canonical, true);

    expect(off.map((item) => item.id)).toEqual([
      "swedish-core",
      "isak-direct",
      "liverpool-context",
      "man-utd-direct",
      "juventus-atalanta",
    ]);

    expect(on.map((item) => item.id)).toEqual([
      "isak-direct",
      "man-utd-direct",
      "swedish-core",
      "liverpool-context",
      "juventus-atalanta",
    ]);

    const offById = new Map(off.map((item) => [item.id, item]));

    for (const item of on) {
      const baseline = offById.get(item.id);
      expect(baseline).toBeDefined();
      expect(item.ranking_total).toBe(baseline?.ranking_total);
      expect(item.favorite_match).toBe(baseline?.favorite_match);
      expect(item.isFavorite).toBe(baseline?.isFavorite);
      expect(item.favorite_context).toBe(baseline?.favorite_context);
      expect(item.favorite_score).toBe(baseline?.favorite_score);
      expect(item.favorite_entity_id).toBe(baseline?.favorite_entity_id);
      expect(item.favorite_entity_name).toBe(baseline?.favorite_entity_name);
      expect(item.favorite_match_mode).toBe(baseline?.favorite_match_mode);
    }

    expect(on[0].favorite_entity_name).toBe("Alexander Isak");
    expect(on[1].favorite_entity_name).toBe("Manchester United");
    expect(on[2].favorite_match).toBe(false);
    expect(on[3].favorite_context).toBe(true);
    expect(on[3].favorite_match).toBe(false);
    expect(on[4].favorite_match).toBe(false);
    expect(on[4].favorite_context).toBe(false);
  });
});
