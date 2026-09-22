import type { GeoRegion, RankedAcceptedItem } from "@/lib/news/newsTypes";

/* ==========================================================================
   CONFIG
   ========================================================================== */

const PRIORITY_TIEBREAK_RANKING_WINDOW = 16;
const INTERLEAVE_WINDOW_SIZE = 16;
const INTERLEAVE_LOOKAHEAD = 6;
const RECENT_SOURCE_BLOCK_WINDOW = 2;

/* ==========================================================================
   HELPERS
   ========================================================================== */

function normalizeSourceName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function publishedAtMs(item: RankedAcceptedItem): number {
  return new Date(item.published_at).getTime();
}

function rankingTotal(item: RankedAcceptedItem): number {
  return item.ranking?.total ?? 0;
}

function priorityValue(item: RankedAcceptedItem): number {
  return item.priority ?? 0;
}

function comparePriorityWithinRankingWindow(
  a: RankedAcceptedItem,
  b: RankedAcceptedItem,
): number {
  const rankingGap = Math.abs(rankingTotal(a) - rankingTotal(b));

  if (rankingGap > PRIORITY_TIEBREAK_RANKING_WINDOW) {
    return 0;
  }

  if (a.hasSwedishPlayer !== b.hasSwedishPlayer) {
    return a.hasSwedishPlayer ? -1 : 1;
  }

  const priorityA = priorityValue(a);
  const priorityB = priorityValue(b);

  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }

  if (a.isPremierOrAllsvenskan !== b.isPremierOrAllsvenskan) {
    return a.isPremierOrAllsvenskan ? -1 : 1;
  }

  return 0;
}

function pickBestInterleaveCandidate(
  queue: RankedAcceptedItem[],
  recentSources: string[],
): number {
  const recentWindow = recentSources.slice(-RECENT_SOURCE_BLOCK_WINDOW);

  let bestAllowedIndex = -1;
  let bestAllowedRank = -Infinity;

  for (
    let index = 0;
    index < Math.min(queue.length, INTERLEAVE_LOOKAHEAD);
    index += 1
  ) {
    const candidate = queue[index];
    const source = normalizeSourceName(candidate?.source);

    if (recentWindow.includes(source)) {
      continue;
    }

    const candidateRank = rankingTotal(candidate);

    if (candidateRank > bestAllowedRank) {
      bestAllowedRank = candidateRank;
      bestAllowedIndex = index;
    }
  }

  if (bestAllowedIndex >= 0) {
    return bestAllowedIndex;
  }

  return 0;
}

/* ==========================================================================
   SOURCE INTERLEAVING
   --------------------------------------------------------------------------
   Målet här är att minska toppdominans från samma källa utan att helt
   förstöra rankingordningen.
   ========================================================================== */

export function interleaveBySource(
  items: RankedAcceptedItem[],
): RankedAcceptedItem[] {
  if (items.length <= INTERLEAVE_WINDOW_SIZE) return items;

  const interleavable = items.slice(0, INTERLEAVE_WINDOW_SIZE);
  const rest = items.slice(INTERLEAVE_WINDOW_SIZE);

  const queue = [...interleavable];
  const result: RankedAcceptedItem[] = [];
  const recentSources: string[] = [];

  while (queue.length > 0) {
    const chosenIndex = pickBestInterleaveCandidate(queue, recentSources);
    const [chosen] = queue.splice(chosenIndex, 1);

    result.push(chosen);

    const source = normalizeSourceName(chosen.source);
    if (source) {
      recentSources.push(source);

      if (recentSources.length > 6) {
        recentSources.splice(0, recentSources.length - 6);
      }
    }
  }

  return [...result, ...rest];
}

/* ==========================================================================
   FEED SORT
   --------------------------------------------------------------------------
   Viktig princip:
   - ranking.total är huvudordning
   - favorite/local får hjälpa
   - priority/core får hjälpa inom rimlig rankingnärhet
   ========================================================================== */

export function sortAcceptedForFeed(
  items: RankedAcceptedItem[],
  hasFavorites: boolean,
  activeRegion: GeoRegion | null,
): RankedAcceptedItem[] {
  const hasUserRegion = activeRegion != null;

  return [...items].sort((a, b) => {
    if (hasUserRegion && a.isLocal !== b.isLocal) {
      return a.isLocal ? -1 : 1;
    }

    if (hasFavorites) {
      if (a.favorite_match !== b.favorite_match) {
        return a.favorite_match ? -1 : 1;
      }

      if (a.favorite_match_mode !== b.favorite_match_mode) {
        if (a.favorite_match_mode === "entity") return -1;
        if (b.favorite_match_mode === "entity") return 1;
      }

      if ((a.favorite_score ?? 0) !== (b.favorite_score ?? 0)) {
        return (b.favorite_score ?? 0) - (a.favorite_score ?? 0);
      }
    }

    if (rankingTotal(b) !== rankingTotal(a)) {
      const priorityComparison = comparePriorityWithinRankingWindow(a, b);

      if (priorityComparison !== 0) {
        return priorityComparison;
      }

      return rankingTotal(b) - rankingTotal(a);
    }

    if (a.hasSwedishPlayer !== b.hasSwedishPlayer) {
      return a.hasSwedishPlayer ? -1 : 1;
    }

    if (a.isPremierOrAllsvenskan !== b.isPremierOrAllsvenskan) {
      return a.isPremierOrAllsvenskan ? -1 : 1;
    }

    if (priorityValue(a) !== priorityValue(b)) {
      return priorityValue(b) - priorityValue(a);
    }

    return publishedAtMs(b) - publishedAtMs(a);
  });
}