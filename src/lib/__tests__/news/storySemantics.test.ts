import { describe, expect, it } from "vitest";
import { isPossibleSameStory, rankPossibleStories, storyTitleSimilarity, type StoryCandidate } from "@/lib/news/storySemantics";
import { confirmedSameStory, validateStoryVerdict } from "@/lib/news/storyAi";
import { articleStoryKey, collapseConfirmedStories, suppressReadStories } from "@/lib/news/storyPresentation";
import type { DbItem } from "@/lib/news/newsTypes";

const published = "2026-10-22T10:50:00.000Z";
const leksand = "leksand-hockey-team";
function candidate(id: string, title: string, extra: Partial<StoryCandidate> = {}): StoryCandidate {
  return {
    id, title, source: "HockeyNews.se", sport: "hockey", published_at: published,
    entityIds: [leksand], ...extra,
  };
}
const aftonbladet = candidate("a", "Leksand stäms på halv miljon av sponsor");
const hockeyNews = candidate("h", "Ny ekonomisk smäll för Leksand – stäms på en halv miljon");
const expressen = candidate("e", "Leksand stäms på 490 000 kronor");

function feedItem(value: StoryCandidate): DbItem {
  return { ...value, url: "https://example.com/" + value.id, tags: [], priority: 80, sport: value.sport };
}

describe("ingest-only story comparison", () => {
  it("preserves dash clauses in meaningful title similarity", () => {
    expect(storyTitleSimilarity(aftonbladet.title, hockeyNews.title)).toBeGreaterThan(0.1);
    expect(storyTitleSimilarity(hockeyNews.title, expressen.title)).toBeGreaterThan(0.1);
  });
  it("offers semantically different headlines about one club to AI", () => {
    expect(rankPossibleStories(aftonbladet, [hockeyNews, expressen])).toHaveLength(2);
  });
  it("never compares across sports, without a shared precise entity or outside the window", () => {
    expect(isPossibleSameStory(aftonbladet, candidate("f", hockeyNews.title, { sport: "football" }))).toBe(false);
    expect(isPossibleSameStory(aftonbladet, candidate("x", hockeyNews.title, { entityIds: ["other-club"] }))).toBe(false);
    expect(isPossibleSameStory(aftonbladet, candidate("old", hockeyNews.title, {
      published_at: "2026-10-21T10:00:00Z",
    }))).toBe(false);
  });
  it("only accepts grounded high-confidence exact-event AI decisions", () => {
    const valid = validateStoryVerdict({
      same_event: true, material_update: false, confidence: 0.97,
      evidence_a: "Leksand stäms", evidence_b: "Leksand",
    }, aftonbladet.title, hockeyNews.title);
    expect(confirmedSameStory(valid)).toBe(true);
    expect(confirmedSameStory({ ...valid!, confidence: 0.65 })).toBe(false);
    expect(confirmedSameStory({ ...valid!, material_update: true })).toBe(false);
    expect(validateStoryVerdict({
      same_event: true, material_update: false, confidence: 0.99,
      evidence_a: "invented fact", evidence_b: "Leksand",
    }, aftonbladet.title, hockeyNews.title)).toBeNull();
  });
});

describe("source selection and persistent event identity", () => {
  const storyById = new Map([["a", "story-a"], ["h", "story-a"], ["e", "story-a"]]);
  it("shows one representation of a known same story; unrelated articles remain", () => {
    const unrelated = feedItem(candidate("unrelated", "Leksand får ny huvudtränare"));
    const shown = collapseConfirmedStories(
      [feedItem(aftonbladet), feedItem(hockeyNews), feedItem(expressen), unrelated],
      storyById,
    );
    expect(shown.filter((row) => ["a", "h", "e"].includes(row.id ?? ""))).toHaveLength(1);
    expect(shown.some((row) => row.id === "unrelated")).toBe(true);
  });
  it("keeps an unread pushed version of the same event visible", () => {
    const shown = collapseConfirmedStories(
      [feedItem(hockeyNews), feedItem(expressen)],
      storyById,
      new Set(["h"]),
    );
    expect(shown.map((row) => row.id)).toEqual(["h"]);
  });
  it("uses stable story identity to hide a replacement when original was read", () => {
    expect(articleStoryKey("h", storyById)).toBe(articleStoryKey("e", storyById));
    const visible = suppressReadStories(
      [feedItem(expressen), feedItem(candidate("other", "AIK tar ny seger"))],
      new Set(["h"]),
      storyById,
    );
    expect(visible.map((row) => row.id)).toEqual(["other"]);
  });
  it("does not remove anything if story storage or AI is unavailable", () => {
    const items = [feedItem(aftonbladet), feedItem(expressen)];
    expect(collapseConfirmedStories(items, new Map()).map((row) => row.id)).toEqual(["a", "e"]);
  });
});
