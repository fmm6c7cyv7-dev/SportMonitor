import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleNewsFeedRequest } from "@/lib/feed/newsFeedRequest";

const { state } = vi.hoisted(() => ({ state: { tables: {} as Record<string, Record<string, unknown>[]> } }));
vi.mock("@/lib/supabase", () => ({
  supabaseService: () => ({ from(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const query = {
      select() { return query; },
      returns() { return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      order() { return query; },
      limit() { return query; },
      then(resolve: (result: unknown) => unknown) {
        return Promise.resolve({ data: (state.tables[table] ?? []).filter(row => filters.every(test => test(row))), error: null }).then(resolve);
      },
    };
    return query;
  } }),
}));

describe("stored men's feed scope", () => {
  it.each([
    "",
    "&fav=AIK&favorites_first=1",
    "&device_id=device-aik&personalized=1&favorites_first=1",
  ])("excludes Nova before favorite/unread-push inclusion: %s", async (params) => {
    const published_at = new Date().toISOString();
    const base = { sport: "football", source: "SVT Sport – Fotboll", published_at, fetched_at: published_at, tags: [], priority: 0 };
    state.tables = {
      news_items: [
        { ...base, id: "nova", title: "AIK:s stjärnskott Nova Selin visar upp unika planerna", url: "https://example.com/nova" },
        { ...base, id: "men", title: "AIK:s herrar vinner i Allsvenskan", url: "https://example.com/men" },
      ],
      push_delivery_log: [{ device_id: "device-aik", news_item_id: "nova", sent_at: published_at }],
      user_seen_news: [],
      user_favorites: [{ device_id: "device-aik", entity_id: "aik" }],
      entities: [{ id: "aik", name: "AIK", sport: "football", type: "team", team_id: null, league_id: null }],
      news_entities: [{ news_item_id: "nova", entity_id: "aik" }, { news_item_id: "men", entity_id: "aik" }],
    };
    const response = await handleNewsFeedRequest(new NextRequest(`https://example.com/api/news?sport=football${params}`));
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result.items.map((item: { id: string }) => item.id)).toEqual(["men"]);
    if (params) expect(result.items[0].favorite_match).toBe(true);
  });
});
