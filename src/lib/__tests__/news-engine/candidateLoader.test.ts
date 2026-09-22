// src/lib/__tests__/news-engine/candidateLoader.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import {
  buildHardNewsArticleIds,
  loadPipelineCandidatesFromAccepted,
  toNormalizedArticle,
} from "@/lib/news-engine/candidateLoader";

describe("candidateLoader", () => {
  it("maps a legacy accepted item to a normalized article", () => {
    const article = toNormalizedArticle(
      {
        id: "a1",
        sport: "football",
        title: "Alexander Isak avgör igen",
        url: "https://example.com/a1?x=1#top",
        source: "BBC Sport",
        published_at: new Date().toISOString(),
        tags: ["JUST_NU"],
        priority: 85,
        entities: [
          {
            id: "player-isak",
            name: "Alexander Isak",
            type: "player",
            sport: "football",
            is_swedish: true,
            is_abroad: true,
          },
        ],
        isLocal: true,
        favorite_match: true,
        favorite_score: 2,
      },
      {
        sport: "football",
      },
    );

    expect(article.id).toBe("a1");
    expect(article.sport).toBe("football");
    expect(article.source).toBe("BBC Sport");
    expect(article.tags).toEqual(["JUST_NU"]);
    expect(article.priority).toBe(85);
    expect(article.entityHits).toHaveLength(1);
    expect(article.entityHits[0].isAbroadCore).toBe(true);
    expect(article.localSignal?.matched).toBe(true);
    expect(article.favoriteSignal?.matched).toBe(true);
    expect(article.canonicalUrl).toBe("https://example.com/a1");
  });

  it("loads multiple normalized articles", () => {
    const result = loadPipelineCandidatesFromAccepted(
      [
        {
          id: "a1",
          sport: "football",
          title: "Rubrik 1",
          url: "https://example.com/a1",
          source: "BBC Sport",
        },
        {
          id: "a2",
          sport: "football",
          title: "Rubrik 2",
          url: "https://example.com/a2",
          source: "SVT Sport",
        },
      ],
      {
        sport: "football",
      },
    );

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("a1");
    expect(result[1].id).toBe("a2");
  });

  it("builds hard-news ids from lexical signals", () => {
    const result = buildHardNewsArticleIds([
      {
        id: "a1",
        title: "JUST NU: tränaren avgår",
        url: "https://example.com/a1",
        tags: [],
      },
      {
        id: "a2",
        title: "Inför helgens omgång",
        url: "https://example.com/a2",
        tags: [],
      },
    ]);

    expect(result).toEqual(["a1"]);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      loadPipelineCandidatesFromAccepted(null as never, {
        sport: "football",
      }),
    ).toThrow(EngineError);
  });
});