// src/lib/feed/newsFeedRequest.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { loadNewsEntityContext } from "@/lib/entities/newsEntityContext";
import { buildHardNewsArticleIds } from "@/lib/news-engine/candidateLoader";
import { filterCandidatesBySportConsistency } from "@/lib/news-engine/sportGuard";
import type {
  EngineFavorite,
  EngineSport,
} from "@/lib/news-engine/types";
import { rankAcceptedFeed } from "@/lib/feed/rankAcceptedFeed";
import { applyFavoritesFirstPresentation } from "@/lib/feed/rankingPresentation";
import type { RankedFeedItem } from "@/lib/feed/types";
import {
  buildAllFavoriteTokens,
  buildRankingPreparation,
  compareFavoriteMatchMeta,
  isFavoriteMatch,
  loadFavoriteExpansion,
  parseFavorites,
  resolveTokenFavoriteMatchMeta,
} from "@/lib/news/newsFavorites";
import {
  clampInt,
  createDedupeState,
  getSourceQualityScoreForDedupe,
  isPremierLeagueOrAllsvenskan,
  markAcceptedNewsItem,
  removeAcceptedItemsFromDedupeState,
  msFromMinutes,
  shouldAcceptNewsItem,
} from "@/lib/news/newsDedupe";
import {
  buildLocalHaystack,
  GEO_REGIONS,
  isLocalEntityMatch,
  isLocalMatch,
  normalizeToken,
  parseCoordinate,
  resolveNewsGeo,
} from "@/lib/news/newsGeo";
import type {
  AcceptedItem,
  DbItem,
  EntityMetaRow,
  FavoriteContextMeta,
  FavoriteExpansionResult,
  FavoriteMatchMeta,
} from "@/lib/news/newsTypes";
import type { FavoriteSignal as LegacyFavoriteSignal } from "@/lib/ranking/rankingTypes";
import { getSourceRegionalEligibilityPolicy } from "@/lib/ranking/sourceProfiles";
import { classifyEditorialRelevance } from "@/lib/classification/editorialRelevance";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 30;

const DEFAULT_SOURCE_COOLDOWN_MIN = 1;
const DEFAULT_DUP_WINDOW_MIN = 4;
const DEFAULT_CROSS_DUP_WINDOW_HOURS = 2;
const DEFAULT_SIM_THRESHOLD = 0.75;
const DEFAULT_EVENT_WINDOW_HOURS = 4;

const FETCH_MULTIPLIER = 10;
const MAX_PUSHED_ITEMS_TO_LOAD = 200;

/* ==========================================================================
   ROUTE RESPONSE TYPES
   ========================================================================== */

export type RouteRankedAcceptedItem = RankedFeedItem;

type RouteMeta = {
  seen_articles_count: number;
  favorites_active: boolean;
  detected_city: string | null;
  region_active: boolean;
  region_key: string | null;
  region_city: string | null;
  region_terms: string[];
  geo_debug: string | null;
  vercel_ip_city: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  location_source: string | null;
  coord_region_distance_km: number | null;
};

type PushDeliveryLogRow = {
  news_item_id: string;
  sent_at: string;
};

export type RegionalSourceEligibilityContext = {
  regionKey: string | null;
  favoriteEntityIds: Set<string>;
  favoriteTokens: Set<string>;
  hardNewsItemKeys: Set<string>;
};

/* ==========================================================================
   FAVORITE ADAPTERS
   ========================================================================== */

export function adaptLegacyFavoriteSignalsToEngineFavorites(
  favoriteSignals: LegacyFavoriteSignal[],
  sport: EngineSport,
): EngineFavorite[] {
  if (!Array.isArray(favoriteSignals)) {
    return [];
  }

  const result: EngineFavorite[] = [];

  for (const favorite of favoriteSignals) {
    const entityId = (favorite.entityId ?? "").trim();
    const label = (favorite.label ?? "").trim();
    const type = favorite.type;

    if (!entityId || !label) {
      continue;
    }

    if (type !== "player" && type !== "team" && type !== "league") {
      continue;
    }

    result.push({
      entityId,
      sport,
      type,
      label,
    });
  }

  return result;
}

