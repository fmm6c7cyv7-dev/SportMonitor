import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  dispatchPushForNewsItemMock,
  supabaseServiceMock,
  sendWebPushMock,
  scrapeAnno1904Mock,
  scrapeVskHerrlagMock,
  auditFavoriteDeliveryForNewsItemMock,
  detectEntitiesInTextMock,
  loadEntityAliasesMock,
} = vi.hoisted(() => ({
  dispatchPushForNewsItemMock: vi.fn(),
  supabaseServiceMock: vi.fn(),
  sendWebPushMock: vi.fn(),
  scrapeAnno1904Mock: vi.fn(),
  scrapeVskHerrlagMock: vi.fn(),
  auditFavoriteDeliveryForNewsItemMock: vi.fn(),
  detectEntitiesInTextMock: vi.fn(),
  loadEntityAliasesMock: vi.fn(),
}));

vi.mock("@/lib/pushDispatch", () => ({
  dispatchPushForNewsItem: dispatchPushForNewsItemMock,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseService: supabaseServiceMock,
}));

vi.mock("@/lib/pushServer", () => ({
  sendWebPush: sendWebPushMock,
}));

vi.mock("@/lib/scrape", () => ({
  scrapeAnno1904: scrapeAnno1904Mock,
  scrapeVskHerrlag: scrapeVskHerrlagMock,
}));

vi.mock("@/lib/audit/favoriteDeliveryAudit", () => ({
  auditFavoriteDeliveryForNewsItem: auditFavoriteDeliveryForNewsItemMock,
}));

vi.mock("@/lib/detectEntities", () => ({
  detectEntitiesInText: detectEntitiesInTextMock,
  loadEntityAliases: loadEntityAliasesMock,
}));

import { GET as forcePushGet } from "@/app/api/force-push/route";
import {
  GET as pushDispatchGet,
  POST as pushDispatchPost,
} from "@/app/api/push/dispatch/route";
import { POST as pushTestPost } from "@/app/api/push/test/route";
import { GET as debugEnvGet } from "@/app/api/debug-env/route";
import { GET as scrapeGet } from "@/app/api/scrape/route";
import { GET as favoriteAuditGet } from "@/app/api/debug/favorite-audit/route";
import { GET as favoriteAuditRunGet } from "@/app/api/debug/favorite-audit/run/route";
import { GET as newsEntitiesRunGet } from "@/app/api/debug/news-entities/run/route";

function withAdminAuth(
  url: string,
  init: RequestInit = {},
  secret = "admin-secret",
): NextRequest {
  const headers = new Headers(init.headers ?? undefined);
  headers.set("authorization", ["Bearer", secret].join(" "));

  return new NextRequest(url, {
    ...init,
    headers,
  });
}

function createEmptyPushSubscriptionClient() {
  const execution = Promise.resolve({ data: [], error: null });

  type QueryResult = { data: unknown[]; error: null };
  type PushSubscriptionQuery = {
    select: () => PushSubscriptionQuery;
    eq: (field: string, value: unknown) => PushSubscriptionQuery;
    order: (
      column: string,
      options?: { ascending?: boolean },
    ) => PushSubscriptionQuery;
    limit: (count: number) => Promise<QueryResult>;
    then: Promise<QueryResult>["then"];
  };

  const query: PushSubscriptionQuery = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: () => execution,
    then: (
      onFulfilled: (value: QueryResult) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => execution.then(onFulfilled, onRejected),
  };

  return {
    from: vi.fn(() => query),
  };
}

describe("protected admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAVORITE_AUDIT_SECRET = "admin-secret";
    dispatchPushForNewsItemMock.mockResolvedValue({ ok: true, sent: 1 });
    scrapeAnno1904Mock.mockResolvedValue([]);
    scrapeVskHerrlagMock.mockResolvedValue([]);
    loadEntityAliasesMock.mockResolvedValue([]);
    detectEntitiesInTextMock.mockReturnValue([]);
    auditFavoriteDeliveryForNewsItemMock.mockResolvedValue({
      ok: true,
      newsItemId: "news-1",
      rowsWritten: 0,
    });
    supabaseServiceMock.mockReturnValue(createEmptyPushSubscriptionClient());
  });

  it.each([
    ["force-push", () => forcePushGet(new NextRequest("http://localhost/api/force-push"))],
    [
      "push-dispatch-get",
      () => pushDispatchGet(new Request("http://localhost/api/push/dispatch?id=news-1")),
    ],
    [
      "push-test-post",
      () =>
        pushTestPost(
          new Request("http://localhost/api/push/test", { method: "POST" }),
        ),
    ],
    [
      "debug-env",
      () => debugEnvGet(new Request("http://localhost/api/debug-env")),
    ],
    [
      "scrape",
      () => scrapeGet(new Request("http://localhost/api/scrape?source=anno1904")),
    ],
    [
      "favorite-audit",
      () =>
        favoriteAuditGet(
          new Request(
            "http://localhost/api/debug/favorite-audit?secret=admin-secret&limit=1",
          ),
        ),
    ],
    [
      "favorite-audit-run",
      () =>
        favoriteAuditRunGet(
          new Request(
            "http://localhost/api/debug/favorite-audit/run?secret=admin-secret&news_item_id=news-1",
          ),
        ),
    ],
    [
      "news-entities-run",
      () =>
        newsEntitiesRunGet(
          new Request(
            "http://localhost/api/debug/news-entities/run?secret=admin-secret&news_item_id=news-1",
          ),
        ),
    ],
  ])("returns 401 without header auth for %s", async (_name, run) => {
    const response = await run();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("does not fall back to INGEST_SECRET for admin route auth", async () => {
    process.env.FAVORITE_AUDIT_SECRET = "";
    process.env.INGEST_SECRET = "ingest-secret";

    const response = await debugEnvGet(
      withAdminAuth("http://localhost/api/debug-env", {}, "ingest-secret"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("allows /api/force-push with header auth", async () => {
    const response = await forcePushGet(
      withAdminAuth("http://localhost/api/force-push?id=news-1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      testad_nyhet: "news-1",
    });
    expect(dispatchPushForNewsItemMock).toHaveBeenCalledWith("news-1");
  });

  it("allows /api/push/dispatch POST with header auth", async () => {
    dispatchPushForNewsItemMock.mockResolvedValueOnce({ ok: true, sent: 3 });

    const response = await pushDispatchPost(
      withAdminAuth("http://localhost/api/push/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "news-2" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: 3 });
    expect(dispatchPushForNewsItemMock).toHaveBeenCalledWith("news-2");
  });

  it("allows /api/push/test POST with header auth", async () => {
    const response = await pushTestPost(
      withAdminAuth("http://localhost/api/push/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "No active push subscriptions found",
    });
    expect(sendWebPushMock).not.toHaveBeenCalled();
  });

  it("allows /api/debug-env with header auth", async () => {
    const response = await debugEnvGet(
      withAdminAuth("http://localhost/api/debug-env"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      hasAdmin: true,
    });
  });

  it("allows /api/scrape with header auth", async () => {
    scrapeAnno1904Mock.mockResolvedValueOnce([{ title: "row-1" }]);

    const response = await scrapeGet(
      withAdminAuth("http://localhost/api/scrape?source=anno1904"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      source: "anno1904",
      count: 1,
    });
  });
});
