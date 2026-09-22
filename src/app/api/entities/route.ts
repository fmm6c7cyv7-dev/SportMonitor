// src/app/api/entities/route.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

/* ==========================================================================
   ROUTE CONFIG
   ========================================================================== */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

// Höj så UI kan få "alla" i browse-läge.
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 500;

/* ==========================================================================
   TYPES
   ========================================================================== */

type Sport = "football" | "hockey";
type EntityType = "player" | "team" | "league";

type SearchEntityRow = {
  id: string;
  sport: Sport;
  type: EntityType;
  name: string;
  slug: string;
  score: number;
};

/* ==========================================================================
   PARAM HELPERS
   ========================================================================== */

function clampInt(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function parseSport(raw: string | null): Sport | null {
  const value = (raw ?? "").trim().toLowerCase();

  return value === "football" || value === "hockey"
    ? (value as Sport)
    : null;
}

function parseType(raw: string | null): EntityType | null {
  const value = (raw ?? "").trim().toLowerCase();

  return value === "player" || value === "team" || value === "league"
    ? (value as EntityType)
    : null;
}

/* ==========================================================================
   PRESENTATION HELPERS
   ========================================================================== */

function iconForType(type: EntityType): string {
  if (type === "player") return "👤";
  if (type === "team") return "🛡️";
  return "🏆";
}

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function GET(req: NextRequest) {
  const sport = parseSport(req.nextUrl.searchParams.get("sport"));
  const type = parseType(req.nextUrl.searchParams.get("type"));
  const query = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const limit = clampInt(
    Number(req.nextUrl.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`),
    1,
    MAX_LIMIT,
    DEFAULT_LIMIT,
  );

  if (!sport) {
    return NextResponse.json({ error: "Invalid sport" }, { status: 400 });
  }

  // Browse-läge: tillåt tom query om type är satt.
  const isBrowse = query.length === 0 && !!type;

  // Sök-läge: kräver minst 2 tecken.
  if (!isBrowse && query.length < 2) {
    return NextResponse.json(
      {
        items: [],
        meta: {
          sport,
          type,
          q: query,
          limit,
          note: "q too short",
        },
      },
      { status: 200 },
    );
  }

  const supabase = supabaseService();

  const { data, error } = await supabase.rpc("search_entities", {
    p_sport: sport,
    p_q: query,
    p_type: type,
    p_limit: limit,
  });

  if (error) {
    console.error("[api/entities] search failed:", error);
    return NextResponse.json(
      { error: "Entity search failed" },
      { status: 500 },
    );
  }

  const items = ((data ?? []) as SearchEntityRow[]).map((row) => ({
    id: row.id,
    sport: row.sport,
    type: row.type,
    name: row.name,
    slug: row.slug,
    score: row.score,
    icon: iconForType(row.type),
  }));

  return NextResponse.json(
    {
      items,
      meta: {
        sport,
        type,
        q: query,
        limit,
        returned: items.length,
        browse: isBrowse,
      },
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}