/* ==========================================================================
   DB / MERGE HELPERS
   ========================================================================== */

function mergeDbItemsById(items: DbItem[]): DbItem[] {
  const merged = new Map<string, DbItem>();

  for (const item of items) {
    const key = item.id ?? item.url;
    if (!key) continue;

    if (!merged.has(key)) {
      merged.set(key, item);
    }
  }

  return Array.from(merged.values());
}

function sortDbItemsByPublishedAtDesc(items: DbItem[]): DbItem[] {
  return [...items].sort((a, b) => {
    const bTime = new Date(b.published_at ?? 0).getTime();
    const aTime = new Date(a.published_at ?? 0).getTime();

    return bTime - aTime;
  });
}

function createEmptyFavoriteExpansion(): FavoriteExpansionResult {
  return {
    directFavoriteEntityIds: new Set<string>(),
    directFavoriteEntityMetaById: new Map<string, EntityMetaRow>(),
    expandedFavoriteEntityIds: new Set<string>(),
    expandedFavoriteEntityMetaById: new Map<string, EntityMetaRow>(),
    favoriteEntityWeightById: new Map<string, number>(),
    favoriteRelations: {
      leagueToTeamIds: {},
      teamToPlayerIds: {},
      teamToStaffIds: {},
    },
    favoriteMatchByNewsId: new Map<string, FavoriteMatchMeta>(),
    favoriteContextByNewsId: new Map<string, FavoriteContextMeta>(),
  };
}

async function loadUnreadPushedItemsForDevice(args: {
  supabase: ReturnType<typeof supabaseService>;
  deviceId: string;
  sport: EngineSport;
}): Promise<{
  pushedItems: DbItem[];
  pushedUnreadIds: Set<string>;
}> {
  const { supabase, deviceId, sport } = args;

  if (!deviceId) {
    return {
      pushedItems: [],
      pushedUnreadIds: new Set<string>(),
    };
  }

  const { data: pushLogData, error: pushLogError } = await supabase
    .from("push_delivery_log")
    .select("news_item_id,sent_at")
    .eq("device_id", deviceId)
    .order("sent_at", { ascending: false })
    .limit(MAX_PUSHED_ITEMS_TO_LOAD);

  if (pushLogError || !pushLogData?.length) {
    return {
      pushedItems: [],
      pushedUnreadIds: new Set<string>(),
    };
  }

  const pushLogRows = pushLogData as PushDeliveryLogRow[];
  const pushedIdsInOrder = Array.from(
    new Set(
      pushLogRows
        .map((row) => row.news_item_id)
        .filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        ),
    ),
  );

  if (!pushedIdsInOrder.length) {
    return {
      pushedItems: [],
      pushedUnreadIds: new Set<string>(),
    };
  }

  const { data: seenData, error: seenError } = await supabase
    .from("user_seen_news")
    .select("news_item_id")
    .eq("device_id", deviceId)
    .in("news_item_id", pushedIdsInOrder);

  const seenIds = new Set<string>();

  if (!seenError && seenData) {
    for (const row of seenData) {
      if (typeof row.news_item_id === "string" && row.news_item_id.length > 0) {
        seenIds.add(row.news_item_id);
      }
    }
  }

  const unreadPushedIds = pushedIdsInOrder.filter((id) => !seenIds.has(id));

  if (!unreadPushedIds.length) {
    return {
      pushedItems: [],
      pushedUnreadIds: new Set<string>(),
    };
  }

  const { data: pushedNewsData, error: pushedNewsError } = await supabase
    .from("news_items")
    .select("id,sport,title,url,source,published_at,fetched_at,tags,priority")
    .eq("sport", sport)
    .in("id", unreadPushedIds);

  if (pushedNewsError || !pushedNewsData?.length) {
    return {
      pushedItems: [],
      pushedUnreadIds: new Set<string>(),
    };
  }

  const pushedItems = sortDbItemsByPublishedAtDesc(
    (pushedNewsData ?? []) as DbItem[],
  );

  return {
    pushedItems,
    pushedUnreadIds: new Set(unreadPushedIds),
  };
}

