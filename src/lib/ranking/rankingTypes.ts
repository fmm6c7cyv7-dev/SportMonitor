// src/lib/ranking/rankingTypes.ts

/* ==========================================================================
   CORE TYPES
   ========================================================================== */

export type Sport = "football" | "hockey";

export type RankingEntityType = "player" | "team" | "league" | "staff";

/* ==========================================================================
   ENTITY TYPES
   ========================================================================== */

export type RankingEntity = {
  id?: string;
  name?: string;
  type?: RankingEntityType;
  sport?: Sport;
  nationality?: string;
  gender?: string;
  country?: string;
  league?: string;
  is_swedish?: boolean;
  is_abroad?: boolean;
};

/* ==========================================================================
   RANKING ITEM TYPES
   ========================================================================== */

export type RankingNewsItem = {
  id?: string;
  title?: string | null;
  summary?: string | null;
  url: string;
  source?: string | null;
  sport?: Sport | null;
  published_at?: string | null;
  tags?: string[] | null;
  entities?: RankingEntity[] | null;
  metadata?: Record<string, unknown> | null;

  // Ingest/ranking-signaler som äldre och nyare rankinglager läser från.
  priority?: number | null;
  urgency?: number | null;
};

/* ==========================================================================
   FAVORITE TYPES
   ========================================================================== */

export type FavoriteSignal = {
  entityId?: string | null;
  label?: string | null;
  type?: RankingEntityType | null;
};

export type FavoriteRelations = {
  leagueToTeamIds?: Record<string, string[]>;
  teamToPlayerIds?: Record<string, string[]>;
  teamToStaffIds?: Record<string, string[]>;
};

/* ==========================================================================
   SCORE CONTEXT TYPES
   ========================================================================== */

export type ScoreContext = {
  nowMs?: number;
  favorites?: FavoriteSignal[];
  sourceCountsInWindow?: Record<string, number>;
  favoriteRelations?: FavoriteRelations;
};

/* ==========================================================================
   SCORE RESULT TYPES
   ========================================================================== */

export type ScoreBreakdown = {
  total: number;
  recency: number;
  urgency: number;
  swedishPlayer: number;
  swedishAbroadCore: number;
  favorite: number;
  sourceAuthority: number;
  sourceLeagueFit: number;
  sourceCountryFit: number;
  sourceClusterPenalty: number;
  evergreenPenalty: number;
  stalenessPenalty: number;
};