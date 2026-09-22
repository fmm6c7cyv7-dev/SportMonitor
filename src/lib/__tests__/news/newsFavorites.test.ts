import { describe, expect, it } from "vitest";

import { getBrowseEntities } from "@/lib/entities/catalog";
import { resolveFavoritePolicyExpansion } from "@/lib/news/newsFavorites";

function findEntity(
  sport: "football" | "hockey",
  type: "player" | "team" | "league",
  name: string,
) {
  const entity = getBrowseEntities(sport, type).find(
    (candidate) => candidate.name === name,
  );

  if (!entity) {
    throw new Error(`Missing test entity: ${sport}:${type}:${name}`);
  }

  return entity;
}

function namesForIds(
  sport: "football" | "hockey",
  ids: string[],
): string[] {
  const namesById = new Map(
    getBrowseEntities(sport, "all").map((entity) => [entity.id, entity.name]),
  );

  return ids
    .map((id) => namesById.get(id))
    .filter((name): name is string => Boolean(name));
}

describe("documented favorite expansion policy", () => {
  it("expands a league favorite to Swedish players, not league teams as favorite entities", () => {
    const league = findEntity("football", "league", "Premier League");

    const expansion = resolveFavoritePolicyExpansion(
      {
        id: league.id,
        type: "league",
        name: league.name,
      },
      "football",
    );

    const playerNames = namesForIds("football", expansion.playerIds);

    expect(playerNames).toContain("Alexander Isak");
    expect(playerNames).toContain("Viktor Gyökeres");
    expect(expansion.staff).toEqual([]);
    expect(expansion.leagueTeamIds.length).toBeGreaterThan(0);
    expect(expansion.playerIds).not.toContain(
      findEntity("football", "team", "Liverpool").id,
    );
  });

  it("expands a foreign team favorite only to curated Swedish players and Swedish staff", () => {
    const team = findEntity("football", "team", "Tottenham Hotspur");

    const expansion = resolveFavoritePolicyExpansion(
      {
        id: team.id,
        type: "team",
        name: team.name,
      },
      "football",
    );

    const playerNames = namesForIds("football", expansion.playerIds);
    const staffNames = expansion.staff.map((staff) => staff.name);

    expect(playerNames).toContain("Dejan Kulusevski");
    expect(playerNames).toContain("Lucas Bergvall");
    expect(staffNames).toContain("Andreas Georgson");
    expect(expansion.leagueTeamIds).toEqual([]);
  });

  it("keeps every catalogued player for a Swedish domestic team favorite", () => {
    const team = findEntity("hockey", "team", "Brynäs IF");

    const expansion = resolveFavoritePolicyExpansion(
      {
        id: team.id,
        type: "team",
        name: team.name,
      },
      "hockey",
    );

    const playerNames = namesForIds("hockey", expansion.playerIds);

    // Kieffer Bellows is deliberately useful here: a Swedish-team favorite
    // must include the whole roster, not only Swedish players.
    expect(playerNames).toContain("Kieffer Bellows");
    expect(playerNames).toContain("Nicklas Bäckström");
  });

  it("does not infer foreign hockey players as Swedish for a league favorite", () => {
    const league = findEntity("hockey", "league", "SHL");

    const expansion = resolveFavoritePolicyExpansion(
      {
        id: league.id,
        type: "league",
        name: league.name,
      },
      "hockey",
    );

    const playerNames = namesForIds("hockey", expansion.playerIds);

    expect(playerNames).not.toContain("Kieffer Bellows");
    expect(playerNames).not.toContain("Julien Gauthier");
  });
});
