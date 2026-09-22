import { beforeEach, describe, expect, it, vi } from "vitest";

const { supabaseServiceMock, loadEntityAliasesMock, processFeedIngestMock } =
  vi.hoisted(() => ({
    supabaseServiceMock: vi.fn(),
    loadEntityAliasesMock: vi.fn(),
    processFeedIngestMock: vi.fn(),
  }));

vi.mock("@/lib/supabase", () => ({
  supabaseService: supabaseServiceMock,
}));

vi.mock("@/lib/detectEntities", () => ({
  loadEntityAliases: loadEntityAliasesMock,
}));

vi.mock("@/lib/ingest/sourceRegistry", () => ({
  FEEDS: [{ name: "Mock Feed", url: "https://example.com/feed.xml", sport: "football" }],
}));

vi.mock("@/lib/ingest/processFeed", () => ({
  processFeedIngest: processFeedIngestMock,
}));

import { GET } from "@/app/api/ingest/route";

function withCronAuth(url: string, secret = "ingest-secret"): Request {
  const headers = new Headers();
  headers.set("authorization", ["Bearer", secret].join(" "));

  return new Request(url, { headers });
}

describe("ingest route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "";
    process.env.INGEST_SECRET = "ingest-secret";
    supabaseServiceMock.mockReturnValue({ id: "mock-supabase" });
    loadEntityAliasesMock.mockResolvedValue([]);
    processFeedIngestMock.mockResolvedValue({
      feedName: "Mock Feed",
      parsedCount: 2,
      insertedCount: 1,
      entityLinkCount: 1,
      pushSent: 0,
    });
  });

  it("returns 401 without Authorization header", async () => {
    const response = await GET(new Request("http://localhost/api/ingest"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("does not accept query-string secrets anymore", async () => {
    const response = await GET(
      new Request("http://localhost/api/ingest?secret=ingest-secret"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("allows header auth and runs ingest", async () => {
    const response = await GET(withCronAuth("http://localhost/api/ingest"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      inserted: 1,
      pushSent: 0,
      feedsProcessed: 1,
    });
    expect(loadEntityAliasesMock).toHaveBeenCalledTimes(1);
    expect(processFeedIngestMock).toHaveBeenCalledTimes(1);
  });

  it("accepts CRON_SECRET when configured", async () => {
    process.env.CRON_SECRET = "cron-secret";
    process.env.INGEST_SECRET = "legacy-ingest-secret";

    const response = await GET(
      withCronAuth("http://localhost/api/ingest", "cron-secret"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
