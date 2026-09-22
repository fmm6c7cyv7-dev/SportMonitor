// src/app/api/top/route.ts

import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";
import { guardPublicApi } from "@/lib/server/publicApiGuard";

/* ==========================================================================
   ROUTE CONFIG
   ========================================================================== */

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ==========================================================================
   TYPES
   ========================================================================== */

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: { "#text"?: string } | string;
  guid?: string | { "#text"?: string };
};

type Sport = "football" | "hockey";
type FallbackNewsRow = {
  id: string;
  sport: Sport;
  title: string;
  url: string;
  source: string;
  published_at: string | null;
  fetched_at: string | null;
  tags: unknown;
};

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const TOP_MAX_AGE_HOURS = Number(process.env.TOP_MAX_AGE_HOURS ?? 6);

/* ==========================================================================
   RSS / TEXT HELPERS
   ========================================================================== */

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function getText(item: RssItem): string {
  const title = stripCdata(String(item.title ?? "").trim());
  const source =
    typeof item.source === "string"
      ? item.source
      : String(item.source?.["#text"] ?? "").trim();

  return `${title} ${source}`.trim().toLowerCase();
}

function detectSport(text: string): Sport {
  const hockeyRegex =
    /\b(shl|hockeyallsvenskan|hockeyallsv|allsvenskan hockey|ishockey|hockey|powerplay|boxplay|utvisning|period|tekning|pp|bp)\b/i;

  const footballRegex =
    /\b(allsvenskan|superettan|fotboll|premier league|championship|serie a|la liga|bundesliga|eredivisie|målskytt|straff|hörna|offside|xg)\b/i;

  const hasHockey = hockeyRegex.test(text);
  const hasFootball = footballRegex.test(text);

  if (hasHockey && !hasFootball) return "hockey";
  if (hasFootball && !hasHockey) return "football";
  if (/\bhockey\b/i.test(text) || /\bishockey\b/i.test(text)) return "hockey";

  return "football";
}

/* ==========================================================================
   TIME HELPERS
   ========================================================================== */

function ageHours(pubDate?: string): number | null {
  if (!pubDate) return null;

  const timestamp = new Date(pubDate).getTime();
  if (Number.isNaN(timestamp)) return null;

  return (Date.now() - timestamp) / 36e5;
}

function timeAgoShort(iso?: string | null, nowMs = Date.now()): string | null {
  if (!iso) return null;

  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return null;

  const ms = nowMs - timestamp;
  const minutes = Math.floor(ms / 60_000);

  if (minutes < 1) return "live";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `${hours} h`;
}

/* ==========================================================================
   TOP SCORING HELPERS
   ========================================================================== */

function scoreUrgency(text: string): number {
  let score = 0;

  if (/\b(mål|goal|scorar|målskytt|nätar|avgör|kvitterar)\b/i.test(text)) {
    score += 40;
  }

  if (
    /\b(1[-–:]0|2[-–:]1|3[-–:]2|4[-–:]3|5[-–:]4|0[-–:]1|1[-–:]2|2[-–:]3)\b/.test(
      text,
    )
  ) {
    score += 35;
  }

  if (/\b(hattrick|gjorde sitt (andra|tredje|fjärde))\b/i.test(text)) {
    score += 20;
  }

  if (/\b(matchslut|slutresultat|full time|ft|slut|avgjort)\b/i.test(text)) {
    score += 18;
  }

  if (/\b(halvtid|halvlek|periodpaus|paus)\b/i.test(text)) {
    score += 10;
  }

  if (/\b(förlängning|straffar|straffläggning)\b/i.test(text)) {
    score += 12;
  }

  if (/\b(rött kort|utvisad|utvisning|matchstraff)\b/i.test(text)) {
    score += 18;
  }

  if (/\b(krönika|intervju|guide|biljetter|event|festival|premiär)\b/i.test(text)) {
    score -= 25;
  }

  if (/\b(rykte|uppgifter|förhandlar|kontrakt|transfer)\b/i.test(text)) {
    score -= 8;
  }

  return score;
}

function scoreRecency(pubDate?: string): number {
  const age = ageHours(pubDate);
  if (age == null) return 0;

  return Math.max(0, 120 - age * 30);
}

function scoreTopItem(item: RssItem): number {
  const text = getText(item);
  const recency = scoreRecency(item.pubDate);
  const urgency = scoreUrgency(text);

  const titleLengthBonus = Math.min(
    8,
    Math.floor(stripCdata(String(item.title ?? "")).length / 25),
  );

  return recency + urgency + titleLengthBonus;
}

/* ==========================================================================
   SUPABASE HELPERS
   ========================================================================== */

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

async function getLatestFromDb() {
  const supabase = createSupabaseClient();

  if (!supabase) {
    return {
      latest_published_at: null as string | null,
      latest_by_sport: {
        football: null as string | null,
        hockey: null as string | null,
      },
    };
  }

  const [latestAnyRes, latestFootballRes, latestHockeyRes] = await Promise.all([
    supabase
      .from("news_items")
      .select("published_at")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1),

    supabase
      .from("news_items")
      .select("published_at")
      .eq("sport", "football")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1),

    supabase
      .from("news_items")
      .select("published_at")
      .eq("sport", "hockey")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(1),
  ]);

  return {
    latest_published_at: latestAnyRes.data?.[0]?.published_at ?? null,
    latest_by_sport: {
      football: latestFootballRes.data?.[0]?.published_at ?? null,
      hockey: latestHockeyRes.data?.[0]?.published_at ?? null,
    },
  };
}

