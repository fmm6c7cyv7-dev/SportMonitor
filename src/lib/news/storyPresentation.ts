// Pure presentation selection + bounded membership loading. No changes to stored news rows.
import { getCanonicalSourceScoreForDedupe } from "@/lib/news/newsDedupe";
import type { DbItem } from "@/lib/news/newsTypes";
import type { supabaseService } from "@/lib/supabase";

type Database = ReturnType<typeof supabaseService>;
type MemberRow = { news_item_id: string; story_id: string };

export type StoryIndex = {
  storyByArticleId: Map<string, string>;
  memberIds: string[];
};

export function emptyStoryIndex(): StoryIndex {
  return { storyByArticleId: new Map(), memberIds: [] };
}

export async function loadStoryIndex(db: Database, articleIds: string[]): Promise<StoryIndex> {
  if (articleIds.length === 0) return emptyStoryIndex();
  const { data: directlyMatched, error } = await db.from("news_story_members")
    .select("news_item_id,story_id")
    .in("news_item_id", articleIds);
  if (error || !directlyMatched?.length) return emptyStoryIndex();
  const storyIds = Array.from(new Set(directlyMatched.map((row) => row.story_id)));
  const { data: members, error: membersError } = await db.from("news_story_members")
    .select("news_item_id,story_id")
    .in("story_id", storyIds)
    .limit(1000);
  if (membersError) return emptyStoryIndex();
  const all = (members ?? []) as MemberRow[];
  return {
    storyByArticleId: new Map(all.map((row) => [row.news_item_id, row.story_id])),
    memberIds: Array.from(new Set(all.map((row) => row.news_item_id))),
  };
}

export function articleStoryKey(
  articleId: string,
  storyByArticleId: ReadonlyMap<string, string>,
): string {
  return storyByArticleId.get(articleId) ?? articleId;
}

export function collapseConfirmedStories<T extends DbItem>(
  items: T[],
  storyByArticleId: ReadonlyMap<string, string>,
  pinnedUnreadIds: ReadonlySet<string> = new Set(),
): T[] {
  if (storyByArticleId.size === 0) return [...items];
  const byStory = new Map<string, { item: T; index: number; score: number }>();
  items.forEach((item, index) => {
    const key = articleStoryKey(item.id ?? item.url, storyByArticleId);
    const score = getCanonicalSourceScoreForDedupe(item);
    const incumbent = byStory.get(key);
    if (!incumbent) {
      byStory.set(key, { item, index, score });
      return;
    }
    const currentPinned = pinnedUnreadIds.has(item.id ?? "");
    const previousPinned = pinnedUnreadIds.has(incumbent.item.id ?? "");
    if (previousPinned && !currentPinned) return;
    const currentTime = Date.parse(item.published_at) || 0;
    const previousTime = Date.parse(incumbent.item.published_at) || 0;
    // Publisher size alone is not a reason to replace original reporting.
    // A clear source-quality improvement wins; near-ties prefer newer accessible reporting.
    const preferCurrent =
      (currentPinned && !previousPinned) ||
      (currentPinned === previousPinned &&
        (score > incumbent.score + 0.08 ||
          (Math.abs(score - incumbent.score) <= 0.08 &&
            currentTime > previousTime)));
    if (preferCurrent) {
      byStory.set(key, { item, index: incumbent.index, score });
    }
  });
  // Keep each story at its first eligible place in the feed. Downstream ranking
  // and all freshness/personalization logic remain unchanged.
  return [...byStory.values()].sort((a, b) => a.index - b.index).map((entry) => entry.item);
}

export function suppressReadStories<T extends DbItem>(
  items: T[],
  seenIds: ReadonlySet<string>,
  storyByArticleId: ReadonlyMap<string, string>,
): T[] {
  const seenStories = new Set(
    Array.from(seenIds).map((id) => articleStoryKey(id, storyByArticleId)),
  );
  return items.filter((item) =>
    !seenStories.has(articleStoryKey(item.id ?? item.url, storyByArticleId)),
  );
}
