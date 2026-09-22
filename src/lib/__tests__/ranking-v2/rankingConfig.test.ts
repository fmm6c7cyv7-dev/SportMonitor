// src/lib/__tests__/ranking-v2/rankingConfig.test.ts

import { describe, expect, it } from "vitest";
import { EngineConfigError } from "@/lib/news-engine/errors";
import {
  DEFAULT_RANKING_CONFIG,
  getDefaultRankingConfig,
  validateRankingConfig,
} from "@/lib/ranking-v2/rankingConfig";

describe("rankingConfig", () => {
  it("returns a validated default config", () => {
    const config = getDefaultRankingConfig();

    expect(config.minRankingTotalBySport.football).toBe(0);
    expect(config.minRankingTotalBySport.hockey).toBe(2);
    expect(config.urgencyThresholds.high).toBe(24);
    expect(config.urgencyThresholds.medium).toBe(16);
  });

  it("returns a cloned config object", () => {
    const a = getDefaultRankingConfig();
    const b = getDefaultRankingConfig();

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("accepts a valid config", () => {
    expect(() => validateRankingConfig(DEFAULT_RANKING_CONFIG)).not.toThrow();
  });

  it("throws on invalid threshold map", () => {
    expect(() =>
      validateRankingConfig({
        ...DEFAULT_RANKING_CONFIG,
        minRankingTotalBySport: {
          football: 0,
          hockey: Number.NaN,
        },
      }),
    ).toThrow(EngineConfigError);
  });

  it("throws if medium urgency threshold is greater than high", () => {
    expect(() =>
      validateRankingConfig({
        ...DEFAULT_RANKING_CONFIG,
        urgencyThresholds: {
          high: 10,
          medium: 11,
        },
      }),
    ).toThrow(EngineConfigError);
  });

  it("throws on missing numeric boost", () => {
    expect(() =>
      validateRankingConfig({
        ...DEFAULT_RANKING_CONFIG,
        bigNewsBoosts: {
          ...DEFAULT_RANKING_CONFIG.bigNewsBoosts,
          live: Number.POSITIVE_INFINITY,
        },
      }),
    ).toThrow(EngineConfigError);
  });
});