async function fallbackFromDb() {
  const supabase = createSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("news_items")
    .select("id,sport,title,url,source,published_at,fetched_at,tags")
    .order("published_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) {
    return null;
  }

  const row = data[0] as FallbackNewsRow;

  return {
    ...row,
    fallback: true,
    top_max_age_hours: TOP_MAX_AGE_HOURS,
  };
}

/* ==========================================================================
   RESPONSE HELPERS
   ========================================================================== */

function buildUiMeta(lastUpdatedAt: string, latestPublishedAt: string | null) {
  const nowMs = Date.now();

  return {
    updated_label: timeAgoShort(lastUpdatedAt, nowMs) ?? "…",
    latest_label: timeAgoShort(latestPublishedAt, nowMs),
    latest_prefix: "senaste nyhet publicerad",
  };
}

function buildFallbackResponse(args: {
  fallbackItem: FallbackNewsRow & {
    fallback: boolean;
    top_max_age_hours: number;
  } | null;
  latestPublishedAt: string | null;
  latestBySport: {
    football: string | null;
    hockey: string | null;
  };
  lastUpdatedAt: string;
  extra?: Record<string, unknown>;
}) {
  return NextResponse.json(
    {
      item: args.fallbackItem ?? null,
      latest_published_at: args.latestPublishedAt,
      latest_by_sport: args.latestBySport,
      last_updated_at: args.lastUpdatedAt,
      ui: buildUiMeta(args.lastUpdatedAt, args.latestPublishedAt),
      ...(args.extra ?? {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function GET(req: Request) {
  const guarded = guardPublicApi(req, { key: "top:get", limit: 60 });
  if (guarded) return guarded;

  const lastUpdatedAt = new Date().toISOString();

  try {
    const latestMeta = await getLatestFromDb();
    const rssUrl = process.env.TOP_RSS_URL;

    if (!rssUrl) {
      const fallbackItem = await fallbackFromDb();
      const latestPublishedAt =
        latestMeta.latest_published_at ?? fallbackItem?.published_at ?? null;

      return buildFallbackResponse({
        fallbackItem,
        latestPublishedAt,
        latestBySport: latestMeta.latest_by_sport,
        lastUpdatedAt,
      });
    }

    const response = await fetch(rssUrl, {
      headers: { "user-agent": "SportMonitor/1.0" },
      cache: "no-store",
    });

    if (!response.ok) {
      const fallbackItem = await fallbackFromDb();
      const latestPublishedAt =
        latestMeta.latest_published_at ?? fallbackItem?.published_at ?? null;

      return buildFallbackResponse({
        fallbackItem,
        latestPublishedAt,
        latestBySport: latestMeta.latest_by_sport,
        lastUpdatedAt,
        extra: {
          rss_http: response.status,
        },
      });
    }

    const xml = await response.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const rawItems = parsed?.rss?.channel?.item ?? [];
    const items: RssItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

    const freshItems = items.filter((item) => {
      const age = ageHours(item.pubDate);
      return age != null && age <= TOP_MAX_AGE_HOURS;
    });

    if (!freshItems.length) {
      const fallbackItem = await fallbackFromDb();
      const latestPublishedAt =
        latestMeta.latest_published_at ?? fallbackItem?.published_at ?? null;

      return buildFallbackResponse({
        fallbackItem,
        latestPublishedAt,
        latestBySport: latestMeta.latest_by_sport,
        lastUpdatedAt,
        extra: {
          rss_stale_hours: TOP_MAX_AGE_HOURS,
        },
      });
    }

    let bestItem = freshItems[0];
    let bestScore = scoreTopItem(bestItem);

    for (const item of freshItems.slice(1)) {
      const currentScore = scoreTopItem(item);

      if (currentScore > bestScore) {
        bestItem = item;
        bestScore = currentScore;
      }
    }

    const text = getText(bestItem);
    const sport = detectSport(text);

    const item = {
      id: String(
        typeof bestItem.guid === "string"
          ? bestItem.guid
          : bestItem.guid?.["#text"] ?? bestItem.link ?? bestItem.title ?? "top",
      ),
      sport,
      title: stripCdata(String(bestItem.title ?? "").trim()),
      url: String(bestItem.link ?? "").trim(),
      source:
        typeof bestItem.source === "string"
          ? bestItem.source
          : bestItem.source?.["#text"] ?? "Google News",
      published_at: bestItem.pubDate
        ? new Date(bestItem.pubDate).toISOString()
        : null,
      top_max_age_hours: TOP_MAX_AGE_HOURS,
      stale: false,
      age_hours: ageHours(bestItem.pubDate),
    };

    const latestPublishedAt =
      latestMeta.latest_published_at ?? item.published_at ?? null;

    return NextResponse.json(
      {
        item,
        latest_published_at: latestPublishedAt,
        latest_by_sport: latestMeta.latest_by_sport,
        last_updated_at: lastUpdatedAt,
        ui: buildUiMeta(lastUpdatedAt, latestPublishedAt),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=5",
        },
      },
    );
  } catch (error: unknown) {
    console.error("[api/top] failed:", error);
    const latestMeta = await getLatestFromDb();
    const fallbackItem = await fallbackFromDb();
    const latestPublishedAt =
      latestMeta.latest_published_at ?? fallbackItem?.published_at ?? null;

    return buildFallbackResponse({
      fallbackItem,
      latestPublishedAt,
      latestBySport: latestMeta.latest_by_sport,
      lastUpdatedAt,
      extra: {
        error: "TOP_FAILED",
      },
    });
  }
}