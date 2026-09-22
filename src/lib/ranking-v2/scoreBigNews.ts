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

const MANAGEMENT_PATTERN =
  /\b(avgar|avgår|sparken|sacked|resigns|resigned|fired)\b/u;

const TRANSFER_PATTERN =
  /\b(here we go|klart|klar|officiellt|official|confirmed|done deal|signs|signed)\b/u;

const MATCH_EVENT_PATTERN =
  /\b(goal|mal|mål|hattrick|utklassning|avgor|avgör|kvitterar|matchvinnare|vinstmal|vinstmål)\b/u;

const LIVE_PATTERN =
  /\b(live|just nu|breaking|red card|rott kort|rött kort|utvisning|matchstraff)\b/u;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildSearchText(article: Pick<NormalizedArticle, "title" | "tags">): string {
  const tagText = (article.tags ?? []).join(" ");
  return normalizeText(`${article.title ?? ""} ${tagText}`);
}

function ensureValidArticle(
  article: Pick<NormalizedArticle, "title" | "tags" | "urgency">,
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
  article: Pick<NormalizedArticle, "title" | "tags" | "urgency">,
  config: RankingConfig = DEFAULT_RANKING_CONFIG,
): BigNewsSignal {
  try {
    ensureValidArticle(article);
    const safeConfig = validateRankingConfig(config);
    const text = buildSearchText(article);

    const categories = new Set<EngineBigNewsCategory>();
    const matchedTerms = new Set<string>();
    const scoreRef = { value: 0 };

    if (MANAGEMENT_PATTERN.test(text)) {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "management",
        safeConfig.bigNewsBoosts.management,
        "management",
      );
    }

    if (TRANSFER_PATTERN.test(text)) {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "transfer",
        safeConfig.bigNewsBoosts.transfer,
        "transfer",
      );
    }

    if (MATCH_EVENT_PATTERN.test(text)) {
      addCategory(
        categories,
        matchedTerms,
        scoreRef,
        "match-event",
        safeConfig.bigNewsBoosts.matchEvent,
        "match-event",
      );
    }

    if (LIVE_PATTERN.test(text)) {
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

    if (article.urgency >= safeConfig.urgencyThresholds.high) {
      scoreRef.value += safeConfig.bigNewsBoosts.urgencyHigh;
      fromUrgency = true;
    } else if (article.urgency >= safeConfig.urgencyThresholds.medium) {
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