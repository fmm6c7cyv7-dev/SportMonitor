// src/lib/news/newsFavorites.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AcceptedItem,
  EntityMetaRow,
  FavoriteEntityRow,
  FavoriteContextMeta,
  FavoriteExpansionResult,
  FavoriteMatchMeta,
  NewsEntityRow,
  RankingPreparationResult,
} from "@/lib/news/newsTypes";
import type {
  FavoriteRelations,
  FavoriteSignal,
  RankingNewsItem,
  Sport,
} from "@/lib/ranking/rankingTypes";
import { normalizeToken } from "@/lib/news/newsGeo";
import { getBrowseEntities } from "@/lib/entities/catalog";
import {
  getLeagueForTeam,
  getPlayersForTeam,
} from "@/lib/entities/relationGraph";
import { rawNhlPlayers } from "@/data/hockeyPlayers";
import { swedishStaffAbroad } from "@/data/swedishStaffAbroad";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const MAX_FAVS = 5;

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

const TEAM_SUFFIX_TOKENS = new Set([
  "aif",
  "ais",
  "bk",
  "bois",
  "fc",
  "ff",
  "fk",
  "gif",
  "hc",
  "hf",
  "hif",
  "if",
  "ifk",
  "ik",
  "lf",
  "maif",
  "sk",
]);

const FAVORITE_TYPE_PRIORITY: Record<EntityMetaRow["type"], number> = {
  player: 300,
  team: 200,
  staff: 150,
  league: 100,
};

const EXPANDED_ENTITY_WEIGHTS = {
  teamPlayer: 180,
  leaguePlayer: 140,
} as const;

const PLAYER_FAVORITE_CONTEXT_SCORE = 6;

const SWEDISH_LEAGUE_NAMES = new Set([
  "allsvenskan",
  "superettan",
  "shl",
  "hockeyallsvenskan",
]);

const KNOWN_SWEDISH_HOCKEY_PLAYER_NAMES = new Set(
  rawNhlPlayers.map((player) =>
    normalizeToken(`${player.firstName} ${player.lastName}`),
  ),
);

type BrowseSeed = {
  id: string;
  type: EntityMetaRow["type"];
  name: string;
  sport: Sport;
  aliases: string[];
};

function buildBrowseSeedIndex(): Map<string, BrowseSeed> {
  const result = new Map<string, BrowseSeed>();

  const sports: Sport[] = ["football", "hockey"];

  for (const sport of sports) {
    for (const entity of getBrowseEntities(sport, "all")) {
      result.set(entity.id, {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        sport,
        aliases: entity.aliases ?? [],
      });
    }
  }

  return result;
}

function buildBrowseFavoriteRelations(): FavoriteRelations {
  const leagueToTeamIds: Record<string, string[]> = {};
  const teamToPlayerIds: Record<string, string[]> = {};
  const teamToStaffIds: Record<string, string[]> = {};

  const sports: Sport[] = ["football", "hockey"];

  for (const sport of sports) {
    const teams = getBrowseEntities(sport, "team");

    for (const team of teams) {
      const league = getLeagueForTeam(sport, team.id);
      const players = getPlayersForTeam(sport, team.id);

      if (league) {
        const currentLeagueTeams = leagueToTeamIds[league.id] ?? [];
        if (!currentLeagueTeams.includes(team.id)) {
          currentLeagueTeams.push(team.id);
        }
        leagueToTeamIds[league.id] = currentLeagueTeams;
      }

      if (players.length > 0) {
        teamToPlayerIds[team.id] = Array.from(
          new Set(players.map((player) => player.id)),
        );
      } else {
        teamToPlayerIds[team.id] = [];
      }

      teamToStaffIds[team.id] = [];
    }
  }

  return {
    leagueToTeamIds,
    teamToPlayerIds,
    teamToStaffIds,
  };
}

const BROWSE_SEED_BY_ID = buildBrowseSeedIndex();
const BROWSE_RELATIONS = buildBrowseFavoriteRelations();

/* ==========================================================================
   BASIC HELPERS
   ========================================================================== */

function pushUnique(
  target: string[],
  values: Array<string | null | undefined>,
): void {
  const seen = new Set(target);

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;

    seen.add(value);
    target.push(value);
  }
}

function getUniqueNormalizedTokens(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const token = normalizeToken(value);
    if (!token || seen.has(token)) {
      continue;
    }

    seen.add(token);
    normalized.push(token);
  }

  return normalized;
}

