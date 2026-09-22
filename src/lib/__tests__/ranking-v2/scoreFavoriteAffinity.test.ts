// src/lib/__tests__/ranking-v2/scoreFavoriteAffinity.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import { scoreFavoriteAffinity } from "@/lib/ranking-v2/scoreFavoriteAffinity";

describe("scoreFavoriteAffinity", () => {
  it("scores exact player favorite match strongly", () => {
    const result = scoreFavoriteAffinity(
      {
        title: "Isak nätar igen",
        sport: "football",
        entityHits: [
          {
            entityId: "player-isak",
            sport: "football",
            type: "player",
            name: "Alexander Isak",
            confidence: 0.98,
            isSwedish: true,
          },
        ],
      },
      {
        favorites: [
          {
            entityId: "player-isak",
            sport: "football",
            type: "player",
            label: "Alexander Isak",
          },
        ],
      },
    );

    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(18);
    expect(result.matchedFavoriteIds).toContain("player-isak");
  });

  it("scores exact team favorite match", () => {
    const result = scoreFavoriteAffinity(
      {
        title: "Tottenham vinner",
        sport: "football",
        entityHits: [
          {
            entityId: "team-tottenham",
            sport: "football",
            type: "team",
            name: "Tottenham Hotspur",
            confidence: 0.95,
          },
        ],
      },
      {
        favorites: [
          {
            entityId: "team-tottenham",
            sport: "football",
            type: "team",
            label: "Tottenham Hotspur",
          },
        ],
      },
    );

    expect(result.matched).toBe(true);
    expect(result.reasons).toContain("exact-team:Tottenham Hotspur");
  });


  it("does not treat unrelated Swedish entities as a team favorite match", () => {
    const result = scoreFavoriteAffinity(
      {
        title: "Hammarby vinner i Allsvenskan",
        sport: "football",
        entityHits: [
          {
            entityId: "team-hammarby",
            sport: "football",
            type: "team",
            name: "Hammarby IF",
            confidence: 0.98,
            isSwedish: true,
          },
        ],
      },
      {
        favorites: [
          {
            entityId: "team-kalmar",
            sport: "football",
            type: "team",
            label: "Kalmar FF",
          },
        ],
      },
    );

    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
    expect(result.matchedFavoriteIds).toEqual([]);
  });

  it("scores league favorite through Swedish related entity", () => {
    const result = scoreFavoriteAffinity(
      {
        title: "Ny svensk succé i Premier League",
        sport: "football",
        entityHits: [
          {
            entityId: "player-isak",
            sport: "football",
            type: "player",
            name: "Alexander Isak",
            confidence: 0.95,
            isSwedish: true,
          },
        ],
      },
      {
        favorites: [
          {
            entityId: "league-premier-league",
            sport: "football",
            type: "league",
            label: "Premier League",
          },
        ],
      },
    );

    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons[0]).toContain("league-swedish-related");
  });

  it("ignores favorites from other sports", () => {
    const result = scoreFavoriteAffinity(
      {
        title: "Isak nätar igen",
        sport: "football",
        entityHits: [
          {
            entityId: "player-isak",
            sport: "football",
            type: "player",
            name: "Alexander Isak",
            confidence: 0.98,
            isSwedish: true,
          },
        ],
      },
      {
        favorites: [
          {
            entityId: "player-isak",
            sport: "hockey",
            type: "player",
            label: "Alexander Isak",
          },
        ],
      },
    );

    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      scoreFavoriteAffinity(
        {
          title: "Rubrik",
          sport: "football",
          entityHits: [] as never[],
        },
        {
          favorites: null as never,
        },
      ),
    ).toThrow(EngineError);
  });
});