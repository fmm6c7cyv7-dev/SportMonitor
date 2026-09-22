// src/lib/news-engine/eventClustering.ts

import type {
  ArticleCluster,
  EntityHit,
  NormalizedArticle,
} from "@/lib/news-engine/types";

export type EventCategory =
  | "management"
  | "transfer"
  | "match-event"
  | "discipline"
  | "injury"
  | "lineup"
  | "live";

export type EventClusterAnalysis = {
  clusters: ArticleCluster[];
  clusterIdByArticleId: Record<string, string>;
  eventIntensityByArticleId: Record<string, number>;
};

export type EventClusteringOptions = {
  maxAgeDifferenceMinutes?: number;
};

const DEFAULT_OPTIONS: Required<EventClusteringOptions> = {
  maxAgeDifferenceMinutes: 360,
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyEventCategory(
  article: Pick<NormalizedArticle, "title" | "tags">,
): EventCategory | null {
  const text = normalizeText(
    `${article.title} ${article.tags.join(" ")}`,
  );

  if (
    /\b(avgår|avgar|sparken|sacked|fired|appointed|appoints|new manager|new head coach|takes over|huvudtranare klar|huvudtränare klar|tränarbyte|tranarbyte)\b/u.test(
      text,
    )
  ) {
    return "management";
  }

  if (
    /\b(here we go|done deal|transfer|signing|signs|signed|joins|joined|klar for|klar för|varvar|värvar|lamnar|lämnar|linked with|forhandlar|förhandlar)\b/u.test(
      text,
    )
  ) {
    return "transfer";
  }

  if (
    /\b(injury|injured|skada|skadad|missar|out for|rehab|comeback|aterkomst|återkomst)\b/u.test(
      text,
    )
  ) {
    return "injury";
  }

  if (
    /\b(red card|rött kort|rott kort|utvisning|matchstraff|suspended|avstangd|avstängd)\b/u.test(
      text,
    )
  ) {
    return "discipline";
  }

  if (
    /\b(starting xi|lineup|lineups|startelva|laguppstallning|laguppställning|confirmed xi|team news)\b/u.test(
      text,
    )
  ) {
    return "lineup";
  }

  if (
    /\b(goal|goals|score|scores|scored|mål|mal|hattrick|assist|avgör|avgor|kvitterar|nätar|natar|winner|match winner|matchvinnare|vinstmål|vinstmal)\b/u.test(
      text,
    )
  ) {
    return "match-event";
  }

  if (/\b(live|just nu|breaking)\b/u.test(text)) {
    return "live";
  }

  return null;
}

function entityPriority(hit: EntityHit): number {
  if (hit.type === "player") return 4;
  if (hit.type === "staff" || hit.type === "coach") return 3;
  if (hit.type === "team") return 2;
  return 0;
}

function pickAnchorEntity(article: NormalizedArticle): EntityHit | null {
  const candidates = article.entityHits
    .filter(
      (hit) =>
        hit &&
        (hit.type === "player" ||
          hit.type === "staff" ||
          hit.type === "coach" ||
          hit.type === "team"),
    )
    .sort((a, b) => {
      const priorityDiff = entityPriority(b) - entityPriority(a);
      if (priorityDiff !== 0) return priorityDiff;

      const swedishDiff = Number(Boolean(b.isSwedish)) - Number(Boolean(a.isSwedish));
      if (swedishDiff !== 0) return swedishDiff;

      return b.confidence - a.confidence;
    });

  return candidates[0] ?? null;
}

function eventKeyForArticle(article: NormalizedArticle): string | null {
  const category = classifyEventCategory(article);
  const anchor = pickAnchorEntity(article);

  if (!category || !anchor) return null;

  return `${article.sport}|${anchor.entityId}|${category}`;
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

  if (aMs == null || bMs == null) return false;

  return (
    Math.abs(aMs - bMs) <=
    Math.max(0, maxAgeDifferenceMinutes) * 60_000
  );
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

function newestArticleId(
  articles: NormalizedArticle[],
  indexes: number[],
): string {
  return [...indexes]
    .sort((a, b) => (publishedMs(articles[b]) ?? 0) - (publishedMs(articles[a]) ?? 0))
    .map((index) => articles[index].id)[0];
}

function clusterIntensity(
  articles: NormalizedArticle[],
  indexes: number[],
): number {
  const sources = new Set(
    indexes
      .map((index) => normalizeText(articles[index].source))
      .filter(Boolean),
  );

  // Multiple independent sources increase confidence/importance, but the boost
  // is deliberately capped so a media swarm cannot overwhelm core relevance.
  return Math.min(8, Math.max(0, sources.size - 1) * 2);
}

export function buildEventClusters(
  articles: NormalizedArticle[],
  options: EventClusteringOptions = {},
): EventClusterAnalysis {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const keys = articles.map(eventKeyForArticle);
  const union = new UnionFind(articles.length);

  for (let left = 0; left < articles.length; left += 1) {
    if (!keys[left]) continue;

    for (let right = left + 1; right < articles.length; right += 1) {
      if (keys[left] !== keys[right]) continue;
      if (
        !withinWindow(
          articles[left],
          articles[right],
          config.maxAgeDifferenceMinutes,
        )
      ) {
        continue;
      }

      union.union(left, right);
    }
  }

  const indexesByRoot = new Map<number, number[]>();

  for (let index = 0; index < articles.length; index += 1) {
    if (!keys[index]) continue;

    const root = union.find(index);
    const indexes = indexesByRoot.get(root) ?? [];
    indexes.push(index);
    indexesByRoot.set(root, indexes);
  }

  const clusters: ArticleCluster[] = [];
  const clusterIdByArticleId: Record<string, string> = {};
  const eventIntensityByArticleId: Record<string, number> = {};
  let clusterNumber = 0;

  for (const indexes of indexesByRoot.values()) {
    if (indexes.length < 2) continue;

    const eventKey = keys[indexes[0]];
    if (!eventKey) continue;

    clusterNumber += 1;
    const clusterId = `event-${clusterNumber}`;
    const articleIds = indexes.map((index) => articles[index].id);
    const intensity = clusterIntensity(articles, indexes);

    for (const articleId of articleIds) {
      clusterIdByArticleId[articleId] = clusterId;
      eventIntensityByArticleId[articleId] = intensity;
    }

    clusters.push({
      clusterId,
      sport: articles[indexes[0]].sport,
      representativeArticleId: newestArticleId(articles, indexes),
      articleIds,
      eventKey,
      intensity,
    });
  }

  return {
    clusters,
    clusterIdByArticleId,
    eventIntensityByArticleId,
  };
}