function buildDerivedTeamAliases(teamName: string): string[] {
  const normalizedTeamName = normalizeToken(teamName);

  if (!normalizedTeamName) {
    return [];
  }

  const words = normalizedTeamName.split(" ").filter(Boolean);

  if (words.length < 2) {
    return [];
  }

  const suffixWords = words.filter((word) => TEAM_SUFFIX_TOKENS.has(word));
  const nonSuffixWords = words.filter((word) => !TEAM_SUFFIX_TOKENS.has(word));

  const derivedAliases: string[] = [];

  if (suffixWords.length > 0 && nonSuffixWords.length > 0) {
    const compactClubCode = `${nonSuffixWords
      .map((word) => word[0])
      .join("")}${suffixWords.join("")}`;

    if (compactClubCode.length >= 2 && compactClubCode.length <= 8) {
      derivedAliases.push(compactClubCode);
    }

    const firstCoreWord = nonSuffixWords[0];
    if (firstCoreWord && firstCoreWord.length >= 4) {
      derivedAliases.push(firstCoreWord);
    }

    return getUniqueNormalizedTokens(derivedAliases);
  }

  const classicAcronym = words.map((word) => word[0]).join("");

  if (classicAcronym.length >= 2 && classicAcronym.length <= 5) {
    derivedAliases.push(classicAcronym);
  }

  const firstWord = words[0];
  if (firstWord && firstWord.length >= 5) {
    derivedAliases.push(firstWord);
  }

  return getUniqueNormalizedTokens(derivedAliases);
}

function getFavoriteTypePriority(type: EntityMetaRow["type"]): number {
  return FAVORITE_TYPE_PRIORITY[type] ?? 0;
}

function getBrowseSeed(entityId: string): BrowseSeed | undefined {
  return BROWSE_SEED_BY_ID.get(entityId);
}

function createEntityMetaFromSeed(seed: BrowseSeed): EntityMetaRow {
  return {
    id: seed.id,
    type: seed.type,
    name: seed.name,
  };
}

function resolveEntitySport(
  entityId: string,
  hintedSport?: string | null,
): Sport | null {
  if (hintedSport === "football" || hintedSport === "hockey") {
    return hintedSport;
  }

  const seed = getBrowseSeed(entityId);
  return seed?.sport ?? null;
}

function isSwedishDomesticTeam(teamId: string, sport: Sport): boolean {
  const league = getLeagueForTeam(sport, teamId);
  if (!league) return false;

  return SWEDISH_LEAGUE_NAMES.has(normalizeToken(league.name));
}

function upsertExpandedEntity(
  expandedFavoriteEntityIds: Set<string>,
  expandedFavoriteEntityMetaById: Map<string, EntityMetaRow>,
  favoriteEntityWeightById: Map<string, number>,
  meta: EntityMetaRow,
  weight: number,
): void {
  expandedFavoriteEntityIds.add(meta.id);

  if (!expandedFavoriteEntityMetaById.has(meta.id)) {
    expandedFavoriteEntityMetaById.set(meta.id, meta);
  }

  const existingWeight = favoriteEntityWeightById.get(meta.id) ?? 0;
  if (weight > existingWeight) {
    favoriteEntityWeightById.set(meta.id, weight);
  }
}

function shouldUseTokenFallback(meta: EntityMetaRow): boolean {
  return (
    meta.type === "player" ||
    meta.type === "team" ||
    meta.type === "league" ||
    meta.type === "staff"
  );
}

function buildEntityTokenFallbacks(meta: EntityMetaRow): string[] {
  const tokens: string[] = [];

  if (!shouldUseTokenFallback(meta)) {
    return tokens;
  }

  pushUnique(tokens, [meta.name]);

  if (meta.type === "team") {
    const aliases = TEAM_ALIASES[meta.name] || [];
    const derivedAliases = buildDerivedTeamAliases(meta.name);
    const browseAliases = getBrowseSeed(meta.id)?.aliases ?? [];

    pushUnique(tokens, aliases);
    pushUnique(tokens, derivedAliases);
    pushUnique(tokens, browseAliases);
  }

  if (meta.type === "league") {
    const browseAliases = getBrowseSeed(meta.id)?.aliases ?? [];
    pushUnique(tokens, browseAliases.filter((alias) => alias !== meta.name));
  }

  return getUniqueNormalizedTokens(tokens);
}

