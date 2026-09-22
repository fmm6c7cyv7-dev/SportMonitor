import { NextResponse } from "next/server";
import { auditFavoriteDeliveryForNewsItem } from "@/lib/audit/favoriteDeliveryAudit";
import { supabaseService } from "@/lib/supabase";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

async function loadAuditRowsForNewsItem(newsItemId: string) {
  const supabase = supabaseService();

  const { data, error } = await supabase
    .from("favorite_delivery_audit")
    .select("*")
    .eq("news_item_id", newsItemId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const { data: newsRows } = await supabase
    .from("news_items")
    .select("id,title,url,source")
    .eq("id", newsItemId);

  const article = (newsRows ?? [])[0]
    ? {
        id: String(newsRows?.[0]?.id ?? ""),
        title: String(newsRows?.[0]?.title ?? ""),
        url: (newsRows?.[0]?.url as string | null) ?? null,
        source: (newsRows?.[0]?.source as string | null) ?? null,
      }
    : null;

  return rows.map((row) => ({
    ...row,
    article,
  }));
}

async function handleRun(newsItemId: string) {
  if (!newsItemId) {
    return NextResponse.json(
      { ok: false, error: "missing news_item_id" },
      { status: 400 },
    );
  }

  const result = await auditFavoriteDeliveryForNewsItem(newsItemId);
  const rows = await loadAuditRowsForNewsItem(newsItemId);

  return NextResponse.json({
    ok: true,
    news_item_id: newsItemId,
    rows_written: result.rowsWritten,
    count: rows.length,
    rows,
  });
}

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);
  const newsItemId = (searchParams.get("news_item_id") ?? "").trim();
  return handleRun(newsItemId);
}

export async function POST(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const body = (await req.json().catch(() => ({}))) as {
    news_item_id?: string;
  };
  const newsItemId = (body.news_item_id ?? "").trim();

  return handleRun(newsItemId);
}
