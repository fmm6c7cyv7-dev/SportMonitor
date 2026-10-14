import { classifyEditorialArticle, type EditorialBudget } from "@/lib/editorial/classifier";
import { isEditorialCandidate } from "@/lib/editorial/assessment";
import type { supabaseService } from "@/lib/supabase";

const MAX_AGE_MS = 3 * 60 * 60 * 1000;
const MAX_SCAN_ROWS = 250;
const MAX_CANDIDATES_PER_RUN = 3;

type Database = ReturnType<typeof supabaseService>;
type BackfillItem = {
  id: string;
  title: string;
  published_at: string | null;
  fetched_at: string | null;
  tags: string[] | null;
};

export function withinEditorialBackfillWindow(
  item: Pick<BackfillItem, "published_at" | "fetched_at">,
  nowMs: number,
): boolean {
  return [item.published_at, item.fetched_at].every(value => {
    const timestamp = Date.parse(value ?? "");
    return Number.isFinite(timestamp) && timestamp <= nowMs && nowMs - timestamp <= MAX_AGE_MS;
  });
}

export async function backfillRecentEditorialAssessments(
  supabase: Database,
  budget: EditorialBudget,
) {
  const stats = { scanned: 0, candidates: 0, attempted: 0, updated: 0, failed: 0, skippedNoAuth: false };
  // Never re-read the database or repeat model attempts if Gateway is unavailable.
  if (!process.env.AI_GATEWAY_API_KEY && !budget.oidcToken && !process.env.VERCEL_OIDC_TOKEN) {
    stats.skippedNoAuth = true;
    return stats;
  }
  if (budget.remaining <= 0 || budget.activeMs < 4_000) return stats;

  const nowMs = Date.now();
  const upper = new Date(nowMs).toISOString();
  const lower = new Date(nowMs - MAX_AGE_MS).toISOString();
  const {data, error} = await supabase.from("news_items")
    .select("id,title,published_at,fetched_at,tags")
    .is("editorial_assessment", null)
    .gte("published_at", lower)
    .lte("published_at", upper)
    .gte("fetched_at", lower)
    .lte("fetched_at", upper)
    .order("published_at", {ascending: false})
    .limit(MAX_SCAN_ROWS);
  if (error) throw error;

  const rows = (data ?? []) as BackfillItem[];
  stats.scanned = rows.length;
  for (const item of rows) {
    if (!withinEditorialBackfillWindow(item, Date.now()) || !isEditorialCandidate(item)) continue;
    stats.candidates += 1;
    if (stats.attempted >= MAX_CANDIDATES_PER_RUN || budget.remaining <= 0 || budget.activeMs < 4_000) break;

    stats.attempted += 1;
    const result = await classifyEditorialArticle({title: item.title, tags: item.tags}, budget);
    if (!result) { stats.failed += 1; continue; }

    // Recheck age in the UPDATE to handle the article expiring during the model call.
    const completedAt = Date.now();
    if (!withinEditorialBackfillWindow(item, completedAt)) continue;
    const {data: updatedRows, error: updateError} = await supabase.from("news_items")
      .update({editorial_assessment: result})
      .eq("id", item.id)
      .eq("title", item.title)
      .is("editorial_assessment", null)
      .gte("published_at", new Date(completedAt - MAX_AGE_MS).toISOString())
      .lte("published_at", new Date(completedAt).toISOString())
      .gte("fetched_at", new Date(completedAt - MAX_AGE_MS).toISOString())
      .lte("fetched_at", new Date(completedAt).toISOString())
      .select("id");
    if (updateError) throw updateError;
    stats.updated += (updatedRows ?? []).length;
  }
  // Intentional: no insert, no push dispatch, no favorite-delivery replay.
  return stats;
}
