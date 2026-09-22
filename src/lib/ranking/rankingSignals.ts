// src/lib/ranking/rankingSignals.ts

/* ==========================================================================
   TYPES
   ========================================================================== */

type LeagueKeywordMap = Record<string, readonly string[]>;

/* ==========================================================================
   LEAGUE KEYWORDS
   --------------------------------------------------------------------------
   Dessa används av contentSignals.ts för att detektera sport från liga.
   Här ska vi vara relativt strikta:
   - liganamnet självt
   - tydliga ligaalias
   - inte breda eller korta klubbalias
   ========================================================================== */

export const FOOTBALL_LEAGUE_KEYWORDS: LeagueKeywordMap = {
  premier_league: ["premier league", "epl"],
  championship: ["championship", "efl championship"],
  serie_a: ["serie a"],
  serie_b: ["serie b"],
  bundesliga: ["bundesliga"],
  la_liga: ["la liga"],
  ligue_1: ["ligue 1"],
  eredivisie: ["eredivisie"],
  allsvenskan: ["allsvenskan"],
  superettan: ["superettan"],
} as const;

export const HOCKEY_LEAGUE_KEYWORDS: LeagueKeywordMap = {
  nhl: ["nhl"],
  shl: ["shl"],
  hockeyallsvenskan: ["hockeyallsvenskan"],
} as const;

/* ==========================================================================
   FUTURE CLUB / TEAM SIGNALS
   --------------------------------------------------------------------------
   Behålls här för framtida mer nyanserad klassning, men används inte som
   binär "sportverifiering" just nu.
   ========================================================================== */

export const FOOTBALL_CLUB_KEYWORDS = [
  "arsenal",
  "chelsea",
  "liverpool",
  "manchester united",
  "man utd",
  "tottenham",
  "spurs",
  "newcastle",
  "aston villa",
  "brighton",
  "west ham",
  "juventus",
  "napoli",
  "milan",
  "roma",
  "atalanta",
  "lazio",
  "bologna",
  "fiorentina",
  "bayern",
  "dortmund",
  "leverkusen",
  "frankfurt",
  "rb leipzig",
  "wolfsburg",
  "real madrid",
  "barcelona",
  "atletico",
  "sevilla",
  "girona",
  "real sociedad",
  "villarreal",
  "psg",
  "marseille",
  "lyon",
  "lille",
  "monaco",
  "ajax",
  "psv",
  "feyenoord",
  "az alkmaar",
  "malmo ff",
  "malmö ff",
  "hammarby",
  "djurgarden",
  "djurgården",
  "ifk goteborg",
  "ifk göteborg",
  "elfsborg",
  "vasteras sk",
  "västerås sk",
  "brommapojkarna",
  "helsingborg",
  "degerfors",
  "landskrona",
  "skövde",
  "skovde",
  "sandviken",
  "trelleborg",
  "utsikten",
] as const;

export const HOCKEY_CLUB_KEYWORDS = [
  "maple leafs",
  "rangers",
  "canucks",
  "bruins",
  "red wings",
  "oilers",
  "panthers",
  "senators",
  "flyers",
  "penguins",
  "stars",
  "avalanche",
  "frölunda",
  "frolunda",
  "färjestad",
  "farjestad",
  "luleå",
  "lulea",
  "skellefteå",
  "skelleftea",
  "brynäs",
  "brynas",
  "växjö",
  "vaxjo",
  "björklöven",
  "bjorkloven",
  "södertälje",
  "sodertalje",
  "bik karlskoga",
  "mora ik",
  "västerås ik",
  "vasteras ik",
  "vik västerås",
  "vik vasteras",
  "timrå",
  "timra",
  "rögle",
  "rogle",
  "hv71",
] as const;

/* ==========================================================================
   STRICT SPORT VERIFICATION SIGNALS
   --------------------------------------------------------------------------
   Används av hasSportContent() som binär verifiering för feeds som kräver
   sportkontroll. Därför måste listan vara ganska stark och inte innehålla
   allmänna ord som:
   - match
   - mål
   - assist
   - coach
   - spelare
   - debut
   - final
   ========================================================================== */

export const SPORT_CONTENT_SIGNALS = [
  // Tydliga ligor / sportnamn
  "fotboll",
  "football",
  "soccer",
  "allsvenskan",
  "superettan",
  "premier league",
  "epl",
  "serie a",
  "serie b",
  "bundesliga",
  "la liga",
  "ligue 1",
  "eredivisie",
  "ishockey",
  "hockey",
  "nhl",
  "shl",
  "hockeyallsvenskan",

  // Tydliga fotbollssignaler
  "startelva",
  "laguppställning",
  "laguppstallning",
  "avspark",
  "kickoff",
  "offside",
  "frispark",
  "hörna",
  "horna",
  "straff",

  // Tydliga hockeysignaler
  "powerplay",
  "boxplay",
  "tekning",
  "tekningar",
  "icing",
  "overtime",
  "sudden death",
  "slapshot",
  "periodpaus",
  "puck",
] as const;

/* ==========================================================================
   RANKING CONSTANTS
   ========================================================================== */

export const FILTERED_OUT_SCORE = -9999;