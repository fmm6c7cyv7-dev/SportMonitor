import { describe, expect, it } from "vitest";
import { evaluatePushAudienceForNewsItem } from "@/lib/push/pushAudience";

type Row = Record<string, unknown>;

class QueryBuilder implements PromiseLike<{ data: unknown; error: null }> {
  private rows: Row[];
  private filters: Array<[string, unknown]> = [];
  private wantsSingle = false;

  constructor(rows: Row[]) {
    this.rows = rows;
  }

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  single<T>(): Promise<{ data: T | null; error: null }> {
    this.wantsSingle = true;
    const filtered = this.filteredRows();
    return Promise.resolve({
      data: (filtered[0] as T | undefined) ?? null,
      error: null,
    });
  }

  private filteredRows(): Row[] {
    return this.rows.filter((row) =>
      this.filters.every(([column, value]) => row[column] === value),
    );
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const data = this.wantsSingle
      ? this.filteredRows()[0] ?? null
      : this.filteredRows();

    return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
  }
}

function fakeSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      return new QueryBuilder(tables[table] ?? []);
    },
  };
}

describe("pushAudience", () => {
  it("does not broadcast VIP-keyword articles to every subscription", async () => {
    const supabase = fakeSupabase({
      news_items: [
        {
          id: "news-1",
          title: "Charbel Eljas målskytt – men Öxnehaga förlorade",
          url: "https://example.com/news-1",
          tags: [],
          sport: "football",
          fetched_at: "2026-09-20T12:12:47.934Z",
          published_at: "2026-09-20T12:11:42.000Z",
          source: "Jönköpings-Posten",
        },
      ],
      entities: [
        {
          id: "team-vsk",
          name: "Västerås SK",
          type: "team",
          team_id: null,
          league_id: "league-superettan",
        },
      ],
      news_entities: [],
      push_subscriptions: [
        {
          id: "sub-1",
          device_id: "device-1",
          endpoint: "https://push.example/sub-1",
          p256dh: "key",
          auth: "auth",
          created_at: "2026-09-20T10:00:00.000Z",
          enabled: true,
        },
      ],
      user_favorites: [
        {
          device_id: "device-1",
          entity_id: "team-vsk",
        },
      ],
    });

    const result = await evaluatePushAudienceForNewsItem(
      supabase as never,
      "news-1",
    );

    expect(result.isVipNews).toBe(true);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.matchedDevices).toEqual([]);
  });

  it("still marks a favorite-matched VIP article as VIP", async () => {
    const supabase = fakeSupabase({
      news_items: [
        {
          id: "news-2",
          title: "Västerås SK målskytt i dramat",
          url: "https://example.com/news-2",
          tags: [],
          sport: "football",
          fetched_at: "2026-09-20T12:12:47.934Z",
          published_at: "2026-09-20T12:11:42.000Z",
          source: "Example",
        },
      ],
      entities: [
        {
          id: "team-vsk",
          name: "Västerås SK",
          type: "team",
          team_id: null,
          league_id: "league-superettan",
        },
      ],
      news_entities: [
        {
          news_item_id: "news-2",
          entity_id: "team-vsk",
        },
      ],
      push_subscriptions: [
        {
          id: "sub-1",
          device_id: "device-1",
          endpoint: "https://push.example/sub-1",
          p256dh: "key",
          auth: "auth",
          created_at: "2026-09-20T10:00:00.000Z",
          enabled: true,
        },
      ],
      user_favorites: [
        {
          device_id: "device-1",
          entity_id: "team-vsk",
        },
      ],
    });

    const result = await evaluatePushAudienceForNewsItem(
      supabase as never,
      "news-2",
    );

    expect(result.isVipNews).toBe(true);
    expect(result.matchedDevices.map((device) => device.deviceId)).toEqual([
      "device-1",
    ]);
  });
});

describe("push women's scope guard", () => {
  it.each([
    "AIK:s stjärnskott Nova Selin visar upp unika planerna",
    "KLART: Nova Selin skriver kontrakt med AIK",
    "KLART: AIK värvar i Damallsvenskan",
  ])("blocks even favorite-linked and VIP eligible articles: %s", async (title) => {
    const supabase = fakeSupabase({
      news_items: [{ id: "women-1", title, sport: "football", tags: [], fetched_at: "2026-10-05T06:00:00Z" }],
      entities: [{ id: "aik", name: "AIK", type: "team" }],
      news_entities: [{ news_item_id: "women-1", entity_id: "aik" }],
      user_favorites: [{ device_id: "device-aik", entity_id: "aik" }],
      push_subscriptions: [{ id: "sub-aik", device_id: "device-aik", enabled: true }],
    });
    const result = await evaluatePushAudienceForNewsItem(supabase as never, "women-1");
    expect(result.news).not.toBeNull();
    expect(result.newsSport).toBeNull();
    expect(result.isVipNews).toBe(false);
    expect(result.matchedDevices).toEqual([]);
    expect(result.subscriptions).toEqual([]);
  });
});
