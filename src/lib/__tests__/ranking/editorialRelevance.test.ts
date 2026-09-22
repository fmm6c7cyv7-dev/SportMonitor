// src/lib/__tests__/ranking/editorialRelevance.test.ts

import { describe, expect, it } from "vitest";
import { classifyEditorialRelevance } from "@/lib/classification/editorialRelevance";

describe("classifyEditorialRelevance", () => {
  it("classifies a known Swedish football player as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Alexander Isak starts for Liverpool",
      source: "BBC Sport",
      tags: ["Premier League"],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishPlayer).toBe(true);
    expect(result.reasons).toContain("swedish-player");
  });

  it("classifies Swedish domestic football as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Malmö FF tar tre poäng i toppmötet",
      source: "Fotbollskanalen",
      tags: ["Allsvenskan"],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishDomesticContext).toBe(true);
    expect(result.reasons).toContain("swedish-domestic");
  });

  it("classifies a foreign club with a Swedish player as Tier 2", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Arsenal prepare for weekend fixture",
      source: "BBC Sport",
      tags: [],
    });

    expect(result.tier).toBe(2);
    expect(result.hasRelatedClub).toBe(true);
    expect(result.hasSwedishPlayer).toBe(false);
  });

  it("classifies a foreign league containing Swedish-player clubs as Tier 2", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Premier League publishes the next round of fixtures",
      source: "BBC Sport",
      tags: [],
    });

    expect(result.tier).toBe(2);
    expect(result.hasRelatedLeague).toBe(true);
  });

  it("keeps unrelated international football in Tier 3", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "River Plate prepare for Copa Libertadores clash",
      source: "International Football",
      tags: ["Copa Libertadores"],
    });

    expect(result.tier).toBe(3);
    expect(result.reasons).toEqual([]);
  });

  it("classifies a known Swedish NHL player as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "hockey",
      title: "William Nylander scores twice for Toronto",
      source: "NHL.com",
      tags: ["NHL"],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishPlayer).toBe(true);
  });

  it("classifies generic NHL context as Tier 2", () => {
    const result = classifyEditorialRelevance({
      sport: "hockey",
      title: "NHL releases updated schedule",
      source: "NHL.com",
      tags: ["NHL"],
    });

    expect(result.tier).toBe(2);
    expect(result.hasRelatedLeague).toBe(true);
  });

  it("classifies Swedish domestic hockey as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "hockey",
      title: "Västerås IK vinner efter förlängning",
      source: "VLT",
      tags: ["HockeyAllsvenskan"],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishDomesticContext).toBe(true);
  });

  it("recognizes explicit Swedish coach context as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Swedish coach takes over after manager departure",
      source: "International Football",
      tags: [],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishCoach).toBe(true);
    expect(result.reasons).toContain("swedish-coach");
  });

  it("classifies a named Swedish football coach abroad as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Kim Hellberg pleased with Middlesbrough response",
      source: "BBC Sport",
      tags: ["Championship"],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishCoach).toBe(true);
    expect(result.reasons).toContain("swedish-coach");
  });

  it("classifies a Swedish coach's foreign club as Tier 2", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Middlesbrough announce changes ahead of Saturday",
      source: "BBC Sport",
      tags: [],
    });

    expect(result.tier).toBe(2);
    expect(result.hasSwedishCoach).toBe(false);
    expect(result.reasons).toContain("swedish-related-staff-organization");
  });

  it("classifies named Swedish staff at Cracovia as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Patric Jildefalk discusses Cracovia preparations",
      source: "Polish Football",
      tags: ["Ekstraklasa"],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishCoach).toBe(true);
  });

  it("classifies a staff-linked foreign competition as Tier 2", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Veikkausliiga confirms next round schedule",
      source: "Finnish Football",
      tags: [],
    });

    expect(result.tier).toBe(2);
    expect(result.reasons).toContain("swedish-related-staff-competition");
  });

  it("classifies a named Swedish hockey coach abroad as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "hockey",
      title: "Roger Rönnberg ready for Fribourg-Gottéron opener",
      source: "Swiss Hockey",
      tags: [],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishCoach).toBe(true);
    expect(result.reasons).toContain("swedish-coach");
  });

  it("classifies Swedish hockey staff organization context as Tier 2", () => {
    const result = classifyEditorialRelevance({
      sport: "hockey",
      title: "Fribourg-Gottéron signs a new forward",
      source: "Swiss Hockey",
      tags: [],
    });

    expect(result.tier).toBe(2);
    expect(result.reasons).toContain("swedish-related-staff-organization");
  });

  it("classifies Swedish national-team coach abroad by name as Tier 1", () => {
    const result = classifyEditorialRelevance({
      sport: "hockey",
      title: "Tommy Samuelsson names Denmark squad",
      source: "Danish Ice Hockey",
      tags: [],
    });

    expect(result.tier).toBe(1);
    expect(result.hasSwedishCoach).toBe(true);
  });

  it("does not keep a departed coach as Swedish core", () => {
    const result = classifyEditorialRelevance({
      sport: "football",
      title: "Jens Wedeborg reflects on his next step",
      source: "Norwegian Football",
      tags: [],
    });

    expect(result.tier).not.toBe(1);
    expect(result.hasSwedishCoach).toBe(false);
  });
});
