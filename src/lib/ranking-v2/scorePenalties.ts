// src/lib/ranking-v2/scorePenalties.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type { NormalizedArticle } from "@/lib/news-engine/types";

export type PenaltySignal = {
  evergreenPenalty: number;
  stalenessPenalty: number;
  duplicatePenalty: number;
  reasons: string[];
};

export type PenaltyContext = {
  nowMs: number;
  duplicateCount?: number;
  isHardNews?: boolean;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ensureValidInputs(
  article: Pick<NormalizedArticle, "title" | "publishedAt" | "tags">,
  context: PenaltyContext,
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

  if (typeof context.nowMs !== "number" || !Number.isFinite(context.nowMs)) {
    throw new EngineValidationError(
      "Penalty context nowMs must be a finite number",
      {
        nowMs: context.nowMs,
      },
    );
  }

  if (
    context.duplicateCount !== undefined &&
    (typeof context.duplicateCount !== "number" ||
      !Number.isFinite(context.duplicateCount) ||
      context.duplicateCount < 0)
  ) {
    throw new EngineValidationError(
      "duplicateCount must be a non-negative finite number",
      {
        duplicateCount: context.duplicateCount,
      },
    );
  }
}

function getPublishedAgeHours(
  publishedAt: string | null,
  nowMs: number,
): number | null {
  if (!publishedAt) return null;

  const publishedMs = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedMs)) return null;

  return Math.max(0, (nowMs - publishedMs) / 3_600_000);
}

function isTodayInHockeyHistory(text: string): boolean {
  return /\btoday in hockey history\b/u.test(text);
}

function matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

function scoreEvergreenPenalty(text: string, reasons: string[]): number {
  if (isTodayInHockeyHistory(text)) {
    reasons.push("daily-feature-exempt");
    return 0;
  }

  let penalty = 0;

  const evergreenHistoryPatterns: RegExp[] = [
    /\barchive\b/u,
    /\barchives\b/u,
    /\bhistory of\b/u,
    /\bhistorien om\b/u,
    /\bhockey history\b/u,
    /\ball-time\b/u,
    /\ball time\b/u,
    /\bbest ever\b/u,
    /\bwhere are they now\b/u,
    /\bnostalgia\b/u,
    /\bnostalgic\b/u,
    /\bthrowback\b/u,
    /\bretro\b/u,
  ];

  const prospectAndDraftPatterns: RegExp[] = [
    /\bprospect profile\b/u,
    /\bdraft profile\b/u,
    /\bdraft review\b/u,
    /\bmock draft\b/u,
    /\btop prospect\b/u,
    /\bprospect\b/u,
    /\bprospects\b/u,
  ];

  const listAndRankingPatterns: RegExp[] = [
    /\btop 10\b/u,
    /\btop 5\b/u,
    /\btop 3\b/u,
    /\btop three\b/u,
    /\branking\b/u,
    /\brankings\b/u,
    /\branked\b/u,
    /\bbest player\b/u,
    /\bbest players\b/u,
    /\bbest goalie\b/u,
    /\bbest goalies\b/u,
    /\bbest defensemen\b/u,
    /\bbest forward\b/u,
    /\bbest forwards\b/u,
    /\bgreatest\b/u,
  ];

  const commentaryPatterns: RegExp[] = [
    /\bcommentary\b/u,
    /\bopinion\b/u,
    /\bcolumn\b/u,
    /\banalysis\b/u,
    /\banalyserar\b/u,
    /\bkronika\b/u,
    /\bkrönika\b/u,
    /\beditorial\b/u,
  ];

  const guideLikePatterns: RegExp[] = [
    /\bguide\b/u,
    /\bsa fungerar\b/u,
    /\bså fungerar\b/u,
    /\bexplained\b/u,
    /\bforklaring\b/u,
    /\bförklaring\b/u,
    /\bexplainer\b/u,
    /\blista\b/u,
  ];

  if (matchesAnyPattern(text, evergreenHistoryPatterns)) {
    penalty += 9;
    reasons.push("evergreen-history-content");
  }

  if (matchesAnyPattern(text, prospectAndDraftPatterns)) {
    penalty += 8;
    reasons.push("prospect-or-draft-content");
  }

  if (matchesAnyPattern(text, listAndRankingPatterns)) {
    penalty += 7;
    reasons.push("list-or-ranking-content");
  }

  if (matchesAnyPattern(text, commentaryPatterns)) {
    penalty += 5;
    reasons.push("commentary-content");
  }

  if (matchesAnyPattern(text, guideLikePatterns)) {
    penalty += 4;
    reasons.push("guide-like-content");
  }

  return penalty;
}

function scoreStalenessPenalty(
  ageHours: number | null,
  isHardNews: boolean,
  reasons: string[],
): number {
  if (ageHours === null) {
    return 0;
  }

  let penalty = 0;

  if (isHardNews) {
    if (ageHours >= 48) {
      penalty += 8;
      reasons.push("hard-news-stale-48h");
    } else if (ageHours >= 24) {
      penalty += 4;
      reasons.push("hard-news-stale-24h");
    }

    return penalty;
  }

  if (ageHours >= 72) {
    penalty += 8;
    reasons.push("stale-72h");
  } else if (ageHours >= 36) {
    penalty += 4;
    reasons.push("stale-36h");
  }

  return penalty;
}

function scoreDuplicatePenalty(
  duplicateCount: number,
  reasons: string[],
): number {
  if (duplicateCount <= 0) {
    return 0;
  }

  const penalty = Math.min(12, duplicateCount * 3);

  reasons.push(`duplicate-count:${duplicateCount}`);

  return penalty;
}

export function scorePenaltySignal(
  article: Pick<NormalizedArticle, "title" | "publishedAt" | "tags">,
  context: PenaltyContext,
): PenaltySignal {
  try {
    ensureValidInputs(article, context);

    const reasons: string[] = [];
    const text = normalizeText(`${article.title} ${(article.tags ?? []).join(" ")}`);
    const ageHours = getPublishedAgeHours(article.publishedAt, context.nowMs);

    const evergreenPenalty = scoreEvergreenPenalty(text, reasons);
    const stalenessPenalty = scoreStalenessPenalty(
      ageHours,
      context.isHardNews === true,
      reasons,
    );
    const duplicatePenalty = scoreDuplicatePenalty(
      context.duplicateCount ?? 0,
      reasons,
    );

    return {
      evergreenPenalty,
      stalenessPenalty,
      duplicatePenalty,
      reasons: Array.from(new Set(reasons)),
    };
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score penalties",
      {
        module: "scorePenaltySignal",
      },
    );
  }
}