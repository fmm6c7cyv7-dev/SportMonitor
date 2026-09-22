// src/lib/news-engine/sportGuard.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type { EngineSport } from "@/lib/news-engine/types";
import {
  detectSportFromContent,
  hasSportContent,
} from "@/lib/classification/sportSignals";
import { getSourceProfile } from "@/lib/ranking/sourceProfiles";
import type { RankingNewsItem } from "@/lib/ranking/rankingTypes";

export type SportGuardCandidate = {
  title?: string | null;
  url?: string | null;
  source?: string | null;
  tags?: string[] | null;
  sport?: EngineSport | null;
};

export function toRankingSignalInput(
  item: SportGuardCandidate,
  requestedSport: EngineSport,
): RankingNewsItem {
  return {
    title: item.title ?? "",
    url: item.url ?? "",
    source: item.source ?? "",
    tags: item.tags ?? [],
    sport: requestedSport,
    entities: [],
  };
}

const FOOTBALL_ONLY_URL_TERMS = [
  "/fotboll/",
  "/football/",
  "/allsvenskan/",
  "/superettan/",
  "/premier-league/",
  "/champions-league/",
  "/kalmar-ff/",
  "/kff/",
];

const HOCKEY_ONLY_URL_TERMS = [
  "/hockey/",
  "/nhl/",
  "/shl/",
  "/hockeyallsvenskan/",
  "/kalmar-hc/",
  "/nybro-vikings/",
  "/nybro-vikings-if/",
];

const FOOTBALL_ONLY_SOURCE_TERMS = [
  "fotbollskanalen",
  "fotboll",
  "pressgurkan",
  "kalmar ff",
  "kff",
  "bollsvenskan",
  "barometern – kalmar ff",
  "olandsbladet – kalmar ff",
  "ölandsbladet – kalmar ff",
  "svenskafans – kalmar ff",
];

const HOCKEY_ONLY_SOURCE_TERMS = [
  "hockeynews",
  "hockeysverige",
  "hockey",
  "shl",
  "hockeyallsvenskan",
  "nhl",
  "kalmar hc",
  "nybro vikings",
];

function normalize(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function hasAnyTerm(haystack: string, terms: string[]): boolean {
  return terms.some((term) => haystack.includes(term));
}

function hasExplicitOppositeSportSignal(
  item: SportGuardCandidate,
  requestedSport: EngineSport,
): boolean {
  const source = normalize(item.source);
  const url = normalize(item.url);

  if (requestedSport === "football") {
    return (
      hasAnyTerm(source, HOCKEY_ONLY_SOURCE_TERMS) ||
      hasAnyTerm(url, HOCKEY_ONLY_URL_TERMS)
    );
  }

  return (
    hasAnyTerm(source, FOOTBALL_ONLY_SOURCE_TERMS) ||
    hasAnyTerm(url, FOOTBALL_ONLY_URL_TERMS)
  );
}

function hasTrustedSameSportSourceFallback(
  item: SportGuardCandidate,
  requestedSport: EngineSport,
): boolean {
  const profile = getSourceProfile(item.source ?? undefined);

  if (!profile.trustFeedSport || !profile.sports.includes(requestedSport)) {
    return false;
  }

  const source = normalize(item.source);
  const url = normalize(item.url);

  if (requestedSport === "football") {
    return (
      hasAnyTerm(source, FOOTBALL_ONLY_SOURCE_TERMS) ||
      hasAnyTerm(url, FOOTBALL_ONLY_URL_TERMS)
    );
  }

  return (
    hasAnyTerm(source, HOCKEY_ONLY_SOURCE_TERMS) ||
    hasAnyTerm(url, HOCKEY_ONLY_URL_TERMS)
  );
}

function ensureValidSport(
  sport: unknown,
): asserts sport is EngineSport {
  if (sport !== "football" && sport !== "hockey") {
    throw new EngineValidationError("Requested sport must be football or hockey", {
      sport,
    });
  }
}

function ensureValidCandidate(
  item: SportGuardCandidate,
): void {
  if (!item || typeof item !== "object") {
    throw new EngineValidationError("Sport guard candidate must be an object", {
      item,
    });
  }

  if (item.tags !== undefined && item.tags !== null && !Array.isArray(item.tags)) {
    throw new EngineValidationError("Sport guard candidate tags must be an array when provided", {
      tags: item.tags,
    });
  }
}

export function isSportConsistentForFeedV2(
  item: SportGuardCandidate,
  requestedSport: EngineSport,
): boolean {
  try {
    ensureValidSport(requestedSport);
    ensureValidCandidate(item);

    if (hasExplicitOppositeSportSignal(item, requestedSport)) {
      return false;
    }

    const signalInput = toRankingSignalInput(item, requestedSport);
    const hasContent = hasSportContent(signalInput);
    const detectedSport = detectSportFromContent(signalInput);

    if (!hasContent) {
      return hasTrustedSameSportSourceFallback(item, requestedSport);
    }

    if (!detectedSport) {
      return true;
    }

    return detectedSport === requestedSport;
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to run sport guard",
      {
        module: "isSportConsistentForFeedV2",
      },
    );
  }
}

export function filterCandidatesBySportConsistency(
  items: SportGuardCandidate[],
  requestedSport: EngineSport,
): SportGuardCandidate[] {
  try {
    ensureValidSport(requestedSport);

    if (!Array.isArray(items)) {
      throw new EngineValidationError("Sport guard items must be an array", {
        items,
      });
    }

    return items.filter((item) =>
      isSportConsistentForFeedV2(item, requestedSport),
    );
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to filter candidates by sport consistency",
      {
        module: "filterCandidatesBySportConsistency",
      },
    );
  }
}