/* ==========================================================================
   ACCEPTED ITEM HELPERS
   ========================================================================== */

export function isRegionalSourceLocalToActiveRegion(
  source: string | null | undefined,
  activeRegion: ReturnType<typeof resolveNewsGeo>["activeRegion"],
): boolean {
  if (!activeRegion) return false;

  const sourceRegionalPolicy = getSourceRegionalEligibilityPolicy(source ?? undefined);
  if (
    sourceRegionalPolicy.scope !== "regional" ||
    !sourceRegionalPolicy.regionKey
  ) {
    return false;
  }

  const sourceRegion = GEO_REGIONS[sourceRegionalPolicy.regionKey];
  if (!sourceRegion) return false;

  return normalizeToken(sourceRegion.city) === normalizeToken(activeRegion.city);
}

function buildDirectFavoriteSupportTokens(meta: EntityMetaRow): string[] {
  const tokens = [meta.name];

  if (meta.type === "player") {
    const parts = normalizeToken(meta.name).split(" ").filter(Boolean);
    const surname = parts.at(-1);
    if (surname && surname.length >= 4) {
      tokens.push(surname);
    }
  }

  return Array.from(new Set(tokens.map(normalizeToken).filter(Boolean)));
}

function hasConflictingPlayerSurnameEntity(
  directMeta: EntityMetaRow,
  articleEntities: NonNullable<AcceptedItem["entities"]>,
  normalizedTitle: string,
): boolean {
  if (directMeta.type !== "player") return false;

  const parts = normalizeToken(directMeta.name).split(" ").filter(Boolean);
  const surname = parts.at(-1);
  if (!surname || surname.length < 4) return false;

  if (!` ${normalizedTitle} `.includes(` ${surname} `)) {
    return false;
  }

  return articleEntities.some((entity) => {
    if (entity.type !== "player") return false;
    if (entity.id === directMeta.id) return false;

    const otherName = normalizeToken(entity.name ?? "");
    if (!otherName) return false;

    return otherName.split(" ").includes(surname) &&
      ` ${normalizedTitle} `.includes(` ${otherName} `);
  });
}

function isDirectFavoriteSupportedByPresentation(
  directMeta: EntityMetaRow,
  normalizedTitle: string,
  tags: string[] | null | undefined,
  articleEntities: NonNullable<AcceptedItem["entities"]>,
): boolean {
  const tokens = buildDirectFavoriteSupportTokens(directMeta);

  const matched = tokens.some((token) =>
    isFavoriteMatch(normalizedTitle, tags, [token]),
  );

  if (!matched) return false;

  return !hasConflictingPlayerSurnameEntity(
    directMeta,
    articleEntities,
    normalizedTitle,
  );
}

function isFavoriteContextSupportedByPresentation(
  contextMeta: FavoriteContextMeta | undefined,
  normalizedTitle: string,
  tags: string[] | null | undefined,
): boolean {
  const contextName = normalizeToken(contextMeta?.context_entity_name ?? "");
  if (!contextName) return false;

  return isFavoriteMatch(normalizedTitle, tags, [contextName]);
}

