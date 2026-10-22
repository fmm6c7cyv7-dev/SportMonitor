import { describe, expect, it } from "vitest";
import { notifiedDeviceIdsForStory } from "@/lib/push/pushStoryDedup";

describe("push story-level recipient guard", () => {
  it("only blocks recipients who already received another member of this story", () => {
    const previous = new Set(["older-source"]);
    const notified = notifiedDeviceIdsForStory([
      { device_id: "one", news_item_id: "older-source" },
      { device_id: "two", news_item_id: "other-unrelated-story" },
      { device_id: "three", news_item_id: "current-source" },
    ], previous);
    expect(notified.has("one")).toBe(true);
    expect(notified.has("two")).toBe(false);
    expect(notified.has("three")).toBe(false);
  });
});
