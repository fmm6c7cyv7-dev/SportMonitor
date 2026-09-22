// src/lib/entities/newsEntityContext.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { rawFootballPlayers } from "@/data/footballPlayers";
import {
  rawFootballLeagues,
  rawHockeyLeagues,
} from "@/data/leagues";
import { rawNhlPlayers } from "@/data/hockeyPlayers";
import { rawFootballTeams } from "@/data/footballTeams";
import { rawHockeyTeams } from "@/data/hockeyTeams";
import type {
  RankingEntity,
  RankingEntityType,
  Sport,
} from "@/lib/ranking/rankingTypes";

export type NewsEntityLinkRow = {
  news_item_id: string;
  entity_id: string;
};

export type CanonicalEntityRow = {
  id: string;
  sport: Sport;
  type: RankingEntityType;
  name: string;
  league_id?: string | null;
  team_id?: string | null;
};

export type NewsEntityContext = {
  entityIdsByNewsId: Map<string, string[]>;
  entitiesByNewsId: Map<string, RankingEntity[]>;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SWEDISH_FOOTBALL_PLAYER_NAMES = new Set(
  rawFootballPlayers.map((player) =>
    normalize(`${player.firstName} ${player.lastName}`),
  ),
);

const SWEDISH_NHL_PLAYER_NAMES = new Set(
  rawNhlPlayers.map((player) =>
    normalize(`${player.firstName} ${player.lastName}`),
  ),
);

const SWEDISH_FOOTBALL_TEAM_NAMES = new Set(
  rawFootballTeams
    .filter((team) => normalize(team.country) === "sverige")
    .map((team) => normalize(team.name)),
);

const SWEDISH_HOCKEY_TEAM_NAMES = new Set(
  rawHockeyTeams
    .filter((team) => normalize(team.country) === "sverige")
    .map((team) => normalize(team.name)),
);

const SWEDISH_FOOTBALL_LEAGUE_NAMES = new Set(
  rawFootballLeagues
    .filter((league) => normalize(league.country) === "sverige")
    .map((league) => normalize(league.name)),
);

const SWEDISH_HOCKEY_LEAGUE_NAMES = new Set(
  rawHockeyLeagues
    .filter((league) => normalize(league.country) === "sverige")
    .map((league) => normalize(league.name)),
);

function isDomesticLeague(row: CanonicalEntityRow | undefined): boolean {
  if (!row || row.type !== "league") return false;

  const name = normalize(row.name);
  return row.sport === "football"
    ? SWEDISH_FOOTBALL_LEAGUE_NAMES.has(name)
    : SWEDISH_HOCKEY_LEAGUE_NAMES.has(name);
}

function isSwedishEntity(
  row: CanonicalEntityRow,
): boolean {
  const name = normalize(row.name);

  if (row.type === "player") {
    return row.sport === "football"
      ? SWEDISH_FOOTBALL_PLAYER_NAMES.has(name)
      : SWEDISH_NHL_PLAYER_NAMES.has(name);
  }

  if (row.type === "team") {
    return row.sport === "football"
      ? SWEDISH_FOOTBALL_TEAM_NAMES.has(name)
      : SWEDISH_HOCKEY_TEAM_NAMES.has(name);
  }

  if (row.type === "league") {
    return row.sport === "football"
      ? SWEDISH_FOOTBALL_LEAGUE_NAMES.has(name)
      : SWEDISH_HOCKEY_LEAGUE_NAMES.has(name);
  }

  return false;
}

function resolveLeagueRow(
  row: CanonicalEntityRow,
  entitiesById: Map<string, CanonicalEntityRow>,
): CanonicalEntityRow | undefined {
  if (row.type === "league") return row;

  if (row.type === "team") {
    return row.league_id ? entitiesById.get(row.league_id) : undefined;
  }

  if (row.type === "player" || row.type === "staff") {
    const team = row.team_id ? entitiesById.get(row.team_id) : undefined;
    if (team?.league_id) {
      return entitiesById.get(team.league_id);
    }

    return row.league_id ? entitiesById.get(row.league_id) : undefined;
  }

  return undefined;
}

export function toRankingEntity(
  row: CanonicalEntityRow,
  entitiesById: Map<string, CanonicalEntityRow>,
): RankingEntity {
  const leagueRow = resolveLeagueRow(row, entitiesById);
  const isSwedish = isSwedishEntity(row);
  const isAbroad =
    isSwedish &&
    (row.type === "player" || row.type === "staff") &&
    Boolean(leagueRow) &&
    !isDomesticLeague(leagueRow);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sport: row.sport,
    nationality: isSwedish && (row.type === "player" || row.type === "staff")
      ? "Sweden"
      : undefined,
    gender: row.type === "player" || row.type === "staff" ? "male" : undefined,
    country:
      isSwedish && (row.type === "team" || row.type === "league")
        ? "Sweden"
        : undefined,
    league: leagueRow?.name,
    is_swedish: isSwedish,
    is_abroad: isAbroad,
  };
}

