// src/lib/news-engine/types.ts

export type EngineSport = "football" | "hockey";

export type EngineEntityType =
  | "player"
  | "team"
  | "league"
  | "coach"
  | "staff"
  | "unknown";

export type EngineEntityOrigin =
  | "detected"
  | "favorite-expansion"
  | "relation-expansion"
  | "manual"
  | "unknown";

export type EngineGeoSource = "browser" | "ip" | "manual" | "unknown";

export type EngineBigNewsCategory =
  | "management"
  | "transfer"
  | "match-event"
  | "live"
  | "discipline"
  | "general";

export type EngineTag =
  | "JUST_NU"
  | "LIVE"
  | "HOT"
  | "KLART"
  | "OFFICIELLT"
  | "HERE_WE_GO"
  | "DONE_DEAL"
  | string;

export type EngineFavoriteType = "player" | "team" | "league";

export type EngineFavorite = {
  entityId: string;
  sport: EngineSport;
  type: EngineFavoriteType;
  label: string;
};

export type EngineGeoContext = {
  lat: number;
  lng: number;
  source: EngineGeoSource;
  radiusKm?: number;
};

export type RawFeedItem = {
  title: string;
  url: string;
  source?: string | null;
  publishedAt?: string | null;
  sport?: EngineSport | null;
  summary?: string | null;
  tags?: string[] | null;
};

export type EntityHit = {
  entityId: string;
  sport: EngineSport;
  type: EngineEntityType;
  name: string;
  confidence: number;
  isSwedish?: boolean;
  isAbroadCore?: boolean;
  origin?: EngineEntityOrigin;
};

export type LocalSignal = {
  score: number;
  matched: boolean;
  region?: string | null;
  reason?: string | null;
};

export type FavoriteSignal = {
  score: number;
  matched: boolean;
  matchedFavoriteIds: string[];
  reasons: string[];
};

export type BigNewsSignal = {
  score: number;
  matched: boolean;
  categories: EngineBigNewsCategory[];
  matchedTerms: string[];
  fromUrgency: boolean;
};

export type NormalizedArticle = {
  id: string;
  sport: EngineSport;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  summary: string | null;
  tags: EngineTag[];
  priority: number;
  urgency: number;
  canonicalUrl?: string | null;
  entityHits: EntityHit[];
  favoriteSignal?: FavoriteSignal;
  trustedFavoriteSignal?: FavoriteSignal;
  localSignal?: LocalSignal;
  bigNewsSignal?: BigNewsSignal;
};

export type ArticleCluster = {
  clusterId: string;
  sport: EngineSport;
  representativeArticleId: string;
  articleIds: string[];
  eventKey?: string | null;
  intensity?: number;
};

export type ScoreComponentMap = {
  recency: number;
  urgency: number;
  swedishPlayer: number;
  swedishAbroadCore: number;
  swedishLeague: number;
  favoriteAffinity: number;
  localGeo: number;
  sourceAuthority: number;
  sourceLeagueFit: number;
  sourceCountryFit: number;
  bigNews: number;
  eventIntensity: number;
  priority: number;
  evergreenPenalty: number;
  stalenessPenalty: number;
  duplicatePenalty: number;
};

export type RankedArticle = NormalizedArticle & {
  score: number;
  scoreComponents: ScoreComponentMap;
  clusterId?: string | null;
};

export type RankContext = {
  nowMs: number;
  favorites?: EngineFavorite[];
  geo?: EngineGeoContext | null;
};

export type PushCandidate = {
  articleId: string;
  sport: EngineSport;
  title: string;
  url: string;
  score: number;
  favoriteMatched: boolean;
  bigNewsMatched: boolean;
  clusterId?: string | null;
};

export function createEmptyScoreComponents(): ScoreComponentMap {
  return {
    recency: 0,
    urgency: 0,
    swedishPlayer: 0,
    swedishAbroadCore: 0,
    swedishLeague: 0,
    favoriteAffinity: 0,
    localGeo: 0,
    sourceAuthority: 0,
    sourceLeagueFit: 0,
    sourceCountryFit: 0,
    bigNews: 0,
    eventIntensity: 0,
    priority: 0,
    evergreenPenalty: 0,
    stalenessPenalty: 0,
    duplicatePenalty: 0,
  };
}