// src/lib/entities/browseSearch.ts

import type { Sport } from "@/lib/types";
import type {
  BrowseEntity,
  BrowseEntityType,
} from "@/lib/entities/browseTypes";
import {
  getEntitySearchStrings,
  normalizeBrowseText,
} from "@/lib/entities/catalog";
import { getSportIndex } from "@/lib/entities/relationGraph";

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }

  return result;
}

function directMatchScore(entity: BrowseEntity, query: string): number {
  const normalizedQuery = normalizeBrowseText(query);
  if (!normalizedQuery) return 0;

  const tokens = getEntitySearchStrings(entity);

  for (const token of tokens) {
    if (token === normalizedQuery) return 140;
    if (token.startsWith(normalizedQuery)) return 110;
    if (token.includes(normalizedQuery)) return 90;
  }

  return 0;
}

function bestDirectMatches(
  entities: BrowseEntity[],
  query: string,
): Array<{ entity: BrowseEntity; score: number }> {
  const scored = entities
    .map((entity) => ({
      entity,
      score: directMatchScore(entity, query),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.entity.name.localeCompare(b.entity.name, "sv"),
    );

  const bestScore = scored[0]?.score ?? 0;

  return bestScore
    ? scored.filter((item) => item.score >= Math.max(90, bestScore - 20))
    : [];
}

export function searchBrowseSuggestions(
  sport: Sport,
  type: BrowseEntityType | "all",
  query: string,
): BrowseEntity[] {
  const normalizedQuery = normalizeBrowseText(query);
  if (!normalizedQuery) return [];

  const index = getSportIndex(sport);
  const playerMatches = bestDirectMatches(index.players, normalizedQuery);
  const teamMatches = bestDirectMatches(index.teams, normalizedQuery);
  const leagueMatches = bestDirectMatches(index.leagues, normalizedQuery);

  if (type === "team") {
    return teamMatches.map((match) => match.entity);
  }

  if (type === "player") {
    return playerMatches.map((match) => match.entity);
  }

  if (type === "league") {
    return leagueMatches.map((match) => match.entity);
  }

  return uniqueById([
    ...leagueMatches.map((match) => match.entity),
    ...teamMatches.map((match) => match.entity),
    ...playerMatches.map((match) => match.entity),
  ]).slice(0, 30);
}
