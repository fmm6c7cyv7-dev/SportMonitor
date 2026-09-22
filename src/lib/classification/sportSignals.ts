// src/lib/classification/sportSignals.ts

import type { RankingNewsItem, Sport } from "@/lib/ranking/rankingTypes";
import {
  FOOTBALL_LEAGUE_KEYWORDS,
  HOCKEY_LEAGUE_KEYWORDS,
  SPORT_CONTENT_SIGNALS,
} from "@/lib/ranking/rankingSignals";

/* ==========================================================================
   NEGATIVE / BLOCKING SIGNALS
   ========================================================================== */

const EXCLUDED_SPORT_SIGNALS = [
  "handboll",
  "handball",
  "innebandy",
  "floorball",
  "bandy",
  "basket",
  "basketball",
  "tennis",
  "padel",
  "volleyboll",
  "volleyball",
  "baseball",
  "cricket",
  "rugby",
  "golf",
  "curling",
  "alpint",
  "skidskytte",
  "friidrott",
  "athletics",
  "trav",
  "galopp",
  "motogp",
  "formel 1",
  "formula 1",
  "f1",
] as const;

/* ==========================================================================
   DIRECT SPORT SIGNALS
   --------------------------------------------------------------------------
   Dessa används för strikt sportklassning.
   Här ska signalerna vara relativt tydliga och inte allmänt sportiga.
   ========================================================================== */

const FOOTBALL_DIRECT_SIGNALS = [
  "fotboll",
  "football",
  "soccer",
  "matchday",
  "avspark",
  "kickoff",
  "startelva",
  "laguppstallning",
  "laguppställning",
  "offside",
  "straff",
  "frispark",
  "hörna",
  "horna",
  "ytterback",
  "mittfältare",
  "mittfaltare",
  "anfallare",
] as const;

const HOCKEY_DIRECT_SIGNALS = [
  "hockey",
  "ishockey",
  "nhl",
  "shl",
  "hockeyallsvenskan",
  "puck",
  "powerplay",
  "boxplay",
  "periodpaus",
  "tekning",
  "tekningar",
  "blueline",
  "goalie",
  "backcheck",
  "forecheck",
  "icing",
  "slapshot",
  "overtime",
  "sudden death",
] as const;

/* ==========================================================================
   NORMALIZATION HELPERS
   ========================================================================== */

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeText(text: string): string[] {
  return normalizeText(text).split(" ").filter(Boolean);
}

function containsTerm(text: string, value: string): boolean {
  const normalizedText = normalizeText(text);
  const normalizedValue = normalizeText(value);

  if (!normalizedText || !normalizedValue) return false;

  if (normalizedValue.includes(" ")) {
    return normalizedText.includes(normalizedValue);
  }

  const tokens = tokenizeText(normalizedText);
  return tokens.includes(normalizedValue);
}

function includesAny(text: string, values: readonly string[]): boolean {
  return values.some((value) => containsTerm(text, value));
}

function countMatches(text: string, values: readonly string[]): number {
  let count = 0;

  for (const value of values) {
    if (containsTerm(text, value)) {
      count += 1;
    }
  }

  return count;
}

/* ==========================================================================
   ITEM TEXT BUILDERS
   ========================================================================== */

function buildEntityText(item: RankingNewsItem): string {
  return (item.entities ?? [])
    .map((entity) => entity.name ?? "")
    .join(" ");
}

function buildSummaryText(item: RankingNewsItem): string {
  return "summary" in item && typeof item.summary === "string"
    ? item.summary
    : "";
}

function buildTitleAndTagsText(item: RankingNewsItem): string {
  return normalizeText(`${item.title ?? ""} ${(item.tags ?? []).join(" ")}`);
}

/**
 * Används för sportverifiering och sportdetektion.
 * Viktigt: source ska INTE hjälpa en artikel att bli "sportig".
 */
