// src/lib/ranking-v2/scoreFavoriteAffinity.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type {
  EngineFavorite,
  EntityHit,
  FavoriteSignal,
  NormalizedArticle,
} from "@/lib/news-engine/types";

type FavoriteAffinityContext = {
  favorites: EngineFavorite[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ensureEntityHits(value: unknown): EntityHit[] {
  if (!Array.isArray(value)) {
    throw new EngineValidationError("entityHits must be an array", {
      entityHits: value,
    });
  }

  return value as EntityHit[];
}

function ensureFavorites(value: unknown): EngineFavorite[] {
  if (!Array.isArray(value)) {
    throw new EngineValidationError("favorites must be an array", {
      favorites: value,
    });
  }

  return value as EngineFavorite[];
}

function ensureValidInputs(
  article: Pick<NormalizedArticle, "title" | "sport" | "entityHits">,
  context: FavoriteAffinityContext,
): void {
  if (!article || typeof article !== "object") {
    throw new EngineValidationError("Article must be an object", {
      article,
    });
  }

  if (typeof article.title !== "string") {
    throw new EngineValidationError("Article title must be a string", {
      title: article.title,
    });
  }

  if (article.sport !== "football" && article.sport !== "hockey") {
    throw new EngineValidationError("Article sport must be football or hockey", {
      sport: article.sport,
    });
  }

  ensureEntityHits(article.entityHits);
  ensureFavorites(context.favorites);
}

function addMatch(
  signal: FavoriteSignal,
  favorite: EngineFavorite,
  score: number,
  reason: string,
): void {
  signal.score += score;
  signal.matched = true;
  signal.matchedFavoriteIds.push(favorite.entityId);
  signal.reasons.push(reason);
}

function getExactEntityMatch(
  entityHits: EntityHit[],
  favorite: EngineFavorite,
): EntityHit | undefined {
  return entityHits.find((hit) => hit.entityId === favorite.entityId);
}

function getLeagueRelatedSwedishMatch(
  entityHits: EntityHit[],
): EntityHit | undefined {
  return entityHits.find((hit) => hit.isSwedish === true);
}

function getTeamRelatedMatch(
  entityHits: EntityHit[],
  favorite: EngineFavorite,
): EntityHit | undefined {
  const normalizedFavoriteLabel = normalizeText(favorite.label);

  // A team favorite must never match an unrelated Swedish entity.
  // Relationship expansion (team -> own players/staff) is handled upstream
  // by the canonical favorite expansion layer. This scorer may only fall
  // back to an exact team-name match when entity ids are unavailable.
  return entityHits.find((hit) => {
    const name = normalizeText(hit.name);

    return hit.type === "team" && name === normalizedFavoriteLabel;
  });
}

export function scoreFavoriteAffinity(
  article: Pick<NormalizedArticle, "title" | "sport" | "entityHits">,
  context: FavoriteAffinityContext,
): FavoriteSignal {
  try {
    ensureValidInputs(article, context);

    const signal: FavoriteSignal = {
      score: 0,
      matched: false,
      matchedFavoriteIds: [],
      reasons: [],
    };

    if (context.favorites.length === 0) {
      return signal;
    }

    for (const favorite of context.favorites) {
      if (favorite.sport !== article.sport) {
        continue;
      }

      const exactMatch = getExactEntityMatch(article.entityHits, favorite);

      if (exactMatch) {
        if (favorite.type === "player") {
          addMatch(signal, favorite, 18, `exact-player:${favorite.label}`);
          continue;
        }

        if (favorite.type === "team") {
          addMatch(signal, favorite, 16, `exact-team:${favorite.label}`);
          continue;
        }

        if (favorite.type === "league") {
          addMatch(signal, favorite, 14, `exact-league:${favorite.label}`);
          continue;
        }
      }

      if (favorite.type === "league") {
        const swedishLeagueRelated = getLeagueRelatedSwedishMatch(article.entityHits);

        if (swedishLeagueRelated) {
          addMatch(
            signal,
            favorite,
            10,
            `league-swedish-related:${favorite.label}:${swedishLeagueRelated.name}`,
          );
        }

        continue;
      }

      if (favorite.type === "team") {
        const teamRelated = getTeamRelatedMatch(article.entityHits, favorite);

        if (teamRelated) {
          addMatch(
            signal,
            favorite,
            teamRelated.type === "team" ? 16 : 12,
            `team-related:${favorite.label}:${teamRelated.name}`,
          );
        }
      }
    }

    signal.matchedFavoriteIds = Array.from(new Set(signal.matchedFavoriteIds));
    signal.reasons = Array.from(new Set(signal.reasons));

    return signal;
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score favorite affinity",
      {
        module: "scoreFavoriteAffinity",
      },
    );
  }
}