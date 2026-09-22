// src/lib/news/newsTypes.ts

import type { EditorialRelevanceTier } from "@/lib/classification/editorialRelevance";
import type {
  FavoriteRelations,
  FavoriteSignal,
  RankingEntity,
  RankingEntityType,
  RankingNewsItem,
  ScoreBreakdown,
  Sport,
} from "@/lib/ranking/rankingTypes";

/* ==========================================================================
   CORE / SHARED TYPES
   ========================================================================== */

export type FavoriteMatchMode = "entity" | "token" | "none";

/* ==========================================================================
   GEO TYPES
   ========================================================================== */

export type GeoRegion = {
  city: string;
  lat: number;
  lng: number;
  terms: string[];
};

export type NewsGeoResolution = {
  activeRegion: GeoRegion | null;
  regionKey: string | null;
  userCity: string;
  locationSource: "debug" | "coords" | "vercel-ip" | "none";
  coordRegionDistanceKm: number | null;
};

/* ==========================================================================
   RAW DB TYPES
   ========================================================================== */

export type DbItem = {
  id: string | null;
  sport: Sport;
  title: string;
  url: string;
  source: string;
  published_at: string;
  fetched_at?: string | null;
  tags?: string[] | null;
  priority?: number | null;
};

export type FavoriteEntityRow = {
  entity_id: string;
};

export type EntityMetaRow = {
  id: string;
  type: RankingEntityType;
  name: string;
  league_id?: string | null;
  team_id?: string | null;
};

export type NewsEntityRow = {
  news_item_id: string;
  entity_id: string;
  match_type?: string | null;
  matched_alias?: string | null;
};

/* ==========================================================================
   FAVORITE / ENTITY SUPPORT TYPES
   ========================================================================== */

export type FavoriteMatchMeta = {
  score: number;
  type: RankingEntityType;
  entity_id: string;
  entity_name: string;
};

export type FavoriteContextMeta = {
  score: number;
  favorite_entity_id: string;
  favorite_entity_name: string;
  context_entity_id?: string;
  context_entity_name?: string;
};

export type FavoriteExpansionResult = {
  directFavoriteEntityIds: Set<string>;
  directFavoriteEntityMetaById: Map<string, EntityMetaRow>;
  expandedFavoriteEntityIds: Set<string>;
  expandedFavoriteEntityMetaById: Map<string, EntityMetaRow>;
  favoriteEntityWeightById: Map<string, number>;
  favoriteRelations: FavoriteRelations;
  favoriteMatchByNewsId: Map<string, FavoriteMatchMeta>;
  favoriteContextByNewsId: Map<string, FavoriteContextMeta>;
};

/* ==========================================================================
   ACCEPTED / RANKED PIPELINE TYPES
   ========================================================================== */

export type AcceptedItem = DbItem & {
  isFavorite: boolean;
  isLocal: boolean;
  favorite_match: boolean;
  favorite_score: number;
  favorite_match_mode: FavoriteMatchMode;
  favorite_entity_type?: RankingEntityType | null;
  favorite_entity_id?: string | null;
  favorite_entity_name?: string | null;
  favorite_context?: boolean;
  favorite_context_score?: number;
  hasSwedishPlayer: boolean;
  isPremierOrAllsvenskan: boolean;
  editorialTier?: EditorialRelevanceTier;
  editorialReasons?: string[];
  entities?: RankingEntity[] | null;
};

export type RankedAcceptedItem = AcceptedItem & {
  ranking: ScoreBreakdown;
};

/* ==========================================================================
   ROUTE SUPPORT TYPES
   ========================================================================== */

export type RankingPreparationResult = {
  favoriteSignals: FavoriteSignal[];
  hasFavorites: boolean;
  acceptedForRanking: RankingNewsItem[];
};