// src/lib/__tests__/ranking-v2/scoreCoreIdentity.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import { scoreCoreIdentity } from "@/lib/ranking-v2/scoreCoreIdentity";

describe("scoreCoreIdentity", () => {
  it("scores high ingest priority modestly, not dominantly", () => {
    const result = scoreCoreIdentity({
      title: "Vanlig artikel",
      tags: [],
      priority: 85,
      entityHits: [],
    });

    expect(result.matched).toBe(true);
    expect(result.score).toBe(6);
    expect(result.reasons).toContain("high-priority-ingest-signal");
  });

  it("scores Swedish league text strongly", () => {
    const result = scoreCoreIdentity({
      title: "Allsvenskan går in i avgörande fas",
      tags: [],
      priority: 0,
      entityHits: [],
    });

    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(12);
    expect(result.reasons).toContain("swedish-football-league-text");
  });

  it("scores abroad core entities strongly", () => {
    const result = scoreCoreIdentity({
      title: "Svensk stjärna glänser igen",
      tags: [],
      priority: 0,
      entityHits: [
        {
          entityId: "p1",
          sport: "football",
          type: "player",
          name: "Alexander Isak",
          confidence: 0.95,
          isSwedish: true,
          isAbroadCore: true,
        },
      ],
    });

    expect(result.matched).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(16);
    expect(result.reasons).toContain("abroad-core:Alexander Isak");
  });

  it("scores Swedish national context text", () => {
    const result = scoreCoreIdentity({
      title: "Sverige laddar för avgörande match",
      tags: [],
      priority: 0,
      entityHits: [],
    });

    expect(result.matched).toBe(true);
    expect(result.reasons).toContain("swedish-national-context-text");
  });

  it("returns no match when nothing qualifies", () => {
    const result = scoreCoreIdentity({
      title: "Inför helgens omgång",
      tags: [],
      priority: 0,
      entityHits: [],
    });

    expect(result.matched).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual([]);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      scoreCoreIdentity({
        title: "Rubrik",
        tags: [],
        priority: Number.NaN,
        entityHits: [],
      }),
    ).toThrow(EngineError);
  });
});