function collectRelationIds(rows: CanonicalEntityRow[]): string[] {
  const ids = new Set<string>();

  for (const row of rows) {
    if (row.team_id) ids.add(row.team_id);
    if (row.league_id) ids.add(row.league_id);
  }

  return Array.from(ids);
}

function addLinksByNewsId(
  rows: NewsEntityLinkRow[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const row of rows) {
    const existing = result.get(row.news_item_id) ?? [];
    if (!existing.includes(row.entity_id)) {
      existing.push(row.entity_id);
    }
    result.set(row.news_item_id, existing);
  }

  return result;
}

export function buildNewsEntityContext(
  links: NewsEntityLinkRow[],
  directEntities: CanonicalEntityRow[],
  relationEntities: CanonicalEntityRow[] = [],
): NewsEntityContext {
  const entityIdsByNewsId = addLinksByNewsId(links);
  const entitiesById = new Map<string, CanonicalEntityRow>();

  for (const row of [...directEntities, ...relationEntities]) {
    entitiesById.set(row.id, row);
  }

  const entitiesByNewsId = new Map<string, RankingEntity[]>();

  for (const [newsItemId, entityIds] of entityIdsByNewsId) {
    const entities = entityIds
      .map((entityId) => entitiesById.get(entityId))
      .filter((row): row is CanonicalEntityRow => Boolean(row))
      .map((row) => toRankingEntity(row, entitiesById));

    entitiesByNewsId.set(newsItemId, entities);
  }

  return {
    entityIdsByNewsId,
    entitiesByNewsId,
  };
}

export async function loadNewsEntityContext(
  supabase: SupabaseClient,
  items: Array<{ id: string | null }>,
): Promise<NewsEntityContext> {
  const empty: NewsEntityContext = {
    entityIdsByNewsId: new Map<string, string[]>(),
    entitiesByNewsId: new Map<string, RankingEntity[]>(),
  };

  const itemIds = items
    .map((item) => item.id)
    .filter((value): value is string => Boolean(value));

  if (!itemIds.length) return empty;

  const { data: linkData, error: linkError } = await supabase
    .from("news_entities")
    .select("news_item_id,entity_id")
    .in("news_item_id", itemIds);

  if (linkError) {
    console.error("loadNewsEntityContext:news_entities failed", linkError);
    return empty;
  }

  const links = (linkData ?? []) as NewsEntityLinkRow[];
  const directEntityIds = Array.from(new Set(links.map((row) => row.entity_id)));

  if (!directEntityIds.length) {
    return {
      ...empty,
      entityIdsByNewsId: addLinksByNewsId(links),
    };
  }

  const { data: directData, error: directError } = await supabase
    .from("entities")
    .select("id,sport,type,name,league_id,team_id")
    .in("id", directEntityIds);

  if (directError) {
    console.error("loadNewsEntityContext:entities failed", directError);
    return {
      ...empty,
      entityIdsByNewsId: addLinksByNewsId(links),
    };
  }

  const directEntities = (directData ?? []) as CanonicalEntityRow[];
  const relationIds = collectRelationIds(directEntities).filter(
    (id) => !directEntityIds.includes(id),
  );

  let relationEntities: CanonicalEntityRow[] = [];

  if (relationIds.length > 0) {
    const { data: relationData, error: relationError } = await supabase
      .from("entities")
      .select("id,sport,type,name,league_id,team_id")
      .in("id", relationIds);

    if (!relationError) {
      relationEntities = (relationData ?? []) as CanonicalEntityRow[];

      const secondHopIds = collectRelationIds(relationEntities).filter(
        (id) =>
          !directEntityIds.includes(id) &&
          !relationIds.includes(id),
      );

      if (secondHopIds.length > 0) {
        const { data: secondHopData, error: secondHopError } = await supabase
          .from("entities")
          .select("id,sport,type,name,league_id,team_id")
          .in("id", secondHopIds);

        if (!secondHopError) {
          relationEntities = [
            ...relationEntities,
            ...((secondHopData ?? []) as CanonicalEntityRow[]),
          ];
        }
      }
    } else {
      console.error(
        "loadNewsEntityContext:relation entities failed",
        relationError,
      );
    }
  }

  return buildNewsEntityContext(links, directEntities, relationEntities);
}
