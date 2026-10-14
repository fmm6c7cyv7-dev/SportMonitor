import { createEditorialBudget } from "@/lib/editorial/classifier";
import { backfillRecentEditorialAssessments } from "@/lib/editorial/backfill";
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

  // Runtime OIDC is attached to the Vercel Function request headers.
  const editorialBudget = createEditorialBudget(req.headers.get("x-vercel-oidc-token") ?? undefined);
  let editorialBackfill: Awaited<ReturnType<typeof backfillRecentEditorialAssessments>> | null = null;
  try {
    editorialBackfill = await backfillRecentEditorialAssessments(supabase, editorialBudget);
  } catch (error) {
    console.error("[editorial] bounded backfill failed", error instanceof Error ? error.message : "unknown");
  }

  for (const feed of FEEDS) {
    try {
      const result = await processFeedIngest(feed, supabase, aliasRows, editorialBudget);

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

  console.info("[editorial] ingest summary", editorialBudget.stats);

  return NextResponse.json({
    ok: true,
    editorial: editorialBudget.stats,
    editorialBackfill,
    inserted: totalInserted,
    pushSent: totalPushSent,
    feedsProcessed: FEEDS.length,
    feedResults,
  });
}