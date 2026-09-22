// src/lib/ranking-v2/rankingConfig.ts

import { EngineConfigError } from "@/lib/news-engine/errors";
import type { EngineSport } from "@/lib/news-engine/types";

export type RankingThresholdsBySport = Record<EngineSport, number>;

export type RankingConfig = {
  minRankingTotalBySport: RankingThresholdsBySport;
  minRankingTotalHardNewsBySport: RankingThresholdsBySport;
  bigNewsBoosts: {
    management: number;
    transfer: number;
    matchEvent: number;
    live: number;
    urgencyHigh: number;
    urgencyMedium: number;
  };
  urgencyThresholds: {
    high: number;
    medium: number;
  };
};

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  minRankingTotalBySport: {
    football: 0,
    hockey: 2,
  },
  minRankingTotalHardNewsBySport: {
    football: -2,
    hockey: -3,
  },
  bigNewsBoosts: {
    management: 18,
    transfer: 18,
    matchEvent: 16,
    live: 12,
    urgencyHigh: 12,
    urgencyMedium: 8,
  },
  urgencyThresholds: {
    high: 24,
    medium: 16,
  },
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateThresholdMap(
  label: string,
  value: RankingThresholdsBySport,
): void {
  if (!isFiniteNumber(value.football) || !isFiniteNumber(value.hockey)) {
    throw new EngineConfigError(`${label} must define numeric football and hockey values`, {
      label,
      value,
    });
  }
}

export function validateRankingConfig(config: RankingConfig): RankingConfig {
  if (!config || typeof config !== "object") {
    throw new EngineConfigError("Ranking config must be an object", {
      receivedType: typeof config,
    });
  }

  validateThresholdMap(
    "minRankingTotalBySport",
    config.minRankingTotalBySport,
  );
  validateThresholdMap(
    "minRankingTotalHardNewsBySport",
    config.minRankingTotalHardNewsBySport,
  );

  const boosts = config.bigNewsBoosts;
  const thresholds = config.urgencyThresholds;

  const boostEntries: Array<[string, unknown]> = [
    ["bigNewsBoosts.management", boosts?.management],
    ["bigNewsBoosts.transfer", boosts?.transfer],
    ["bigNewsBoosts.matchEvent", boosts?.matchEvent],
    ["bigNewsBoosts.live", boosts?.live],
    ["bigNewsBoosts.urgencyHigh", boosts?.urgencyHigh],
    ["bigNewsBoosts.urgencyMedium", boosts?.urgencyMedium],
    ["urgencyThresholds.high", thresholds?.high],
    ["urgencyThresholds.medium", thresholds?.medium],
  ];

  for (const [label, value] of boostEntries) {
    if (!isFiniteNumber(value)) {
      throw new EngineConfigError(`${label} must be a finite number`, {
        label,
        value,
      });
    }
  }

  if (thresholds.medium > thresholds.high) {
    throw new EngineConfigError(
      "urgencyThresholds.medium cannot be greater than urgencyThresholds.high",
      {
        medium: thresholds.medium,
        high: thresholds.high,
      },
    );
  }

  return config;
}

export function getDefaultRankingConfig(): RankingConfig {
  return validateRankingConfig(structuredClone(DEFAULT_RANKING_CONFIG));
}