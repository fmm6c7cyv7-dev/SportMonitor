import { afterEach, describe, expect, it, vi } from "vitest";
import { createEditorialBudget } from "@/lib/editorial/classifier";
import { linkNewArticlesToStories } from "@/lib/news/storyAi";
import type { supabaseService } from "@/lib/supabase";

const a = {
  id: "a", title: "Leksand stäms på halv miljon av sponsor",
  url: "https://example.com/a", source: "Aftonbladet – Hockey",
  sport: "hockey", published_at: "2026-10-22T10:55:59.000Z",
};
const b = {
  id: "b", title: "Ny ekonomisk smäll för Leksand – stäms på en halv miljon",
  url: "https://example.com/b", source: "HockeyNews.se",
  sport: "hockey", published_at: "2026-10-22T10:49:05.000Z",
};

function fakeDb() {
  const persisted: unknown[] = [];
  const recentChain = {
    in: () => recentChain, gte: () => recentChain,
    order: () => recentChain,
    limit: async () => ({ data: [a, b], error: null }),
  };
  const db = {
    from(table: string) {
      if (table === "news_items") {
        return { select: () => recentChain };
      }
      if (table === "news_entities") {
        return {
          select: () => ({
            in: async () => ({ data: [
              { news_item_id: "a", entity_id: "leksand" },
              { news_item_id: "b", entity_id: "leksand" },
            ], error: null }),
          }),
        };
      }
      if (table === "news_story_members") {
        return {
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
          upsert: async (items: unknown[]) => {
            persisted.push(...items);
            return { error: null };
          },
        };
      }
      throw new Error("Unexpected table " + table);
    },
  };
  return { db: db as unknown as ReturnType<typeof supabaseService>, persisted };
}

describe("story ingest linking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("stores one stable group for a same-story AI verdict before push", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          same_event: true, material_update: false, confidence: 0.99,
          evidence_a: "Leksand stäms", evidence_b: "Leksand",
        }) } }],
      }),
    })));
    const { db, persisted } = fakeDb();
    const budget = createEditorialBudget();
    budget.remaining = 2;
    const duplicateIds = await linkNewArticlesToStories(db, [b], [{
      url: b.url,
      summary: "Sponsor stämmer klubben.",
      detected: [{ entity_id: "leksand", entity_type: "team" }],
    }], budget);
    expect(duplicateIds.has("b")).toBe(true);
    expect(persisted).toEqual([
      { news_item_id: "a", story_id: "a", match_method: "ai" },
      { news_item_id: "b", story_id: "a", match_method: "ai" },
    ]);
  });

  it("does not suppress a genuine new development", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-only");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          same_event: true, material_update: true, confidence: 0.99,
          evidence_a: "Leksand stäms", evidence_b: "Leksand",
        }) } }],
      }),
    })));
    const { db, persisted } = fakeDb();
    const duplicates = await linkNewArticlesToStories(
      db, [b], [{ url: b.url, detected: [{ entity_id: "leksand", entity_type: "team" }] }],
      createEditorialBudget(),
    );
    expect(duplicates.size).toBe(0);
    expect(persisted).toHaveLength(0);
  });
});
