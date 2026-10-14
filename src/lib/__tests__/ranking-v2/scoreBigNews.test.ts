import { assessment } from "../editorial/fixtures";
// src/lib/__tests__/ranking-v2/scoreBigNews.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import { scoreBigNewsSignal } from "@/lib/ranking-v2/scoreBigNews";

describe("scoreBigNewsSignal", () => {
  it("scores management news strongly", () => {
    const result = scoreBigNewsSignal({
      title: "Tränaren avgår efter krismötet",
      editorial_assessment: assessment("Tränaren avgår efter krismötet", "management"),
      tags: [],
      urgency: 0,
    });

    expect(result.matched).toBe(true);
    expect(result.categories).toContain("management");
    expect(result.score).toBeGreaterThan(0);
  });

  it("scores transfer news from validated interpretation", () => {
    const result = scoreBigNewsSignal({
      title: "Stjärnan är klar för klubben",
      editorial_assessment: assessment("Stjärnan är klar för klubben", "transfer"),
      tags: ["OFFICIELLT"],
      urgency: 0,
    });

    expect(result.matched).toBe(true);
    expect(result.categories).toContain("transfer");
    expect(result.score).toBeGreaterThan(0);
  });

  it("scores match event news", () => {
    const result = scoreBigNewsSignal({
      title: "Gyökeres avgör med hattrick",
      editorial_assessment: assessment("Gyökeres avgör med hattrick", "match-event"),
      tags: [],
      urgency: 0,
    });

    expect(result.matched).toBe(true);
    expect(result.categories).toContain("match-event");
  });

  it("scores live news", () => {
    const result = scoreBigNewsSignal({
      title: "LIVE: rött kort i derbyt",
      editorial_assessment: assessment("LIVE: rött kort i derbyt", "live"),
      tags: ["LIVE"],
      urgency: 0,
    });

    expect(result.matched).toBe(true);
    expect(result.categories).toContain("live");
  });

  it("ignores unverified caller urgency even when high", () => {
    const result = scoreBigNewsSignal({
      title: "Vanlig rubrik utan särskilt lexikalt big-news-stöd",
      tags: [],
      urgency: 25,
    });

    expect(result.fromUrgency).toBe(false);
    expect(result.score).toBe(0);
  });

  it("combines interpreted event with bounded interpreted urgency", () => {
    const result = scoreBigNewsSignal({
      title: "Officiellt: spelaren är klar",
      editorial_assessment: assessment("Officiellt: spelaren är klar", "transfer"),
      tags: ["KLART"],
      urgency: 24,
    });

    expect(result.matched).toBe(true);
    expect(result.categories).toContain("transfer");
    expect(result.fromUrgency).toBe(false);
    expect(result.score).toBe(18);
  });

  it("returns no match when nothing qualifies", () => {
    const result = scoreBigNewsSignal({
      title: "Inför helgens omgång",
      tags: [],
      urgency: 0,
    });

    expect(result.matched).toBe(false);
    expect(result.categories).toEqual([]);
    expect(result.matchedTerms).toEqual([]);
    expect(result.fromUrgency).toBe(false);
    expect(result.score).toBe(0);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      scoreBigNewsSignal({
        title: "Rubrik",
        tags: [],
        urgency: Number.NaN,
      }),
    ).toThrow(EngineError);
  });
});