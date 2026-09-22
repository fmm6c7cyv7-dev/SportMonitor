// src/lib/feed/freshness.ts

import type { AcceptedItem } from "@/lib/news/newsTypes";
import type { RankedFeedItem } from "@/lib/feed/types";

/**
 * NON-REGRESSION: editorial relevance must stay inside these freshness limits.
 * See docs/PRODUCT_CORE.md and docs/RANKING_SYSTEM.md before changing them.
 */
export const FRESH_WINDOW_MAX_AGE_HOURS = 3;
export const NORMAL_FEED_MAX_AGE_HOURS = 6;
export const HIDE_READ_BACKFILL_MAX_AGE_HOURS = 72;

export const FRESHNESS_BUCKET_1_MAX_MINUTES = 30;
export const FRESHNESS_BUCKET_2_MAX_MINUTES = 90;
export const FRESHNESS_BUCKET_3_MAX_MINUTES = 180;
export const FRESHNESS_BUCKET_4_MAX_MINUTES = 360;

export const CORE_BUCKET_JUMP_THRESHOLD = 20;
export const CORE_BUCKET_JUMP_MARGIN = 18;

export function getPublishedAtMs(
  publishedAt: string | null | undefined,
): number | null {
  if (!publishedAt || typeof publishedAt !== "string") {
    return null;
  }

  const parsedMs = Date.parse(publishedAt);

  if (!Number.isFinite(parsedMs)) {
    return null;
  }

  return parsedMs;
}

export function getArticleAgeHours(
  publishedAt: string | null | undefined,
  nowMs: number,
): number | null {
  const publishedAtMs = getPublishedAtMs(publishedAt);

  if (publishedAtMs == null) {
    return null;
  }

  const ageMs = nowMs - publishedAtMs;

  if (!Number.isFinite(ageMs) || ageMs < 0) {
    return 0;
  }

  return ageMs / (60 * 60_000);
}

export function getArticleAgeMinutes(
  publishedAt: string | null | undefined,
  nowMs: number,
): number | null {
  const ageHours = getArticleAgeHours(publishedAt, nowMs);

  if (ageHours == null) {
    return null;
  }

  return ageHours * 60;
}

export function filterAcceptedItemsByFreshness(
  accepted: AcceptedItem[],
  nowMs: number,
  maxAgeHours = NORMAL_FEED_MAX_AGE_HOURS,
): AcceptedItem[] {
  return accepted.filter((item) => {
    const ageHours = getArticleAgeHours(item.published_at, nowMs);

    if (ageHours == null) {
      return false;
    }

    return ageHours <= maxAgeHours;
  });
}

export function splitAcceptedItemsByFreshness(
  accepted: AcceptedItem[],
  nowMs: number,
  freshMaxAgeHours = FRESH_WINDOW_MAX_AGE_HOURS,
  fallbackMaxAgeHours = NORMAL_FEED_MAX_AGE_HOURS,
  backfillMaxAgeHours = HIDE_READ_BACKFILL_MAX_AGE_HOURS,
): {
  fresh: AcceptedItem[];
  fallback: AcceptedItem[];
  backfill: AcceptedItem[];
} {
  const fresh: AcceptedItem[] = [];
  const fallback: AcceptedItem[] = [];
  const backfill: AcceptedItem[] = [];

  for (const item of accepted) {
    const ageHours = getArticleAgeHours(item.published_at, nowMs);

    if (ageHours == null) {
      continue;
    }

    if (ageHours <= freshMaxAgeHours) {
      fresh.push(item);
      continue;
    }

    if (ageHours <= fallbackMaxAgeHours) {
      fallback.push(item);
      continue;
    }

    if (ageHours <= backfillMaxAgeHours) {
      backfill.push(item);
    }
  }

  return { fresh, fallback, backfill };
}

function getFreshnessBucketIndex(
  publishedAt: string | null | undefined,
  nowMs: number,
): number {
  const ageMinutes = getArticleAgeMinutes(publishedAt, nowMs);

  if (ageMinutes == null) {
    return 99;
  }

  if (ageMinutes <= FRESHNESS_BUCKET_1_MAX_MINUTES) return 0;
  if (ageMinutes <= FRESHNESS_BUCKET_2_MAX_MINUTES) return 1;
  if (ageMinutes <= FRESHNESS_BUCKET_3_MAX_MINUTES) return 2;
  if (ageMinutes <= FRESHNESS_BUCKET_4_MAX_MINUTES) return 3;

  return 4;
}

