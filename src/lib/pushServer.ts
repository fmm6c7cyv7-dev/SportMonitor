// web/src/lib/pushServer.ts

import webpush from "web-push";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
};

type WebPushSubscription = Parameters<typeof webpush.sendNotification>[0];

/* ==========================================================================
   VAPID CONFIGURATION
   ========================================================================== */

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) {
    return;
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    throw new Error(
      "Missing VAPID env vars: Ensure VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT are set.",
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
}

/* ==========================================================================
   PAYLOAD HELPERS
   ========================================================================== */

function buildPushSubscription(sub: StoredPushSubscription) {
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: sub.p256dh,
      auth: sub.auth,
    },
  };
}

function buildPayloadString(payload: WebPushPayload): string {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag ?? "default-tag",
    icon: payload.icon ?? "/favicon.png",
    badge: payload.badge ?? "/favicon.png",
    data: {
      url: payload.url ?? "/",
      ...(payload.data ?? {}),
    },
  });
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

export async function sendWebPush(
  sub: StoredPushSubscription,
  payload: WebPushPayload,
) {
  ensureVapidConfigured();

  const pushSubscription = buildPushSubscription(sub);
  const payloadString = buildPayloadString(payload);

  try {
    return await webpush.sendNotification(
      pushSubscription as WebPushSubscription,
      payloadString,
    );
  } catch (error) {
    console.error(
      "Failed to construct or send web push notification:",
      error,
    );
    throw error;
  }
}