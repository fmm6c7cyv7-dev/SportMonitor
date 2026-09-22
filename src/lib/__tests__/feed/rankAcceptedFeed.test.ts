// src/lib/__tests__/feed/rankAcceptedFeed.test.ts

import { describe, expect, it } from "vitest";
import {
  balanceFavoriteDensity,
  rankAcceptedFeed,
} from "@/lib/feed/rankAcceptedFeed";
import type { AcceptedItem } from "@/lib/news/newsTypes";

const NOW = Date.parse("2026-09-20T12:00:00.000Z");

function item(
  id: string,
  ageMinutes: number,
  overrides: Partial<AcceptedItem> = {},
): AcceptedItem {
  return {
    id,
    sport: overrides.sport ?? "football",
    title: overrides.title ?? "Alexander Isak scores for Liverpool",
    url: overrides.url ?? `https://example.com/${id}`,
    source: overrides.source ?? "BBC Sport",
    published_at:
      overrides.published_at ??
      new Date(NOW - ageMinutes * 60_000).toISOString(),
    fetched_at: overrides.fetched_at ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 100,
    isFavorite: overrides.isFavorite ?? false,
    isLocal: overrides.isLocal ?? false,
    favorite_match: overrides.favorite_match ?? false,
    favorite_score: overrides.favorite_score ?? 0,
    favorite_match_mode: overrides.favorite_match_mode ?? "none",
    favorite_entity_type: overrides.favorite_entity_type ?? null,
    favorite_entity_id: overrides.favorite_entity_id ?? null,
    favorite_entity_name: overrides.favorite_entity_name ?? null,
    hasSwedishPlayer: overrides.hasSwedishPlayer ?? true,
    isPremierOrAllsvenskan: overrides.isPremierOrAllsvenskan ?? false,
    editorialTier: overrides.editorialTier ?? 1,
    editorialReasons: overrides.editorialReasons ?? ["swedish-player"],
    entities: overrides.entities ?? null,
  };
}

describe("balanceFavoriteDensity", () => {
  it("prevents a favorites-first feed from becoming one long favorite block", () => {
    const favorite = (id: string) =>
      ({
        ...item(id, 30, {
          isFavorite: true,
          favorite_match: true,
          favorite_score: 300,
        }),
        ranking_total: 100,
        is_local: false,
      });

    const regular = (id: string) =>
      ({
        ...item(id, 30, {
          isFavorite: false,
          favorite_match: false,
          favorite_score: 0,
        }),
        ranking_total: 90,
        is_local: false,
      });

    const result = balanceFavoriteDensity([
      favorite("fav-1"),
      favorite("fav-2"),
      favorite("fav-3"),
      favorite("fav-4"),
      regular("regular-1"),
      regular("regular-2"),
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "fav-1",
      "fav-2",
      "regular-1",
      "fav-3",
      "fav-4",
      "regular-2",
    ]);
  });
});

describe("rankAcceptedFeed", () => {
  it("keeps >6h Swedish-core news out of the normal feed", () => {
    const result = rankAcceptedFeed({
      accepted: [
        item("fresh", 45),
        item("stale-core", 7 * 60, {
          priority: 100,
          editorialTier: 1,
          hasSwedishPlayer: true,
        }),
      ],
      sport: "football",
      nowMs: NOW,
      hideRead: false,
      limit: 10,
    });

    expect(result.map((entry) => entry.id)).toEqual(["fresh"]);
  });

  it("uses >6h items only as hide-read backfill when normal slots remain", () => {
    const result = rankAcceptedFeed({
      accepted: [
        item("fresh", 45),
        item("backfill", 7 * 60),
      ],
      sport: "football",
      nowMs: NOW,
      hideRead: true,
      limit: 2,
    });

    expect(result.map((entry) => entry.id)).toEqual(["fresh", "backfill"]);
  });

  it("does not use 72h+ items even for hide-read backfill", () => {
    const result = rankAcceptedFeed({
      accepted: [
        item("fresh", 45),
        item("too-old", 73 * 60),
      ],
      sport: "football",
      nowMs: NOW,
      hideRead: true,
      limit: 2,
    });

    expect(result.map((entry) => entry.id)).toEqual(["fresh"]);
  });

  it("preserves an unread pushed item inside the eligible normal window", () => {
    const pushed = item("pushed", 120, {
      priority: 0,
      title: "Premier League weekend preview",
      hasSwedishPlayer: false,
      editorialTier: 2,
      editorialReasons: ["swedish-related-league"],
    });
    const result = rankAcceptedFeed({
      accepted: [item("fresh", 30), pushed],
      sport: "football",
      nowMs: NOW,
      unreadPushedIds: new Set(["pushed"]),
      hideRead: false,
      limit: 2,
    });

    expect(result.some((entry) => entry.id === "pushed")).toBe(true);
    expect(result[0]?.id).toBe("pushed");
  });

  it("keeps an unread pushed low-score article inside a 12-item visible head", () => {
    const ordinary = Array.from({ length: 20 }, (_, index) =>
      item(`ordinary-${index}`, 5 + index, {
        priority: 100,
        editorialTier: 1,
        hasSwedishPlayer: true,
      }),
    );

    const pushed = item("low-score-pushed", 120, {
      priority: 0,
      title: "Regional football result",
      hasSwedishPlayer: false,
      editorialTier: 3,
      editorialReasons: [],
    });

    const result = rankAcceptedFeed({
      accepted: [...ordinary, pushed],
      sport: "football",
      nowMs: NOW,
      unreadPushedIds: new Set(["low-score-pushed"]),
      hideRead: false,
      limit: 30,
    });

    expect(result.slice(0, 12).some((entry) => entry.id === "low-score-pushed")).toBe(
      true,
    );
  });
});
