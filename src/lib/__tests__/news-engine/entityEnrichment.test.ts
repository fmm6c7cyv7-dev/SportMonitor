// src/lib/__tests__/news-engine/entityEnrichment.test.ts

import { describe, expect, it } from "vitest";
import {
  enrichArticleEntities,
  enrichArticlesWithCoreEntities,
} from "@/lib/news-engine/entityEnrichment";
import type { NormalizedArticle } from "@/lib/news-engine/types";

function article(
  title: string,
  overrides: Partial<NormalizedArticle> = {},
): NormalizedArticle {
  return {
    id: overrides.id ?? "a1",
    sport: overrides.sport ?? "football",
    title,
    url: overrides.url ?? "https://example.com/a1",
    source: overrides.source ?? "Example Sport",
    publishedAt: overrides.publishedAt ?? "2026-09-20T10:00:00.000Z",
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    urgency: overrides.urgency ?? 0,
    entityHits: overrides.entityHits ?? [],
    ...overrides,
  };
}

describe("entityEnrichment", () => {
  it("adds a Swedish football player abroad from the canonical catalog", () => {
    const enriched = enrichArticleEntities(
      article("Alexander Isak scores again for Liverpool"),
    );

    const isak = enriched.entityHits.find(
      (hit) => hit.name === "Alexander Isak",
    );

    expect(isak?.type).toBe("player");
    expect(isak?.isSwedish).toBe(true);
    expect(isak?.isAbroadCore).toBe(true);
  });

  it("does not mark a Swedish player in Allsvenskan as abroad core", () => {
    const enriched = enrichArticleEntities(
      article("Robin Olsen keeps clean sheet for Malmö FF"),
    );

    const player = enriched.entityHits.find(
      (hit) => hit.name === "Robin Olsen",
    );

    expect(player?.isSwedish).toBe(true);
    expect(player?.isAbroadCore).toBe(false);
  });

  it("adds verified Swedish staff abroad", () => {
    const enriched = enrichArticleEntities(
      article("Kim Hellberg reacts after Middlesbrough win"),
    );

    const staff = enriched.entityHits.find((hit) => hit.name === "Kim Hellberg");

    expect(staff?.type).toBe("staff");
    expect(staff?.isSwedish).toBe(true);
    expect(staff?.isAbroadCore).toBe(true);
  });

  it("adds Swedish NHL players for hockey", () => {
    const enriched = enrichArticleEntities(
      article("William Nylander scores twice", {
        sport: "hockey",
      }),
    );

    const player = enriched.entityHits.find(
      (hit) => hit.name === "William Nylander",
    );

    expect(player?.type).toBe("player");
    expect(player?.isSwedish).toBe(true);
    expect(player?.isAbroadCore).toBe(true);
  });

  it("does not use source name as a core-entity match", () => {
    const enriched = enrichArticleEntities(
      article("Weekend preview", {
        source: "Alexander Isak Daily",
      }),
    );

    expect(
      enriched.entityHits.some((hit) => hit.name === "Alexander Isak"),
    ).toBe(false);
  });

  it("preserves canonical hits without duplicating the same entity name/type", () => {
    const enriched = enrichArticleEntities(
      article("Alexander Isak scores again", {
        entityHits: [
          {
            entityId: "db-isak",
            sport: "football",
            type: "player",
            name: "Alexander Isak",
            confidence: 0.99,
            isSwedish: true,
            isAbroadCore: true,
            origin: "detected",
          },
        ],
      }),
    );

    const matches = enriched.entityHits.filter(
      (hit) => hit.type === "player" && hit.name === "Alexander Isak",
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].entityId).toBe("db-isak");
  });

  it("enriches multiple articles independently", () => {
    const result = enrichArticlesWithCoreEntities([
      article("Kim Hellberg speaks", { id: "a1" }),
      article("William Nylander scores", {
        id: "a2",
        sport: "hockey",
      }),
    ]);

    expect(result[0].entityHits.some((hit) => hit.type === "staff")).toBe(true);
    expect(result[1].entityHits.some((hit) => hit.type === "player")).toBe(true);
  });
});
