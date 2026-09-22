// src/lib/__tests__/ingest/filterPolicy.test.ts

import { describe, expect, it } from "vitest";
import {
  isIrrelevantSport,
  isWomensSportContent,
  normalizeFilterText,
} from "@/lib/ingest/filterPolicy";
import { buildDetectionText } from "@/lib/ingest/processFeed";

describe("ingest filter policy — men's football/hockey scope", () => {
  it.each([
    "Damallsvenskan: Malmö FF möter Hammarby",
    "Sverige vann dam-EM-finalen",
    "Damkronorna samlas inför VM",
    "SDHL: Luleå vinner igen",
    "Women's Super League title race tightens",
    "UEFA Women's Champions League quarter-final draw",
    "UWCL semi-final fixtures confirmed",
    "NWSL club signs new striker",
    "Frauen-Bundesliga: Bayern gewinnt",
    "Serie A Femminile round-up",
    "Liga MX Femenil result",
  ])("blocks explicit women's sport content: %s", (text) => {
    expect(isWomensSportContent(text)).toBe(true);
    expect(isIrrelevantSport(text)).toBe(true);
  });

  it.each([
    "Allsvenskan: Malmö FF vinner toppmötet",
    "SHL: Västerås IK jagar ny seger",
    "Premier League: Alexander Isak avgör",
    "Kim Hellberg inför Middlesbroughs nästa match",
    "Tommy Samuelsson tar ut Danmarks herrlandslag",
  ])("keeps normal men's football/hockey content: %s", (text) => {
    expect(isWomensSportContent(text)).toBe(false);
  });

  it("does not block a male article merely because a name contains dam", () => {
    expect(
      isWomensSportContent("Damian Garcia signs for a new football club"),
    ).toBe(false);
  });

  it("normalizes diacritics before filtering", () => {
    expect(normalizeFilterText("Division 1 Féminine")).toContain("feminine");
    expect(isWomensSportContent("Division 1 Féminine")).toBe(true);
  });

  it("blocks when the women's marker exists only in summary", () => {
    const text = buildDetectionText(
      {
        title: "Chelsea announce new signing",
        url: "https://example.com/chelsea-signing",
        summary: "The player joins Chelsea Women's first team.",
        tags: ["Football"],
        source: "Example Sport",
      },
      "Example Football Feed",
    );

    expect(isIrrelevantSport(text)).toBe(true);
  });

  it("blocks when the women's marker exists only in tags", () => {
    const text = buildDetectionText(
      {
        title: "Arsenal confirm fixture change",
        url: "https://example.com/arsenal-fixture",
        summary: null,
        tags: ["WSL"],
        source: "Example Sport",
      },
      "Example Football Feed",
    );

    expect(isIrrelevantSport(text)).toBe(true);
  });

  it("blocks when the women's marker exists only in source/feed metadata", () => {
    const text = buildDetectionText(
      {
        title: "Weekend fixtures announced",
        url: "https://example.com/weekend-fixtures",
        summary: null,
        tags: ["Football"],
        source: "Women's Football Weekly",
      },
      "Women's Football Weekly",
    );

    expect(isIrrelevantSport(text)).toBe(true);
  });

  it("continues to block unrelated sports", () => {
    expect(isIrrelevantSport("Tennis: svensk seger i finalen")).toBe(true);
    expect(isIrrelevantSport("V75 avgjord på Solvalla")).toBe(true);
  });

  it("does not turn the women's filter into a generic football blocker", () => {
    expect(
      isIrrelevantSport(
        "Premier League: Liverpool och Arsenal gör upp om serieledningen",
      ),
    ).toBe(false);
  });
});
