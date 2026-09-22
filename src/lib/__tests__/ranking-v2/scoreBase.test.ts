import { describe, expect, it } from "vitest";
import type { EntityHit, NormalizedArticle } from "@/lib/news-engine/types";
import { scoreBaseArticle } from "@/lib/ranking-v2/scoreBase";

const NOW_MS = Date.parse("2026-04-04T09:00:00.000Z");
const PUBLISHED_AT = "2026-04-04T08:30:00.000Z";

function createArticle(overrides: Partial<NormalizedArticle>): NormalizedArticle {
  return {
    id: overrides.id ?? "article-1",
    sport: overrides.sport ?? "hockey",
    title: overrides.title ?? "Grundartikel",
    url: overrides.url ?? "https://example.com/article-1",
    source: overrides.source ?? "SVT Sport – Hockey",
    publishedAt: overrides.publishedAt ?? PUBLISHED_AT,
    summary: overrides.summary ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
    urgency: overrides.urgency ?? 0,
    canonicalUrl: overrides.canonicalUrl ?? null,
    entityHits: overrides.entityHits ?? [],
    favoriteSignal: overrides.favoriteSignal,
    localSignal: overrides.localSignal,
    bigNewsSignal: overrides.bigNewsSignal,
  };
}

function createEntityHit(overrides: Partial<EntityHit>): EntityHit {
  return {
    entityId: overrides.entityId ?? "entity-1",
    sport: overrides.sport ?? "hockey",
    type: overrides.type ?? "player",
    name: overrides.name ?? "Spelare",
    confidence: overrides.confidence ?? 0.9,
    isSwedish: overrides.isSwedish,
    isAbroadCore: overrides.isAbroadCore,
    origin: overrides.origin,
  };
}

describe("scoreBaseArticle", () => {
  it("pushes down generic NHL without Swedish context", () => {
    const genericNhl = createArticle({
      id: "nhl-generic",
      title: "Maple Leafs vann igen",
      source: "Sportsnet – NHL",
      tags: [],
      entityHits: [],
    });

    const swedishLeagueHockey = createArticle({
      id: "shl-generic",
      title: "Färjestad vann toppmötet i SHL",
      source: "SVT Sport – Hockey",
      tags: [],
      entityHits: [
        createEntityHit({
          entityId: "league-shl",
          type: "league",
          name: "SHL",
          confidence: 0.99,
        }),
      ],
    });

    const nhlScore = scoreBaseArticle(genericNhl, { nowMs: NOW_MS }).score;
    const shlScore = scoreBaseArticle(swedishLeagueHockey, { nowMs: NOW_MS }).score;

    expect(nhlScore).toBeLessThan(shlScore);
  });

  it("keeps Swedish NHL articles competitive", () => {
    const genericNhl = createArticle({
      id: "nhl-generic-2",
      title: "Maple Leafs vann igen",
      source: "Sportsnet – NHL",
      tags: [],
      entityHits: [],
    });

    const swedishNhl = createArticle({
      id: "nhl-swedish",
      title: "William Nylander målskytt igen i NHL",
      source: "Sportsnet – NHL",
      tags: [],
      urgency: 8,
      entityHits: [
        createEntityHit({
          entityId: "player-nylander",
          name: "William Nylander",
          type: "player",
          isSwedish: true,
          isAbroadCore: true,
        }),
        createEntityHit({
          entityId: "league-nhl",
          name: "NHL",
          type: "league",
          confidence: 0.99,
        }),
      ],
    });

    const genericScore = scoreBaseArticle(genericNhl, { nowMs: NOW_MS }).score;
    const swedishScore = scoreBaseArticle(swedishNhl, { nowMs: NOW_MS }).score;

    expect(swedishScore).toBeGreaterThan(genericScore);
  });

  it("lets big NHL news break through", () => {
    const genericNhl = createArticle({
      id: "nhl-generic-3",
      title: "Maple Leafs vann igen",
      source: "Sportsnet – NHL",
      tags: [],
      entityHits: [],
    });

    const bigNhl = createArticle({
      id: "nhl-big-news",
      title: "NHL-klubben sparken tränaren – officiellt",
      source: "Sportsnet – NHL",
      tags: ["OFFICIELLT"],
      urgency: 20,
      entityHits: [
        createEntityHit({
          entityId: "league-nhl-2",
          name: "NHL",
          type: "league",
          confidence: 0.99,
        }),
      ],
    });

    const genericScore = scoreBaseArticle(genericNhl, { nowMs: NOW_MS }).score;
    const bigScore = scoreBaseArticle(bigNhl, { nowMs: NOW_MS }).score;

    expect(bigScore).toBeGreaterThan(genericScore);
  });
});
