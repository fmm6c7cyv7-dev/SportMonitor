import { describe, expect, it } from "vitest";
import { isEligibleClubSourceArticle } from "@/lib/ingest/clubSourcePolicy";

describe("club-specific source guard (pre-activation)", () => {
  it.each([
    ["The Stacey West", "Have Lincoln City Adequately Replaced Jack Moylan?", true],
    ["The Stacey West", "Championship Rivals Poised To Sack Manager Weeks Before Lincoln City Visit", true],
    ["The Stacey West", "Lincolnshire Non-League Round-Up: Gainsborough Win Again", false],
    ["The Stacey West", "West Ham United And Mark Kennedy's Last Hurrah", false],
    ["FeanOnline", "Levi Smans over SC Heerenveen-fans", true],
    ["FeanOnline", "Linday verbijsterd na de wedstrijd", true],
    ["FeanOnline", "Ron Jans mogelijk weer aan de slag in Eredivisie", false],
    ["FeanOnline", "SC Heerenveen Vrouwen tekenen contract", false],
    ["FeanOnline", "SC Heerenveen academy u19 signings", false],
    ["FeanOnline", "SC Heerenveen betting odds en casino bonus", false],
  ] as const)("filters %s article %s", (source, title, expected) => {
    expect(isEligibleClubSourceArticle(source, {title})).toBe(expected);
  });

  it("rejects scope violations in tags, summaries and URLs", () => {
    expect(isEligibleClubSourceArticle("FeanOnline", {title:"SC Heerenveen update", tags:["Vrouwen"]})).toBe(false);
    expect(isEligibleClubSourceArticle("FeanOnline", {title:"SC Heerenveen update", summary:"Een advertorial voor casino"})).toBe(false);
    expect(isEligibleClubSourceArticle("The Stacey West", {title:"Lincoln City preview", url:"https://staceywest.net/2026/lincoln-city-women/"})).toBe(false);
  });

  it("does not treat a source alone as proof of club relevance", () => {
    expect(isEligibleClubSourceArticle("FeanOnline", {title:"Topploeg wint belangrijke wedstrijd"})).toBe(false);
  });

  it("ignores generic summary and tag references without headline identity", () => {
    expect(isEligibleClubSourceArticle("The Stacey West", {
      title: "West Ham United And Mark Kennedy's Last Hurrah",
      summary: "We also publish Lincoln City news.",
      tags: ["Lincoln City"],
    })).toBe(false);
    expect(isEligibleClubSourceArticle("FeanOnline", {
      title: "Ron Jans terug in de Eredivisie?",
      summary: "Bekijk hier ook het SC Heerenveen nieuws",
      tags: ["Heerenveen"],
    })).toBe(false);
  });

  it("accepts club identity in canonical URL slug", () => {
    expect(isEligibleClubSourceArticle("The Stacey West", {
      title: "Latest squad updates",
      url: "https://staceywest.net/2026/lincoln-city-squad-updates",
    })).toBe(true);
  });

  it("preserves all existing sources without changes", () => {
    expect(isEligibleClubSourceArticle("BBC Sport", {title:"Premier League football news"})).toBe(true);
  });
});
