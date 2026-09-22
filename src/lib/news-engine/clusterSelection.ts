// src/lib/news-engine/clusterSelection.ts

import type {
  ArticleCluster,
  RankedArticle,
} from "@/lib/news-engine/types";

function publishedMs(article: RankedArticle): number {
  if (!article.publishedAt) return 0;
  const value = new Date(article.publishedAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function chooseRepresentative(
  cluster: ArticleCluster,
  articlesById: Map<string, RankedArticle>,
): string | null {
  const candidates = cluster.articleIds
    .map((articleId) => articlesById.get(articleId))
    .filter((article): article is RankedArticle => Boolean(article))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const timeDiff = publishedMs(b) - publishedMs(a);
      if (timeDiff !== 0) return timeDiff;

      return b.source.localeCompare(a.source);
    });

  return candidates[0]?.id ?? null;
}

/**
 * Collapses explicit event clusters after scoring while preserving the order of
 * the already-ranked list. The highest-scored article becomes representative.
 *
 * This is deliberately opt-in at pipeline level. Building clusters and using
 * cluster intensity is safe by default; suppressing follow-up articles is a
 * separate presentation decision.
 */
export function selectClusterRepresentatives(
  rankedArticles: RankedArticle[],
  clusters: ArticleCluster[],
): RankedArticle[] {
  if (!clusters.length) {
    return rankedArticles;
  }

  const articlesById = new Map(
    rankedArticles.map((article) => [article.id, article]),
  );
  const representativeByClusterId = new Map<string, string>();
  const clusterIdByArticleId = new Map<string, string>();

  for (const cluster of clusters) {
    const representativeId = chooseRepresentative(cluster, articlesById);
    if (!representativeId) continue;

    representativeByClusterId.set(cluster.clusterId, representativeId);

    for (const articleId of cluster.articleIds) {
      clusterIdByArticleId.set(articleId, cluster.clusterId);
    }
  }

  return rankedArticles
    .filter((article) => {
      const clusterId = clusterIdByArticleId.get(article.id);
      if (!clusterId) return true;

      return representativeByClusterId.get(clusterId) === article.id;
    })
    .map((article) => {
      const clusterId = clusterIdByArticleId.get(article.id);

      return clusterId
        ? {
            ...article,
            clusterId,
          }
        : article;
    });
}