function isTokenMatch(
  normalizedTitle: string,
  tags: string[] | null | undefined,
  token: string,
): boolean {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) return false;

  const haystack = ` ${normalizedTitle} `;

  if (normalizedToken.includes(" ")) {
    if (
      haystack.includes(` ${normalizedToken} `) ||
      normalizedTitle.includes(normalizedToken)
    ) {
      return true;
    }
  } else if (haystack.includes(` ${normalizedToken} `)) {
    return true;
  }

  if (tags?.length) {
    for (const tag of tags) {
      const normalizedTag = normalizeToken(tag);
      if (!normalizedTag) continue;

      if (normalizedTag === normalizedToken) {
        return true;
      }

      if (
        normalizedToken.includes(" ")
          ? normalizedTag.includes(normalizedToken)
          : ` ${normalizedTag} `.includes(` ${normalizedToken} `)
      ) {
        return true;
      }
    }
  }

  return false;
}

export function compareFavoriteMatchMeta(
  candidate: FavoriteMatchMeta,
  existing?: FavoriteMatchMeta,
): boolean {
  if (!existing) {
    return true;
  }

  if (candidate.score !== existing.score) {
    return candidate.score > existing.score;
  }

  const candidatePriority = getFavoriteTypePriority(candidate.type);
  const existingPriority = getFavoriteTypePriority(existing.type);

  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority;
  }

  return candidate.entity_name.length > existing.entity_name.length;
}

/* ==========================================================================
   FAVORITE TOKEN PARSING
   ========================================================================== */

export function parseFavorites(params: URLSearchParams): string[] {
  const raw: string[] = [];

  for (const value of params.getAll("fav")) {
    raw.push(value);
  }

  const favoriteCsv = params.get("favorites");
  if (favoriteCsv) {
    raw.push(favoriteCsv);
  }

  const expanded = raw
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const parts = value.split(":");
      return parts.length >= 2 ? parts.slice(1).join(":").trim() : value;
    })
    .map(normalizeToken)
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const token of expanded) {
    if (seen.has(token)) continue;

    seen.add(token);
    unique.push(token);

    if (unique.length >= MAX_FAVS) break;
  }

  return unique;
}

/* ==========================================================================
   TOKEN MATCHING
   ========================================================================== */

export function isFavoriteMatch(
  normalizedTitle: string,
  tags: string[] | null | undefined,
  favoriteTokens: string[],
): boolean {
  if (!favoriteTokens.length) return false;

  for (const favorite of favoriteTokens) {
    if (isTokenMatch(normalizedTitle, tags, favorite)) {
      return true;
    }
  }

  return false;
}

