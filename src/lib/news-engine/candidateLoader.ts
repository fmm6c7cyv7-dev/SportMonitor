// src/lib/news-engine/candidateLoader.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type {
  EngineSport,
  EntityHit,
  FavoriteSignal,
  NormalizedArticle,
} from "@/lib/news-engine/types";

export type LegacyRankingEntityType = "player" | "team" | "league" | "staff";

export type LegacyRankingEntity = {
  id?: string;
  name?: string;
  type?: LegacyRankingEntityType;
  sport?: EngineSport;
  nationality?: string;
  gender?: string;
  country?: string;
  league?: string;
  is_swedish?: boolean;
  is_abroad?: boolean;
};

export type LegacyAcceptedCandidate = {
  id?: string | null;
  sport?: EngineSport | null;
  title?: string | null;
  url: string;
  source?: string | null;
  published_at?: string | null;
  tags?: string[] | null;
  priority?: number | null;
  entities?: LegacyRankingEntity[] | null;
  isLocal?: boolean;
  favorite_match?: boolean;
  favorite_score?: number | null;
  favorite_context?: boolean;
  favorite_context_score?: number | null;
  favorite_entity_type?: LegacyRankingEntityType | null;
  favorite_entity_id?: string | null;
};

export type CandidateLoaderContext = {
  sport: EngineSport;
};

function normalizeString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function ensureValidContext(context: CandidateLoaderContext): void {
  if (!context || typeof context !== "object") {
    throw new EngineValidationError("Candidate loader context must be an object", {
      context,
    });
  }

  if (context.sport !== "football" && context.sport !== "hockey") {
    throw new EngineValidationError(
      "Candidate loader context sport must be football or hockey",
      {
        sport: context.sport,
      },
    );
  }
}

function ensureValidCandidates(
  items: LegacyAcceptedCandidate[],
): void {
  if (!Array.isArray(items)) {
    throw new EngineValidationError("Candidate loader items must be an array", {
      items,
    });
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      throw new EngineValidationError("Each candidate item must be an object", {
        item,
      });
    }

    if (typeof item.url !== "string" || item.url.trim().length === 0) {
      throw new EngineValidationError("Candidate item url must be a non-empty string", {
        item,
        url: item?.url,
      });
    }

    if (
      item.entities !== undefined &&
      item.entities !== null &&
      !Array.isArray(item.entities)
    ) {
      throw new EngineValidationError("Candidate item entities must be an array when provided", {
        item,
        entities: item.entities,
      });
    }
  }
}

function inferEntityType(
  type: LegacyRankingEntityType | undefined,
): EntityHit["type"] {
  if (type === "player") return "player";
  if (type === "team") return "team";
  if (type === "league") return "league";
  if (type === "staff") return "staff";

  return "unknown";
}

function inferEntitySport(
  entitySport: EngineSport | undefined,
  fallbackSport: EngineSport,
): EngineSport {
  if (entitySport === "football" || entitySport === "hockey") {
    return entitySport;
  }

  return fallbackSport;
}