function getRouteCoreBoost(
  item: RankedFeedItem,
  favoriteBoostEnabled: boolean,
): number {
  let boost = 0;

  const priority = item.priority ?? 0;

  if (priority >= 90) {
    boost += 24;
  } else if (priority >= 80) {
    boost += 18;
  } else if (priority >= 50) {
    boost += 10;
  }

  if (favoriteBoostEnabled && (item.favorite_match || item.isFavorite)) {
    boost += 16;
  } else if (favoriteBoostEnabled && item.favorite_context === true) {
    // Related context is useful personalization, but it is not a direct
    // favorite hit and must remain below the direct favorite boost.
    boost += Math.max(0, item.favorite_context_score ?? 6);
  }

  if (item.isLocal || item.is_local) {
    boost += 14;
  }

  if (item.hasSwedishPlayer) {
    boost += 12;
  }

  if (item.editorialTier === 1) {
    boost += 12;
  } else if (item.editorialTier === 2) {
    boost += 6;
  } else if (
    item.editorialTier == null &&
    item.isPremierOrAllsvenskan
  ) {
    // Legacy fallback for synthetic/older accepted items that do not carry
    // the canonical editorial tier yet.
    boost += 8;
  }

  return boost;
}

function getHybridRouteScore(
  item: RankedFeedItem,
  favoriteBoostEnabled: boolean,
): number {
  return (
    (item.ranking_total ?? 0) +
    getRouteCoreBoost(item, favoriteBoostEnabled)
  );
}

function shouldAllowSingleBucketJump(
  olderItem: RankedFeedItem,
  fresherItem: RankedFeedItem,
  favoriteBoostEnabled: boolean,
): boolean {
  const olderCoreBoost = getRouteCoreBoost(
    olderItem,
    favoriteBoostEnabled,
  );
  const olderHybridScore = getHybridRouteScore(
    olderItem,
    favoriteBoostEnabled,
  );
  const fresherHybridScore = getHybridRouteScore(
    fresherItem,
    favoriteBoostEnabled,
  );

  if (olderCoreBoost < CORE_BUCKET_JUMP_THRESHOLD) {
    return false;
  }

  return olderHybridScore - fresherHybridScore >= CORE_BUCKET_JUMP_MARGIN;
}

export function sortRouteItemsHybrid(
  items: RankedFeedItem[],
  nowMs: number,
  favoriteBoostEnabled = true,
): RankedFeedItem[] {
  return [...items].sort((a, b) => {
    const aBucket = getFreshnessBucketIndex(a.published_at, nowMs);
    const bBucket = getFreshnessBucketIndex(b.published_at, nowMs);

    if (aBucket !== bBucket) {
      const bucketDiff = Math.abs(aBucket - bBucket);

      if (bucketDiff === 1) {
        if (
          aBucket > bBucket &&
          shouldAllowSingleBucketJump(a, b, favoriteBoostEnabled)
        ) {
          return -1;
        }

        if (
          bBucket > aBucket &&
          shouldAllowSingleBucketJump(b, a, favoriteBoostEnabled)
        ) {
          return 1;
        }
      }

      return aBucket - bBucket;
    }

    const hybridDiff =
      getHybridRouteScore(b, favoriteBoostEnabled) -
      getHybridRouteScore(a, favoriteBoostEnabled);
    if (hybridDiff !== 0) {
      return hybridDiff;
    }

    const bPublishedAt = getPublishedAtMs(b.published_at) ?? 0;
    const aPublishedAt = getPublishedAtMs(a.published_at) ?? 0;

    if (bPublishedAt !== aPublishedAt) {
      return bPublishedAt - aPublishedAt;
    }

    return (b.ranking_total ?? 0) - (a.ranking_total ?? 0);
  });
}

export function filterRouteItemsByFreshness(
  items: RankedFeedItem[],
  nowMs: number,
  maxAgeHours = NORMAL_FEED_MAX_AGE_HOURS,
): RankedFeedItem[] {
  return items.filter((item) => {
    const ageHours = getArticleAgeHours(item.published_at, nowMs);
    if (ageHours == null) {
      return false;
    }

    return ageHours <= maxAgeHours;
  });
}
