// src/lib/entities/catalog.ts

import type { Sport } from "@/lib/types";
import { rawFootballPlayers } from "@/data/footballPlayers";
import { rawFootballTeams } from "@/data/footballTeams";
import { rawHockeyPlayers } from "@/data/hockeyPlayers";
import { rawHockeyTeams } from "@/data/hockeyTeams";
import { rawFootballLeagues, rawHockeyLeagues } from "@/data/leagues";
import type {
  BrowseEntity,
  BrowseEntityType,
  RawLeague,
  RawPlayer,
  RawTeam,
} from "@/lib/entities/browseTypes";

export const GENERIC_TEAM_TOKENS = new Set([
  "united", "city", "fc", "cf", "afc", "if", "bk", "hc", "ik", "sk", "ff",
  "cp", "fk", "sc", "ac", "bc", "club", "team", "hockey", "fotboll",
]);

export const TEAM_ALIASES: Record<string, string[]> = {
  "vasteras sk": ["vsk", "västerås", "grönvitt"],
  "vasteras ik": ["vik", "gulsvart"],
  "leksands if": ["lif", "leksand", "masarna"],
  "djurgardens if": ["dif", "djurgården", "järnkaminerna"],
  aik: ["gnaget", "gnagare", "aik hockey", "aik fotboll"],
  "malmo ff": ["mff", "di blåe"],
  "ifk goteborg": ["blåvitt", "göteborg"],
  "brynas if": ["brynäs"],
  "frolunda hc": ["frölunda", "indians"],
  "farjestad bk": ["färjestad", "fbk"],
  hv71: ["hv 71", "hv"],
  "linkoping hc": ["linköping", "lhc"],
  "lulea hockey": ["luleå", "luleå hf"],
  "malmo redhawks": ["malmö", "redhawks"],
  "rogle bk": ["rögle"],
  "skelleftea aik": ["skellefteå", "saik"],
  "timra ik": ["timrå"],
  "vaxjo lakers": ["växjö", "lakers", "vaxjo lakers", "växjö lakers hc"],
  "orebro hockey": ["örebro", "öhk", "örebro hk"],
  "almtuna is": ["almtuna"],
  "bik karlskoga": ["karlskoga", "bik"],
  "if bjorkloven": ["björklöven", "löven"],
  "ik oskarshamn": ["oskarshamn", "iko"],
  "kalmar hc": ["kalmar"],
  "modo hockey": ["modo"],
  "mora ik": ["mora"],
  "nybro vikings if": ["nybro", "vikings"],
  "sodertalje sk": ["södertälje", "ssk"],
  "vimmerby hc": ["vimmerby"],
  "ostersunds ik": ["östersund"],
  "anaheim ducks": ["anaheim", "ducks"],
  "boston bruins": ["boston", "bruins"],
  "buffalo sabres": ["buffalo", "sabres"],
  "calgary flames": ["calgary", "flames"],
  "chicago blackhawks": ["chicago", "blackhawks", "hawks"],
  "colorado avalanche": ["colorado", "avalanche", "avs"],
  "columbus blue jackets": ["columbus", "blue jackets"],
  "dallas stars": ["dallas", "stars"],
  "detroit red wings": ["detroit", "red wings", "wings"],
  "florida panthers": ["florida", "panthers", "cats"],
  "los angeles kings": ["la kings", "los angeles", "kings"],
  "minnesota wild": ["minnesota", "wild"],
  "new york islanders": ["islanders", "nyi"],
  "new york rangers": ["rangers", "nyr"],
  "ottawa senators": ["ottawa", "senators", "sens"],
  "philadelphia flyers": ["philadelphia", "flyers"],
  "pittsburgh penguins": ["pittsburgh", "penguins", "pens"],
  "san jose sharks": ["san jose", "sharks"],
  "st. louis blues": ["st louis", "blues"],
  "tampa bay lightning": ["tampa bay", "lightning", "bolts"],
  "toronto maple leafs": ["toronto", "maple leafs", "leafs"],
  "utah mammoth": ["utah", "utah hc", "utah hockey club"],
  "vancouver canucks": ["vancouver", "canucks"],
  "vegas golden knights": ["vegas", "golden knights", "knights"],
  "washington capitals": ["washington", "capitals", "caps"],
  "newcastle united": ["newcastle united", "newcastle", "magpies"],
  "tottenham hotspur": ["tottenham", "spurs"],
  "manchester united": ["manchester united", "manchester u", "man utd"],
  "nottingham forest": ["nottingham"],
  "sporting cp": ["sporting lissabon", "sporting"],
  "fc porto": ["porto"],
  atalanta: ["atalanta bc"],
  bologna: ["bologna fc"],
  "eintracht frankfurt": ["frankfurt"],
  "vfl wolfsburg": ["wolfsburg"],
  "rc strasbourg": ["strasbourg"],
  "leeds united": ["leeds united", "leeds"],
  "sc heerenveen": ["heerenveen"],
  "fc kopenhamn": ["fck", "köpenhamn"],
};

