// src/lib/ingest/processFeed.ts

import { parseRssFeed } from "@/lib/rss";
import { dispatchPushForNewsItem } from "@/lib/pushDispatch";
import { auditFavoriteDeliveryForNewsItem } from "@/lib/audit/favoriteDeliveryAudit";
import { detectEntitiesInText, loadEntityAliases } from "@/lib/detectEntities";
import { Sport, type FeedDef } from "@/lib/ingest/sourceRegistry";
import {
  scrapeAnno1904,
  scrapeOlandsbladetKalmarFF,
  scrapeVskHerrlag,
} from "@/lib/scrape";
import { isIrrelevantSport } from "@/lib/ingest/filterPolicy";
import {
  detectSportFromContent,
  hasSportContent,
} from "@/lib/classification/sportSignals";
import type { RankingNewsItem } from "@/lib/ranking/rankingTypes";
import { getSourceProfile } from "@/lib/ranking/sourceProfiles";
import { supabaseService } from "@/lib/supabase";

/* ==========================================================================
   CONFIG
   ========================================================================== */

const MAX_ITEMS_PER_FEED = 80;
const MAX_INGEST_AGE_HOURS = 12;
const MAX_PUSH_AGE_MINUTES = 180;
const MAX_DEBUG_SAMPLES = 5;

const DOMESTIC_KEYWORDS = [
  "shl",
  "allsvenskan",
  "superettan",
  "vsk",
  "västerås",
  "leksand",
  "djurgården",
  "aik",
  "mff",
  "malmö",
  "göteborg",
  "blåvitt",
  "brynäs",
  "frölunda",
  "färjestad",
  "hv71",
  "linköping",
  "luleå",
  "rögle",
  "skellefteå",
  "timrå",
  "växjö",
  "örebro",
  "almtuna",
  "björklöven",
  "karlskoga",
  "modo",
  "mora",
  "södertälje",
  "nybro",
  "oskarshamn",
  "kalmar",
  "östersund",
  "vimmerby",
  "löven",
  "vik",
] as const;

/* ==========================================================================
   TYPES
   ========================================================================== */

type SupabaseServiceClient = ReturnType<typeof supabaseService>;
export type EntityAliasRows = Awaited<ReturnType<typeof loadEntityAliases>>;

type ParsedFeedItem = {
  title: string;
  url: string;
  published_at?: string | null;
  source?: string | null;
  summary?: string | null;
  tags?: string[] | null;
};

type PreparedFeedItem = ParsedFeedItem & {
  parsedTags: string[];
  combinedText: string;
};

type DetectedEntityHit = {
  entity_id: string;
  entity_name: string;
  entity_type: "player" | "team" | "league" | string;
  matched_alias: string;
  match_type: "alias";
};

type ParsedDetectedItem = {
  dbRow: {
    sport: Sport;
    title: string;
    url: string;
    source: string;
    published_at: string;
    fetched_at: string;
    tags: string[];
    priority: number;
  };
  detected: DetectedEntityHit[];
};

type NewsRow = {
  id: string;
  url: string;
  published_at?: string | null;
};

type NewsEntityLinkRow = {
  news_item_id: string;
  entity_id: string;
  matched_alias: string;
  match_type: "alias";
};

type ResolveItemSportResult =
  | {
      status: "ok";
      sport: Sport;
      detectedSport: Sport | null;
      verifiedSportContent: boolean;
    }
  | {
      status: "blocked";
      reason: "no_sport_signal" | "sport_mismatch";
      detectedSport: Sport | null;
      verifiedSportContent: boolean;
    };

type SourceVerificationResult = {
  keep: boolean;
  hasVerifiedSportContent: boolean;
};

export type FeedIngestDebug = {
  rawFetchedCount: number;
  afterRequiredFieldsCount: number;
  blockedByMissingRequiredFieldsCount: number;
  afterAgeFilterCount: number;
  blockedByAgeCount: number;
  afterIrrelevantFilterCount: number;
  blockedByIrrelevantCount: number;
  afterMaxItemsCapCount: number;
  cappedAwayCount: number;
  afterSourceSportVerificationCount: number;
  blockedBySourceSportVerificationCount: number;
  afterResolvedSportCount: number;
  blockedByNoSportSignalCount: number;
  blockedBySportMismatchCount: number;
  blockedByUnknownSportReasonCount: number;
  duplicateOrExistingCount: number;
  sampleBlockedByMissingRequiredFields: string[];
  sampleBlockedByAge: string[];
  sampleBlockedByIrrelevant: string[];
  sampleBlockedBySourceSportVerification: string[];
  sampleBlockedByNoSportSignal: string[];
  sampleBlockedBySportMismatch: string[];
};

