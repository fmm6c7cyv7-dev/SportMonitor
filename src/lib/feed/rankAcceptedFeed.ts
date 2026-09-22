// src/lib/feed/rankAcceptedFeed.ts

import {
  HIDE_READ_BACKFILL_MAX_AGE_HOURS,
  NORMAL_FEED_MAX_AGE_HOURS,
  FRESH_WINDOW_MAX_AGE_HOURS,
  filterRouteItemsByFreshness,
  sortRouteItemsHybrid,
  splitAcceptedItemsByFreshness,
} from "@/lib/feed/freshness";
import {
  ensureUnreadPushedItemsStayInFlow,
  mergeRankedArticlesIntoAccepted,
} from "@/lib/feed/rankingPresentation";
import type { RankedFeedItem } from "@/lib/feed/types";
import {
  buildHardNewsArticleIds,
  loadPipelineCandidatesFromAccepted,
} from "@/lib/news-engine/candidateLoader";
import { runRankingPipeline } from "@/lib/news-engine/pipeline";
import type {
  EngineFavorite,
  EngineGeoContext,
  EngineSport,
} from "@/lib/news-engine/types";
import type { AcceptedItem } from "@/lib/news/newsTypes";

export type RankAcceptedFeedInput = {
  accepted: AcceptedItem[];
  sport: EngineSport;
  nowMs: number;
  favorites?: EngineFavorite[];
  geo?: EngineGeoContext | null;
  unreadPushedIds?: Set<string>;
  hideRead: boolean;
  limit: number;
};

function filterUnreadPushedIds(
  accepted: AcceptedItem[],
  unreadPushedIds: Set<string>,
): Set<string> {
  return new Set(
    accepted
      .map((item) => item.id)
      .filter(
        (id): id is string =>
          typeof id === "string" &&
          id.length > 0 &&
          unreadPushedIds.has(id),
      ),
  );
}


const MAX_CONSECUTIVE_FAVORITES = 2;
const FAVORITE_BALANCE_LOOKAHEAD = 8;

function isFavoriteItem(item: RankedFeedItem): boolean {
  return item.favorite_match === true || item.isFavorite === true;
}

/**
 * Favorites-first may boost favorite articles, but it must not collapse the
 * column into one favorite-only block. Preserve the ranked order unless two
 * favorites have already been shown and a non-favorite candidate is available
 * nearby.
 */
export function balanceFavoriteDensity(
  items: RankedFeedItem[],
): RankedFeedItem[] {
  const queue = [...items];
  const result: RankedFeedItem[] = [];
  let favoriteStreak = 0;

  while (queue.length > 0) {
    let chosenIndex = 0;

    if (
      favoriteStreak >= MAX_CONSECUTIVE_FAVORITES &&
      isFavoriteItem(queue[0])
    ) {
      const maxIndex = Math.min(
        FAVORITE_BALANCE_LOOKAHEAD,
        queue.length - 1,
      );

      for (let index = 1; index <= maxIndex; index += 1) {
        if (!isFavoriteItem(queue[index])) {
          chosenIndex = index;
          break;
        }
      }
    }

    const [chosen] = queue.splice(chosenIndex, 1);
    result.push(chosen);
    favoriteStreak = isFavoriteItem(chosen) ? favoriteStreak + 1 : 0;
  }

  return result;
}

function rankAcceptedSlice(args: {
  accepted: AcceptedItem[];
  sport: EngineSport;
  nowMs: number;
  favorites: EngineFavorite[];
  geo: EngineGeoContext | null;
  unreadPushedIds: Set<string>;
  limit: number;
}): RankedFeedItem[] {
  const {
    accepted,
    sport,
    nowMs,
    favorites,
    geo,
    unreadPushedIds,
    limit,
  } = args;

  const candidates = loadPipelineCandidatesFromAccepted(accepted, { sport });
  const hardNewsArticleIds = buildHardNewsArticleIds(accepted);

  const rankedArticles = runRankingPipeline(candidates, {
    sport,
    nowMs,
    favorites,
    geo,
    hardNewsArticleIds,
    limit,
  });

  const merged = mergeRankedArticlesIntoAccepted(
    accepted,
    rankedArticles,
    sport,
  );

  return ensureUnreadPushedItemsStayInFlow({
    returned: merged,
    accepted,
    unreadPushedIds,
    limit,
    sport,
  });
}

