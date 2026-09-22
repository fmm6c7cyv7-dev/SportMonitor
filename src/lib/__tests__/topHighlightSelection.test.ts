import { describe, expect, it } from "vitest";
import type { NewsItem, Sport } from "@/lib/types";
import {
  hasTopHighlightSpecialSignal,
  selectTopHighlightCandidate,
} from "@/components/TopHighlight";

function createItem(params: {
  id: string;
  title: string;
  publishedAtMs: number;
  sport?: Sport;
  favoriteMatch?: boolean;
  rankingTotal?: number;
  tags?: string[];
  isLocal?: boolean;
}): NewsItem {
  return {
    id: params.id,
    title: params.title,
    url: `https://example.com/${params.id}`,
    source: "TestSource",
    sport: params.sport ?? "football",
    published_at: new Date(params.publishedAtMs).toISOString(),
    favorite_match: params.favoriteMatch ?? false,
    ranking_total: params.rankingTotal ?? 0,
    tags: params.tags,
    is_local: params.isLocal,
  };
}

describe("TopHighlight selection", () => {
  it("prioriterar nyare artikel över äldre favorit", () => {
    const nowMs = Date.UTC(2026, 3, 9, 12, 0, 0);
    const olderFavorite = createItem({
      id: "older-favorite",
      title: "Äldre favorit",
      publishedAtMs: nowMs - 70 * 60_000,
      favoriteMatch: true,
      rankingTotal: 999,
    });
    const newerNormal = createItem({
      id: "newer-normal",
      title: "Nyare vanlig artikel",
      publishedAtMs: nowMs - 5 * 60_000,
      favoriteMatch: false,
      rankingTotal: 0,
    });

    const winner = selectTopHighlightCandidate([olderFavorite, newerNormal], nowMs);

    expect(winner?.item.id).toBe("newer-normal");
  });

  it("inom 20-minuters tie vinner specialsignal över vanlig artikel", () => {
    const nowMs = Date.UTC(2026, 3, 9, 12, 0, 0);
    const normalFresh = createItem({
      id: "normal-fresh",
      title: "Vanlig artikel",
      publishedAtMs: nowMs - 2 * 60_000,
    });
    const specialWithinTie = createItem({
      id: "special-within-tie",
      title: "Tränaren får sparken efter derbyt",
      publishedAtMs: nowMs - 12 * 60_000,
    });

    const winner = selectTopHighlightCandidate([normalFresh, specialWithinTie], nowMs);

    expect(winner?.item.id).toBe("special-within-tie");
    expect(winner?.hasSpecialSignal).toBe(true);
  });

  it("inom 20-minuters tie vinner favorit över övrig", () => {
    const nowMs = Date.UTC(2026, 3, 9, 12, 0, 0);
    const normalFresh = createItem({
      id: "normal-fresh",
      title: "Vanlig artikel",
      publishedAtMs: nowMs - 3 * 60_000,
    });
    const favoriteWithinTie = createItem({
      id: "favorite-within-tie",
      title: "Favoritnyhet",
      publishedAtMs: nowMs - 10 * 60_000,
      favoriteMatch: true,
    });

    const winner = selectTopHighlightCandidate([normalFresh, favoriteWithinTie], nowMs);

    expect(winner?.item.id).toBe("favorite-within-tie");
  });

  it("visar inte JUST NU för vanlig artikel utan signal", () => {
    const item = createItem({
      id: "plain",
      title: "Vanlig äldre artikel",
      publishedAtMs: Date.UTC(2026, 3, 9, 8, 0, 0),
    });

    expect(hasTopHighlightSpecialSignal(item)).toBe(false);
  });

  it("faller tillbaka till alla kandidater när inget finns inom 90 minuter", () => {
    const nowMs = Date.UTC(2026, 3, 9, 12, 0, 0);
    const freshestOld = createItem({
      id: "freshest-old",
      title: "Färskast av gamla",
      publishedAtMs: nowMs - 3 * 60 * 60_000,
      favoriteMatch: false,
      rankingTotal: 1,
    });
    const olderFavorite = createItem({
      id: "older-favorite",
      title: "Äldre favorit",
      publishedAtMs: nowMs - 5 * 60 * 60_000,
      favoriteMatch: true,
      rankingTotal: 999,
    });

    const winner = selectTopHighlightCandidate([freshestOld, olderFavorite], nowMs);

    expect(winner?.item.id).toBe("freshest-old");
  });
});
