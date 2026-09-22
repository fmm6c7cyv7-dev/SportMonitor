import {
  buildNewsSearchText,
  favoriteMatchesNews,
} from "@/lib/push/pushMatching";
import { VIP_REGEX } from "@/lib/push/pushPolicy";
import type {
  FavoriteRow,
  NewsEntityRow,
  NewsRow,
  PushEntity,
  PushSubscriptionRow,
} from "@/lib/push/pushTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AudienceNewsRow = NewsRow & {
  published_at?: string | null;
  source?: string | null;
};

export type MatchedFavoriteDevice = {
  deviceId: string;
  favoriteEntityIds: string[];
  favoriteEntityNames: string[];
  pushSubscriptionExists: boolean;
};

export type PushAudienceEvaluation = {
  news: AudienceNewsRow | null;
  newsSport: "football" | "hockey" | null;
  isVipNews: boolean;
  subscriptions: PushSubscriptionRow[];
  matchedDevices: MatchedFavoriteDevice[];
};

function uniqueStringArray(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value) => typeof value === "string" && value.length > 0)),
  );
}

export async function evaluatePushAudienceForNewsItem(
  supabase: SupabaseClient,
  newsItemId: string,
): Promise<PushAudienceEvaluation> {
  const { data: news, error: newsError } = await supabase
    .from("news_items")
    .select("id,title,url,tags,sport,fetched_at,published_at,source")
    .eq("id", newsItemId)
    .single<AudienceNewsRow>();

  if (newsError || !news) {
    return {
      news: null,
      newsSport: null,
      isVipNews: false,
      subscriptions: [],
      matchedDevices: [],
    };
  }

  const newsSport = news.sport === "football" || news.sport === "hockey"
    ? news.sport
    : null;
  const isVipNews = VIP_REGEX.test(news.title);

  if (!newsSport) {
    return {
      news,
      newsSport: null,
      isVipNews,
      subscriptions: [],
      matchedDevices: [],
    };
  }

  const { data: allEntities, error: entitiesError } = await supabase
    .from("entities")
    .select("*");

  if (entitiesError) {
    throw new Error(entitiesError.message);
  }

  const typedEntities = (allEntities ?? []) as PushEntity[];
  const entityMap = new Map(typedEntities.map((entity) => [entity.id, entity]));

  const { data: newsEntityRows } = await supabase
    .from("news_entities")
    .select("entity_id")
    .eq("news_item_id", newsItemId);

  const taggedEntityIds = new Set(
    ((newsEntityRows ?? []) as NewsEntityRow[]).map((row) => row.entity_id),
  );

  const { data: subscriptionsData } = await supabase
    .from("push_subscriptions")
    .select("id,device_id,endpoint,p256dh,auth,created_at")
    .eq("enabled", true);

  const subscriptions = (subscriptionsData ?? []) as PushSubscriptionRow[];
  const hasSubscriptionByDevice = new Set(
    subscriptions.map((subscription) => subscription.device_id),
  );

  const normalizedSearchText = buildNewsSearchText(news.title, news.tags);

  const { data: favoritesData } = await supabase
    .from("user_favorites")
    .select("device_id, entity_id");

  const favorites = (favoritesData ?? []) as FavoriteRow[];
  const matchedByDevice = new Map<string, MatchedFavoriteDevice>();

  for (const favorite of favorites) {
    const favoriteEntity = entityMap.get(favorite.entity_id);
    if (!favoriteEntity) {
      continue;
    }

    const matched =
      taggedEntityIds.has(favorite.entity_id) ||
      favoriteMatchesNews(
        favoriteEntity,
        typedEntities,
        entityMap,
        taggedEntityIds,
        normalizedSearchText,
      );

    if (!matched) {
      continue;
    }

    const existing = matchedByDevice.get(favorite.device_id);

    if (existing) {
      existing.favoriteEntityIds = uniqueStringArray([
        ...existing.favoriteEntityIds,
        favorite.entity_id,
      ]);
      existing.favoriteEntityNames = uniqueStringArray([
        ...existing.favoriteEntityNames,
        favoriteEntity.name,
      ]);
      continue;
    }

    matchedByDevice.set(favorite.device_id, {
      deviceId: favorite.device_id,
      favoriteEntityIds: [favorite.entity_id],
      favoriteEntityNames: [favoriteEntity.name],
      pushSubscriptionExists: hasSubscriptionByDevice.has(favorite.device_id),
    });
  }

  return {
    news,
    newsSport,
    isVipNews,
    subscriptions,
    matchedDevices: Array.from(matchedByDevice.values()),
  };
}
