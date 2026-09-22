// src/lib/ranking-v2/scoreGeo.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type {
  EngineGeoContext,
  LocalSignal,
  NormalizedArticle,
} from "@/lib/news-engine/types";

type GeoScorableArticle = Pick<
  NormalizedArticle,
  "title" | "sport" | "source" | "tags"
> & {
  localSignal?: LocalSignal;
};

type GeoScoreContext = {
  geo: EngineGeoContext | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ensureValidInputs(
  article: GeoScorableArticle,
  context: GeoScoreContext,
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

  if (typeof article.source !== "string") {
    throw new EngineValidationError("Article source must be a string", {
      source: article.source,
    });
  }

  if (!Array.isArray(article.tags)) {
    throw new EngineValidationError("Article tags must be an array", {
      tags: article.tags,
    });
  }

  if (
    context.geo !== null &&
    (!context.geo ||
      typeof context.geo.lat !== "number" ||
      !Number.isFinite(context.geo.lat) ||
      typeof context.geo.lng !== "number" ||
      !Number.isFinite(context.geo.lng))
  ) {
    throw new EngineValidationError("Geo context must contain finite lat/lng", {
      geo: context.geo,
    });
  }
}

export function scoreGeoAffinity(
  article: GeoScorableArticle,
  context: GeoScoreContext,
): number {
  try {
    ensureValidInputs(article, context);

    if (!context.geo) {
      return 0;
    }

    let score = 0;

    if (article.localSignal?.matched) {
      score += Math.max(0, article.localSignal.score);
    }

    const text = normalizeText(
      `${article.title} ${article.source} ${(article.tags ?? []).join(" ")}`,
    );

    if (/\b(lokalt|lokal|nara dig|nära dig|din stad|din region)\b/u.test(text)) {
      score += 6;
    }

    if (/\b(vlt|unt|hd|sydsvenskan|corren|nt|vk|gd|dt|dalademokraten)\b/u.test(text)) {
      score += 4;
    }

    return score;
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score geo affinity",
      {
        module: "scoreGeoAffinity",
      },
    );
  }
}