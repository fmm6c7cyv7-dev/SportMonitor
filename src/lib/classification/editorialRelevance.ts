// src/lib/classification/editorialRelevance.ts

import { rawFootballPlayers } from "@/data/footballPlayers";
import { rawFootballTeams } from "@/data/footballTeams";
import { rawNhlPlayers } from "@/data/hockeyPlayers";
import { rawHockeyTeams } from "@/data/hockeyTeams";
import { rawFootballLeagues, rawHockeyLeagues } from "@/data/leagues";
import { swedishStaffAbroad } from "@/data/swedishStaffAbroad";
import type { RankingEntity } from "@/lib/ranking/rankingTypes";

export type EditorialRelevanceTier = 1 | 2 | 3;

export type EditorialRelevanceResult = {
  tier: EditorialRelevanceTier;
  reasons: string[];
  hasSwedishPlayer: boolean;
  hasSwedishCoach: boolean;
  hasSwedishDomesticContext: boolean;
  hasRelatedClub: boolean;
  hasRelatedLeague: boolean;
};

export type EditorialRelevanceInput = {
  sport: "football" | "hockey";
  title?: string | null;
  source?: string | null;
  tags?: string[] | null;
  entities?: RankingEntity[] | null;
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

function addTerm(target: Set<string>, value: string | null | undefined): void {
  const normalized = normalizeText(value);
  if (normalized) {
    target.add(normalized);
  }
}

function containsTerm(normalizedHaystack: string, normalizedTerm: string): boolean {
  if (!normalizedHaystack || !normalizedTerm) {
    return false;
  }

  return ` ${normalizedHaystack} `.includes(` ${normalizedTerm} `);
}

function containsAny(
  normalizedHaystack: string,
  normalizedTerms: Set<string>,
): boolean {
  for (const term of normalizedTerms) {
    if (containsTerm(normalizedHaystack, term)) {
      return true;
    }
  }

  return false;
}

function entityName(entity: RankingEntity): string {
  return normalizeText(entity.name);
}

function isCanonicalEntitySupportedByPresentation(
  entity: RankingEntity,
  entities: RankingEntity[],
  presentationText: string,
): boolean {
  const normalizedName = entityName(entity);
  if (!normalizedName) return false;

  if (containsTerm(presentationText, normalizedName)) {
    return true;
  }

  if (entity.type !== "player") {
    return false;
  }

  const parts = normalizedName.split(" ").filter(Boolean);
  const surname = parts.at(-1);

  if (!surname || surname.length < 4 || !containsTerm(presentationText, surname)) {
    return false;
  }

  const shadowedByVisiblePlayer = entities.some((other) => {
    if (other === entity || other.type !== "player") return false;

    const otherName = entityName(other);
    if (!otherName || !otherName.includes(" ")) return false;

    return (
      otherName.split(" ").includes(surname) &&
      containsTerm(presentationText, otherName)
    );
  });

  return !shadowedByVisiblePlayer;
}

function hasCanonicalSwedishPlayer(
  entities: RankingEntity[],
  presentationText: string,
): boolean {
  return entities.some(
    (entity) =>
      entity.type === "player" &&
      entity.is_swedish === true &&
      isCanonicalEntitySupportedByPresentation(
        entity,
        entities,
        presentationText,
      ),
  );
}

function hasCanonicalSwedishDomesticContext(
  entities: RankingEntity[],
  presentationText: string,
): boolean {
  return entities.some((entity) => {
    if (entity.type !== "team" && entity.type !== "league") {
      return false;
    }

    const canonicalSwedish =
      entity.is_swedish === true ||
      normalizeText(entity.country) === "sweden" ||
      normalizeText(entity.country) === "sverige";

    return (
      canonicalSwedish &&
      isCanonicalEntitySupportedByPresentation(
        entity,
        entities,
        presentationText,
      )
    );
  });
}

const SWEDISH_FOOTBALL_LEAGUES = new Set(
  rawFootballLeagues
    .filter((league) => normalizeText(league.country) === "sverige")
    .map((league) => normalizeText(league.name)),
);

const SWEDISH_HOCKEY_LEAGUES = new Set(
  rawHockeyLeagues
    .filter((league) => normalizeText(league.country) === "sverige")
    .map((league) => normalizeText(league.name)),
);

function buildDomesticTeamTerms(
  teams: Array<{ name: string; country: string; aliases: string[] }>,
): Set<string> {
  const result = new Set<string>();

  for (const team of teams) {
    if (normalizeText(team.country) !== "sverige") {
      continue;
    }

    addTerm(result, team.name);

    for (const alias of team.aliases ?? []) {
      addTerm(result, alias);
    }
  }

  return result;
}

const SWEDISH_FOOTBALL_TEAM_TERMS = buildDomesticTeamTerms(rawFootballTeams);
const SWEDISH_HOCKEY_TEAM_TERMS = buildDomesticTeamTerms(rawHockeyTeams);

const SWEDISH_FOOTBALL_PLAYER_TERMS = new Set<string>();
for (const player of rawFootballPlayers) {
  addTerm(
    SWEDISH_FOOTBALL_PLAYER_TERMS,
    `${player.firstName} ${player.lastName}`,
  );
}

const SWEDISH_NHL_PLAYER_TERMS = new Set<string>();
for (const player of rawNhlPlayers) {
  addTerm(SWEDISH_NHL_PLAYER_TERMS, `${player.firstName} ${player.lastName}`);
}

function buildStaffNameTerms(sport: "football" | "hockey"): Set<string> {
  const result = new Set<string>();

  for (const staff of swedishStaffAbroad) {
    if (staff.sport !== sport || !staff.active) {
      continue;
    }

    addTerm(result, staff.name);

    for (const alias of staff.aliases) {
      addTerm(result, alias);
    }
  }

  return result;
}

function buildStaffOrganizationTerms(
  sport: "football" | "hockey",
): Set<string> {
  const result = new Set<string>();

  for (const staff of swedishStaffAbroad) {
    if (staff.sport !== sport || !staff.active) {
      continue;
    }

    addTerm(result, staff.organization);

    for (const alias of staff.organizationAliases) {
      addTerm(result, alias);
    }
  }

  return result;
}

function buildStaffCompetitionTerms(
  sport: "football" | "hockey",
): Set<string> {
  const result = new Set<string>();

  for (const staff of swedishStaffAbroad) {
    if (staff.sport !== sport || !staff.active) {
      continue;
    }

    addTerm(result, staff.competition);

    for (const alias of staff.competitionAliases) {
      addTerm(result, alias);
    }
  }

  return result;
}

const SWEDISH_FOOTBALL_STAFF_TERMS = buildStaffNameTerms("football");
const SWEDISH_HOCKEY_STAFF_TERMS = buildStaffNameTerms("hockey");
const RELATED_FOOTBALL_STAFF_ORGANIZATION_TERMS =
  buildStaffOrganizationTerms("football");
const RELATED_HOCKEY_STAFF_ORGANIZATION_TERMS =
  buildStaffOrganizationTerms("hockey");
const RELATED_FOOTBALL_STAFF_COMPETITION_TERMS =
  buildStaffCompetitionTerms("football");
const RELATED_HOCKEY_STAFF_COMPETITION_TERMS =
  buildStaffCompetitionTerms("hockey");

function buildTeamAliasesByName(
  teams: Array<{ name: string; aliases: string[] }>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const team of teams) {
    result.set(normalizeText(team.name), team.aliases ?? []);
  }

  return result;
}