function buildVerificationText(item: RankingNewsItem): string {
  const entityNames = buildEntityText(item);
  const summary = buildSummaryText(item);

  return normalizeText(
    `${item.title ?? ""} ${summary} ${(item.tags ?? []).join(" ")} ${entityNames}`,
  );
}

/**
 * Bredare textbyggare kan vara användbar i andra sammanhang senare.
 * Just nu exporteras den för bakåtkompatibilitet, men används inte för att
 * låta source bära sportverifiering.
 */
export function buildItemText(item: RankingNewsItem): string {
  return buildVerificationText(item);
}

/* ==========================================================================
   CONTENT SIGNAL HELPERS
   ========================================================================== */

export function hasSportContent(item: RankingNewsItem): boolean {
  const text = buildVerificationText(item);

  if (!text) {
    return false;
  }

  if (includesAny(text, EXCLUDED_SPORT_SIGNALS)) {
    return false;
  }

  return includesAny(text, SPORT_CONTENT_SIGNALS);
}

export function hasHardNewsSignal(item: RankingNewsItem): boolean {
  const text = buildTitleAndTagsText(item);

  return (
    /\b(live|just nu|breaking|here we go|done deal|officiellt|official|klart|presenterad|confirmed)\b/.test(
      text,
    ) ||
    /\b(goal|mal|mål|avgor|avgör|kvitterar|natar|nätar|malskytt|målskytt|assist)\b/.test(
      text,
    ) ||
    /\b(starting xi|lineup|lineups|startelva|laguppstallning|laguppstallningar|confirmed xi|expected xi|team news)\b/.test(
      text,
    )
  );
}

/* ==========================================================================
   LEAGUE DETECTION
   ========================================================================== */

export function detectLeague(item: RankingNewsItem): string | null {
  const haystack = buildVerificationText(item);

  const keywordMap =
    item.sport === "hockey"
      ? HOCKEY_LEAGUE_KEYWORDS
      : FOOTBALL_LEAGUE_KEYWORDS;

  for (const [league, terms] of Object.entries(keywordMap)) {
    if (terms.some((term) => containsTerm(haystack, term))) {
      return league;
    }
  }

  return null;
}

export function detectSportFromLeague(item: RankingNewsItem): Sport | null {
  const haystack = buildVerificationText(item);

  for (const terms of Object.values(FOOTBALL_LEAGUE_KEYWORDS)) {
    if (terms.some((term) => containsTerm(haystack, term))) {
      return "football";
    }
  }

  for (const terms of Object.values(HOCKEY_LEAGUE_KEYWORDS)) {
    if (terms.some((term) => containsTerm(haystack, term))) {
      return "hockey";
    }
  }

  return null;
}

/* ==========================================================================
   STRICT SPORT DETECTION
   --------------------------------------------------------------------------
   Rule:
   - Clear football signal => football
   - Clear hockey signal => hockey
   - Excluded/other sport => null
   - Ambiguous => null
   ========================================================================== */

export function detectSportFromContent(item: RankingNewsItem): Sport | null {
  const text = buildVerificationText(item);

  if (!text) {
    return null;
  }

  if (includesAny(text, EXCLUDED_SPORT_SIGNALS)) {
    return null;
  }

  const leagueSport = detectSportFromLeague(item);
  if (leagueSport) {
    return leagueSport;
  }

  const footballSignalCount = countMatches(text, FOOTBALL_DIRECT_SIGNALS);
  const hockeySignalCount = countMatches(text, HOCKEY_DIRECT_SIGNALS);

  if (footballSignalCount > 0 && hockeySignalCount === 0) {
    return "football";
  }

  if (hockeySignalCount > 0 && footballSignalCount === 0) {
    return "hockey";
  }

  if (footballSignalCount >= 2 && footballSignalCount > hockeySignalCount) {
    return "football";
  }

  if (hockeySignalCount >= 2 && hockeySignalCount > footballSignalCount) {
    return "hockey";
  }

  return null;
}