// Conservative prefilter only; a low title similarity never proves story identity.
// Keep this deliberately independent of favorites, VIP and ranking.
import { normalizeTitle, titleSimilarity } from "@/lib/news/newsDedupe";

export type StoryCandidate = {
  id: string;
  title: string;
  source: string;
  sport: "football" | "hockey";
  published_at: string;
  entityIds: string[];
};

export const STORY_MAX_AGE_DIFF_MS = 3 * 60 * 60_000;
export const STORY_AI_SIMILARITY_FLOOR = 0.10;

export function storyTitleSimilarity(a: string, b: string): number {
  // Preserve meaningful clauses after dashes, including Swedish legal headlines.
  return titleSimilarity(normalizeTitle(a), normalizeTitle(b));
}

export function isPossibleSameStory(
  a: StoryCandidate,
  b: StoryCandidate,
): boolean {
  if (a.id === b.id || a.sport !== b.sport) return false;
  const aTime = Date.parse(a.published_at);
  const bTime = Date.parse(b.published_at);
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime) ||
      Math.abs(aTime - bTime) > STORY_MAX_AGE_DIFF_MS) return false;

  // Never compare solely because both mention a league or an ambiguous place.
  if (a.entityIds.length === 0 || b.entityIds.length === 0) return false;
  const candidateEntities = new Set(b.entityIds);
  if (!a.entityIds.some((id) => candidateEntities.has(id))) return false;

  return storyTitleSimilarity(a.title, b.title) >= STORY_AI_SIMILARITY_FLOOR;
}

export function rankPossibleStories(
  article: StoryCandidate,
  existing: StoryCandidate[],
  maximum = 3,
): StoryCandidate[] {
  return existing
    .filter((candidate) => isPossibleSameStory(article, candidate))
    .sort((a, b) =>
      storyTitleSimilarity(article.title, b.title) -
      storyTitleSimilarity(article.title, a.title))
    .slice(0, maximum);
}