export type ProcessFeedResult = {
  feedName: string;
  parsedCount: number;
  insertedCount: number;
  entityLinkCount: number;
  pushSent: number;
  status: "ok" | "error";
  error: string | null;
  debug: FeedIngestDebug;
};

/* ==========================================================================
   DEBUG HELPERS
   ========================================================================== */

export function createEmptyFeedIngestDebug(): FeedIngestDebug {
  return {
    rawFetchedCount: 0,
    afterRequiredFieldsCount: 0,
    blockedByMissingRequiredFieldsCount: 0,
    afterAgeFilterCount: 0,
    blockedByAgeCount: 0,
    afterIrrelevantFilterCount: 0,
    blockedByIrrelevantCount: 0,
    afterMaxItemsCapCount: 0,
    cappedAwayCount: 0,
    afterSourceSportVerificationCount: 0,
    blockedBySourceSportVerificationCount: 0,
    afterResolvedSportCount: 0,
    blockedByNoSportSignalCount: 0,
    blockedBySportMismatchCount: 0,
    blockedByUnknownSportReasonCount: 0,
    duplicateOrExistingCount: 0,
    sampleBlockedByMissingRequiredFields: [],
    sampleBlockedByAge: [],
    sampleBlockedByIrrelevant: [],
    sampleBlockedBySourceSportVerification: [],
    sampleBlockedByNoSportSignal: [],
    sampleBlockedBySportMismatch: [],
  };
}

function pushDebugSample(target: string[], value: string): void {
  if (!value) return;
  if (target.length >= MAX_DEBUG_SAMPLES) return;
  target.push(value);
}

function buildItemSample(item: Partial<ParsedFeedItem>): string {
  const title =
    typeof item.title === "string" && item.title.trim().length > 0
      ? item.title.trim()
      : "[missing title]";

  const publishedAt =
    typeof item.published_at === "string" && item.published_at.trim().length > 0
      ? item.published_at.trim()
      : "no-published-at";

  return `${publishedAt} | ${title}`;
}

/* ==========================================================================
   FEED LOADING HELPERS
   ========================================================================== */

