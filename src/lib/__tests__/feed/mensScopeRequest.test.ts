import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleNewsFeedRequest, type NewsFeedCandidateCache } from "@/lib/feed/newsFeedRequest";

const { state } = vi.hoisted(() => ({ state: { tables: {} as Record<string, Record<string, unknown>[]>, reads: [] as string[] } }));
vi.mock("@/lib/supabase", () => ({
  supabaseService: () => ({ from(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    let isArticleList = false;
    const query = {
      select() { return query; },
      returns() { return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      order(key: string) { isArticleList = table === "news_items" && key === "published_at"; return query; },
      limit() { return query; },
      then(resolve: (result: unknown) => unknown) {
        state.reads.push(isArticleList ? "recent_articles" : table);
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

it("reuses recent articles while an audit sees a push recorded after dispatch", async () => {
  const publishedAt = new Date().toISOString();
  const base = { sport: "football", source: "SVT Sport – Fotboll", published_at: publishedAt, fetched_at: publishedAt, tags: [], priority: 0 };
  state.tables = {
    news_items: [
      { ...base, id: "men", title: "AIK:s herrar vinner i Allsvenskan", url: "https://example.com/men" },
    ],
    push_delivery_log: [],
    user_seen_news: [],
    user_favorites: [{ device_id: "device-aik", entity_id: "aik" }],
    entities: [{ id: "aik", name: "AIK", sport: "football", type: "team", team_id: null, league_id: null }],
    news_entities: [{ news_item_id: "men", entity_id: "aik" }],
  };
  const request = new NextRequest("https://example.com/api/news?sport=football&device_id=device-aik&personalized=1&favorites_first=1");
  const cache: NewsFeedCandidateCache = new Map();
  state.reads = [];

  const dispatch = await handleNewsFeedRequest(request, cache);
  expect(dispatch.status).toBe(200);
  expect((await dispatch.json()).items.map((item: { id: string }) => item.id)).toEqual(["men"]);
  state.tables.push_delivery_log.push({ device_id: "device-aik", news_item_id: "men", sent_at: publishedAt });

  const audit = await handleNewsFeedRequest(request, cache);
  expect(audit.status).toBe(200);
  expect(state.reads.filter((read) => read === "recent_articles")).toHaveLength(1);
  expect(state.reads.filter((read) => read === "push_delivery_log")).toHaveLength(2);
  // The newly delivered article is fetched through the unread push path.
  expect(state.reads.filter((read) => read === "news_items")).toHaveLength(1);

  const baseline = await handleNewsFeedRequest(request);
  expect(baseline.status).toBe(200);
  expect(await audit.json()).toEqual(await baseline.json());
  expect(state.reads.filter((read) => read === "recent_articles")).toHaveLength(2);
});
