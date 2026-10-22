import { describe, expect, it } from "vitest";
import { isNewsStoryRead, newsReadKeys } from "@/lib/news/storyRead";

describe("local read state across source replacement", () => {
  const firstSource = { id: "first", url: "https://example.com/first", story_id: "first", story_member_ids: ["first", "second"] };
  const replacement = { id: "second", url: "https://example.com/second", story_id: "first", story_member_ids: ["first", "second"] };
  it("treats a replacement as read when the original article ID was saved before grouping", () => {
    expect(isNewsStoryRead(replacement, new Set(["first"]))).toBe(true);
  });
  it("retains read status if a previously opened source is later replaced again", () => {
    const readIds = new Set(newsReadKeys(firstSource));
    expect(isNewsStoryRead(replacement, readIds)).toBe(true);
  });
  it("does not mark unrelated stories as read", () => {
    const other = { id: "other", url: "https://example.com/other" };
    expect(isNewsStoryRead(other, new Set(newsReadKeys(firstSource)))).toBe(false);
  });
});
