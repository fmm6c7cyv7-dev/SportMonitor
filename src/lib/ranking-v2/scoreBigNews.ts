import { getEditorialAssessment, hasEditorialPriority, editorialUrgency } from "@/lib/editorial/assessment";
// src/lib/ranking-v2/scoreBigNews.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type {
  BigNewsSignal,
  EngineBigNewsCategory,
  NormalizedArticle,
} from "@/lib/news-engine/types";
import {
  DEFAULT_RANKING_CONFIG,
  type RankingConfig,
  validateRankingConfig,
} from "@/lib/ranking-v2/rankingConfig";

function ensureValidArticle(
  article: Pick<NormalizedArticle, "title" | "tags" | "urgency" | "editorial_assessment">,
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

  if (!Array.isArray(article.tags)) {
    throw new EngineValidationError("Article tags must be an array", {
      tags: article.tags,
    });
  }

  if (typeof article.urgency !== "number" || !Number.isFinite(article.urgency)) {
    throw new EngineValidationError("Article urgency must be a finite number", {
      urgency: article.urgency,
    });
  }
}

function addCategory(
  categories: Set<EngineBigNewsCategory>,
  matchedTerms: Set<string>,
  scoreRef: { value: number },
  category: EngineBigNewsCategory,
  boost: number,
  term: string,
): void {
  categories.add(category);
  matchedTerms.add(term);
  scoreRef.value += boost;
}

export function scoreBigNewsSignal(
  article: Pick<NormalizedArticle, "title" | "tags" | "urgency" | "editorial_assessment">,
  config: RankingConfig = DEFAULT_RANKING_CONFIG,
): BigNewsSignal {
  try {
    ensureValidArticle(article);
    const safeConfig = validateRankingConfig(config);
    const assessment = getEditorialAssessment(article);
    const allowed = hasEditorialPriority(article);

    const categories = new Set<EngineBigNewsCategory>();
    const matchedTerms = new Set<string>();
    const scoreRef = { value: 0 };

    if (allowed && assessment?.category === "management") {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "management",
        safeConfig.bigNewsBoosts.management,
        "management",
      );
    }

    if (allowed && !!assessment && ["transfer", "departure", "contract"].includes(assessment.category)) {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "transfer",
        safeConfig.bigNewsBoosts.transfer,
        "transfer",
      );
    }

    if (allowed && assessment?.category === "match-event") {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "match-event",
        safeConfig.bigNewsBoosts.matchEvent,
        "match-event",
      );
    }

    if (allowed && !!assessment && (assessment.breaking || ["live", "discipline"].includes(assessment.category))) {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "live",
        safeConfig.bigNewsBoosts.live,
        "live",
      );
    }

    let fromUrgency = false;

    if (editorialUrgency(article) >= safeConfig.urgencyThresholds.high) {
      scoreRef.value += safeConfig.bigNewsBoosts.urgencyHigh;
      fromUrgency = true;
    } else if (editorialUrgency(article) >= safeConfig.urgencyThresholds.medium) {
      scoreRef.value += safeConfig.bigNewsBoosts.urgencyMedium;
      fromUrgency = true;
    }

    return {
      score: scoreRef.value,
      matched: scoreRef.value > 0,
      categories: Array.from(categories),
      matchedTerms: Array.from(matchedTerms),
      fromUrgency,
    };
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score big news signal",
      {
        module: "scoreBigNewsSignal",
      },
    );
  }
}