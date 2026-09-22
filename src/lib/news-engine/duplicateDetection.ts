// src/lib/news-engine/duplicateDetection.ts

import type { NormalizedArticle } from "@/lib/news-engine/types";

export type DuplicateKind = "canonical-url" | "title-similarity";

export type DuplicateGroup = {
  groupId: string;
  kind: DuplicateKind;
  articleIds: string[];
};

export type DuplicateAnalysis = {
  groups: DuplicateGroup[];
  duplicateCountsByArticleId: Record<string, number>;
};

export type DuplicateDetectionOptions = {
  maxAgeDifferenceMinutes?: number;
  titleSimilarityThreshold?: number;
};

const DEFAULT_OPTIONS: Required<DuplicateDetectionOptions> = {
  maxAgeDifferenceMinutes: 360,
  titleSimilarityThreshold: 0.84,
};

function normalizeTitle(value: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(just nu|live|breaking|klart|officiellt|official)\b/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";

    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function tokens(value: string): string[] {
  return normalizeTitle(value).split(" ").filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));

  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(value: string): Set<string> {
  const normalized = `  ${normalizeTitle(value)}  `;
  const result = new Set<string>();

  for (let index = 0; index < normalized.length - 2; index += 1) {
    result.add(normalized.slice(index, index + 3));
  }

  return result;
}

function trigramSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);

  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function titleSimilarity(a: string, b: string): number {
  return Math.max(jaccardSimilarity(a, b), trigramSimilarity(a, b));
}

function publishedMs(article: NormalizedArticle): number | null {
  if (!article.publishedAt) return null;
  const value = new Date(article.publishedAt).getTime();
  return Number.isFinite(value) ? value : null;
}

function withinWindow(
  a: NormalizedArticle,
  b: NormalizedArticle,
  maxAgeDifferenceMinutes: number,
): boolean {
  const aMs = publishedMs(a);
  const bMs = publishedMs(b);

  if (aMs == null || bMs == null) return true;

  return (
    Math.abs(aMs - bMs) <=
    Math.max(0, maxAgeDifferenceMinutes) * 60_000
  );
}

function duplicateKind(
  a: NormalizedArticle,
  b: NormalizedArticle,
  options: Required<DuplicateDetectionOptions>,
): DuplicateKind | null {
  if (a.sport !== b.sport) return null;
  if (!withinWindow(a, b, options.maxAgeDifferenceMinutes)) return null;

  const aUrl = canonicalizeUrl(a.canonicalUrl ?? a.url);
  const bUrl = canonicalizeUrl(b.canonicalUrl ?? b.url);

  if (aUrl && bUrl && aUrl === bUrl) {
    return "canonical-url";
  }

  const aTitle = normalizeTitle(a.title);
  const bTitle = normalizeTitle(b.title);

  if (!aTitle || !bTitle) return null;
  if (aTitle === bTitle) return "title-similarity";

  return titleSimilarity(aTitle, bTitle) >= options.titleSimilarityThreshold
    ? "title-similarity"
    : null;
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    let current = index;

    while (this.parent[current] !== current) {
      this.parent[current] = this.parent[this.parent[current]];
      current = this.parent[current];
    }

    return current;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent[rootB] = rootA;
    }
  }
}

export function analyzeDuplicates(
  articles: NormalizedArticle[],
  options: DuplicateDetectionOptions = {},
): DuplicateAnalysis {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const union = new UnionFind(articles.length);
  const pairKinds = new Map<string, DuplicateKind>();

  for (let left = 0; left < articles.length; left += 1) {
    for (let right = left + 1; right < articles.length; right += 1) {
      const kind = duplicateKind(articles[left], articles[right], config);
      if (!kind) continue;

      union.union(left, right);
      pairKinds.set(`${left}:${right}`, kind);
    }
  }

  const indexesByRoot = new Map<number, number[]>();

  for (let index = 0; index < articles.length; index += 1) {
    const root = union.find(index);
    const indexes = indexesByRoot.get(root) ?? [];
    indexes.push(index);
    indexesByRoot.set(root, indexes);
  }

  const groups: DuplicateGroup[] = [];
  const duplicateCountsByArticleId: Record<string, number> = {};
  let groupNumber = 0;

  for (const indexes of indexesByRoot.values()) {
    if (indexes.length < 2) continue;

    groupNumber += 1;
    let kind: DuplicateKind = "title-similarity";

    outer: for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const pairKey = `${Math.min(indexes[left], indexes[right])}:${Math.max(
          indexes[left],
          indexes[right],
        )}`;

        if (pairKinds.get(pairKey) === "canonical-url") {
          kind = "canonical-url";
          break outer;
        }
      }
    }

    const articleIds = indexes.map((index) => articles[index].id);
    const duplicateCount = Math.max(0, articleIds.length - 1);

    for (const articleId of articleIds) {
      duplicateCountsByArticleId[articleId] = duplicateCount;
    }

    groups.push({
      groupId: `duplicate-${groupNumber}`,
      kind,
      articleIds,
    });
  }

  return {
    groups,
    duplicateCountsByArticleId,
  };
}
