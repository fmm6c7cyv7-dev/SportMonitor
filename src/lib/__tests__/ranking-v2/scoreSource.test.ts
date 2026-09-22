import { describe, expect, it } from "vitest";
import { scoreSourceSignal } from "@/lib/ranking-v2/scoreSource";

describe("scoreSourceSignal", () => {
  it("neutralizes NHL as a positive league-fit signal", () => {
    const signal = scoreSourceSignal({
      source: "Sportsnet – NHL",
      sport: "hockey",
      title: "Maple Leafs vann igen i NHL",
      tags: [],
    });

    expect(signal.leagueFit).toBe(0);
    expect(signal.reasons).toContain("nhl-neutralized-source-fit");
  });

  it("still gives positive league-fit to Swedish hockey context", () => {
    const signal = scoreSourceSignal({
      source: "SVT Sport – Hockey",
      sport: "hockey",
      title: "Färjestad vann toppmötet i SHL",
      tags: [],
    });

    expect(signal.leagueFit).toBeGreaterThan(0);
    expect(signal.countryFit).toBeGreaterThan(0);
  });

  it("ranks official local source authority above aggregator team feeds", () => {
    const official = scoreSourceSignal({
      source: "Kalmar FF (officiell)",
      sport: "football",
      title: "Startelvan mot Djurgården",
      tags: [],
    });

    const aggregator = scoreSourceSignal({
      source: "Bollsvenskan – Kalmar FF",
      sport: "football",
      title: "Kalmar FF nyheter och uppdateringar",
      tags: [],
    });

    expect(official.authority).toBeGreaterThan(aggregator.authority);
    expect(official.reasons).toContain("source-category:official_local");
    expect(aggregator.reasons).toContain("source-category:aggregator_team_feed");
  });

  it("penalizes low-news fan community content types", () => {
    const signal = scoreSourceSignal({
      source: "SvenskaFans – Kalmar FF",
      sport: "football",
      title: "Inför matchen: forum och podd om läget",
      tags: ["opinion"],
    });

    expect(signal.reasons).toContain("source-category:fan_community");
    expect(signal.reasons).toContain("fan-community-low-news-signal");
  });
});
