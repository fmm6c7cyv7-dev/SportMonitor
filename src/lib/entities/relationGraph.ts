// src/lib/entities/relationGraph.ts

import type { Sport } from "@/lib/types";
import { rawFootballPlayers } from "@/data/footballPlayers";
import { rawFootballTeams } from "@/data/footballTeams";
import { rawHockeyPlayers } from "@/data/hockeyPlayers";
import { rawHockeyTeams } from "@/data/hockeyTeams";
import type {
  BrowseEntity,
  RawPlayer,
  RawTeam,
  SportBrowseIndex,
} from "@/lib/entities/browseTypes";
import {
  footballLeagues,
  footballPlayers,
  footballTeams,
  hockeyLeagues,
  hockeyPlayers,
  hockeyTeams,
  normalizeBrowseText,
  slugifyBrowseValue,
} from "@/lib/entities/catalog";

type UniqueLookup = Map<string, string | null>;

function addToUniqueLookup(
  lookup: UniqueLookup,
  key: string,
  entityId: string,
): void {
  const existing = lookup.get(key);
  if (existing === undefined) {
    lookup.set(key, entityId);
    return;
  }
  if (existing !== entityId) {
    lookup.set(key, null);
  }
}

function getUniqueLookupMatch(
  lookup: UniqueLookup,
  key: string,
): string | undefined {
  const value = lookup.get(key);
  return typeof value === "string" ? value : undefined;
}

function buildNameLookup(entities: BrowseEntity[]): UniqueLookup {
  const lookup = new Map<string, string | null>();
  for (const entity of entities) {
    addToUniqueLookup(lookup, normalizeBrowseText(entity.name), entity.id);
  }
  return lookup;
}

function buildTeamAliasLookup(teams: BrowseEntity[]): UniqueLookup {
  const lookup = new Map<string, string | null>();
  for (const team of teams) {
    for (const alias of team.aliases) {
      const normalizedAlias = normalizeBrowseText(alias);
      if (!normalizedAlias) continue;
      addToUniqueLookup(lookup, normalizedAlias, team.id);
    }
  }
  return lookup;
}

function findTeamId(
  teamNameLookup: UniqueLookup,
  teamAliasLookup: UniqueLookup,
  teamName: string,
): string | undefined {
  const normalizedTeamName = normalizeBrowseText(teamName);
  if (!normalizedTeamName) return undefined;
  return (
    getUniqueLookupMatch(teamNameLookup, normalizedTeamName) ??
    getUniqueLookupMatch(teamAliasLookup, normalizedTeamName)
  );
}

function findLeagueId(
  leagueNameLookup: UniqueLookup,
  leagueName: string,
): string | undefined {
  const normalizedLeagueName = normalizeBrowseText(leagueName);
  if (!normalizedLeagueName) return undefined;
  return getUniqueLookupMatch(leagueNameLookup, normalizedLeagueName);
}

function buildSportIndex(
  sport: Sport,
  players: BrowseEntity[],
  teams: BrowseEntity[],
  leagues: BrowseEntity[],
  rawPlayers: RawPlayer[],
  rawTeams: RawTeam[],
): SportBrowseIndex {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const teamNameLookup = buildNameLookup(teams);
  const teamAliasLookup = buildTeamAliasLookup(teams);
  const leagueNameLookup = buildNameLookup(leagues);
  const playerToTeamId = new Map<string, string>();
  const teamToLeagueId = new Map<string, string>();
  const teamIdToPlayers = new Map<string, BrowseEntity[]>();
  const teamIdToPlayerIds = new Map<string, Set<string>>();

  for (const rawTeam of rawTeams) {
    const teamId = findTeamId(teamNameLookup, teamAliasLookup, rawTeam.name);
    const leagueId = findLeagueId(leagueNameLookup, rawTeam.league);
    if (teamId && leagueId) {
      teamToLeagueId.set(teamId, leagueId);
    }
  }

  for (const rawPlayer of rawPlayers) {
    const fullName = `${rawPlayer.firstName} ${rawPlayer.lastName}`.trim();
    const playerId =
      `${sport}-player-${rawPlayer.id ?? slugifyBrowseValue(fullName)}`;
    const teamId = findTeamId(teamNameLookup, teamAliasLookup, rawPlayer.club);
    if (!teamId) continue;

    playerToTeamId.set(playerId, teamId);
    const currentPlayers = teamIdToPlayers.get(teamId) ?? [];
    const playerEntity = playerMap.get(playerId);

    if (playerEntity) {
      const seenPlayerIds =
        teamIdToPlayerIds.get(teamId) ?? new Set<string>();
      if (seenPlayerIds.has(playerEntity.id)) continue;
      seenPlayerIds.add(playerEntity.id);
      teamIdToPlayerIds.set(teamId, seenPlayerIds);
      currentPlayers.push(playerEntity);
      teamIdToPlayers.set(teamId, currentPlayers);
    }
  }

  return {
    players,
    teams,
    leagues,
    playerToTeamId,
    teamToLeagueId,
    teamIdToPlayers,
  };
}

export const footballIndex = buildSportIndex(
  "football",
  footballPlayers,
  footballTeams,
  footballLeagues,
  rawFootballPlayers,
  rawFootballTeams,
);

export const hockeyIndex = buildSportIndex(
  "hockey",
  hockeyPlayers,
  hockeyTeams,
  hockeyLeagues,
  rawHockeyPlayers,
  rawHockeyTeams,
);

export function getSportIndex(sport: Sport): SportBrowseIndex {
  return sport === "football" ? footballIndex : hockeyIndex;
}

export function getPlayersForTeam(
  sport: Sport,
  teamId: string,
): BrowseEntity[] {
  return getSportIndex(sport).teamIdToPlayers.get(teamId) ?? [];
}

export function getTeamForPlayer(
  sport: Sport,
  playerId: string,
): BrowseEntity | null {
  const index = getSportIndex(sport);
  const teamId = index.playerToTeamId.get(playerId);
  return index.teams.find((team) => team.id === teamId) ?? null;
}

export function getLeagueForTeam(
  sport: Sport,
  teamId: string,
): BrowseEntity | null {
  const index = getSportIndex(sport);
  const leagueId = index.teamToLeagueId.get(teamId);
  return index.leagues.find((league) => league.id === leagueId) ?? null;
}