/**
 * Pure feed-serving motor for already accepted candidates.
 *
 * Freshness remains a hard outer guardrail around ranking. The engine may
 * improve relevance inside eligible windows, but it cannot re-admit stale
 * normal-feed items.
 */
export function rankAcceptedFeed(
  input: RankAcceptedFeedInput,
): RankedFeedItem[] {
  const favorites = input.favorites ?? [];
  const favoriteBoostEnabled = favorites.length > 0;
  const geo = input.geo ?? null;
  const unreadPushedIds = input.unreadPushedIds ?? new Set<string>();

  const freshnessSplit = splitAcceptedItemsByFreshness(
    input.accepted,
    input.nowMs,
    FRESH_WINDOW_MAX_AGE_HOURS,
    NORMAL_FEED_MAX_AGE_HOURS,
    HIDE_READ_BACKFILL_MAX_AGE_HOURS,
  );

  const normalFeedAccepted = [
    ...freshnessSplit.fresh,
    ...freshnessSplit.fallback,
  ];

  const normalBeforeSort = rankAcceptedSlice({
    accepted: normalFeedAccepted,
    sport: input.sport,
    nowMs: input.nowMs,
    favorites,
    geo,
    unreadPushedIds: filterUnreadPushedIds(
      normalFeedAccepted,
      unreadPushedIds,
    ),
    limit: input.limit,
  });

  const sortedWithin6h = sortRouteItemsHybrid(
    filterRouteItemsByFreshness(
      normalBeforeSort,
      input.nowMs,
      NORMAL_FEED_MAX_AGE_HOURS,
    ),
    input.nowMs,
    favoriteBoostEnabled,
  );

  // If SportMonitor has just pushed an unread article, keep it inside the
  // visible head of the feed after ranking/sorting. Otherwise dispatch can
  // verify inclusion in the API's top 30 while the default UI only shows 12.
  const densityBalancedWithin6h = favoriteBoostEnabled
    ? balanceFavoriteDensity(sortedWithin6h)
    : sortedWithin6h;

  const returnedWithin6h = ensureUnreadPushedItemsStayInFlow({
    returned: densityBalancedWithin6h,
    accepted: normalFeedAccepted,
    unreadPushedIds: filterUnreadPushedIds(
      normalFeedAccepted,
      unreadPushedIds,
    ),
    limit: input.limit,
    sport: input.sport,
  });

  if (
    !input.hideRead ||
    returnedWithin6h.length >= input.limit ||
    freshnessSplit.backfill.length === 0
  ) {
    return returnedWithin6h;
  }

  const remainingLimit = input.limit - returnedWithin6h.length;
  const backfillAccepted = freshnessSplit.backfill;

  const backfillBeforeSort = rankAcceptedSlice({
    accepted: backfillAccepted,
    sport: input.sport,
    nowMs: input.nowMs,
    favorites,
    geo,
    unreadPushedIds: filterUnreadPushedIds(
      backfillAccepted,
      unreadPushedIds,
    ),
    limit: remainingLimit,
  });

  const sortedBackfill = sortRouteItemsHybrid(
    backfillBeforeSort,
    input.nowMs,
    favoriteBoostEnabled,
  );

  const densityBalancedBackfill = favoriteBoostEnabled
    ? balanceFavoriteDensity(sortedBackfill)
    : sortedBackfill;

  return [...returnedWithin6h, ...densityBalancedBackfill]
    .slice(0, input.limit);
}
