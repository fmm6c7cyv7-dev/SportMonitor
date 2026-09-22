// src/lib/news-engine/finalRanking.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import { balanceSources, type SourceBalancingOptions } from "@/lib/news-engine/sourceBalancing";
import type { EngineSport, RankedArticle } from "@/lib/news-engine/types";
import { getDefaultRankingConfig } from "@/lib/ranking-v2/rankingConfig";

export type FinalRankingContext = {
  sport: EngineSport;
  hardNewsArticleIds?: string[];
  limit?: number;
  sourceBalancing?: SourceBalancingOptions;
};

function ensureValidArticles(items: RankedArticle[]): void {
  if (!Array.isArray(items)) {
    throw new EngineValidationError("Ranked articles must be an array", {
      items,
    });
  }

  for (const item of items) {
    if (!item || typeof item !== "object") {
      throw new EngineValidationError("Each ranked article must be an object", {
        item,
      });
    }

    if (item.sport !== "football" && item.sport !== "hockey") {
      throw new EngineValidationError("Ranked article sport must be football or hockey", {
        id: item?.id,
        sport: item?.sport,
      });
    }

    if (typeof item.score !== "number" || !Number.isFinite(item.score)) {
      throw new EngineValidationError("Ranked article score must be a finite number", {
        id: item?.id,
        score: item?.score,
      });
    }
  }
}

function ensureValidContext(context: FinalRankingContext): void {
  if (!context || typeof context !== "object") {
    throw new EngineValidationError("Final ranking context must be an object", {
      context,
    });
  }

  if (context.sport !== "football" && context.sport !== "hockey") {
    throw new EngineValidationError("Final ranking context sport must be football or hockey", {
      sport: context.sport,
    });
  }

  if (
    context.limit !== undefined &&
    (!Number.isFinite(context.limit) || context.limit < 0)
  ) {
    throw new EngineValidationError("Final ranking limit must be a non-negative finite number", {
      limit: context.limit,
    });
  }

  if (
    context.hardNewsArticleIds !== undefined &&
    !Array.isArray(context.hardNewsArticleIds)
  ) {
    throw new EngineValidationError("hardNewsArticleIds must be an array when provided", {
      hardNewsArticleIds: context.hardNewsArticleIds,
    });
  }
}

function sortByScoreAndTime(items: RankedArticle[]): RankedArticle[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const bTime = new Date(b.publishedAt ?? 0).getTime();
    const aTime = new Date(a.publishedAt ?? 0).getTime();

    return bTime - aTime;
  });
}

function passesFloor(
  item: RankedArticle,
  sport: EngineSport,
  hardNewsArticleIds: Set<string>,
): boolean {
  const config = getDefaultRankingConfig();
  const isHardNews = hardNewsArticleIds.has(item.id);

  const floor = isHardNews
    ? config.minRankingTotalHardNewsBySport[sport]
    : config.minRankingTotalBySport[sport];

  return item.score >= floor;
}

export function finalizeRanking(
  items: RankedArticle[],
  context: FinalRankingContext,
): RankedArticle[] {
  try {
    ensureValidArticles(items);
    ensureValidContext(context);

    const hardNewsArticleIds = new Set(context.hardNewsArticleIds ?? []);

    const sportFiltered = items.filter((item) => item.sport === context.sport);

    const floorFiltered = sportFiltered.filter((item) =>
      passesFloor(item, context.sport, hardNewsArticleIds),
    );

    const sorted = sortByScoreAndTime(floorFiltered);
    const balanced = balanceSources(sorted, context.sourceBalancing ?? {});

    if (context.limit === undefined) {
      return balanced;
    }

    return balanced.slice(0, context.limit);
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to finalize ranking",
      {
        module: "finalizeRanking",
      },
    );
  }
}