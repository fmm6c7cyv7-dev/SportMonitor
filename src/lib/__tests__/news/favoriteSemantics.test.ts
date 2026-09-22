import { describe, expect, it } from "vitest";

import { buildAcceptedItem } from "@/lib/feed/newsFeedRequest";
import {
  isShadowedAmbiguousPlayerFavoriteMatch,
} from "@/lib/news/newsFavorites";
import type {
  DbItem,
  EntityMetaRow,
  FavoriteContextMeta,
  FavoriteMatchMeta,
  NewsEntityRow,
} from "@/lib/news/newsTypes";

const ISAK_ID = "player-alexander-isak";

const isakMeta: EntityMetaRow = {
  id: ISAK_ID,
  type: "player",
  name: "Alexander Isak",
  team_id: "team-liverpool",
};

const directIsak: FavoriteMatchMeta = {
  score: 300,
  type: "player",
  entity_id: ISAK_ID,
  entity_name: "Alexander Isak",
};

const isakContext: FavoriteContextMeta = {
  score: 6,
  favorite_entity_id: ISAK_ID,
  favorite_entity_name: "Alexander Isak",
  context_entity_id: "team-liverpool",
  context_entity_name: "Liverpool",
};

function article(id: string, title: string, tags: string[] = []): DbItem {
  return {
    id,
    sport: "football",
    title,
    url: `https://example.com/${id}`,
    source: "Test Source",
    published_at: "2026-09-21T09:00:00.000Z",
    tags,
    priority: 0,
  };
}

function accepted(args: {
  item: DbItem;
  direct?: FavoriteMatchMeta;
  context?: FavoriteContextMeta;
  entities?: Array<{
    id?: string;
    name?: string;
    type?: "player" | "team" | "league" | "staff";
  }>;
}) {
  const { item, direct, context, entities = [] } = args;

  return buildAcceptedItem({
    item,
    allFavoriteTokens: [],
    favoriteMatchByNewsId: direct && item.id
      ? new Map([[item.id, direct]])
      : new Map(),
    favoriteContextByNewsId: context && item.id
      ? new Map([[item.id, context]])
      : new Map(),
    directFavoriteEntityMetaById: new Map([[ISAK_ID, isakMeta]]),
    newsEntityIdsByNewsId: new Map(),
    newsEntitiesByNewsId: item.id ? new Map([[item.id, entities]]) : new Map(),
    geoActiveRegion: null,
    normalizedTitle: item.title.toLowerCase(),
  });
}

describe("direct favorite vs related context", () => {
  it("keeps a direct Alexander Isak story as a visible favorite match", () => {
    const result = accepted({
      item: article("isak-direct", "Isak kritiseras efter succén: Kräver mer"),
      direct: directIsak,
    });

    expect(result.favorite_match).toBe(true);
    expect(result.isFavorite).toBe(true);
    expect(result.favorite_entity_name).toBe("Alexander Isak");
    expect(result.favorite_context).toBe(false);
  });

  it("treats a Liverpool club story as related context without favorite badge semantics", () => {
    const result = accepted({
      item: article(
        "liverpool-context",
        "Liverpool prepare for another major Premier League test",
        ["Liverpool FC"],
      ),
      direct: directIsak,
      context: isakContext,
    });

    expect(result.favorite_match).toBe(false);
    expect(result.isFavorite).toBe(false);
    expect(result.favorite_entity_name).toBeNull();
    expect(result.favorite_context).toBe(true);
    expect(result.favorite_context_score).toBe(6);
  });

  it("treats a Liverpool teammate story as related context without calling it an Isak article", () => {
    const result = accepted({
      item: article(
        "teammate-context",
        "Florian Wirtz faces fresh decision at Liverpool",
        ["Liverpool FC", "Florian Wirtz"],
      ),
      direct: directIsak,
      context: {
        ...isakContext,
        context_entity_id: "player-florian-wirtz",
        context_entity_name: "Florian Wirtz",
      },
    });

    expect(result.favorite_match).toBe(false);
    expect(result.favorite_entity_name).toBeNull();
    expect(result.favorite_context).toBe(true);
  });

  it("does not connect Juventus-Atalanta to Alexander Isak without Liverpool/Isak context", () => {
    const result = accepted({
      item: article(
        "juventus-atalanta",
        "Juventus claim first home win over Atalanta since 2018",
        ["Serie A Campionato 2026-27"],
      ),
      direct: directIsak,
      entities: [
        {
          id: "player-isak-hien",
          name: "Isak Hien",
          type: "player",
        },
      ],
    });

    expect(result.favorite_match).toBe(false);
    expect(result.isFavorite).toBe(false);
    expect(result.favorite_context).toBe(false);
    expect(result.favorite_context_score).toBe(0);
  });
  it("does not badge Manchester United on an Arsenal story from polluted news_entities", () => {
    const manUtdId = "team-manchester-united";
    const result = buildAcceptedItem({
      item: article(
        "arsenal-story",
        "Mikel Arteta makes Noni Madueke decision as European clubs monitor Arsenal winger",
        ["Arsenal FC", "Premier League", "Noni Madueke"],
      ),
      allFavoriteTokens: [],
      favoriteMatchByNewsId: new Map([
        [
          "arsenal-story",
          {
            score: 200,
            type: "team",
            entity_id: manUtdId,
            entity_name: "Manchester United",
          },
        ],
      ]),
      favoriteContextByNewsId: new Map(),
      directFavoriteEntityMetaById: new Map([
        [
          manUtdId,
          {
            id: manUtdId,
            type: "team",
            name: "Manchester United",
          },
        ],
      ]),
      newsEntityIdsByNewsId: new Map(),
      newsEntitiesByNewsId: new Map(),
      geoActiveRegion: null,
      normalizedTitle:
        "mikel arteta makes noni madueke decision as european clubs monitor arsenal winger",
    });

    expect(result.favorite_match).toBe(false);
    expect(result.favorite_entity_name).toBeNull();
  });
});

describe("ambiguous player alias guard", () => {
  it("rejects Alexander Isak when short alias Isak is shadowed by Isak Hien", () => {
    const rows: NewsEntityRow[] = [
      {
        news_item_id: "juventus-atalanta",
        entity_id: ISAK_ID,
        match_type: "alias",
        matched_alias: "Isak",
      },
      {
        news_item_id: "juventus-atalanta",
        entity_id: "player-isak-hien",
        match_type: "alias",
        matched_alias: "Isak Hien",
      },
    ];

    expect(
      isShadowedAmbiguousPlayerFavoriteMatch(rows[0], rows, isakMeta),
    ).toBe(true);
  });

  it("keeps an unambiguous full-name Alexander Isak entity match", () => {
    const row: NewsEntityRow = {
      news_item_id: "isak-direct",
      entity_id: ISAK_ID,
      match_type: "alias",
      matched_alias: "Alexander Isak",
    };

    expect(
      isShadowedAmbiguousPlayerFavoriteMatch(row, [row], isakMeta),
    ).toBe(false);
  });
});
