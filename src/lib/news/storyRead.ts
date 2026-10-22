import type { NewsItem } from "@/lib/types";

/** Preserve locally read state when a confirmed story changes source. */
export function newsReadKeys(
  item: Pick<NewsItem, "id" | "url" | "story_id" | "story_member_ids">,
): string[] {
  return Array.from(new Set(
    [
      String(item.id ?? item.url),
      item.story_id,
      ...(item.story_member_ids ?? []),
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
  ));
}

export function isNewsStoryRead(
  item: Pick<NewsItem, "id" | "url" | "story_id" | "story_member_ids">,
  readIds: ReadonlySet<string>,
): boolean {
  return newsReadKeys(item).some((key) => readIds.has(key));
}
