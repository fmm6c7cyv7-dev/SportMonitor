import { NextResponse } from "next/server";
import { detectEntitiesInText, loadEntityAliases } from "@/lib/detectEntities";
import { supabaseService } from "@/lib/supabase";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

type NewsItemRow = {
  id: string;
  title: string;
  url: string;
  source: string | null;
  sport: "football" | "hockey";
  tags: string[] | null;
};

type NewsEntityLinkRow = {
  news_item_id: string;
  entity_id: string;
  matched_alias: string;
  match_type: "alias";
};

function buildDetectionTextForStoredArticle(item: {
  title: string;
  url: string;
  source?: string | null;
  tags?: string[] | null;
}): string {
  return [
    item.title,
    item.url,
    item.source ?? "",
    item.source ?? "",
    ...(item.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

async function rebuildNewsEntitiesForNewsItem(newsItemId: string) {
  const supabase = supabaseService();

  const { data: article, error: articleError } = await supabase
    .from("news_items")
    .select("id,title,url,source,sport,tags")
    .eq("id", newsItemId)
    .maybeSingle<NewsItemRow>();

  if (articleError) {
    throw new Error(articleError.message);
  }

  if (!article) {
    return {
      ok: false as const,
      status: 404,
      error: "news_item_not_found",
    };
  }

  const aliases = await loadEntityAliases(supabase, article.sport);
  const detected = detectEntitiesInText(
    buildDetectionTextForStoredArticle(article),
    aliases,
    article.sport,
  );

  const { error: deleteError } = await supabase
    .from("news_entities")
    .delete()
    .eq("news_item_id", newsItemId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const rows: NewsEntityLinkRow[] = detected.map((hit) => ({
    news_item_id: newsItemId,
    entity_id: hit.entity_id,
    matched_alias: hit.matched_alias,
    match_type: "alias",
  }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("news_entities")
      .upsert(rows, {
        onConflict: "news_item_id,entity_id,match_type",
      });

    if (upsertError) {
      throw new Error(upsertError.message);
    }
  }

  const { data: currentRows, error: currentRowsError } = await supabase
    .from("news_entities")
    .select("entity_id,matched_alias,match_type")
    .eq("news_item_id", newsItemId);

  if (currentRowsError) {
    throw new Error(currentRowsError.message);
  }

  return {
    ok: true as const,
    status: 200,
    article,
    rows_written: rows.length,
    entities: currentRows ?? [],
  };
}

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);
  const newsItemId = (searchParams.get("news_item_id") ?? "").trim();

  if (!newsItemId) {
    return NextResponse.json(
      { ok: false, error: "missing news_item_id" },
      { status: 400 },
    );
  }

  const result = await rebuildNewsEntitiesForNewsItem(newsItemId);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    news_item_id: newsItemId,
    rows_written: result.rows_written,
    article: result.article,
    entities: result.entities,
  });
}
