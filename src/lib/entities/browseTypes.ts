// src/lib/entities/browseTypes.ts

import type { Sport } from "@/lib/types";

export type BrowseEntityType = "player" | "team" | "league";

export type BrowseEntity = {
  id: string;
  sport: Sport;
  type: BrowseEntityType;
  name: string;
  slug: string;
  aliases: string[];
  icon?: string;
};

export type RawPlayer = {
  firstName: string;
  lastName: string;
  nickname?: string;
  id?: string;
  league: string;
  club: string;
};

export type RawTeam = {
  name: string;
  league: string;
  country: string;
  slug: string;
  aliases: string[];
};

export type RawLeague = {
  name: string;
  country: string;
};

export type SportBrowseIndex = {
  players: BrowseEntity[];
  teams: BrowseEntity[];
  leagues: BrowseEntity[];
  playerToTeamId: Map<string, string>;
  teamToLeagueId: Map<string, string>;
  teamIdToPlayers: Map<string, BrowseEntity[]>;
};
