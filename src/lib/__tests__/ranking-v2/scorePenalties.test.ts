// src/lib/__tests__/ranking-v2/scorePenalties.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import { scorePenaltySignal } from "@/lib/ranking-v2/scorePenalties";

describe("scorePenaltySignal", () => {
  it("scores evergreen-like content penalty", () => {
    const result = scorePenaltySignal(
      {
        title: "Historien om klubbens största profiler",
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        nowMs: Date.now(),
      },
    );

    expect(result.evergreenPenalty).toBeGreaterThan(0);
    expect(result.reasons).toContain("evergreen-history-content");
  });

  it("scores hard penalty for prospect and draft style content", () => {
    const result = scorePenaltySignal(
      {
        title: "Noel Pakarinen – 2026 NHL Draft Prospect Profile",
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        nowMs: Date.now(),
      },
    );

    expect(result.evergreenPenalty).toBeGreaterThanOrEqual(8);
    expect(result.reasons).toContain("prospect-or-draft-content");
  });

  it("scores hard penalty for all-time and list content", () => {
    const result = scorePenaltySignal(
      {
        title: "Top 3 All-Time Sabres Goalies",
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        nowMs: Date.now(),
      },
    );

    expect(result.evergreenPenalty).toBeGreaterThanOrEqual(7);
    expect(result.reasons).toContain("list-or-ranking-content");
  });

  it("does not treat Today in Hockey History as generic evergreen", () => {
    const result = scorePenaltySignal(
      {
        title: "Today in Hockey History: April 1",
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        nowMs: Date.now(),
      },
    );

    expect(result.evergreenPenalty).toBe(0);
    expect(result.reasons).toContain("daily-feature-exempt");
  });

  it("scores staleness penalty for old hard news", () => {
    const oldDate = new Date(Date.now() - 60 * 3_600_000).toISOString();

    const result = scorePenaltySignal(
      {
        title: "Officiellt: tränaren avgår",
        publishedAt: oldDate,
        tags: [],
      },
      {
        nowMs: Date.now(),
        isHardNews: true,
      },
    );

    expect(result.stalenessPenalty).toBeGreaterThan(0);
  });

  it("scores duplicate penalty", () => {
    const result = scorePenaltySignal(
      {
        title: "Rubrik",
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        nowMs: Date.now(),
        duplicateCount: 2,
      },
    );

    expect(result.duplicatePenalty).toBe(6);
    expect(result.reasons).toContain("duplicate-count:2");
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      scorePenaltySignal(
        {
          title: "Rubrik",
          publishedAt: new Date().toISOString(),
          tags: [],
        },
        {
          nowMs: Number.NaN,
        },
      ),
    ).toThrow(EngineError);
  });
});