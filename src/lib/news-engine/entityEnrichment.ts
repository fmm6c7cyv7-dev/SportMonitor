// src/lib/news-engine/entityEnrichment.ts

import { rawFootballPlayers } from "@/data/footballPlayers";
import {
  rawFootballLeagues,
  rawHockeyLeagues,
} from "@/data/leagues";
import { rawNhlPlayers } from "@/data/hockeyPlayers";
import { rawFootballTeams } from "@/data/footballTeams";
import { rawHockeyTeams } from "@/data/hockeyTeams";
import { swedishStaffAbroad } from "@/data/swedishStaffAbroad";
import type {
  EngineEntityType,
  EngineSport,
  EntityHit,
  NormalizedArticle,
} from "@/lib/news-engine/types";

type CatalogEntity = {
  entityId: string;
  sport: EngineSport;
  type: EngineEntityType;
  name: string;
  aliases: string[];
  isSwedish: boolean;
  isAbroadCore: boolean;
  confidence: number;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function containsPhrase(haystack: string, value: string): boolean {
  const normalizedValue = normalizeText(value);
  if (!haystack || !normalizedValue) return false;

  return ` ${haystack} `.includes(` ${normalizedValue} `);
}

function uniqueAliases(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeText(value))
        .filter((value) => value.length > 0),
    ),
  );
}

function buildFootballPlayerCatalog(): CatalogEntity[] {
  return rawFootballPlayers.map((player) => {
    const name = `${player.firstName} ${player.lastName}`.trim();
    const normalizedLeague = normalizeText(player.league);
    const isDomestic =
      normalizedLeague === "allsvenskan" ||
      normalizedLeague === "superettan";

    return {
      entityId: `catalog-football-player-${slugify(name)}`,
      sport: "football",
      type: "player",
      name,
      aliases: uniqueAliases([name, player.nickname]),
      isSwedish: true,
      isAbroadCore: !isDomestic,
      confidence: 0.96,
    };
  });
}

function buildHockeyPlayerCatalog(): CatalogEntity[] {
  return rawNhlPlayers.map((player) => {
    const name = `${player.firstName} ${player.lastName}`.trim();

    return {
      entityId: `catalog-hockey-player-${slugify(name)}`,
      sport: "hockey",
      type: "player",
      name,
      aliases: uniqueAliases([name, player.nickname]),
      isSwedish: true,
      isAbroadCore: true,
      confidence: 0.96,
    };
  });
}

function buildStaffCatalog(): CatalogEntity[] {
  return swedishStaffAbroad
    .filter((staff) => staff.active)
    .map((staff) => ({
      entityId: `catalog-${staff.sport}-staff-${slugify(staff.name)}`,
      sport: staff.sport,
      type: "staff" as const,
      name: staff.name,
      aliases: uniqueAliases([staff.name, ...staff.aliases]),
      isSwedish: true,
      isAbroadCore: true,
      confidence: 0.97,
    }));
}

function buildDomesticLeagueCatalog(): CatalogEntity[] {
  const football = rawFootballLeagues
    .filter((league) => normalizeText(league.country) === "sverige")
    .map((league) => ({
      entityId: `catalog-football-league-${slugify(league.name)}`,
      sport: "football" as const,
      type: "league" as const,
      name: league.name,
      aliases: uniqueAliases([league.name]),
      isSwedish: true,
      isAbroadCore: false,
      confidence: 0.94,
    }));

  const hockey = rawHockeyLeagues
    .filter((league) => normalizeText(league.country) === "sverige")
    .map((league) => ({
      entityId: `catalog-hockey-league-${slugify(league.name)}`,
      sport: "hockey" as const,
      type: "league" as const,
      name: league.name,
      aliases: uniqueAliases([league.name]),
      isSwedish: true,
      isAbroadCore: false,
      confidence: 0.94,
    }));

  return [...football, ...hockey];
}

function buildDomesticTeamCatalog(): CatalogEntity[] {
  const football = rawFootballTeams
    .filter((team) => normalizeText(team.country) === "sverige")
    .map((team) => ({
      entityId: `catalog-football-team-${slugify(team.name)}`,
      sport: "football" as const,
      type: "team" as const,
      name: team.name,
      // Official name only. Broad aliases remain the ingest entity detector's job.
      aliases: uniqueAliases([team.name]),
      isSwedish: true,
      isAbroadCore: false,
      confidence: 0.93,
    }));

  const hockey = rawHockeyTeams
    .filter((team) => normalizeText(team.country) === "sverige")
    .map((team) => ({
      entityId: `catalog-hockey-team-${slugify(team.name)}`,
      sport: "hockey" as const,
      type: "team" as const,
      name: team.name,
      aliases: uniqueAliases([team.name]),
      isSwedish: true,
      isAbroadCore: false,
      confidence: 0.93,
    }));

  return [...football, ...hockey];
}

const CORE_CATALOG: CatalogEntity[] = [
  ...buildFootballPlayerCatalog(),
  ...buildHockeyPlayerCatalog(),
  ...buildStaffCatalog(),
  ...buildDomesticLeagueCatalog(),
  ...buildDomesticTeamCatalog(),
];

function buildArticleText(
  article: Pick<NormalizedArticle, "title" | "summary" | "tags">,
): string {
  return normalizeText(
    `${article.title} ${article.summary ?? ""} ${article.tags.join(" ")}`,
  );
}

function entityKey(hit: Pick<EntityHit, "type" | "name">): string {
  return `${hit.type}:${normalizeText(hit.name)}`;
}

function catalogMatches(
  article: Pick<NormalizedArticle, "sport" | "title" | "summary" | "tags">,
): EntityHit[] {
  const text = buildArticleText(article);
  if (!text) return [];

  const matches: EntityHit[] = [];

  for (const entity of CORE_CATALOG) {
    if (entity.sport !== article.sport) continue;

    const matched = entity.aliases.some((alias) => containsPhrase(text, alias));
    if (!matched) continue;

    matches.push({
      entityId: entity.entityId,
      sport: entity.sport,
      type: entity.type,
      name: entity.name,
      confidence: entity.confidence,
      isSwedish: entity.isSwedish,
      isAbroadCore: entity.isAbroadCore,
      origin: "detected",
    });
  }

  return matches;
}

/**
 * Adds conservative catalog-backed Swedish core entity hits.
 *
 * Existing canonical/database hits always win. This is a defensive enrichment
 * layer for the motor so ranking does not depend on incomplete hardcoded
 * fallback lists or on every production article already having a news_entities
 * link.
 */
export function enrichArticleEntities(
  article: NormalizedArticle,
): NormalizedArticle {
  const existing = Array.isArray(article.entityHits)
    ? article.entityHits.filter(Boolean)
    : [];

  const seen = new Set(existing.map(entityKey));
  const enriched = [...existing];

  for (const hit of catalogMatches(article)) {
    const key = entityKey(hit);
    if (seen.has(key)) continue;

    seen.add(key);
    enriched.push(hit);
  }

  return {
    ...article,
    entityHits: enriched,
  };
}

export function enrichArticlesWithCoreEntities(
  articles: NormalizedArticle[],
): NormalizedArticle[] {
  return articles.map(enrichArticleEntities);
}
