import { buildNewsFeed, FEED_COLUMN_LIMIT } from "@/lib/news/feedService";
import { evaluatePushAudienceForNewsItem } from "@/lib/push/pushAudience";
import { supabaseService } from "@/lib/supabase";

type DeliveryAuditInsertRow = {
  news_item_id: string;
  device_id: string;
  sport: string;
  matched_favorite: boolean;
  feed_eligible: boolean;
  push_sent: boolean;
  push_delivery_logged: boolean;
  favorite_entity_ids: string[];
  favorite_entity_names: string[];
  reason: string | null;
  debug_json: Record<string, unknown>;
};

export type FavoriteDeliveryAuditResult = {
  ok: boolean;
  newsItemId: string;
  rowsWritten: number;
};

function buildReason(args: {
  feedEligible: boolean;
  pushSubscriptionExists: boolean;
  pushDeliveryLogged: boolean;
}): string {
  if (!args.feedEligible) {
    return "not_in_feed";
  }

  if (!args.pushSubscriptionExists) {
    return "no_active_subscription";
  }

  if (args.pushDeliveryLogged) {
    return "push_logged";
  }

  return "push_not_logged";
}
export async function auditFavoriteDeliveryForNewsItem(
  newsItemId: string,
): Promise<FavoriteDeliveryAuditResult> {
  const supabase = supabaseService();
  const evaluation = await evaluatePushAudienceForNewsItem(supabase, newsItemId);

  if (!evaluation.news || !evaluation.newsSport) {
    return {
      ok: true,
      newsItemId,
      rowsWritten: 0,
    };
  }

  if (!evaluation.matchedDevices.length) {
    return {
      ok: true,
      newsItemId,
      rowsWritten: 0,
    };
  }

  const matchedDeviceIds = evaluation.matchedDevices.map((device) => device.deviceId);

  const { data: pushLogRows } = await supabase
    .from("push_delivery_log")
    .select("device_id,news_item_id,sent_at")
    .eq("news_item_id", newsItemId)
    .in("device_id", matchedDeviceIds);

  const pushLoggedDeviceIds = new Set(
    (pushLogRows ?? [])
      .map((row) => row.device_id)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  const rows: DeliveryAuditInsertRow[] = [];

  for (const matchedDevice of evaluation.matchedDevices) {
    const feedResult = await buildNewsFeed({
      sport: evaluation.newsSport,
      deviceId: matchedDevice.deviceId,
      hideRead: false,
      personalized: true,
      includeDebug: true,
      limit: FEED_COLUMN_LIMIT,
    });

    const feedEligible = feedResult.includedIds.has(newsItemId);
    const pushDeliveryLogged = pushLoggedDeviceIds.has(matchedDevice.deviceId);
    const pushSent = pushDeliveryLogged;

    rows.push({
      news_item_id: newsItemId,
      device_id: matchedDevice.deviceId,
      sport: evaluation.newsSport,
      matched_favorite: true,
      feed_eligible: feedEligible,
      push_sent: pushSent,
      push_delivery_logged: pushDeliveryLogged,
      favorite_entity_ids: matchedDevice.favoriteEntityIds,
      favorite_entity_names: matchedDevice.favoriteEntityNames,
      reason: buildReason({
        feedEligible,
        pushSubscriptionExists: matchedDevice.pushSubscriptionExists,
        pushDeliveryLogged,
      }),
      debug_json: {
        device_id_used: feedResult.debug?.device_id_used ?? matchedDevice.deviceId,
        personalization_source:
          feedResult.debug?.personalization_source ?? "none",
        feed_included_ids_contains_article: feedEligible,
        force_included_unread_pushed_ids:
          feedResult.debug?.force_included_unread_pushed_ids ?? [],
        favorite_entity_names: matchedDevice.favoriteEntityNames,
        push_subscription_exists: matchedDevice.pushSubscriptionExists,
        push_delivery_log_exists: pushDeliveryLogged,
        feed_debug: feedResult.debug ?? {},
      },
    });
  }

  const { error } = await supabase
    .from("favorite_delivery_audit")
    .upsert(rows, {
      onConflict: "news_item_id,device_id",
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    ok: true,
    newsItemId,
    rowsWritten: rows.length,
  };
}
