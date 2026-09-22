// src/app/api/force-push/route.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { dispatchPushForNewsItem } from "@/lib/pushDispatch";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

/* ==========================================================================
   ROUTE CONFIG
   ========================================================================== */

export const dynamic = "force-dynamic";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

// Fallback-ID för snabb manuell testning om inget ?id= anges.
const DEFAULT_TEST_NEWS_ID = "9f0e2b9a-0b8a-4159-9a88-283125416bcc";

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function GET(req: NextRequest) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(req.url);
  const newsId = url.searchParams.get("id") || DEFAULT_TEST_NEWS_ID;

  try {
    const result = await dispatchPushForNewsItem(newsId);

    return NextResponse.json({
      success: true,
      testad_nyhet: newsId,
      resultat: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Fel vid force-push:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}