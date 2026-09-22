// src/lib/push/pushMatching.ts

import type { PushEntity } from "@/lib/push/pushTypes";

/* ==========================================================================
   MATCHING CONSTANTS
   ========================================================================== */

const TEAM_ALIASES: Record<string, string[]> = {
  Arsenal: ["Gunners"],
  "Aston Villa": ["Villans", "Villa"],
  Bournemouth: ["Cherries"],
  Brentford: ["Bees"],
  Brighton: ["Seagulls"],
  Chelsea: ["Blues"],
  "Crystal Palace": ["Eagles", "Palace"],
  Everton: ["Toffees"],
  Fulham: ["Cottagers"],
  "Ipswich Town": ["Tractor Boys", "Ipswich"],
  "Leicester City": ["Foxes", "Leicester"],
  Liverpool: ["Reds"],
  "Manchester City": ["Man City", "Citizens", "Sky Blues"],
  "Manchester United": ["Man Utd", "ManUtd", "Red Devils"],
  "Newcastle United": ["Magpies", "Newcastle"],
  "Nottingham Forest": ["Forest", "Tricky Trees"],
  Southampton: ["Saints"],
  "Tottenham Hotspur": ["Spurs", "Tottenham"],
  "West Ham United": ["West Ham", "Hammers", "Irons"],
  "Wolverhampton Wanderers": ["Wolves", "Wanderers"],
  Sunderland: ["Black Cats"],
};

/* ==========================================================================
   NORMALIZATION HELPERS
   ========================================================================== */

function foldDiacritics(value: string): string {
  return (value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeToken(value: string): string {
  return foldDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNewsSearchText(
  title: string,
  tags?: string[] | null,
): string {
  return normalizeToken(`${title} ${(tags ?? []).join(" ")}`);
}

/* ==========================================================================
   ENTITY / TERM HELPERS
   ========================================================================== */

function getTeamAliases(teamName: string): string[] {
  return TEAM_ALIASES[teamName] ?? [];
}

function hasTaggedEntityMatch(
  relatedEntityIds: Set<string>,
  taggedEntityIds: Set<string>,
): boolean {
  return Array.from(relatedEntityIds).some((entityId) =>
    taggedEntityIds.has(entityId),
  );
}

function hasTextTermMatch(
  terms: Set<string>,
  normalizedSearchText: string,
): boolean {
  const paddedSearchText = ` ${normalizedSearchText} `;

  return Array.from(terms).some((term) => {
    if (!term) return false;
    return paddedSearchText.includes(` ${term} `);
  });
}

function addNormalizedTerm(terms: Set<string>, value?: string | null): void {
  const normalized = normalizeToken(value ?? "");
  if (normalized) {
    terms.add(normalized);
  }
}

/* ==========================================================================
   FAVORITE MATCH HELPERS
   ========================================================================== */

function collectTeamMatchTerms(
  favoriteEntity: PushEntity,
  typedEntities: PushEntity[],
  terms: Set<string>,
  relatedEntityIds: Set<string>,
): void {
  for (const alias of getTeamAliases(favoriteEntity.name)) {
    addNormalizedTerm(terms, alias);
  }

  const teamPlayers = typedEntities.filter(
    (entity) => entity.type === "player" && entity.team_id === favoriteEntity.id,
  );

  for (const player of teamPlayers) {
    addNormalizedTerm(terms, player.name);
    relatedEntityIds.add(player.id);
  }
}

function collectPlayerMatchTerms(
  favoriteEntity: PushEntity,
  entityMap: Map<string, PushEntity>,
  terms: Set<string>,
  relatedEntityIds: Set<string>,
): void {
  if (!favoriteEntity.team_id) {
    return;
  }

  const playerTeam = entityMap.get(favoriteEntity.team_id);

  if (playerTeam?.type === "team") {
    addNormalizedTerm(terms, playerTeam.name);
    relatedEntityIds.add(playerTeam.id);

    for (const alias of getTeamAliases(playerTeam.name)) {
      addNormalizedTerm(terms, alias);
    }
  }
}

function collectLeagueMatchTerms(
  favoriteEntity: PushEntity,
  typedEntities: PushEntity[],
  terms: Set<string>,
  relatedEntityIds: Set<string>,
): void {
  const leagueChildren = typedEntities.filter(
    (entity) => entity.league_id === favoriteEntity.id,
  );

  for (const child of leagueChildren) {
    addNormalizedTerm(terms, child.name);
    relatedEntityIds.add(child.id);

    if (child.type === "team") {
      for (const alias of getTeamAliases(child.name)) {
        addNormalizedTerm(terms, alias);
      }
    }
  }
}

export function favoriteMatchesNews(
  favoriteEntity: PushEntity,
  typedEntities: PushEntity[],
  entityMap: Map<string, PushEntity>,
  taggedEntityIds: Set<string>,
  normalizedSearchText: string,
): boolean {
  const terms = new Set<string>();
  const relatedEntityIds = new Set<string>();

  addNormalizedTerm(terms, favoriteEntity.name);
  relatedEntityIds.add(favoriteEntity.id);

  if (favoriteEntity.type === "team") {
    collectTeamMatchTerms(favoriteEntity, typedEntities, terms, relatedEntityIds);

    if (hasTaggedEntityMatch(relatedEntityIds, taggedEntityIds)) {
      return true;
    }
  }

  if (favoriteEntity.type === "player") {
    collectPlayerMatchTerms(favoriteEntity, entityMap, terms, relatedEntityIds);

    if (hasTaggedEntityMatch(relatedEntityIds, taggedEntityIds)) {
      return true;
    }
  }

  if (favoriteEntity.type === "league") {
    collectLeagueMatchTerms(
      favoriteEntity,
      typedEntities,
      terms,
      relatedEntityIds,
    );

    if (hasTaggedEntityMatch(relatedEntityIds, taggedEntityIds)) {
      return true;
    }
  }

  return hasTextTermMatch(terms, normalizedSearchText);
}