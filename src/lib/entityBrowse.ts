// src/lib/entityBrowse.ts
//
// Compatibility facade for the split entity catalog/relation/browse domain.
// New code should import from "@/lib/entities/*" directly.

export type {
  BrowseEntityType,
  BrowseEntity,
  SportBrowseIndex,
} from "@/lib/entities/browseTypes";

export {
  GENERIC_TEAM_TOKENS,
  TEAM_ALIASES,
  PLAYER_NICKNAMES,
  foldDiacritics,
  normalizeBrowseText,
  getEntitySearchStrings,
  hockeyPlayers,
  hockeyTeams,
  hockeyLeagues,
  footballPlayers,
  footballTeams,
  footballLeagues,
  browseData,
  getBrowseEntities,
} from "@/lib/entities/catalog";

export {
  footballIndex,
  hockeyIndex,
  getPlayersForTeam,
  getTeamForPlayer,
  getLeagueForTeam,
} from "@/lib/entities/relationGraph";

export { searchBrowseSuggestions } from "@/lib/entities/browseSearch";
