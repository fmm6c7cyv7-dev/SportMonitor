// src/lib/news-engine/pipeline.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import { selectClusterRepresentatives } from "@/lib/news-engine/clusterSelection";
import { analyzeDuplicates } from "@/lib/news-engine/duplicateDetection";
import { enrichArticlesWithCoreEntities } from "@/lib/news-engine/entityEnrichment";
import { buildEventClusters } from "@/lib/news-engine/eventClustering";
import { finalizeRanking, type FinalRankingContext } from "@/lib/news-engine/finalRanking";
import type {
  EngineFavorite,
  EngineGeoContext,
  EngineSport,
  NormalizedArticle,
  RankedArticle,
} from "@/lib/news-engine/types";
import { scoreBaseArticle } from "@/lib/ranking-v2/scoreBase";

export type RankingPipelineContext = {
  sport: EngineSport;
  nowMs: number;
  favorites?: EngineFavorite[];
  geo?: EngineGeoContext | null;
  duplicateCountsByArticleId?: Record<string, number>;
  eventIntensityByArticleId?: Record<string, number>;
  hardNewsArticleIds?: string[];
  limit?: number;
  sourceBalancing?: FinalRankingContext["sourceBalancing"];
  collapseEventClusters?: boolean;
};

function ensureValidArticles(articles: NormalizedArticle[]): void {
  if (!Array.isArray(articles)) {
    throw new EngineValidationError("Pipeline articles must be an array", {
      articles,
    });
  }

  for (const article of articles) {
    if (!article || typeof article !== "object") {
      throw new EngineValidationError("Each pipeline article must be an object", {
        article,
      });
    }

    if (typeof article.id !== "string" || article.id.trim().length === 0) {
      throw new EngineValidationError("Pipeline article id must be a non-empty string", {
        id: article?.id,
      });
    }
  }
}

function ensureValidContext(context: RankingPipelineContext): void {
  if (!context || typeof context !== "object") {
    throw new EngineValidationError("Pipeline context must be an object", {
      context,
    });
  }

  if (context.sport !== "football" && context.sport !== "hockey") {
    throw new EngineValidationError("Pipeline context sport must be football or hockey", {
      sport: context.sport,
    });
  }

  if (typeof context.nowMs !== "number" || !Number.isFinite(context.nowMs)) {
    throw new EngineValidationError("Pipeline context nowMs must be a finite number", {
      nowMs: context.nowMs,
    });
  }

  if (
    context.duplicateCountsByArticleId !== undefined &&
    (typeof context.duplicateCountsByArticleId !== "object" ||
      context.duplicateCountsByArticleId === null)
  ) {
    throw new EngineValidationError("duplicateCountsByArticleId must be an object when provided", {
      duplicateCountsByArticleId: context.duplicateCountsByArticleId,
    });
  }

  if (
    context.eventIntensityByArticleId !== undefined &&
    (typeof context.eventIntensityByArticleId !== "object" ||
      context.eventIntensityByArticleId === null)
  ) {
    throw new EngineValidationError("eventIntensityByArticleId must be an object when provided", {
      eventIntensityByArticleId: context.eventIntensityByArticleId,
    });
  }

  if (
    context.collapseEventClusters !== undefined &&
    typeof context.collapseEventClusters !== "boolean"
  ) {
    throw new EngineValidationError(
      "collapseEventClusters must be boolean when provided",
      {
        collapseEventClusters: context.collapseEventClusters,
      },
    );
  }
}

function scoreArticles(
  articles: NormalizedArticle[],
  context: RankingPipelineContext,
  duplicateCountsByArticleId: Record<string, number>,
  eventIntensityByArticleId: Record<string, number>,
): RankedArticle[] {
  return articles.map((article) =>
    scoreBaseArticle(article, {
      nowMs: context.nowMs,
      favorites: context.favorites ?? [],
      geo: context.geo ?? null,
      duplicateCount: duplicateCountsByArticleId[article.id] ?? 0,
      eventIntensity: eventIntensityByArticleId[article.id] ?? 0,
    }),
  );
}

function mergeNumericSignals(
  automatic: Record<string, number>,
  explicit: Record<string, number> | undefined,
): Record<string, number> {
  if (!explicit) return automatic;

  return {
    ...automatic,
    ...explicit,
  };
}

export function runRankingPipeline(
  articles: NormalizedArticle[],
  context: RankingPipelineContext,
): RankedArticle[] {
  try {
    ensureValidArticles(articles);
    ensureValidContext(context);

    const enrichedArticles = enrichArticlesWithCoreEntities(articles);
    const duplicateAnalysis = analyzeDuplicates(enrichedArticles);
    const eventAnalysis = buildEventClusters(enrichedArticles);

    const duplicateCountsByArticleId = mergeNumericSignals(
      duplicateAnalysis.duplicateCountsByArticleId,
      context.duplicateCountsByArticleId,
    );
    const eventIntensityByArticleId = mergeNumericSignals(
      eventAnalysis.eventIntensityByArticleId,
      context.eventIntensityByArticleId,
    );

    const scored = scoreArticles(
      enrichedArticles,
      context,
      duplicateCountsByArticleId,
      eventIntensityByArticleId,
    ).map((article) => {
      const clusterId = eventAnalysis.clusterIdByArticleId[article.id];

      return clusterId
        ? {
            ...article,
            clusterId,
          }
        : article;
    });

    const finalized = finalizeRanking(scored, {
      sport: context.sport,
      hardNewsArticleIds: context.hardNewsArticleIds ?? [],
      limit: context.collapseEventClusters ? undefined : context.limit,
      sourceBalancing: context.sourceBalancing,
    });

    if (!context.collapseEventClusters) {
      return finalized;
    }

    const collapsed = selectClusterRepresentatives(
      finalized,
      eventAnalysis.clusters,
    );

    return context.limit === undefined
      ? collapsed
      : collapsed.slice(0, context.limit);
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to run ranking pipeline",
      {
        module: "runRankingPipeline",
      },
    );
  }
}