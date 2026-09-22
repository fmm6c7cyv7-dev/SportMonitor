/* ==========================================================================
   CORE DOMAIN TYPES
   ========================================================================== */

export type Sport = "football" | "hockey";

export type FavoriteMatchMode = "entity" | "token" | "none";

export type FavoriteEntityType = "team" | "player" | "league" | "staff";

/* ==========================================================================
   NEWS TYPES
   --------------------------------------------------------------------------
   Denna typ ska spegla vad frontend faktiskt får tillbaka från /api/news.
   Behåll optional på fält som inte alltid måste finnas, men inkludera dem här
   så UI-komponenter slipper använda "as any".
   ========================================================================== */

export type NewsItem = {
  id?: string | number;
  url: string;
  title: string;
  source: string;
  published_at: string;
  sport: Sport;

  fetched_at?: string | null;
  tags?: string[] | null;
  priority?: number | null;

  isFavorite?: boolean;
  favorite_match?: boolean;
  favorite_score?: number;
  favorite_match_mode?: FavoriteMatchMode;
  favorite_entity_type?: FavoriteEntityType | null;
  favorite_entity_id?: string | null;
  favorite_entity_name?: string | null;
  favorite_context?: boolean;
  favorite_context_score?: number;

  hasSwedishPlayer?: boolean;
  isPremierOrAllsvenskan?: boolean;

  ranking_total?: number;
  is_local?: boolean;
};

/* ==========================================================================
   API RESPONSE TYPES
   ========================================================================== */

export type NewsResponseMeta = {
  seen_articles_count?: number;
  favorites_active?: boolean;
  detected_city?: string;
  region_active?: boolean;
  region_key?: string | null;
  region_city?: string | null;
  region_terms?: string[];
  geo_debug?: string | null;
  vercel_ip_city?: string | null;
  geo_lat?: number | null;
  geo_lng?: number | null;
  location_source?: "debug" | "coords" | "vercel-ip" | "none";
  coord_region_distance_km?: number | null;
};

export type NewsResponse = {
  items: NewsItem[];
  meta?: NewsResponseMeta;
};