export function buildAcceptedItem(args: {
  item: DbItem;
  allFavoriteTokens: string[];
  favoriteMatchByNewsId: Map<string, FavoriteMatchMeta>;
  favoriteContextByNewsId: Map<string, FavoriteContextMeta>;
  directFavoriteEntityMetaById: Map<string, EntityMetaRow>;
  newsEntityIdsByNewsId: Map<string, string[]>;
  newsEntitiesByNewsId: Map<
    string,
    NonNullable<AcceptedItem["entities"]>
  >;
  geoActiveRegion: ReturnType<typeof resolveNewsGeo>["activeRegion"];
  normalizedTitle: string;
}): AcceptedItem {
  const {
    item,
    allFavoriteTokens,
    favoriteMatchByNewsId,
    favoriteContextByNewsId,
    directFavoriteEntityMetaById,
    newsEntityIdsByNewsId,
    newsEntitiesByNewsId,
    geoActiveRegion,
    normalizedTitle,
  } = args;

  const rawEntityFavoriteMeta = item.id
    ? favoriteMatchByNewsId.get(item.id)
    : undefined;
  const rawFavoriteContextMeta = item.id
    ? favoriteContextByNewsId.get(item.id)
    : undefined;
  const articleEntities = item.id
    ? (newsEntitiesByNewsId.get(item.id) ?? [])
    : [];

  const directFavoriteMeta =
    rawEntityFavoriteMeta &&
    directFavoriteEntityMetaById.has(rawEntityFavoriteMeta.entity_id)
      ? directFavoriteEntityMetaById.get(rawEntityFavoriteMeta.entity_id)
      : undefined;

  const entityFavoriteMeta =
    rawEntityFavoriteMeta && directFavoriteMeta
      ? isDirectFavoriteSupportedByPresentation(
          directFavoriteMeta,
          normalizedTitle,
          item.tags ?? null,
          articleEntities,
        )
        ? rawEntityFavoriteMeta
        : undefined
      : rawEntityFavoriteMeta;

  const favoriteContextMeta =
    rawFavoriteContextMeta &&
    isFavoriteContextSupportedByPresentation(
      rawFavoriteContextMeta,
      normalizedTitle,
      item.tags ?? null,
    )
      ? rawFavoriteContextMeta
      : undefined;

  const tokenFavoriteMeta = resolveTokenFavoriteMatchMeta(
    normalizedTitle,
    item.tags ?? null,
    directFavoriteEntityMetaById,
  );

  let resolvedFavoriteMeta = entityFavoriteMeta ?? null;

  if (
    tokenFavoriteMeta &&
    compareFavoriteMatchMeta(tokenFavoriteMeta, entityFavoriteMeta)
  ) {
    resolvedFavoriteMeta = tokenFavoriteMeta;
  }

  const tokenFavoriteMatch =
    !resolvedFavoriteMeta && allFavoriteTokens.length > 0
      ? isFavoriteMatch(normalizedTitle, item.tags ?? null, allFavoriteTokens)
      : false;

  const localHaystack = buildLocalHaystack({
    title: item.title,
    url: item.url,
    source: item.source,
    tags: item.tags ?? null,
  });

  const newsEntityIds = item.id
    ? (newsEntityIdsByNewsId.get(item.id) ?? [])
    : [];

  const isFavorite = Boolean(resolvedFavoriteMeta) || tokenFavoriteMatch;
  const isLocal =
    isLocalMatch(localHaystack, geoActiveRegion) ||
    isLocalEntityMatch(newsEntityIds, geoActiveRegion) ||
    isRegionalSourceLocalToActiveRegion(item.source, geoActiveRegion);
  const editorialRelevance = classifyEditorialRelevance({
    sport: item.sport,
    title: item.title,
    source: item.source,
    tags: item.tags ?? null,
    entities: articleEntities,
  });
  const hasSwedishPlayer = editorialRelevance.hasSwedishPlayer;
  const isPremierOrAllsvenskan = isPremierLeagueOrAllsvenskan(
    `${item.title ?? ""} ${item.source ?? ""} ${(item.tags ?? []).join(" ")}`,
  );

  return {
    ...item,
    isFavorite,
    isLocal,
    favorite_match: isFavorite,
    favorite_score:
      resolvedFavoriteMeta?.score ?? (tokenFavoriteMatch ? 1 : 0),
    favorite_match_mode: resolvedFavoriteMeta
      ? "entity"
      : tokenFavoriteMatch
        ? "token"
        : "none",
    favorite_entity_type: resolvedFavoriteMeta?.type ?? null,
    favorite_entity_id: resolvedFavoriteMeta?.entity_id ?? null,
    favorite_entity_name: resolvedFavoriteMeta?.entity_name ?? null,
    favorite_context: !isFavorite && Boolean(favoriteContextMeta),
    favorite_context_score:
      !isFavorite && favoriteContextMeta ? favoriteContextMeta.score : 0,
    hasSwedishPlayer,
    isPremierOrAllsvenskan,
    editorialTier: editorialRelevance.tier,
    editorialReasons: editorialRelevance.reasons,
    entities: articleEntities,
  };
}