const FOOTBALL_TEAM_ALIASES_BY_NAME = buildTeamAliasesByName(rawFootballTeams);
const HOCKEY_TEAM_ALIASES_BY_NAME = buildTeamAliasesByName(rawHockeyTeams);

function buildRelatedFootballClubTerms(): Set<string> {
  const result = new Set<string>();

  for (const player of rawFootballPlayers) {
    if (SWEDISH_FOOTBALL_LEAGUES.has(normalizeText(player.league))) {
      continue;
    }

    addTerm(result, player.club);

    const aliases =
      FOOTBALL_TEAM_ALIASES_BY_NAME.get(normalizeText(player.club)) ?? [];

    for (const alias of aliases) {
      addTerm(result, alias);
    }
  }

  return result;
}

function buildRelatedHockeyClubTerms(): Set<string> {
  const result = new Set<string>();

  for (const player of rawNhlPlayers) {
    addTerm(result, player.club);

    const aliases =
      HOCKEY_TEAM_ALIASES_BY_NAME.get(normalizeText(player.club)) ?? [];

    for (const alias of aliases) {
      addTerm(result, alias);
    }
  }

  return result;
}

function buildRelatedFootballLeagueTerms(): Set<string> {
  const result = new Set<string>();

  for (const player of rawFootballPlayers) {
    const league = normalizeText(player.league);

    if (!league || SWEDISH_FOOTBALL_LEAGUES.has(league)) {
      continue;
    }

    result.add(league);
  }

  return result;
}

const RELATED_FOOTBALL_CLUB_TERMS = buildRelatedFootballClubTerms();
const RELATED_HOCKEY_CLUB_TERMS = buildRelatedHockeyClubTerms();
const RELATED_FOOTBALL_LEAGUE_TERMS = buildRelatedFootballLeagueTerms();
const RELATED_HOCKEY_LEAGUE_TERMS = new Set(
  rawNhlPlayers.map((player) => normalizeText(player.league)).filter(Boolean),
);

const SWEDISH_NATIONAL_CONTEXT_TERMS = new Set([
  "sverige",
  "svensk",
  "svenska",
  "svenske",
  "tre kronor",
  "blagult",
  "landslaget",
]);

const SWEDISH_COACH_PATTERNS = [
  /\bsvensk tranare\b/u,
  /\bsvenske tranaren\b/u,
  /\bswedish coach\b/u,
  /\bswedish manager\b/u,
];

function hasSwedishCoachText(normalizedTextValue: string): boolean {
  return SWEDISH_COACH_PATTERNS.some((pattern) =>
    pattern.test(normalizedTextValue),
  );
}