export const PLAYER_NICKNAMES: Record<string, string[]> = {
  "dejan kulusevski": ["deki"],
  "victor lindelof": ["vigge"],
  "jacob widell zetterstrom": ["jwz"],
  "ludwig augustinsson": ["ludde"],
  "emil forsberg": ["foppa"],
};

export function foldDiacritics(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function slugifyBrowseValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeBrowseText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sortSv<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

function dedupeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeEntities(items: BrowseEntity[]): BrowseEntity[] {
  const map = new Map<string, BrowseEntity>();
  for (const item of items) {
    const key = `${item.sport}:${item.type}:${item.id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, aliases: dedupeStringArray(item.aliases) });
    } else {
      map.set(key, {
        ...existing,
        aliases: dedupeStringArray([...existing.aliases, ...item.aliases]),
      });
    }
  }
  return Array.from(map.values());
}

function playerToEntity(player: RawPlayer, sport: Sport): BrowseEntity {
  const fullName = `${player.firstName} ${player.lastName}`.trim();
  const nameKey = fullName.toLowerCase();
  const aliases = [
    fullName,
    player.lastName,
    player.nickname ?? "",
    ...(PLAYER_NICKNAMES[nameKey] || []),
    player.club,
    player.league,
  ].filter(Boolean);

  return {
    id: `${sport}-player-${player.id ?? slugifyBrowseValue(fullName)}`,
    sport,
    type: "player",
    name: fullName,
    slug: slugifyBrowseValue(fullName),
    aliases,
    icon: "👤",
  };
}

function teamToEntity(team: RawTeam, sport: Sport): BrowseEntity {
  const nameKey = foldDiacritics(team.name).toLowerCase();
  const aliases = dedupeStringArray([
    team.name,
    team.league,
    ...(TEAM_ALIASES[nameKey] || []),
    ...team.aliases,
  ]);

  return {
    id: `${sport}-team-${team.slug}`,
    sport,
    type: "team",
    name: team.name,
    slug: team.slug,
    aliases,
    icon: "🛡️",
  };
}

function leagueToEntity(league: RawLeague, sport: Sport): BrowseEntity {
  return {
    id: `${sport}-league-${slugifyBrowseValue(league.name)}`,
    sport,
    type: "league",
    name: league.name,
    slug: slugifyBrowseValue(league.name),
    aliases: [league.name, league.country],
    icon: "🏆",
  };
}

export function getEntitySearchStrings(entity: BrowseEntity): string[] {
  const values = [
    entity.name,
    entity.slug,
    entity.slug.replace(/-/g, " "),
    ...entity.aliases,
  ];
  return Array.from(
    new Set(values.map((value) => normalizeBrowseText(value)).filter(Boolean)),
  );
}

export const hockeyPlayers = sortSv(
  dedupeEntities(rawHockeyPlayers.map((item) => playerToEntity(item, "hockey"))),
);
export const hockeyTeams = sortSv(
  dedupeEntities(rawHockeyTeams.map((item) => teamToEntity(item, "hockey"))),
);
export const hockeyLeagues = sortSv(
  dedupeEntities(rawHockeyLeagues.map((item) => leagueToEntity(item, "hockey"))),
);
export const footballPlayers = sortSv(
  dedupeEntities(rawFootballPlayers.map((item) => playerToEntity(item, "football"))),
);
export const footballTeams = sortSv(
  dedupeEntities(rawFootballTeams.map((item) => teamToEntity(item, "football"))),
);
export const footballLeagues = sortSv(
  dedupeEntities(rawFootballLeagues.map((item) => leagueToEntity(item, "football"))),
);

export const browseData = {
  football: { players: footballPlayers, teams: footballTeams, leagues: footballLeagues },
  hockey: { players: hockeyPlayers, teams: hockeyTeams, leagues: hockeyLeagues },
} as const;

export function getBrowseEntities(
  sport: Sport,
  type: BrowseEntityType | "all",
): BrowseEntity[] {
  const data = browseData[sport];
  if (type === "player") return data.players;
  if (type === "team") return data.teams;
  if (type === "league") return data.leagues;
  return sortSv([...data.players, ...data.teams, ...data.leagues]);
}
