import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

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

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);
  const newsItemId = (searchParams.get("news_item_id") ?? "").trim();
  const deviceId = (searchParams.get("device_id") ?? "").trim();
  const matchedOnly = searchParams.get("matched_only") === "1";
  const limit = clampInt(Number(searchParams.get("limit") ?? "50"), 1, 200, 50);

  const supabase = supabaseService();
  let query = supabase
    .from("favorite_delivery_audit")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (newsItemId) {
    query = query.eq("news_item_id", newsItemId);
  }

  if (deviceId) {
    query = query.eq("device_id", deviceId);
  }

  if (matchedOnly) {
    query = query.eq("matched_favorite", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const newsItemIds = Array.from(
    new Set(
      rows
        .map((row) => row.news_item_id)
        .filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        ),
    ),
  );

  let articleById = new Map<
    string,
    { id: string; title: string; url: string | null; source: string | null }
  >();

  if (newsItemIds.length > 0) {
    const { data: newsRows } = await supabase
      .from("news_items")
      .select("id,title,url,source")
      .in("id", newsItemIds);

    articleById = new Map(
      (newsRows ?? []).map((row) => [
        row.id as string,
        {
          id: row.id as string,
          title: (row.title as string) ?? "",
          url: (row.url as string | null) ?? null,
          source: (row.source as string | null) ?? null,
        },
      ]),
    );
  }

  return NextResponse.json({
    ok: true,
    count: rows.length,
    filters: {
      news_item_id: newsItemId || null,
      device_id: deviceId || null,
      matched_only: matchedOnly,
      limit,
    },
    rows: rows.map((row) => {
      const articleId =
        typeof row.news_item_id === "string" ? row.news_item_id : null;

      return {
        ...row,
        article: articleId ? articleById.get(articleId) ?? null : null,
      };
    }),
  });
}