function sourcePolicyMatchesFavorite(
  item: AcceptedItem,
  context: RegionalSourceEligibilityContext,
): boolean {
  const policy = getSourceRegionalEligibilityPolicy(item.source);

  if (policy.scope !== "regional" || !policy.favoriteEligible) {
    return false;
  }

  if (item.isFavorite || item.favorite_match) {
    return true;
  }

  if (
    policy.favoriteEntityIds.some((entityId) =>
      context.favoriteEntityIds.has(entityId),
    )
  ) {
    return true;
  }

  if (
    policy.favoriteTokens.some((token) =>
      context.favoriteTokens.has(normalizeToken(token)),
    )
  ) {
    return true;
  }

  return false;
}

function hasHardNewsOverride(
  item: AcceptedItem,
  context: RegionalSourceEligibilityContext,
): boolean {
  const itemKey = (item.id ?? item.url ?? "").trim();
  if (!itemKey) {
    return false;
  }

  return context.hardNewsItemKeys.has(itemKey);
}

export function isAcceptedItemEligibleForRegionalSource(
  item: AcceptedItem,
  context: RegionalSourceEligibilityContext,
): boolean {
  const policy = getSourceRegionalEligibilityPolicy(item.source);

  if (policy.scope !== "regional") {
    return true;
  }

  if (context.regionKey && policy.regionKey === context.regionKey) {
    return true;
  }

  if (sourcePolicyMatchesFavorite(item, context)) {
    return true;
  }

  if (hasHardNewsOverride(item, context)) {
    return true;
  }

  return false;
}

export function filterAcceptedItemsByRegionalSourceEligibility(
  accepted: AcceptedItem[],
  context: RegionalSourceEligibilityContext,
): AcceptedItem[] {
  return accepted.filter((item) =>
    isAcceptedItemEligibleForRegionalSource(item, context),
  );
}

function forceIncludeUnreadPushedAcceptedItems(args: {
  items: DbItem[];
  accepted: AcceptedItem[];
  unreadPushedIds: Set<string>;
  allFavoriteTokens: string[];
  favoriteMatchByNewsId: Map<string, FavoriteMatchMeta>;
  favoriteContextByNewsId: Map<string, FavoriteContextMeta>;
  directFavoriteEntityMetaById: Map<string, EntityMetaRow>;
  newsEntityIdsByNewsId: Map<string, string[]>;
  newsEntitiesByNewsId: Map<
    string,
    NonNullable<AcceptedItem["entities"]>
  >;
  geoActiveRegion: ReturnType<typeof resolveNewsGeo>["activeRegion"];
}): AcceptedItem[] {
  const {
    items,
    accepted,
    unreadPushedIds,
    allFavoriteTokens,
    favoriteMatchByNewsId,
    favoriteContextByNewsId,
    directFavoriteEntityMetaById,
    newsEntityIdsByNewsId,
    newsEntitiesByNewsId,
    geoActiveRegion,
  } = args;

  if (!unreadPushedIds.size) {
    return accepted;
  }

  const acceptedIds = new Set(
    accepted
      .map((item) => item.id)
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
  );

  const forcedAccepted: AcceptedItem[] = [...accepted];

  for (const item of items) {
    if (!item.id || !unreadPushedIds.has(item.id) || acceptedIds.has(item.id)) {
      continue;
    }

    forcedAccepted.push(
      buildAcceptedItem({
        item,
        allFavoriteTokens,
        favoriteMatchByNewsId,
        favoriteContextByNewsId,
        directFavoriteEntityMetaById,
        newsEntityIdsByNewsId,
        newsEntitiesByNewsId,
        geoActiveRegion,
        normalizedTitle: item.title ?? "",
      }),
    );

    acceptedIds.add(item.id);
  }

  return forcedAccepted;
}

/* ==========================================================================
   META BUILDER
   ========================================================================== */