export function classifyEditorialRelevance(
  input: EditorialRelevanceInput,
): EditorialRelevanceResult {
  const normalizedTextValue = normalizeText(
    `${input.title ?? ""} ${input.source ?? ""} ${(input.tags ?? []).join(" ")}`,
  );
  const presentationText = normalizeText(
    `${input.title ?? ""} ${(input.tags ?? []).join(" ")}`,
  );
  const canonicalEntities = Array.isArray(input.entities)
    ? input.entities.filter(Boolean)
    : [];

  const playerTerms =
    input.sport === "football"
      ? SWEDISH_FOOTBALL_PLAYER_TERMS
      : SWEDISH_NHL_PLAYER_TERMS;

  const domesticTeamTerms =
    input.sport === "football"
      ? SWEDISH_FOOTBALL_TEAM_TERMS
      : SWEDISH_HOCKEY_TEAM_TERMS;

  const domesticLeagueTerms =
    input.sport === "football"
      ? SWEDISH_FOOTBALL_LEAGUES
      : SWEDISH_HOCKEY_LEAGUES;

  const relatedClubTerms =
    input.sport === "football"
      ? RELATED_FOOTBALL_CLUB_TERMS
      : RELATED_HOCKEY_CLUB_TERMS;

  const relatedLeagueTerms =
    input.sport === "football"
      ? RELATED_FOOTBALL_LEAGUE_TERMS
      : RELATED_HOCKEY_LEAGUE_TERMS;

  const staffTerms =
    input.sport === "football"
      ? SWEDISH_FOOTBALL_STAFF_TERMS
      : SWEDISH_HOCKEY_STAFF_TERMS;

  const relatedStaffOrganizationTerms =
    input.sport === "football"
      ? RELATED_FOOTBALL_STAFF_ORGANIZATION_TERMS
      : RELATED_HOCKEY_STAFF_ORGANIZATION_TERMS;

  const relatedStaffCompetitionTerms =
    input.sport === "football"
      ? RELATED_FOOTBALL_STAFF_COMPETITION_TERMS
      : RELATED_HOCKEY_STAFF_COMPETITION_TERMS;

  const hasSwedishPlayer =
    hasCanonicalSwedishPlayer(canonicalEntities, presentationText) ||
    containsAny(normalizedTextValue, playerTerms);
  const hasNamedSwedishCoach = containsAny(normalizedTextValue, staffTerms);
  const hasSwedishCoach =
    hasNamedSwedishCoach || hasSwedishCoachText(normalizedTextValue);
  const hasSwedishDomesticContext =
    hasCanonicalSwedishDomesticContext(canonicalEntities, presentationText) ||
    containsAny(normalizedTextValue, domesticTeamTerms) ||
    containsAny(normalizedTextValue, domesticLeagueTerms) ||
    containsAny(normalizedTextValue, SWEDISH_NATIONAL_CONTEXT_TERMS);

  const hasPlayerRelatedClub = containsAny(
    normalizedTextValue,
    relatedClubTerms,
  );
  const hasStaffRelatedOrganization = containsAny(
    normalizedTextValue,
    relatedStaffOrganizationTerms,
  );
  const hasPlayerRelatedLeague = containsAny(
    normalizedTextValue,
    relatedLeagueTerms,
  );
  const hasStaffRelatedCompetition = containsAny(
    normalizedTextValue,
    relatedStaffCompetitionTerms,
  );

  const hasRelatedClub =
    hasPlayerRelatedClub || hasStaffRelatedOrganization;
  const hasRelatedLeague =
    hasPlayerRelatedLeague || hasStaffRelatedCompetition;

  const reasons: string[] = [];

  if (hasSwedishPlayer) reasons.push("swedish-player");
  if (hasSwedishCoach) reasons.push("swedish-coach");
  if (hasSwedishDomesticContext) reasons.push("swedish-domestic");
  if (hasPlayerRelatedClub) reasons.push("swedish-related-club");
  if (hasStaffRelatedOrganization) {
    reasons.push("swedish-related-staff-organization");
  }
  if (hasPlayerRelatedLeague) reasons.push("swedish-related-league");
  if (hasStaffRelatedCompetition) {
    reasons.push("swedish-related-staff-competition");
  }

  if (
    hasSwedishPlayer ||
    hasSwedishCoach ||
    hasSwedishDomesticContext
  ) {
    return {
      tier: 1,
      reasons,
      hasSwedishPlayer,
      hasSwedishCoach,
      hasSwedishDomesticContext,
      hasRelatedClub,
      hasRelatedLeague,
    };
  }

  if (hasRelatedClub || hasRelatedLeague) {
    return {
      tier: 2,
      reasons,
      hasSwedishPlayer,
      hasSwedishCoach,
      hasSwedishDomesticContext,
      hasRelatedClub,
      hasRelatedLeague,
    };
  }

  return {
    tier: 3,
    reasons,
    hasSwedishPlayer,
    hasSwedishCoach,
    hasSwedishDomesticContext,
    hasRelatedClub,
    hasRelatedLeague,
  };
}