async function loadFeedItems(feed: FeedDef): Promise<ParsedFeedItem[]> {
  if (feed.type === "scrape") {
    if (feed.scrapeSource === "anno1904") {
      const scraped = await scrapeAnno1904();

      return scraped.map((item) => ({
        title: item.title,
        url: item.url,
        published_at: item.published_at ?? null,
        source: feed.name,
        summary: null,
        tags: [],
      }));
    }

    if (feed.scrapeSource === "vskherrlag") {
      const scraped = await scrapeVskHerrlag();

      return scraped.map((item) => ({
        title: item.title,
        url: item.url,
        published_at: item.published_at ?? null,
        source: feed.name,
        summary: null,
        tags: [],
      }));
    }

    if (feed.scrapeSource === "olandsbladetKalmarFF") {
      const scraped = await scrapeOlandsbladetKalmarFF();

      return scraped.map((item) => ({
        title: item.title,
        url: item.url,
        published_at: item.published_at ?? null,
        source: feed.name,
        summary: null,
        tags: [],
      }));
    }

    throw new Error(`Unknown scrape source for feed: ${feed.name}`);
  }

  return (await parseRssFeed(feed.url)) as ParsedFeedItem[];
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

function hasRequiredFields(item: ParsedFeedItem | null | undefined): boolean {
  return Boolean(item?.title && item?.url);
}

function withinAge(publishedAtIso?: string | null): boolean {
  if (!publishedAtIso) return true;

  const now = Date.now();
  const timestamp = new Date(publishedAtIso).getTime();

  if (Number.isNaN(timestamp)) return true;

  return now - timestamp <= MAX_INGEST_AGE_HOURS * 3_600_000;
}

function uniqueTags(tags?: string[] | null): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const tag of tags ?? []) {
    const cleaned = String(tag ?? "").trim();
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

export function buildDetectionText(
  item: {
    title: string;
    url?: string | null;
    summary?: string | null;
    tags?: string[] | null;
    source?: string | null;
  },
  feedName: string,
): string {
  return [
    item.title,
    item.url ?? "",
    item.summary ?? "",
    item.source ?? "",
    feedName,
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildRankingInput(
  item: {
    title: string;
    summary?: string | null;
    tags?: string[] | null;
    source?: string | null;
  },
  feedSport?: Sport,
): RankingNewsItem {
  return {
    title: item.title,
    source: item.source ?? null,
    tags: item.tags ?? [],
    sport: feedSport,
    entities: [],
    metadata: null,
    url: "",
  };
}

function calculatePriority(
  searchText: string,
  detected: DetectedEntityHit[],
): number {
  let priority = 0;

  for (const hit of detected) {
    if (hit.entity_type === "player") {
      return 100;
    }

    if (hit.entity_type === "team" || hit.entity_type === "league") {
      const entityNameLower = hit.entity_name.toLowerCase();
      const isDomestic = DOMESTIC_KEYWORDS.some((keyword) =>
        entityNameLower.includes(keyword),
      );

      priority = Math.max(priority, isDomestic ? 80 : 50);
    }
  }

  if (priority < 80) {
    const searchTextLower = searchText.toLowerCase();
    const isDomesticText = DOMESTIC_KEYWORDS.some((keyword) =>
      searchTextLower.includes(keyword),
    );

    if (isDomesticText) {
      priority = Math.max(priority, 80);
    }
  }

  return priority;
}

function runSourceSportVerification(
  feedName: string,
  item: PreparedFeedItem,
): SourceVerificationResult {
  const profile = getSourceProfile(feedName);

  const verificationInput = buildRankingInput({
    title: item.title,
    summary: item.summary ?? null,
    tags: item.parsedTags,
    source: item.source ?? feedName,
  });

  const hasVerifiedSportContent = hasSportContent(verificationInput);

  if (profile.requiresSportVerification && !hasVerifiedSportContent) {
    console.log(
      `[BLOCKED NON-SPORT VERIFIED SOURCE] ${feedName} | ${item.title}`,
    );

    return {
      keep: false,
      hasVerifiedSportContent,
    };
  }

  return {
    keep: true,
    hasVerifiedSportContent,
  };
}

function shouldTrustFeedSport(feedName: string): boolean {
  const profile = getSourceProfile(feedName);
  return profile.trustFeedSport === true;
}

function resolveItemSport(
  item: PreparedFeedItem,
  feedSport: Sport,
  feedName: string,
): ResolveItemSportResult {
  const sportDetectionInput = buildRankingInput(
    {
      title: item.title,
      summary: item.summary ?? null,
      tags: item.parsedTags,
      source: item.source ?? feedName,
    },
    feedSport,
  );

  const detectedSport = detectSportFromContent(sportDetectionInput);
  const verifiedSportContent = hasSportContent(sportDetectionInput);

  if (detectedSport && detectedSport !== feedSport) {
    console.log(
      `[BLOCKED SPORT MISMATCH] ${feedName} | feed=${feedSport} detected=${detectedSport} | ${item.title}`,
    );

    return {
      status: "blocked",
      reason: "sport_mismatch",
      detectedSport,
      verifiedSportContent,
    };
  }

  if (detectedSport === feedSport) {
    return {
      status: "ok",
      sport: feedSport,
      detectedSport,
      verifiedSportContent,
    };
  }

  if (verifiedSportContent) {
    return {
      status: "ok",
      sport: feedSport,
      detectedSport,
      verifiedSportContent,
    };
  }

  if (shouldTrustFeedSport(feedName)) {
    return {
      status: "ok",
      sport: feedSport,
      detectedSport,
      verifiedSportContent,
    };
  }

  console.log(
    `[BLOCKED NO SPORT SIGNAL] ${feedName} | feed=${feedSport} | ${item.title}`,
  );

  return {
    status: "blocked",
    reason: "no_sport_signal",
    detectedSport,
    verifiedSportContent,
  };
}

function buildParsedDetectedItems(
  preparedItems: PreparedFeedItem[],
  feedSport: Sport,
  feedName: string,
  aliasRows: EntityAliasRows,
  nowIso: string,
  debug: FeedIngestDebug,
): ParsedDetectedItem[] {
  const output: ParsedDetectedItem[] = [];

  for (const item of preparedItems) {
    const resolvedSport = resolveItemSport(item, feedSport, feedName);

    if (resolvedSport.status === "blocked") {
      if (resolvedSport.reason === "no_sport_signal") {
        debug.blockedByNoSportSignalCount += 1;
        pushDebugSample(debug.sampleBlockedByNoSportSignal, buildItemSample(item));
      } else if (resolvedSport.reason === "sport_mismatch") {
        debug.blockedBySportMismatchCount += 1;
        pushDebugSample(debug.sampleBlockedBySportMismatch, buildItemSample(item));
      } else {
        debug.blockedByUnknownSportReasonCount += 1;
      }

      continue;
    }

    const publishedAt =
      item.published_at && new Date(item.published_at) > new Date()
        ? nowIso
        : (item.published_at ?? nowIso);

    const detected = detectEntitiesInText(
      item.combinedText,
      aliasRows,
      resolvedSport.sport,
    ) as DetectedEntityHit[];

    const priority = calculatePriority(item.combinedText, detected);

    output.push({
      dbRow: {
        sport: resolvedSport.sport,
        title: item.title,
        url: item.url,
        source: feedName,
        published_at: publishedAt,
        fetched_at: nowIso,
        tags: item.parsedTags,
        priority,
      },
      detected,
    });
  }

  debug.afterResolvedSportCount = output.length;

  return output;
}

async function upsertNewsItems(
  supabase: SupabaseServiceClient,
  payload: ParsedDetectedItem["dbRow"][],
): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from("news_items")
    .upsert(payload, {
      onConflict: "url",
      ignoreDuplicates: true,
    })
    .select();

  if (error) {
    throw error;
  }

  return (data ?? []) as NewsRow[];
}

function buildEntityLinks(
  newlyCreatedRows: NewsRow[],
  parsedItems: ParsedDetectedItem[],
): NewsEntityLinkRow[] {
  const entityLinks: NewsEntityLinkRow[] = [];
  const parsedItemByUrl = new Map<string, ParsedDetectedItem>();

  for (const item of parsedItems) {
    parsedItemByUrl.set(item.dbRow.url, item);
  }

  for (const row of newlyCreatedRows) {
    const matchingParsedItem = parsedItemByUrl.get(row.url);

    if (!matchingParsedItem || matchingParsedItem.detected.length === 0) {
      continue;
    }

    for (const hit of matchingParsedItem.detected) {
      entityLinks.push({
        news_item_id: row.id,
        entity_id: hit.entity_id,
        matched_alias: hit.matched_alias,
        match_type: hit.match_type,
      });
    }
  }

  return entityLinks;
}

async function upsertEntityLinks(
  supabase: SupabaseServiceClient,
  entityLinks: NewsEntityLinkRow[],
): Promise<void> {
  if (entityLinks.length === 0) return;

  const { error } = await supabase.from("news_entities").upsert(entityLinks, {
    onConflict: "news_item_id,entity_id,match_type",
  });

  if (error) {
    throw error;
  }
}

async function dispatchPushForRows(newsRows: NewsRow[]): Promise<number> {
  let dispatched = 0;
  const now = Date.now();

  for (const row of newsRows) {
    const publishedTimestamp = row.published_at
      ? new Date(row.published_at).getTime()
      : now;

    const ageMinutes = (now - publishedTimestamp) / 60_000;

    if (ageMinutes > MAX_PUSH_AGE_MINUTES) {
      continue;
    }

    try {
      const result = await dispatchPushForNewsItem(row.id);
      if (result?.sent) {
        dispatched += result.sent;
      }
    } catch (error) {
      console.error("Push failed:", row.id, error);
    }

    try {
      await auditFavoriteDeliveryForNewsItem(row.id);
    } catch (error) {
      console.error("Favorite delivery audit failed:", row.id, error);
    }
  }

  return dispatched;
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

export async function processFeedIngest(
  feed: FeedDef,
  supabase: SupabaseServiceClient,
  aliasRows: EntityAliasRows,
): Promise<ProcessFeedResult> {
  const debug = createEmptyFeedIngestDebug();

  const rawItems = await loadFeedItems(feed);
  debug.rawFetchedCount = rawItems.length;

  const withRequiredFields: ParsedFeedItem[] = [];

  for (const item of rawItems) {
    if (hasRequiredFields(item)) {
      withRequiredFields.push(item);
      continue;
    }

    debug.blockedByMissingRequiredFieldsCount += 1;
    pushDebugSample(
      debug.sampleBlockedByMissingRequiredFields,
      buildItemSample(item ?? {}),
    );
  }

  debug.afterRequiredFieldsCount = withRequiredFields.length;

  const ageEligibleItems: ParsedFeedItem[] = [];

  for (const item of withRequiredFields) {
    if (withinAge(item.published_at)) {
      ageEligibleItems.push(item);
      continue;
    }

    debug.blockedByAgeCount += 1;
    pushDebugSample(debug.sampleBlockedByAge, buildItemSample(item));
  }

  debug.afterAgeFilterCount = ageEligibleItems.length;

  const preparedItems: PreparedFeedItem[] = ageEligibleItems.map((item) => {
    const parsedTags = uniqueTags(item.tags);
    const combinedText = buildDetectionText(
      {
        title: item.title,
        url: item.url,
        summary: item.summary ?? null,
        tags: parsedTags,
        source: item.source ?? null,
      },
      feed.name,
    );

    return {
      ...item,
      parsedTags,
      combinedText,
    };
  });

  const relevantItems: PreparedFeedItem[] = [];

  for (const item of preparedItems) {
    if (!isIrrelevantSport(item.combinedText)) {
      relevantItems.push(item);
      continue;
    }

    debug.blockedByIrrelevantCount += 1;
    pushDebugSample(debug.sampleBlockedByIrrelevant, buildItemSample(item));
  }

  debug.afterIrrelevantFilterCount = relevantItems.length;

  const cappedItems = relevantItems.slice(0, MAX_ITEMS_PER_FEED);
  debug.afterMaxItemsCapCount = cappedItems.length;
  debug.cappedAwayCount = Math.max(relevantItems.length - cappedItems.length, 0);

  const sourceVerifiedItems: PreparedFeedItem[] = [];

  for (const item of cappedItems) {
    const verification = runSourceSportVerification(feed.name, item);

    if (verification.keep) {
      sourceVerifiedItems.push(item);
      continue;
    }

    debug.blockedBySourceSportVerificationCount += 1;
    pushDebugSample(
      debug.sampleBlockedBySourceSportVerification,
      buildItemSample(item),
    );
  }

  debug.afterSourceSportVerificationCount = sourceVerifiedItems.length;

  const nowIso = new Date().toISOString();
  const parsedItems = buildParsedDetectedItems(
    sourceVerifiedItems,
    feed.sport,
    feed.name,
    aliasRows,
    nowIso,
    debug,
  );

  if (parsedItems.length === 0) {
    return {
      feedName: feed.name,
      parsedCount: 0,
      insertedCount: 0,
      entityLinkCount: 0,
      pushSent: 0,
      status: "ok",
      error: null,
      debug,
    };
  }

  const payload = parsedItems.map((item) => item.dbRow);
  const newlyCreatedRows = await upsertNewsItems(supabase, payload);

  debug.duplicateOrExistingCount = Math.max(
    payload.length - newlyCreatedRows.length,
    0,
  );

  if (newlyCreatedRows.length === 0) {
    return {
      feedName: feed.name,
      parsedCount: parsedItems.length,
      insertedCount: 0,
      entityLinkCount: 0,
      pushSent: 0,
      status: "ok",
      error: null,
      debug,
    };
  }

  const entityLinks = buildEntityLinks(newlyCreatedRows, parsedItems);
  await upsertEntityLinks(supabase, entityLinks);

  const pushSent = await dispatchPushForRows(newlyCreatedRows);

  return {
    feedName: feed.name,
    parsedCount: parsedItems.length,
    insertedCount: newlyCreatedRows.length,
    entityLinkCount: entityLinks.length,
    pushSent,
    status: "ok",
    error: null,
    debug,
  };
}
