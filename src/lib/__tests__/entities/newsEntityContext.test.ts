// src/lib/__tests__/entities/newsEntityContext.test.ts

import { describe, expect, it } from "vitest";
import {
  buildNewsEntityContext,
  toRankingEntity,
  type CanonicalEntityRow,
} from "@/lib/entities/newsEntityContext";

function row(
  id: string,
  sport: "football" | "hockey",
  type: "player" | "team" | "league" | "staff",
  name: string,
  overrides: Partial<CanonicalEntityRow> = {},
): CanonicalEntityRow {
  return {
    id,
    sport,
    type,
    name,
    league_id: null,
    team_id: null,
    ...overrides,
  };
}

describe("newsEntityContext", () => {
  it("marks a canonical Swedish football player abroad as Swedish abroad core input", () => {
    const premierLeague = row(
      "league-pl",
      "football",
      "league",
      "Premier League",
    );
    const liverpool = row("team-liverpool", "football", "team", "Liverpool", {
      league_id: premierLeague.id,
    });
    const isak = row("player-isak", "football", "player", "Alexander Isak", {
      team_id: liverpool.id,
    });

    const entitiesById = new Map(
      [premierLeague, liverpool, isak].map((entity) => [entity.id, entity]),
    );
    const result = toRankingEntity(isak, entitiesById);

    expect(result.is_swedish).toBe(true);
    expect(result.is_abroad).toBe(true);
    expect(result.nationality).toBe("Sweden");
    expect(result.league).toBe("Premier League");
  });

  it("does not mark a Swedish player in Allsvenskan as abroad", () => {
    const allsvenskan = row(
      "league-allsvenskan",
      "football",
      "league",
      "Allsvenskan",
    );
    const malmo = row("team-malmo", "football", "team", "Malmö FF", {
      league_id: allsvenskan.id,
    });
    const robin = row("player-robin", "football", "player", "Robin Olsen", {
      team_id: malmo.id,
    });

    const entitiesById = new Map(
      [allsvenskan, malmo, robin].map((entity) => [entity.id, entity]),
    );
    const result = toRankingEntity(robin, entitiesById);

    expect(result.is_swedish).toBe(true);
    expect(result.is_abroad).toBe(false);
    expect(result.league).toBe("Allsvenskan");
  });

  it("marks Swedish domestic teams and leagues without inventing player nationality", () => {
    const shl = row("league-shl", "hockey", "league", "SHL");
    const brynas = row("team-brynas", "hockey", "team", "Brynäs IF", {
      league_id: shl.id,
    });
    const foreignPlayer = row(
      "player-bellows",
      "hockey",
      "player",
      "Kieffer Bellows",
      { team_id: brynas.id },
    );

    const entitiesById = new Map(
      [shl, brynas, foreignPlayer].map((entity) => [entity.id, entity]),
    );

    expect(toRankingEntity(shl, entitiesById).is_swedish).toBe(true);
    expect(toRankingEntity(brynas, entitiesById).is_swedish).toBe(true);
    expect(toRankingEntity(foreignPlayer, entitiesById).is_swedish).toBe(false);
  });

  it("builds per-article direct entity lists while using relations only for enrichment", () => {
    const premierLeague = row(
      "league-pl",
      "football",
      "league",
      "Premier League",
    );
    const liverpool = row("team-liverpool", "football", "team", "Liverpool", {
      league_id: premierLeague.id,
    });
    const isak = row("player-isak", "football", "player", "Alexander Isak", {
      team_id: liverpool.id,
    });

    const context = buildNewsEntityContext(
      [
        {
          news_item_id: "news-1",
          entity_id: isak.id,
        },
      ],
      [isak],
      [liverpool, premierLeague],
    );

    expect(context.entityIdsByNewsId.get("news-1")).toEqual(["player-isak"]);
    expect(context.entitiesByNewsId.get("news-1")).toHaveLength(1);
    expect(context.entitiesByNewsId.get("news-1")?.[0]).toMatchObject({
      id: "player-isak",
      name: "Alexander Isak",
      is_swedish: true,
      is_abroad: true,
      league: "Premier League",
    });
  });
});
