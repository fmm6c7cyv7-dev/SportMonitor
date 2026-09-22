import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildNewsFeedMock, supabaseServiceMock } = vi.hoisted(() => ({
  buildNewsFeedMock: vi.fn(),
  supabaseServiceMock: vi.fn(),
}));

vi.mock("@/lib/news/feedService", () => ({
  buildNewsFeed: buildNewsFeedMock,
  FEED_COLUMN_LIMIT: 30,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseService: supabaseServiceMock,
}));

import { auditFavoriteDeliveryForNewsItem } from "@/lib/audit/favoriteDeliveryAudit";

type QueryState = {
  eq: Record<string, unknown>;
  in: Record<string, unknown[]>;
  order?: { column: string; ascending: boolean };
  limit?: number;
  single?: boolean;
};

type MockRow = Record<string, unknown>;
type QueryResult = {
  data: MockRow | MockRow[] | null;
  error: { message: string } | null;
};
type QueryBuilder = {
  select: () => QueryBuilder;
  eq: (field: string, value: unknown) => QueryBuilder;
  in: (field: string, values: unknown[]) => QueryBuilder;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => QueryBuilder;
  limit: (limit: number) => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
  upsert: (rows: MockRow[]) => Promise<{ error: null }>;
  then: <TResult1 = QueryResult, TResult2 = never>(
    onFulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ) => PromiseLike<TResult1 | TResult2>;
};

function createQueryBuilder(
  table: string,
  rowsByTable: Record<string, MockRow[]>,
  auditWrites: MockRow[][],
  state: QueryState = { eq: {}, in: {} },
): QueryBuilder {
  const executeState = async (activeState: QueryState) => {
    const rows = [...(rowsByTable[table] ?? [])];

    let result = rows.filter((row) =>
      Object.entries(activeState.eq).every(([field, value]) => row[field] === value),
    );

    result = result.filter((row) =>
      Object.entries(activeState.in).every(([field, values]) =>
        values.length === 0 ? true : values.includes(row[field]),
      ),
    );

    if (activeState.order) {
      const { column, ascending } = activeState.order;
      result.sort((a, b) => {
        const aValue = a[column] ?? null;
        const bValue = b[column] ?? null;
        const aMs =
          typeof aValue === "string" ? Date.parse(aValue) || 0 : Number(aValue ?? 0);
        const bMs =
          typeof bValue === "string" ? Date.parse(bValue) || 0 : Number(bValue ?? 0);
        return ascending ? aMs - bMs : bMs - aMs;
      });
    }

    if (typeof activeState.limit === "number") {
      result = result.slice(0, activeState.limit);
    }

    if (activeState.single) {
      return {
        data: result[0] ?? null,
        error: result[0] ? null : { message: "Not found" },
      };
    }

    return { data: result, error: null };
  };

  const builder: QueryBuilder = {
    select: () => builder,
    eq: (field: string, value: unknown) =>
      createQueryBuilder(table, rowsByTable, auditWrites, {
        ...state,
        eq: { ...state.eq, [field]: value },
      }),
    in: (field: string, values: unknown[]) =>
      createQueryBuilder(table, rowsByTable, auditWrites, {
        ...state,
        in: { ...state.in, [field]: values },
      }),
    order: (column: string, options?: { ascending?: boolean }) =>
      createQueryBuilder(table, rowsByTable, auditWrites, {
        ...state,
        order: { column, ascending: options?.ascending ?? true },
      }),
    limit: async (limit: number) =>
      executeState({
        ...state,
        limit,
      }),
    single: async () =>
      executeState({
        ...state,
        single: true,
      }),
    upsert: async (rows: MockRow[]) => {
      auditWrites.push(rows);
      rowsByTable[table] = [...(rowsByTable[table] ?? []), ...rows];
      return { error: null };
    },
    then: <TResult1 = QueryResult, TResult2 = never>(
      onFulfilled?:
        | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onRejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ) => executeState(state).then(onFulfilled, onRejected),
  };

  return builder;
}

