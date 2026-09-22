// src/lib/__tests__/news-engine/sportGuard.test.ts

import { describe, expect, it } from "vitest";
import { EngineError } from "@/lib/news-engine/errors";
import {
  filterCandidatesBySportConsistency,
  isSportConsistentForFeedV2,
  toRankingSignalInput,
} from "@/lib/news-engine/sportGuard";

describe("sportGuard", () => {
  it("builds ranking signal input correctly", () => {
    const result = toRankingSignalInput(
      {
        title: "Alexander Isak avgör",
        url: "https://example.com/a1",
        source: "BBC Sport",
        tags: ["JUST_NU"],
      },
      "football",
    );

    expect(result.title).toBe("Alexander Isak avgör");
    expect(result.url).toBe("https://example.com/a1");
    expect(result.source).toBe("BBC Sport");
    expect(result.tags).toEqual(["JUST_NU"]);
    expect(result.sport).toBe("football");
  });

  it("keeps obviously football-consistent content in football", () => {
    const result = isSportConsistentForFeedV2(
      {
        title: "Premier League: Alexander Isak avgör för Newcastle",
        url: "https://example.com/a1",
        source: "BBC Sport",
        tags: ["JUST_NU"],
      },
      "football",
    );

    expect(result).toBe(true);
  });

  it("filters obvious cross-sport content from requested feed", () => {
    const result = isSportConsistentForFeedV2(
      {
        title: "SHL: Rögle vinner efter förlängning",
        url: "https://example.com/a2",
        source: "HockeyNews",
        tags: [],
      },
      "football",
    );

    expect(result).toBe(false);
  });

  it("filters a mixed list by requested sport consistency", () => {
    const result = filterCandidatesBySportConsistency(
      [
        {
          title: "Premier League: Newcastle vinner igen",
          url: "https://example.com/f1",
          source: "BBC Sport",
          tags: [],
        },
        {
          title: "SHL: Leksand tar viktig seger",
          url: "https://example.com/h1",
          source: "HockeyNews",
          tags: [],
        },
      ],
      "football",
    );

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com/f1");
  });

  it("allows trusted same-sport source fallback for Pressgurkan football content", () => {
    const result = isSportConsistentForFeedV2(
      {
        title: "Vi har byggt en fin kultur i VSK",
        url: "https://pressgurkan.se/2026/04/08/vi-har-byggt-en-fin-kultur-i-vsk/",
        source: "Pressgurkan",
        tags: ["Uncategorized"],
      },
      "football",
    );

    expect(result).toBe(true);
  });

  it("still blocks the same Pressgurkan article in hockey", () => {
    const result = isSportConsistentForFeedV2(
      {
        title: "Vi har byggt en fin kultur i VSK",
        url: "https://pressgurkan.se/2026/04/08/vi-har-byggt-en-fin-kultur-i-vsk/",
        source: "Pressgurkan",
        tags: ["Uncategorized"],
      },
      "hockey",
    );

    expect(result).toBe(false);
  });

  it("keeps rejecting generic sources without a trusted sport profile fallback", () => {
    const result = isSportConsistentForFeedV2(
      {
        title: "Vi har byggt en fin kultur i VSK",
        url: "https://example.com/2026/04/08/vi-har-byggt-en-fin-kultur-i-vsk/",
        source: "Example News",
        tags: ["Uncategorized"],
      },
      "football",
    );

    expect(result).toBe(false);
  });

  it("wraps invalid input in EngineError", () => {
    expect(() =>
      filterCandidatesBySportConsistency(null as never, "football"),
    ).toThrow(EngineError);
  });
});
