// src/lib/feed/rankingPresentation.ts

import { classifyEditorialRelevance } from "@/lib/classification/editorialRelevance";
import type { RankedFeedItem } from "@/lib/feed/types";
import type {
  EngineSport,
  RankedArticle,
} from "@/lib/news-engine/types";
import type { AcceptedItem } from "@/lib/news/newsTypes";

export function mergeRankedArticlesIntoAccepted(
  accepted: AcceptedItem[],
  rankedArticles: RankedArticle[],
  sport: EngineSport,
): RankedFeedItem[] {
  const acceptedByKey = new Map<string, AcceptedItem>();

  for (const item of accepted) {
    acceptedByKey.set(item.id ?? item.url, item);
  }

  const merged: RankedFeedItem[] = [];

  for (const ranked of rankedArticles) {
    const original = acceptedByKey.get(ranked.id ?? ranked.url);
    const rankedLocalMatched = ranked.localSignal?.matched ?? false;

    if (!original) {
      // A ranked candidate without its validated AcceptedItem has no reliable
      // favorite metadata. Do not manufacture an unmarked article in the feed.
      continue;
    }

    const originalLocalMatched =
      original.isLocal === true ||
      (original as RankedFeedItem).is_local === true;

    const mergedLocalMatched = originalLocalMatched || rankedLocalMatched;

    // Direct favorite metadata is owned by the validated AcceptedItem.
    // Ranking may change position, but it must never manufacture or rewrite
    // visible favorite semantics.
    merged.push({
      ...original,
      sport,
      isLocal: mergedLocalMatched,
      ranking_total: ranked.score,
      is_local: mergedLocalMatched,
    });
  }

  return merged.filter((item) => item.sport === sport);
}

/**
 * Presentation-only favorites-first mode.
 *
 * The ranking engine has already produced the canonical order. This helper
 * performs a stable partition only: direct favorites first, then everything
 * else. It must never change scores or article metadata.
 */
export function applyFavoritesFirstPresentation(
  items: RankedFeedItem[],
  enabled: boolean,
): RankedFeedItem[] {
  if (!enabled) {
    return [...items];
  }

  const directFavorites: RankedFeedItem[] = [];
  const others: RankedFeedItem[] = [];

  for (const item of items) {
    if (item.favorite_match === true) {
      directFavorites.push(item);
    } else {
      others.push(item);
    }
  }

  return [...directFavorites, ...others];
}

function buildForcedRouteItem(
  item: AcceptedItem,
  sport: EngineSport,
): RankedFeedItem {
  return {
    ...item,
    sport,
    ranking_total: item.priority ?? 0,
    is_local: item.isLocal,
  };
}

export function ensureUnreadPushedItemsStayInFlow(args: {
  returned: RankedFeedItem[];
  accepted: AcceptedItem[];
  unreadPushedIds: Set<string>;
  limit: number;
  sport: EngineSport;
}): RankedFeedItem[] {
  const { returned, accepted, unreadPushedIds, limit, sport } = args;

  if (!unreadPushedIds.size) {
    return returned.slice(0, limit);
  }

  const acceptedById = new Map<string, AcceptedItem>();
  for (const item of accepted) {
    if (item.id) {
      acceptedById.set(item.id, item);
    }
  }

  const forcedItems = Array.from(unreadPushedIds)
    .map((id) => acceptedById.get(id))
    .filter((item): item is AcceptedItem => Boolean(item))
    .sort((a, b) => {
      const bTime = new Date(b.published_at ?? 0).getTime();
      const aTime = new Date(a.published_at ?? 0).getTime();

      return bTime - aTime;
    })
    .map((item) => buildForcedRouteItem(item, sport));

  const merged: RankedFeedItem[] = [];
  const seenIds = new Set<string>();

  for (const item of forcedItems) {
    const key = item.id ?? item.url;
    if (!key || seenIds.has(key)) continue;

    merged.push(item);
    seenIds.add(key);
  }

  for (const item of returned) {
    const key = item.id ?? item.url;
    if (!key || seenIds.has(key)) continue;

    merged.push(item);
    seenIds.add(key);
  }

  return merged.slice(0, limit);
}