function createSupabaseMock(rowsByTable: Record<string, MockRow[]>) {
  const auditWrites: MockRow[][] = [];

  return {
    client: {
      from: (table: string) =>
        createQueryBuilder(table, rowsByTable, auditWrites),
    },
    auditWrites,
  };
}

function createNewsRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "news-1",
    title: "Manchester United jagar ny mittback",
    url: "https://example.com/news-1",
    tags: ["Fotboll"],
    sport: "football",
    fetched_at: "2026-04-08T08:00:00.000Z",
    published_at: "2026-04-08T07:59:05.000Z",
    source: "Example",
    ...overrides,
  };
}

function createFeedDebug(deviceId: string) {
  return {
    device_id_used: deviceId,
    personalization_source: "server_favorites",
    force_included_unread_pushed_ids: [],
  };
}

describe("auditFavoriteDeliveryForNewsItem", () => {
  beforeEach(() => {
    buildNewsFeedMock.mockReset();
    supabaseServiceMock.mockReset();
  });

  it("writes matched favorite row with push_sent false when subscription is missing", async () => {
    const mock = createSupabaseMock({
      news_items: [createNewsRow()],
      entities: [
        {
          id: "football-team-manchester-united",
          name: "Manchester United",
          type: "team",
        },
      ],
      news_entities: [
        {
          news_item_id: "news-1",
          entity_id: "football-team-manchester-united",
        },
      ],
      user_favorites: [
        {
          device_id: "device-manutd",
          entity_id: "football-team-manchester-united",
        },
      ],
      push_subscriptions: [],
      push_delivery_log: [],
      favorite_delivery_audit: [],
    });

    supabaseServiceMock.mockReturnValue(mock.client);
    buildNewsFeedMock.mockResolvedValue({
      includedIds: new Set(["news-1"]),
      debug: createFeedDebug("device-manutd"),
    });

    const result = await auditFavoriteDeliveryForNewsItem("news-1");
    const [rows] = mock.auditWrites;

    expect(result).toEqual({ ok: true, newsItemId: "news-1", rowsWritten: 1 });
    expect(rows[0]).toMatchObject({
      matched_favorite: true,
      feed_eligible: true,
      push_sent: false,
      push_delivery_logged: false,
      device_id: "device-manutd",
      reason: "no_active_subscription",
    });
  });

  it("marks feed_eligible true when the article is included in buildNewsFeed", async () => {
    const mock = createSupabaseMock({
      news_items: [createNewsRow()],
      entities: [
        { id: "entity-juve", name: "Juventus", type: "team" },
      ],
      news_entities: [{ news_item_id: "news-1", entity_id: "entity-juve" }],
      user_favorites: [{ device_id: "device-juve", entity_id: "entity-juve" }],
      push_subscriptions: [{ id: "sub-1", device_id: "device-juve", enabled: true }],
      push_delivery_log: [],
      favorite_delivery_audit: [],
    });

    supabaseServiceMock.mockReturnValue(mock.client);
    buildNewsFeedMock.mockResolvedValue({
      includedIds: new Set(["news-1"]),
      debug: createFeedDebug("device-juve"),
    });

    await auditFavoriteDeliveryForNewsItem("news-1");

    expect(mock.auditWrites[0]?.[0]).toMatchObject({
      device_id: "device-juve",
      feed_eligible: true,
    });
  });

  it("marks push_delivery_logged true when a delivery log row exists", async () => {
    const mock = createSupabaseMock({
      news_items: [createNewsRow()],
      entities: [{ id: "entity-juve", name: "Juventus", type: "team" }],
      news_entities: [{ news_item_id: "news-1", entity_id: "entity-juve" }],
      user_favorites: [{ device_id: "device-juve", entity_id: "entity-juve" }],
      push_subscriptions: [{ id: "sub-1", device_id: "device-juve", enabled: true }],
      push_delivery_log: [
        {
          device_id: "device-juve",
          news_item_id: "news-1",
          sent_at: "2026-04-08T08:05:00.000Z",
        },
      ],
      favorite_delivery_audit: [],
    });

    supabaseServiceMock.mockReturnValue(mock.client);
    buildNewsFeedMock.mockResolvedValue({
      includedIds: new Set(["news-1"]),
      debug: createFeedDebug("device-juve"),
    });

    await auditFavoriteDeliveryForNewsItem("news-1");

    expect(mock.auditWrites[0]?.[0]).toMatchObject({
      push_delivery_logged: true,
      push_sent: true,
      reason: "push_logged",
    });
  });

  it("records VSK Pressgurkan-like audit row with favorite and feed eligibility", async () => {
    const mock = createSupabaseMock({
      news_items: [
        createNewsRow({
          id: "a0f0655e-f463-48ac-ba35-c9db46fd35c2",
          title: "Vi har byggt en fin kultur i VSK",
          source: "Pressgurkan",
        }),
      ],
      entities: [
        {
          id: "football-team-vasteras-sk",
          name: "Västerås SK",
          type: "team",
        },
      ],
      news_entities: [
        {
          news_item_id: "a0f0655e-f463-48ac-ba35-c9db46fd35c2",
          entity_id: "football-team-vasteras-sk",
        },
      ],
      user_favorites: [
        {
          device_id: "device-vsk",
          entity_id: "football-team-vasteras-sk",
        },
      ],
      push_subscriptions: [{ id: "sub-1", device_id: "device-vsk", enabled: true }],
      push_delivery_log: [],
      favorite_delivery_audit: [],
    });

    supabaseServiceMock.mockReturnValue(mock.client);
    buildNewsFeedMock.mockResolvedValue({
      includedIds: new Set(["a0f0655e-f463-48ac-ba35-c9db46fd35c2"]),
      debug: {
        device_id_used: "device-vsk",
        personalization_source: "server_favorites",
        force_included_unread_pushed_ids: [
          "a0f0655e-f463-48ac-ba35-c9db46fd35c2",
        ],
      },
    });

    await auditFavoriteDeliveryForNewsItem(
      "a0f0655e-f463-48ac-ba35-c9db46fd35c2",
    );

    expect(mock.auditWrites[0]?.[0]).toMatchObject({
      device_id: "device-vsk",
      matched_favorite: true,
      feed_eligible: true,
      favorite_entity_names: ["Västerås SK"],
    });
  });

  it("tracks device-specific Manchester United and Juventus favorite matches separately", async () => {
    const mock = createSupabaseMock({
      news_items: [
        createNewsRow({
          id: "news-manutd",
          title: "Manchester United uppges vilja värva ny ytter",
        }),
      ],
      entities: [
        { id: "entity-manutd", name: "Manchester United", type: "team" },
        { id: "entity-juve", name: "Juventus", type: "team" },
      ],
      news_entities: [{ news_item_id: "news-manutd", entity_id: "entity-manutd" }],
      user_favorites: [
        { device_id: "device-manutd", entity_id: "entity-manutd" },
        { device_id: "device-juve", entity_id: "entity-juve" },
      ],
      push_subscriptions: [{ id: "sub-1", device_id: "device-manutd", enabled: true }],
      push_delivery_log: [],
      favorite_delivery_audit: [],
    });

    supabaseServiceMock.mockReturnValue(mock.client);
    buildNewsFeedMock.mockResolvedValue({
      includedIds: new Set(["news-manutd"]),
      debug: createFeedDebug("device-manutd"),
    });

    await auditFavoriteDeliveryForNewsItem("news-manutd");

    expect(mock.auditWrites[0]).toHaveLength(1);
    expect(mock.auditWrites[0]?.[0]).toMatchObject({
      device_id: "device-manutd",
      favorite_entity_names: ["Manchester United"],
    });
  });
});
