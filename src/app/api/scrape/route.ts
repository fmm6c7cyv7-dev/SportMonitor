// src/app/api/scrape/route.ts

import { NextResponse } from "next/server";
import { scrapeAnno1904, scrapeVskHerrlag } from "@/lib/scrape";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

/* ==========================================================================
   ROUTE CONFIG
   ========================================================================== */

export const runtime = "nodejs";

/* ==========================================================================
   TYPES
   ========================================================================== */

type Source = "anno1904" | "vskherrlag";

/* ==========================================================================
   HELPERS
   ========================================================================== */

function parseSource(raw: string | null): Source | null {
  const value = (raw ?? "").trim().toLowerCase();

  if (value === "anno1904") {
    return "anno1904";
  }

  if (value === "vskherrlag") {
    return "vskherrlag";
  }

  return null;
}

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(req.url);
  const source = parseSource(url.searchParams.get("source"));

  if (!source) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unknown source. Use source=anno1904 or source=vskherrlag",
      },
      { status: 400 },
    );
  }

  try {
    if (source === "anno1904") {
      const items = await scrapeAnno1904();

      return NextResponse.json({
        ok: true,
        source,
        count: items.length,
        items,
      });
    }

    const items = await scrapeVskHerrlag();

    return NextResponse.json({
      ok: true,
      source,
      count: items.length,
      items,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        source,
        error: message,
      },
      { status: 500 },
    );
  }
}