export function buildRouteMeta(args: {
  seenArticlesCount: number;
  favoritesActive: boolean;
  detectedCity: string | null;
  regionActive: boolean;
  regionKey: string | null;
  regionCity: string | null;
  regionTerms: string[];
  geoDebug: string | null;
  vercelIpCity: string | null;
  geoLat: number | null;
  geoLng: number | null;
  locationSource: string | null;
  coordRegionDistanceKm: number | null;
}): RouteMeta {
  return {
    seen_articles_count: args.seenArticlesCount,
    favorites_active: args.favoritesActive,
    detected_city: args.detectedCity,
    region_active: args.regionActive,
    region_key: args.regionKey,
    region_city: args.regionCity,
    region_terms: args.regionTerms,
    geo_debug: args.geoDebug,
    vercel_ip_city: args.vercelIpCity,
    geo_lat: args.geoLat,
    geo_lng: args.geoLng,
    location_source: args.locationSource,
    coord_region_distance_km: args.coordRegionDistanceKm,
  };
}

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function handleNewsFeedRequest(req: NextRequest) {
  try {
    const sportRaw = req.nextUrl.searchParams.get("sport");
    const sport = (sportRaw ?? "").trim().toLowerCase();

    if (sport !== "football" && sport !== "hockey") {
      return NextResponse.json(
        {
          error: "Invalid sport",
          received: sportRaw,
          normalized: sport,
        },
        { status: 400 },
      );
    }

    const safeSport = sport as EngineSport;
    const deviceId = (req.nextUrl.searchParams.get("device_id") ?? "").trim();
    const hideRead = req.nextUrl.searchParams.get("hide_read") === "1";
    const personalized = req.nextUrl.searchParams.get("personalized") === "1";
    const favoritesFirst = req.nextUrl.searchParams.get("favorites_first") === "1";

    const debugCity = req.nextUrl.searchParams.get("geo_debug");
    const geoLat = parseCoordinate(req.nextUrl.searchParams.get("lat"));
    const geoLng = parseCoordinate(req.nextUrl.searchParams.get("lng"));
    const vercelIpCity = req.headers.get("x-vercel-ip-city");

    const limitRaw = req.nextUrl.searchParams.get("limit");
    const safeLimit = clampInt(
      Number(limitRaw ?? `${DEFAULT_LIMIT}`),
      1,
      MAX_LIMIT,
      DEFAULT_LIMIT,
    );

    const parsedFavoriteTokens = parseFavorites(req.nextUrl.searchParams);
    const hasExplicitFavoriteTokens = parsedFavoriteTokens.length > 0;
    const shouldUseFavoritePersonalization =
      personalized || hasExplicitFavoriteTokens;
    const shouldUseDevicePersonalization =
      personalized && Boolean(deviceId);

    const cooldownMin = clampInt(
      Number(
        req.nextUrl.searchParams.get("cooldown_min") ??
          `${DEFAULT_SOURCE_COOLDOWN_MIN}`,
      ),
      0,
      60,
      DEFAULT_SOURCE_COOLDOWN_MIN,
    );

    const dupWindowMin = clampInt(
      Number(
        req.nextUrl.searchParams.get("dup_window_min") ??
          `${DEFAULT_DUP_WINDOW_MIN}`,
      ),
      0,
      180,
      DEFAULT_DUP_WINDOW_MIN,
    );

    const crossDupHours = clampInt(
      Number(
        req.nextUrl.searchParams.get("cross_dup_hours") ??
          `${DEFAULT_CROSS_DUP_WINDOW_HOURS}`,
      ),
      0,
      72,
      DEFAULT_CROSS_DUP_WINDOW_HOURS,
    );

    const simThreshold = Math.min(
      Math.max(
        Number(
          req.nextUrl.searchParams.get("sim_threshold") ??
            `${DEFAULT_SIM_THRESHOLD}`,
        ),
        0.5,
      ),
      0.95,
    );

    const eventWindowHours = clampInt(
      Number(
        req.nextUrl.searchParams.get("event_window_hours") ??
          `${DEFAULT_EVENT_WINDOW_HOURS}`,
      ),
      0,
      168,
      DEFAULT_EVENT_WINDOW_HOURS,
    );

    const geo = resolveNewsGeo({
      debugCity,
      geoLat,
      geoLng,
      vercelIpCity,
    });

    const supabase = supabaseService();
    const fetchLimit = Math.min(safeLimit * FETCH_MULTIPLIER, 200);

    const { data, error } = await supabase
      .from("news_items")
      .select("id,sport,title,url,source,published_at,fetched_at,tags,priority")
      .eq("sport", safeSport)
      .order("published_at", { ascending: false })
      .limit(fetchLimit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let items = (data ?? []) as DbItem[];
    let seenArticlesCount = 0;

    const { pushedItems, pushedUnreadIds } = shouldUseDevicePersonalization
      ? await loadUnreadPushedItemsForDevice({
          supabase,
          deviceId,
          sport: safeSport,
        })
      : {
          pushedItems: [] as DbItem[],
          pushedUnreadIds: new Set<string>(),
        };

    items = sortDbItemsByPublishedAtDesc(
      mergeDbItemsById([...pushedItems, ...items]),
    );

    items = filterCandidatesBySportConsistency(items, safeSport) as DbItem[];

    const newsEntityContext = await loadNewsEntityContext(supabase, items);
    const newsEntityIdsByNewsId = newsEntityContext.entityIdsByNewsId;
    const newsEntitiesByNewsId = newsEntityContext.entitiesByNewsId;

    if (hideRead && deviceId && items.length > 0) {
      const itemIds = items.map((item) => item.id).filter(Boolean) as string[];
      const seenIds = new Set<string>();

      const { data: seenData, error: seenError } = await supabase
        .from("user_seen_news")
        .select("news_item_id")
        .eq("device_id", deviceId)
        .in("news_item_id", itemIds);

      if (!seenError && seenData) {
        for (const row of seenData) {
          seenIds.add(row.news_item_id);
        }

        items = items.filter((item) => !item.id || !seenIds.has(item.id));
        seenArticlesCount = seenIds.size;
      }
    }

    const unreadPushedIdsInCurrentItems = new Set(
      items
        .map((item) => item.id)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0 && pushedUnreadIds.has(id),
        ),
    );

    const favoriteExpansion = shouldUseDevicePersonalization
      ? await loadFavoriteExpansion(supabase, deviceId, items)
      : createEmptyFavoriteExpansion();

    const allFavoriteTokens = shouldUseFavoritePersonalization
      ? buildAllFavoriteTokens(
          parsedFavoriteTokens,
          favoriteExpansion.directFavoriteEntityMetaById,
        )
      : [];

    let accepted: AcceptedItem[] = [];
    const dedupeState = createDedupeState();

    const cooldownMs = msFromMinutes(cooldownMin);
    const dupWindowMs = msFromMinutes(dupWindowMin);
    const crossDupMs = crossDupHours * 60 * 60_000;
    const eventWindowMs = eventWindowHours * 60 * 60_000;

    for (const item of items) {
      const dedupeContext = {
        entityIds: item.id ? (newsEntityIdsByNewsId.get(item.id) ?? []) : [],
        entities: item.id ? (newsEntitiesByNewsId.get(item.id) ?? []) : [],
      };

      const dedupeDecision = shouldAcceptNewsItem(
        item,
        safeSport,
        {
          cooldownMs,
          dupWindowMs,
          crossDupMs,
          eventWindowMs,
          simThreshold,
        },
        dedupeState,
        dedupeContext,
      );

      if (!dedupeDecision.accepted || dedupeDecision.publishedAtMs == null) {
        continue;
      }

      if (dedupeDecision.replaceAcceptedIds.length > 0) {
        const replacedIds = new Set(
          dedupeDecision.replaceAcceptedIds.filter(Boolean),
        );

        if (replacedIds.size > 0) {
          accepted = accepted.filter((acceptedItem) => {
            const acceptedId = String(acceptedItem.id ?? "").trim();
            return !acceptedId || !replacedIds.has(acceptedId);
          });

          removeAcceptedItemsFromDedupeState(replacedIds, dedupeState);
        }
      }

      const sourceQuality = getSourceQualityScoreForDedupe(
        dedupeDecision.source,
      );

      markAcceptedNewsItem(
        dedupeDecision.acceptedItemId,
        dedupeDecision.publishedAtMs,
        dedupeDecision.normalizedTitle,
        dedupeDecision.source,
        sourceQuality,
        crossDupMs,
        dedupeState,
        item,
        dedupeContext,
      );

      accepted.push(
        buildAcceptedItem({
          item,
          allFavoriteTokens,
          favoriteMatchByNewsId: favoriteExpansion.favoriteMatchByNewsId,
          favoriteContextByNewsId: favoriteExpansion.favoriteContextByNewsId,
          directFavoriteEntityMetaById:
            favoriteExpansion.directFavoriteEntityMetaById,
          newsEntityIdsByNewsId,
          newsEntitiesByNewsId,
          geoActiveRegion: geo.activeRegion,
          normalizedTitle: dedupeDecision.normalizedTitle,
        }),
      );

      if (accepted.length >= Math.min(safeLimit * 3, fetchLimit)) {
        break;
      }
    }

    const acceptedWithForcedPushedItems = shouldUseDevicePersonalization
      ? forceIncludeUnreadPushedAcceptedItems({
          items,
          accepted,
          unreadPushedIds: unreadPushedIdsInCurrentItems,
          allFavoriteTokens,
          favoriteMatchByNewsId: favoriteExpansion.favoriteMatchByNewsId,
          favoriteContextByNewsId: favoriteExpansion.favoriteContextByNewsId,
          directFavoriteEntityMetaById:
            favoriteExpansion.directFavoriteEntityMetaById,
          newsEntityIdsByNewsId,
          newsEntitiesByNewsId,
          geoActiveRegion: geo.activeRegion,
        })
      : accepted;

    const regionalEligibilityHardNewsItemKeys = new Set(
      buildHardNewsArticleIds(acceptedWithForcedPushedItems),
    );

    const acceptedAfterRegionalSourceEligibility =
      filterAcceptedItemsByRegionalSourceEligibility(
        acceptedWithForcedPushedItems,
        {
          regionKey: geo.regionKey ?? null,
          favoriteEntityIds: new Set(
            Array.from(favoriteExpansion.directFavoriteEntityIds).map((value) =>
              value.trim().toLowerCase(),
            ),
          ),
          favoriteTokens: new Set(
            allFavoriteTokens.map((value) => normalizeToken(value)),
          ),
          hardNewsItemKeys: regionalEligibilityHardNewsItemKeys,
        },
      );

    const rankingPreparation = buildRankingPreparation(
      favoriteExpansion.directFavoriteEntityIds,
      favoriteExpansion.directFavoriteEntityMetaById,
      parsedFavoriteTokens,
      acceptedAfterRegionalSourceEligibility,
    );

    // Favorite relevance is part of the one canonical ranking engine.
    // favoritesFirst is presentation-only and must never change engine inputs.
    const engineFavorites = shouldUseFavoritePersonalization
      ? adaptLegacyFavoriteSignalsToEngineFavorites(
          rankingPreparation.favoriteSignals,
          safeSport,
        )
      : [];

    const nowMs = Date.now();
    const canonicalRanked = rankAcceptedFeed({
      accepted: acceptedAfterRegionalSourceEligibility,
      sport: safeSport,
      nowMs,
      favorites: engineFavorites,
      geo:
        geoLat != null && geoLng != null
          ? {
              lat: geoLat,
              lng: geoLng,
              source: "browser",
            }
          : null,
      unreadPushedIds: unreadPushedIdsInCurrentItems,
      hideRead,
      limit: safeLimit,
    });

    const returned = applyFavoritesFirstPresentation(
      canonicalRanked,
      favoritesFirst,
    );

    return NextResponse.json(
      {
        items: returned,
        meta: buildRouteMeta({
          seenArticlesCount,
          favoritesActive: rankingPreparation.hasFavorites,
          detectedCity: geo.userCity,
          regionActive: !!geo.activeRegion,
          regionKey: geo.regionKey ?? null,
          regionCity: geo.activeRegion?.city ?? null,
          regionTerms: geo.activeRegion?.terms ?? [],
          geoDebug: debugCity ?? null,
          vercelIpCity: vercelIpCity ?? null,
          geoLat,
          geoLng,
          locationSource: geo.locationSource,
          coordRegionDistanceKm: geo.coordRegionDistanceKm,
        }),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown news route failure";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