export function resolveTokenFavoriteMatchMeta(
  normalizedTitle: string,
  tags: string[] | null | undefined,
  directFavoriteEntityMetaById: Map<string, EntityMetaRow>,
): FavoriteMatchMeta | null {
  let bestMatch: FavoriteMatchMeta | null = null;

  for (const meta of directFavoriteEntityMetaById.values()) {
    const fallbackTokens = buildEntityTokenFallbacks(meta);

    if (!fallbackTokens.length) {
      continue;
    }

    let matchedToken: string | null = null;

    for (const token of fallbackTokens) {
      if (isTokenMatch(normalizedTitle, tags, token)) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      continue;
    }

    const exactNameMatch = isTokenMatch(normalizedTitle, tags, meta.name);

    const candidate: FavoriteMatchMeta = {
      score:
        getFavoriteTypePriority(meta.type) +
        (exactNameMatch ? 50 : 0) +
        Math.min(meta.name.length, 25),
      type: meta.type,
      entity_id: meta.id,
      entity_name: meta.name,
    };

    if (compareFavoriteMatchMeta(candidate, bestMatch ?? undefined)) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/* ==========================================================================
   RANKING CONVERSION
   ========================================================================== */

export function toRankingNewsItem(item: AcceptedItem): RankingNewsItem {
  return {
    ...item,
    id: item.id ?? undefined,
    source: item.source ?? undefined,
    published_at: item.published_at ?? undefined,
    tags: item.tags ?? undefined,
    sport: item.sport ?? undefined,
  };
}

/* ==========================================================================
   FAVORITE EXPANSION
   ========================================================================== */

export type FavoritePolicyExpansion = {
  leagueTeamIds: string[];
  playerIds: string[];
  staff: EntityMetaRow[];
};

function isKnownSwedishPlayer(
  playerId: string,
  sport: Sport,
): boolean {
  const playerSeed = getBrowseSeed(playerId);
  if (!playerSeed || playerSeed.type !== "player") {
    return false;
  }

  // The football player catalog is the curated Swedish-player catalog.
  if (sport === "football") {
    return true;
  }

  // Hockey nationality is only canonical for the curated Swedish NHL list
  // today. Do not infer nationality from playing in a Swedish league.
  return KNOWN_SWEDISH_HOCKEY_PLAYER_NAMES.has(
    normalizeToken(playerSeed.name),
  );
}

function getKnownSwedishStaffForTeam(
  teamId: string,
  sport: Sport,
): EntityMetaRow[] {
  const teamSeed = getBrowseSeed(teamId);
  if (!teamSeed || teamSeed.type !== "team") {
    return [];
  }

  const teamTerms = new Set(
    [teamSeed.name, ...teamSeed.aliases]
      .map(normalizeToken)
      .filter(Boolean),
  );

  return swedishStaffAbroad
    .filter(
      (staff) =>
        staff.active &&
        staff.sport === sport &&
        staff.organizationType === "club" &&
        [staff.organization, ...staff.organizationAliases]
          .map(normalizeToken)
          .some((term) => teamTerms.has(term)),
    )
    .map((staff) => ({
      id: staff.id,
      type: "staff" as const,
      name: staff.name,
    }));
}

/**
 * Existing favorite policy:
 * - league -> league + Swedish players in that league
 * - foreign team -> team + Swedish players + Swedish staff
 * - Swedish team -> team + all players + all known staff
 *
 * The returned expansion is deliberately limited to entities backed by the
 * current curated catalogs. Unknown staff/nationality is never guessed.
 */
export function resolveFavoritePolicyExpansion(
  directMeta: EntityMetaRow,
  directSport: Sport | null,
): FavoritePolicyExpansion {
  if (!directSport) {
    return { leagueTeamIds: [], playerIds: [], staff: [] };
  }

  if (directMeta.type === "league") {
    const leagueTeamIds = BROWSE_RELATIONS.leagueToTeamIds?.[directMeta.id] ?? [];
    const playerIds = Array.from(
      new Set(
        leagueTeamIds.flatMap((teamId) =>
          (BROWSE_RELATIONS.teamToPlayerIds?.[teamId] ?? []).filter((playerId) =>
            isKnownSwedishPlayer(playerId, directSport),
          ),
        ),
      ),
    );

    return { leagueTeamIds, playerIds, staff: [] };
  }

  if (directMeta.type === "team") {
    const allPlayerIds =
      BROWSE_RELATIONS.teamToPlayerIds?.[directMeta.id] ?? [];
    const playerIds = isSwedishDomesticTeam(directMeta.id, directSport)
      ? allPlayerIds
      : allPlayerIds.filter((playerId) =>
          isKnownSwedishPlayer(playerId, directSport),
        );

    return {
      leagueTeamIds: [],
      playerIds,
      staff: getKnownSwedishStaffForTeam(directMeta.id, directSport),
    };
  }

  return { leagueTeamIds: [], playerIds: [], staff: [] };
}

function buildExpandedRelationsForFavorite(
  directMeta: EntityMetaRow,
  directSport: Sport | null,
  favoriteRelations: FavoriteRelations,
  expandedFavoriteEntityIds: Set<string>,
  expandedFavoriteEntityMetaById: Map<string, EntityMetaRow>,
  favoriteEntityWeightById: Map<string, number>,
): void {
  if (!directSport) {
    return;
  }

  const expansion = resolveFavoritePolicyExpansion(directMeta, directSport);

  if (directMeta.type === "league") {
    favoriteRelations.leagueToTeamIds = favoriteRelations.leagueToTeamIds ?? {};
    favoriteRelations.leagueToTeamIds[directMeta.id] = expansion.leagueTeamIds;

    for (const playerId of expansion.playerIds) {
      const playerSeed = getBrowseSeed(playerId);
      if (!playerSeed) continue;

      upsertExpandedEntity(
        expandedFavoriteEntityIds,
        expandedFavoriteEntityMetaById,
        favoriteEntityWeightById,
        createEntityMetaFromSeed(playerSeed),
        EXPANDED_ENTITY_WEIGHTS.leaguePlayer,
      );
    }

    return;
  }

  if (directMeta.type === "team") {
    favoriteRelations.teamToPlayerIds = favoriteRelations.teamToPlayerIds ?? {};
    favoriteRelations.teamToPlayerIds[directMeta.id] = expansion.playerIds;
    favoriteRelations.teamToStaffIds = favoriteRelations.teamToStaffIds ?? {};
    favoriteRelations.teamToStaffIds[directMeta.id] = expansion.staff.map(
      (staff) => staff.id,
    );

    for (const playerId of expansion.playerIds) {
      const playerSeed = getBrowseSeed(playerId);
      if (!playerSeed) continue;

      upsertExpandedEntity(
        expandedFavoriteEntityIds,
        expandedFavoriteEntityMetaById,
        favoriteEntityWeightById,
        createEntityMetaFromSeed(playerSeed),
        EXPANDED_ENTITY_WEIGHTS.teamPlayer,
      );
    }

    for (const staff of expansion.staff) {
      upsertExpandedEntity(
        expandedFavoriteEntityIds,
        expandedFavoriteEntityMetaById,
        favoriteEntityWeightById,
        staff,
        EXPANDED_ENTITY_WEIGHTS.teamPlayer,
      );
    }
  }
}


export function isShadowedAmbiguousPlayerFavoriteMatch(
  row: NewsEntityRow,
  rowsForSameNewsItem: NewsEntityRow[],
  meta: EntityMetaRow,
): boolean {
  if (meta.type !== "player") {
    return false;
  }

  const matchedAlias = normalizeToken(row.matched_alias ?? "");
  if (!matchedAlias || matchedAlias.includes(" ")) {
    return false;
  }

  return rowsForSameNewsItem.some((other) => {
    if (other.entity_id === row.entity_id) return false;

    const otherAlias = normalizeToken(other.matched_alias ?? "");
    if (!otherAlias || !otherAlias.includes(" ")) return false;

    return otherAlias.split(" ").includes(matchedAlias);
  });
}

async function loadPlayerFavoriteContext(args: {
  supabase: SupabaseClient;
  directFavoriteEntityMetaById: Map<string, EntityMetaRow>;
}): Promise<{
  contextEntityIds: Set<string>;
  contextOwnerByEntityId: Map<string, FavoriteContextMeta>;
}> {
  const { supabase, directFavoriteEntityMetaById } = args;
  const playerFavorites = Array.from(directFavoriteEntityMetaById.values())
    .filter(
      (meta): meta is EntityMetaRow & { team_id: string } =>
        meta.type === "player" &&
        typeof meta.team_id === "string" &&
        meta.team_id.length > 0,
    );

  const contextEntityIds = new Set<string>();
  const contextOwnerByEntityId = new Map<string, FavoriteContextMeta>();

  if (playerFavorites.length === 0) {
    return { contextEntityIds, contextOwnerByEntityId };
  }

  const teamIds = Array.from(new Set(playerFavorites.map((meta) => meta.team_id)));

  const [{ data: teamsData, error: teamsError }, { data: teammatesData, error: teammatesError }] =
    await Promise.all([
      supabase
        .from("entities")
        .select("id,type,name,team_id,league_id")
        .in("id", teamIds),
      supabase
        .from("entities")
        .select("id,type,name,team_id,league_id")
        .in("team_id", teamIds)
        .in("type", ["player", "staff"]),
    ]);

  if (teamsError) {
    console.error("loadPlayerFavoriteContext:teams failed", teamsError);
  }

  if (teammatesError) {
    console.error("loadPlayerFavoriteContext:teammates failed", teammatesError);
  }

  const rows = [
    ...((teamsData ?? []) as EntityMetaRow[]),
    ...((teammatesData ?? []) as EntityMetaRow[]),
  ];

  for (const favorite of playerFavorites) {
    const owner: FavoriteContextMeta = {
      score: PLAYER_FAVORITE_CONTEXT_SCORE,
      favorite_entity_id: favorite.id,
      favorite_entity_name: favorite.name,
    };

    for (const row of rows) {
      const belongsToFavoriteTeam =
        row.id === favorite.team_id || row.team_id === favorite.team_id;

      if (!belongsToFavoriteTeam || row.id === favorite.id) {
        continue;
      }

      contextEntityIds.add(row.id);

      if (!contextOwnerByEntityId.has(row.id)) {
        contextOwnerByEntityId.set(row.id, {
          ...owner,
          context_entity_id: row.id,
          context_entity_name: row.name,
        });
      }
    }
  }

  return { contextEntityIds, contextOwnerByEntityId };
}

export async function loadFavoriteExpansion(
  supabase: SupabaseClient,
  deviceId: string,
  items: Array<{ id: string | null }>,
): Promise<FavoriteExpansionResult> {
  const directFavoriteEntityIds = new Set<string>();
  const directFavoriteEntityMetaById = new Map<string, EntityMetaRow>();

  const expandedFavoriteEntityIds = new Set<string>();
  const expandedFavoriteEntityMetaById = new Map<string, EntityMetaRow>();
  const favoriteEntityWeightById = new Map<string, number>();

  const favoriteRelations: FavoriteRelations = {
    leagueToTeamIds: {},
    teamToPlayerIds: {},
    teamToStaffIds: {},
  };

  const favoriteMatchByNewsId = new Map<string, FavoriteMatchMeta>();
  const favoriteContextByNewsId = new Map<string, FavoriteContextMeta>();

  if (!deviceId) {
    return {
      directFavoriteEntityIds,
      directFavoriteEntityMetaById,
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
      favoriteRelations,
      favoriteMatchByNewsId,
      favoriteContextByNewsId,
    };
  }

  const { data: favoriteRows, error: favoriteRowsError } = await supabase
    .from("user_favorites")
    .select("entity_id")
    .eq("device_id", deviceId)
    .returns<FavoriteEntityRow[]>();

  if (favoriteRowsError) {
    console.error("loadFavoriteExpansion:user_favorites failed", favoriteRowsError);
    return {
      directFavoriteEntityIds,
      directFavoriteEntityMetaById,
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
      favoriteRelations,
      favoriteMatchByNewsId,
      favoriteContextByNewsId,
    };
  }

  for (const row of favoriteRows ?? []) {
    if (row.entity_id) {
      directFavoriteEntityIds.add(row.entity_id);
    }
  }

  if (directFavoriteEntityIds.size === 0) {
    return {
      directFavoriteEntityIds,
      directFavoriteEntityMetaById,
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
      favoriteRelations,
      favoriteMatchByNewsId,
      favoriteContextByNewsId,
    };
  }

  const directIds = Array.from(directFavoriteEntityIds);

  const { data: directEntityMetaRows, error: directEntityMetaError } =
    await supabase
      .from("entities")
      .select("id,type,name,sport,team_id,league_id")
      .in("id", directIds)
      .returns<
        Array<
          Pick<EntityMetaRow, "id" | "type" | "name" | "team_id" | "league_id"> & { sport?: string | null }
        >
      >();

  if (directEntityMetaError) {
    console.error("loadFavoriteExpansion:entities failed", directEntityMetaError);
  }

  const dbMetaById = new Map<
    string,
    Pick<EntityMetaRow, "id" | "type" | "name" | "team_id" | "league_id"> & { sport?: string | null }
  >();

  for (const row of directEntityMetaRows ?? []) {
    dbMetaById.set(row.id, row);
  }

  for (const directId of directIds) {
    const dbMeta = dbMetaById.get(directId);
    const browseSeed = getBrowseSeed(directId);

    const directMeta: EntityMetaRow | null = dbMeta
      ? {
          id: dbMeta.id,
          type: dbMeta.type,
          name: dbMeta.name,
          team_id: dbMeta.team_id ?? null,
          league_id: dbMeta.league_id ?? null,
        }
      : browseSeed
        ? createEntityMetaFromSeed(browseSeed)
        : null;

    if (!directMeta) {
      continue;
    }

    directFavoriteEntityMetaById.set(directMeta.id, directMeta);

    upsertExpandedEntity(
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
      directMeta,
      getFavoriteTypePriority(directMeta.type),
    );

    buildExpandedRelationsForFavorite(
      directMeta,
      resolveEntitySport(directMeta.id, dbMeta?.sport ?? null),
      favoriteRelations,
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
    );
  }

  const { contextEntityIds, contextOwnerByEntityId } =
    await loadPlayerFavoriteContext({
      supabase,
      directFavoriteEntityMetaById,
    });

  const itemIds = items.map((item) => item.id).filter(Boolean) as string[];

  if (itemIds.length === 0 || expandedFavoriteEntityIds.size === 0) {
    return {
      directFavoriteEntityIds,
      directFavoriteEntityMetaById,
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
      favoriteRelations,
      favoriteMatchByNewsId,
      favoriteContextByNewsId,
    };
  }

  const { data: newsEntityRows, error: newsEntityError } = await supabase
    .from("news_entities")
    .select("news_item_id,entity_id,match_type,matched_alias")
    .in("news_item_id", itemIds)
    .returns<NewsEntityRow[]>();

  if (newsEntityError) {
    console.error("loadFavoriteExpansion:news_entities failed", newsEntityError);
    return {
      directFavoriteEntityIds,
      directFavoriteEntityMetaById,
      expandedFavoriteEntityIds,
      expandedFavoriteEntityMetaById,
      favoriteEntityWeightById,
      favoriteRelations,
      favoriteMatchByNewsId,
      favoriteContextByNewsId,
    };
  }

  const rowsByNewsId = new Map<string, NewsEntityRow[]>();
  for (const row of newsEntityRows ?? []) {
    const rows = rowsByNewsId.get(row.news_item_id) ?? [];
    rows.push(row);
    rowsByNewsId.set(row.news_item_id, rows);
  }

  for (const row of newsEntityRows ?? []) {
    const meta = expandedFavoriteEntityMetaById.get(row.entity_id);

    if (meta) {
      const rowsForSameNewsItem = rowsByNewsId.get(row.news_item_id) ?? [];

      if (
        !isShadowedAmbiguousPlayerFavoriteMatch(
          row,
          rowsForSameNewsItem,
          meta,
        )
      ) {
        const candidate: FavoriteMatchMeta = {
          score: favoriteEntityWeightById.get(row.entity_id) ?? 1,
          type: meta.type,
          entity_id: meta.id,
          entity_name: meta.name,
        };

        const existing = favoriteMatchByNewsId.get(row.news_item_id);
        if (compareFavoriteMatchMeta(candidate, existing)) {
          favoriteMatchByNewsId.set(row.news_item_id, candidate);
        }
      }
    }

    if (contextEntityIds.has(row.entity_id)) {
      const owner = contextOwnerByEntityId.get(row.entity_id);
      if (owner) {
        const existingContext = favoriteContextByNewsId.get(row.news_item_id);
        if (!existingContext || owner.score > existingContext.score) {
          favoriteContextByNewsId.set(row.news_item_id, owner);
        }
      }
    }
  }

  return {
    directFavoriteEntityIds,
    directFavoriteEntityMetaById,
    expandedFavoriteEntityIds,
    expandedFavoriteEntityMetaById,
    favoriteEntityWeightById,
    favoriteRelations,
    favoriteMatchByNewsId,
    favoriteContextByNewsId,
  };
}

/* ==========================================================================
   TOKEN BUILDING
   ========================================================================== */

export function buildAllFavoriteTokens(
  explicitFavoriteTokens: string[],
  expandedFavoriteEntityMetaById: Map<string, EntityMetaRow>,
): string[] {
  const dynamicTokensSet = new Set<string>();

  for (const meta of expandedFavoriteEntityMetaById.values()) {
    const entityTokens = buildEntityTokenFallbacks(meta);

    for (const token of entityTokens) {
      dynamicTokensSet.add(token);
    }
  }

  const expandedDynamicTokens = Array.from(dynamicTokensSet)
    .map(normalizeToken)
    .filter(Boolean);

  return Array.from(
    new Set([...explicitFavoriteTokens, ...expandedDynamicTokens]),
  );
}

/* ==========================================================================
   RANKING PREPARATION
   ========================================================================== */

export function buildRankingPreparation(
  directFavoriteEntityIds: Set<string>,
  directFavoriteEntityMetaById: Map<string, EntityMetaRow>,
  explicitFavoriteTokens: string[],
  accepted: AcceptedItem[],
): RankingPreparationResult {
  const favoriteSignals: FavoriteSignal[] = [];

  for (const meta of directFavoriteEntityMetaById.values()) {
    favoriteSignals.push({
      entityId: meta.id,
      label: meta.name,
      type: meta.type,
    });
  }

  for (const token of explicitFavoriteTokens) {
    favoriteSignals.push({
      label: token,
    });
  }

  const hasFavorites = Boolean(
    directFavoriteEntityIds.size > 0 || explicitFavoriteTokens.length > 0,
  );

  const acceptedForRanking = accepted.map(toRankingNewsItem);

  return {
    favoriteSignals,
    hasFavorites,
    acceptedForRanking,
  };
}