import { describe, expect, it } from "vitest";
import {
  buildNewsSearchText,
  favoriteMatchesNews,
} from "@/lib/push/pushMatching";
import type { PushEntity } from "@/lib/push/pushTypes";

function mapEntities(entities: PushEntity[]) {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

describe("pushMatching", () => {
  it("does not match Aston Villa alias inside Sevilla", () => {
    const villa: PushEntity = {
      id: "team-villa",
      name: "Aston Villa",
      type: "team",
      team_id: null,
      league_id: "league-pl",
    };
    const lindelof: PushEntity = {
      id: "player-lindelof",
      name: "Victor Lindelöf",
      type: "player",
      team_id: villa.id,
      league_id: null,
    };
    const entities = [villa, lindelof];

    const matched = favoriteMatchesNews(
      lindelof,
      entities,
      mapEntities(entities),
      new Set(),
      buildNewsSearchText(
        "Sevilla boss baffled by Raphinha Ballon d'Or snub",
        [],
      ),
    );

    expect(matched).toBe(false);
  });

  it("still matches the explicit Villa alias as a whole term", () => {
    const villa: PushEntity = {
      id: "team-villa",
      name: "Aston Villa",
      type: "team",
      team_id: null,
      league_id: "league-pl",
    };
    const lindelof: PushEntity = {
      id: "player-lindelof",
      name: "Victor Lindelöf",
      type: "player",
      team_id: villa.id,
      league_id: null,
    };
    const entities = [villa, lindelof];

    const matched = favoriteMatchesNews(
      lindelof,
      entities,
      mapEntities(entities),
      new Set(),
      buildNewsSearchText("Villa prepare for weekend fixture", []),
    );

    expect(matched).toBe(true);
  });
});