function buildFallbackEntityId(
  entity: LegacyRankingEntity,
  fallbackSport: EngineSport,
): string {
  const type = inferEntityType(entity.type);
  const safeName = normalizeString(entity.name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${fallbackSport}-${type}-${safeName || "unknown"}`;
}

function mapLegacyEntityToEntityHit(
  entity: LegacyRankingEntity,
  fallbackSport: EngineSport,
): EntityHit {
  const name = normalizeString(entity.name);

  if (!name) {
    throw new EngineValidationError("Legacy entity name must be present", {
      entity,
    });
  }

  return {
    entityId: normalizeString(entity.id) || buildFallbackEntityId(entity, fallbackSport),
    sport: inferEntitySport(entity.sport, fallbackSport),
    type: inferEntityType(entity.type),
    name,
    confidence: 0.8,
    isSwedish: entity.is_swedish === true,
    isAbroadCore:
      entity.is_swedish === true &&
      entity.is_abroad === true &&
      (entity.type === "player" || entity.type === "staff"),
    origin: "detected",
  };
}

function getDirectFavoriteAffinityScore(
  type: LegacyRankingEntityType | null | undefined,
): number {
  if (type === "player") return 18;
  if (type === "team") return 16;
  if (type === "league") return 14;
  if (type === "staff") return 12;

  return 12;
}

function buildTrustedFavoriteSignal(
  item: LegacyAcceptedCandidate,
): FavoriteSignal {
  if (item.favorite_match === true) {
    const favoriteId = normalizeString(item.favorite_entity_id);

    return {
      score: getDirectFavoriteAffinityScore(item.favorite_entity_type),
      matched: true,
      matchedFavoriteIds: favoriteId ? [favoriteId] : [],
      reasons: ["trusted-direct-favorite"],
    };
  }

  if (item.favorite_context === true) {
    const rawContextScore = Number(item.favorite_context_score ?? 6);
    const contextScore = Number.isFinite(rawContextScore)
      ? Math.min(10, Math.max(1, rawContextScore))
      : 6;

    return {
      score: contextScore,
      matched: false,
      matchedFavoriteIds: [],
      reasons: ["trusted-related-context"],
    };
  }

  return {
    score: 0,
    matched: false,
    matchedFavoriteIds: [],
    reasons: ["trusted-no-favorite"],
  };
}

function inferUrgencyFromLegacyItem(item: LegacyAcceptedCandidate): number {
  const text = `${item.title ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();

  let urgency = 0;

  // Favorite personalization is ranking context, not article urgency.
  // Keeping it out of urgency makes favorites-first the only switch that
  // changes favorite ordering.
  if (
    /\b(just nu|live|breaking|avgår|avgar|sparken|klart|officiellt|mål|mal|hattrick|avgör|avgor)\b/u.test(
      text,
    )
  ) {
    urgency += 12;
  }

  return urgency;
}

function inferCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";

    return parsed.toString();
  } catch {
    return url;
  }
}

export function toNormalizedArticle(
  item: LegacyAcceptedCandidate,
  context: CandidateLoaderContext,
): NormalizedArticle {
  try {
    ensureValidContext(context);
    ensureValidCandidates([item]);

    const title = normalizeString(item.title) || "Untitled article";
    const source = normalizeString(item.source) || "Unknown source";
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    const entityHits = (item.entities ?? []).map((entity) =>
      mapLegacyEntityToEntityHit(entity, context.sport),
    );

    return {
      id: normalizeString(item.id) || item.url,
      sport:
        item.sport === "football" || item.sport === "hockey"
          ? item.sport
          : context.sport,
      title,
      url: item.url,
      source,
      publishedAt: item.published_at ?? null,
      summary: null,
      tags,
      priority: Number.isFinite(item.priority) ? Number(item.priority) : 0,
      urgency: inferUrgencyFromLegacyItem(item),
      canonicalUrl: inferCanonicalUrl(item.url),
      entityHits,
      favoriteSignal: item.favorite_match
        ? {
            score: Math.max(0, Number(item.favorite_score ?? 0)),
            matched: true,
            matchedFavoriteIds: [],
            reasons: ["legacy-favorite-match"],
          }
        : undefined,
      trustedFavoriteSignal: buildTrustedFavoriteSignal(item),
      localSignal: item.isLocal
        ? {
            score: 8,
            matched: true,
            reason: "legacy-local-match",
          }
        : undefined,
      bigNewsSignal: undefined,
    };
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to normalize legacy candidate",
      {
        module: "toNormalizedArticle",
        url: item?.url,
      },
    );
  }
}

export function loadPipelineCandidatesFromAccepted(
  items: LegacyAcceptedCandidate[],
  context: CandidateLoaderContext,
): NormalizedArticle[] {
  try {
    ensureValidContext(context);
    ensureValidCandidates(items);

    return items.map((item) => toNormalizedArticle(item, context));
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to load pipeline candidates from accepted items",
      {
        module: "loadPipelineCandidatesFromAccepted",
      },
    );
  }
}

export function buildHardNewsArticleIds(
  items: LegacyAcceptedCandidate[],
): string[] {
  try {
    ensureValidCandidates(items);

    return items
      .filter((item) => {
        const text = `${item.title ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();

        return /\b(just nu|live|breaking|avgår|avgar|sparken|klart|officiellt|mål|mal|hattrick|avgör|avgor)\b/u.test(
          text,
        );
      })
      .map((item) => normalizeString(item.id) || item.url);
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to build hard news article ids",
      {
        module: "buildHardNewsArticleIds",
      },
    );
  }
}