// src/lib/push/pushDispatch.ts

import { supabaseService } from "@/lib/supabase";
import { sendWebPush } from "@/lib/pushServer";
import { buildNewsFeed, FEED_COLUMN_LIMIT } from "@/lib/news/feedService";
import { evaluatePushAudienceForNewsItem } from "@/lib/push/pushAudience";
import {
  exceedsRateLimit,
  hasAlreadyReceivedNews,
  isRetroactiveToSubscription,
} from "@/lib/push/pushPolicy";
import type {
  DeliveryLogRow,
  PushDeliveryInsertRow,
} from "@/lib/push/pushTypes";

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

export async function dispatchPushForNewsItem(newsItemId: string) {
  const supabase = supabaseService();

  /* ========================================================================
     1. LOAD NEWS ITEM
     ======================================================================== */

  const audience = await evaluatePushAudienceForNewsItem(supabase, newsItemId);
  const news = audience.news;

  if (!news) {
    return { ok: false, reason: "news_not_found" };
  }
  const newsSport = audience.newsSport;

  if (!newsSport) {
    return { ok: true, reason: "core_ineligible_sport", sent: 0 };
  }
  const isVipNews = audience.isVipNews;
  const subscriptions = audience.subscriptions;

  if (!subscriptions.length) {
    return { ok: true, reason: "no_active_subs", sent: 0 };
  }

  /* ========================================================================
     4. MATCH DEVICES AGAINST FAVORITES
     ======================================================================== */

  const deviceIdsToNotify = audience.matchedDevices.map((device) => device.deviceId);

  if (!deviceIdsToNotify.length) {
    return { ok: true, reason: "no_matching_favorites", sent: 0 };
  }

  const feedEligibleDeviceIds: string[] = [];

  for (const deviceId of deviceIdsToNotify) {
    const feedResult = await buildNewsFeed({
      sport: newsSport,
      deviceId,
      personalized: true,
      hideRead: false,
      limit: FEED_COLUMN_LIMIT,
    });

    if (feedResult.includedIds.has(news.id)) {
      feedEligibleDeviceIds.push(deviceId);
    }
  }

  if (!feedEligibleDeviceIds.length) {
    return { ok: true, reason: "core_ineligible", sent: 0 };
  }

  /* ========================================================================
     5. LOAD DELIVERY LOG WINDOW
     ======================================================================== */

  const sixtyMinutesAgoIso = new Date(
    Date.now() - 60 * 60 * 1000,
  ).toISOString();
  const tenMinutesAgoMs = Date.now() - 10 * 60 * 1000;

  const { data: deliveryLogData } = await supabase
    .from("push_delivery_log")
    .select("device_id,news_item_id,sent_at")
    .in("device_id", feedEligibleDeviceIds)
    .gte("sent_at", sixtyMinutesAgoIso);

  const deliveryLog = (deliveryLogData ?? []) as DeliveryLogRow[];

  /* ========================================================================
     6. SEND PUSHES
     ======================================================================== */

  let sent = 0;
  const successfulPushes: PushDeliveryInsertRow[] = [];

  for (const subscription of subscriptions) {
    if (!feedEligibleDeviceIds.includes(subscription.device_id)) {
      continue;
    }

    if (isRetroactiveToSubscription(news.fetched_at, subscription.created_at)) {
      continue;
    }

    if (hasAlreadyReceivedNews(deliveryLog, subscription.device_id, news.id)) {
      continue;
    }

    if (
      !isVipNews &&
      exceedsRateLimit(deliveryLog, subscription.device_id, tenMinutesAgoMs)
    ) {
      continue;
    }

    try {
      await sendWebPush(
        {
          endpoint: subscription.endpoint,
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
        {
          title: isVipNews ? "🚨 SportMonitor Breaking" : "SportMonitor",
          body: news.title,
          url: news.url ?? "/",
          tag: `news-${news.id}`,
          data: {
            newsItemId: news.id,
            sport: news.sport ?? null,
            url: news.url ?? "/",
          },
        },
      );

      successfulPushes.push({
        device_id: subscription.device_id,
        news_item_id: news.id,
        event_type: isVipNews ? "VIP_ARTICLE" : "ARTICLE",
        sent_at: new Date().toISOString(),
      });

      sent += 1;
    } catch (error: unknown) {
      const pushError = error as { statusCode?: number };

      if (pushError?.statusCode === 404 || pushError?.statusCode === 410) {
        await supabase
          .from("push_subscriptions")
          .update({ enabled: false })
          .eq("id", subscription.id);
      }
    }
  }

  /* ========================================================================
     7. WRITE DELIVERY LOGS / UPDATE NEWS ITEM
     ======================================================================== */

  if (successfulPushes.length > 0) {
    await supabase.from("push_delivery_log").insert(successfulPushes);

    await supabase
      .from("news_items")
      .update({ push_sent: true, matched: true })
      .eq("id", newsItemId);
  }

  return { ok: true, sent };
}
