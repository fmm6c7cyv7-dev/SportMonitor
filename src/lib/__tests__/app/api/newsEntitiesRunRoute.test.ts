import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  supabaseServiceMock,
  detectEntitiesInTextMock,
  loadEntityAliasesMock,
} = vi.hoisted(() => ({
  supabaseServiceMock: vi.fn(),
  detectEntitiesInTextMock: vi.fn(),
  loadEntityAliasesMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseService: supabaseServiceMock,
}));

vi.mock("@/lib/detectEntities", () => ({
  detectEntitiesInText: detectEntitiesInTextMock,
  loadEntityAliases: loadEntityAliasesMock,
}));

import { GET } from "@/app/api/debug/news-entities/run/route";

describe("debug news entities run route", () => {
  function withAdminAuth(url: string, secret = "test-secret") {
    const headers = new Headers();
    headers.set("authorization", ["Bearer", secret].join(" "));

    return new Request(url, {
      headers,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAVORITE_AUDIT_SECRET = "test-secret";
  });

  it("returns unauthorized when the secret is wrong", async () => {
    const response = await GET(
      withAdminAuth(
        "http://localhost/api/debug/news-entities/run?news_item_id=news-1",
        "wrong",
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("rebuilds news_entities for a specific article id", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "news-1",
        title: "Så många biljetter är sålda till hemmapremiären",
        url: "https://pressgurkan.se/fotboll/vasteras-sk/sa-manga-biljetter-ar-salda-till-hemmapremiaren/",
        source: "Pressgurkan",
        sport: "football",
        tags: [],
      },
      error: null,
    });

    const eqNewsItem = vi.fn().mockReturnValue({ maybeSingle });
    const selectNewsItem = vi.fn().mockReturnValue({ eq: eqNewsItem });

    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const deleteNewsEntities = vi.fn().mockReturnValue({ eq: deleteEq });

    const upsertNewsEntities = vi.fn().mockResolvedValue({ error: null });

    const selectEqCurrent = vi.fn().mockResolvedValue({
      data: [
        {
          entity_id: "football-team-vasteras-sk",
          matched_alias: "Västerås SK",
          match_type: "alias",
        },
      ],
      error: null,
    });
    const selectCurrent = vi.fn().mockReturnValue({ eq: selectEqCurrent });

    const from = vi.fn((table: string) => {
      if (table === "news_items") {
        return { select: selectNewsItem };
      }

      if (table === "news_entities") {
        return {
          delete: deleteNewsEntities,
          upsert: upsertNewsEntities,
          select: selectCurrent,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    supabaseServiceMock.mockReturnValue({ from });
    loadEntityAliasesMock.mockResolvedValue([
      {
        entity_id: "football-team-vasteras-sk",
        entity_name: "Västerås SK",
        entity_type: "team",
        sport: "football",
        alias: "Västerås SK",
        alias_normalized: "vasteras sk",
      },
    ]);
    detectEntitiesInTextMock.mockReturnValue([
      {
        entity_id: "football-team-vasteras-sk",
        entity_name: "Västerås SK",
        entity_type: "team",
        sport: "football",
        matched_alias: "Västerås SK",
        match_type: "alias",
      },
    ]);

    const response = await GET(
      withAdminAuth("http://localhost/api/debug/news-entities/run?news_item_id=news-1"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      news_item_id: "news-1",
      rows_written: 1,
      article: {
        id: "news-1",
        title: "Så många biljetter är sålda till hemmapremiären",
        url: "https://pressgurkan.se/fotboll/vasteras-sk/sa-manga-biljetter-ar-salda-till-hemmapremiaren/",
        source: "Pressgurkan",
        sport: "football",
        tags: [],
      },
      entities: [
        {
          entity_id: "football-team-vasteras-sk",
          matched_alias: "Västerås SK",
          match_type: "alias",
        },
      ],
    });

    expect(loadEntityAliasesMock).toHaveBeenCalledWith(
      expect.anything(),
      "football",
    );
    expect(detectEntitiesInTextMock).toHaveBeenCalledWith(
      expect.stringContaining("vasteras-sk"),
      expect.any(Array),
      "football",
    );
    expect(upsertNewsEntities).toHaveBeenCalledWith(
      [
        {
          news_item_id: "news-1",
          entity_id: "football-team-vasteras-sk",
          matched_alias: "Västerås SK",
          match_type: "alias",
        },
      ],
      {
        onConflict: "news_item_id,entity_id,match_type",
      },
    );
  });
});
