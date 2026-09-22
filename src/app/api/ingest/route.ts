// src/app/api/ingest/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { loadEntityAliases } from "@/lib/detectEntities";
import { FEEDS } from "@/lib/ingest/sourceRegistry";
import { processFeedIngest } from "@/lib/ingest/processFeed";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "cron");
  if (unauthorized) {
    return unauthorized;
  }

  const supabase = supabaseService();
  const aliasRows = await loadEntityAliases(supabase, null);

  let totalPushSent = 0;
  let totalInserted = 0;
  const feedResults: Array<{
    feedName: string;
    parsedCount: number;
    insertedCount: number;
    entityLinkCount: number;
    pushSent: number;
  }> = [];

  for (const feed of FEEDS) {
    try {
      const result = await processFeedIngest(feed, supabase, aliasRows);

      totalPushSent += result.pushSent;
      totalInserted += result.insertedCount;
      feedResults.push(result);
    } catch (error) {
      console.error(`Feed error (${feed.name}):`, error);
      feedResults.push({
        feedName: feed.name,
        parsedCount: 0,
        insertedCount: 0,
        entityLinkCount: 0,
        pushSent: 0,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    inserted: totalInserted,
    pushSent: totalPushSent,
    feedsProcessed: FEEDS.length,
    feedResults,
  });
}