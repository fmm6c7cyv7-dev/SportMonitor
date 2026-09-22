// src/lib/push/pushPolicy.ts

import type { DeliveryLogRow } from "@/lib/push/pushTypes";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const MAX_10_MIN = 3;
const MAX_60_MIN = 10;

export const VIP_REGEX =
  /\b(MÅL|MÅÅL|MÅÅÅL|KLART|KLAR FÖR|SILLY SEASON|JUST NU|MÅLSKYTT|MÅLSKYTTAR|NY KLUBB|KONTRAKT)\b/i;

/* ==========================================================================
   DELIVERY POLICY HELPERS
   ========================================================================== */

export function isRetroactiveToSubscription(
  newsFetchedAt: string,
  createdAt: string,
): boolean {
  const newsTime = new Date(newsFetchedAt).getTime();
  const subscriptionTime = new Date(createdAt).getTime() - 5 * 60 * 1000;

  return newsTime < subscriptionTime;
}

export function hasAlreadyReceivedNews(
  logs: DeliveryLogRow[],
  deviceId: string,
  newsItemId: string,
): boolean {
  return logs.some(
    (log) => log.device_id === deviceId && log.news_item_id === newsItemId,
  );
}

export function exceedsRateLimit(
  logs: DeliveryLogRow[],
  deviceId: string,
  tenMinutesAgoMs: number,
): boolean {
  const deviceLogs = logs.filter((log) => log.device_id === deviceId);
  const sentLast60 = deviceLogs.length;
  const sentLast10 = deviceLogs.filter(
    (log) => log.sent_at && new Date(log.sent_at).getTime() > tenMinutesAgoMs,
  ).length;

  return sentLast60 >= MAX_60_MIN || sentLast10 >= MAX_10_MIN;
}