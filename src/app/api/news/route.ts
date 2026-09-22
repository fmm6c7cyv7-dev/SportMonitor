// src/app/api/news/route.ts

import type { NextRequest } from "next/server";
import { handleNewsFeedRequest } from "@/lib/feed/newsFeedRequest";
import { guardPublicApi } from "@/lib/server/publicApiGuard";

export {
  adaptLegacyFavoriteSignalsToEngineFavorites,
  filterAcceptedItemsByRegionalSourceEligibility,
  isAcceptedItemEligibleForRegionalSource,
  isRegionalSourceLocalToActiveRegion,
} from "@/lib/feed/newsFeedRequest";

export {
  filterAcceptedItemsByFreshness,
  filterRouteItemsByFreshness,
  getArticleAgeHours,
  getArticleAgeMinutes,
  getPublishedAtMs,
  sortRouteItemsHybrid,
  splitAcceptedItemsByFreshness,
} from "@/lib/feed/freshness";

export { mergeRankedArticlesIntoAccepted } from "@/lib/feed/rankingPresentation";
export type { RankedFeedItem as RouteRankedAcceptedItem } from "@/lib/feed/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guarded = guardPublicApi(req, { key: "news:get", limit: 120 });
  if (guarded) return guarded;

  return handleNewsFeedRequest(req);
}
