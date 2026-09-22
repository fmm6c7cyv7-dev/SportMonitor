// src/lib/news-engine/sourceBalancing.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type { RankedArticle } from "@/lib/news-engine/types";

export type SourceBalancingOptions = {
  minGap?: number;
  lookahead?: number;
  protectTop?: number;
  limitIndex?: number;
  maxScoreDropForReorder?: number;
};

const DEFAULT_OPTIONS: Required<SourceBalancingOptions> = {
  minGap: 1,
  lookahead: 6,
  protectTop: 2,
  limitIndex: 15,
  maxScoreDropForReorder: 8,
};

function normalizeSource(source: string | null | undefined): string {
  return (source ?? "").trim().toLowerCase();
}

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

    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      throw new EngineValidationError("Ranked article id must be a non-empty string", {
        id: item?.id,
      });
    }

    if (typeof item.source !== "string") {
      throw new EngineValidationError("Ranked article source must be a string", {
        source: item?.source,
      });
    }

    if (typeof item.score !== "number" || !Number.isFinite(item.score)) {
      throw new EngineValidationError("Ranked article score must be a finite number", {
        id: item.id,
        score: item.score,
      });
    }
  }
}

function ensureValidOptions(options: SourceBalancingOptions): Required<SourceBalancingOptions> {
  const merged = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const numericEntries: Array<[string, number]> = [
    ["minGap", merged.minGap],
    ["lookahead", merged.lookahead],
    ["protectTop", merged.protectTop],
    ["limitIndex", merged.limitIndex],
    ["maxScoreDropForReorder", merged.maxScoreDropForReorder],
  ];

  for (const [key, value] of numericEntries) {
    if (!Number.isFinite(value) || value < 0) {
      throw new EngineValidationError(`${key} must be a non-negative finite number`, {
        key,
        value,
      });
    }
  }

  return merged;
}

function sourceSeenTooRecently(
  recentSources: string[],
  source: string,
  minGap: number,
): boolean {
  if (!source) {
    return false;
  }

  const recentWindow = recentSources.slice(-minGap);
  return recentWindow.includes(source);
}

function pushRecentSource(
  recentSources: string[],
  source: string,
  minGap: number,
): void {
  if (!source) {
    return;
  }

  recentSources.push(source);

  const maxRecent = Math.max(minGap, 5);
  if (recentSources.length > maxRecent) {
    recentSources.splice(0, recentSources.length - maxRecent);
  }
}

function isCandidateReorderAcceptable(
  firstItem: RankedArticle,
  candidate: RankedArticle,
  maxScoreDropForReorder: number,
): boolean {
  return firstItem.score - candidate.score <= maxScoreDropForReorder;
}

function pickCandidateIndex(
  queue: RankedArticle[],
  recentSources: string[],
  options: Required<SourceBalancingOptions>,
  position: number,
): number {
  const { minGap, lookahead, protectTop, maxScoreDropForReorder } = options;

  if (queue.length === 0) {
    return -1;
  }

  if (position < protectTop) {
    return 0;
  }

  const firstItem = queue[0];
  const firstSource = normalizeSource(firstItem?.source);

  if (!sourceSeenTooRecently(recentSources, firstSource, minGap)) {
    return 0;
  }

  const maxIndex = Math.min(lookahead, queue.length - 1);

  for (let index = 1; index <= maxIndex; index += 1) {
    const candidate = queue[index];
    const candidateSource = normalizeSource(candidate?.source);

    if (sourceSeenTooRecently(recentSources, candidateSource, minGap)) {
      continue;
    }

    if (!isCandidateReorderAcceptable(firstItem, candidate, maxScoreDropForReorder)) {
      continue;
    }

    return index;
  }

  return 0;
}

export function balanceSources(
  items: RankedArticle[],
  options: SourceBalancingOptions = {},
): RankedArticle[] {
  try {
    ensureValidArticles(items);
    const config = ensureValidOptions(options);

    const interleavableItems = items.slice(0, config.limitIndex);
    const remainingItems = items.slice(config.limitIndex);

    const queue = [...interleavableItems];
    const result: RankedArticle[] = [];
    const recentSources: string[] = [];

    let position = 0;

    while (queue.length > 0) {
      const candidateIndex = pickCandidateIndex(
        queue,
        recentSources,
        config,
        position,
      );

      const [chosen] = queue.splice(candidateIndex, 1);
      result.push(chosen);

      pushRecentSource(
        recentSources,
        normalizeSource(chosen.source),
        config.minGap,
      );

      position += 1;
    }

    return [...result, ...remainingItems];
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_PIPELINE_FAILURE",
      "Failed to balance sources",
      {
        module: "balanceSources",
      },
    );
  }
}