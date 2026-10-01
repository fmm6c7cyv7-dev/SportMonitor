// web/src/lib/pushServer.ts

import { createECDH } from "node:crypto";
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

export function deriveVapidPublicKey(privateKey: string): string {
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
  return ecdh.getPublicKey(undefined, "uncompressed").toString("base64url");
}

function ensureVapidConfigured(): void {
  if (vapidConfigured) {
    return;
  }

  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const configuredServerPublicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const configuredClientPublicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const vapidSubject =
    process.env.VAPID_SUBJECT?.trim() || "https://sportmonitor.se";

  if (!vapidPrivateKey) {
    throw new Error("Missing VAPID env var: VAPID_PRIVATE_KEY.");
  }

  let derivedPublicKey: string;

  try {
    derivedPublicKey = deriveVapidPublicKey(vapidPrivateKey);
  } catch {
    throw new Error("Invalid VAPID_PRIVATE_KEY.");
  }

  if (
    configuredClientPublicKey &&
    configuredClientPublicKey !== derivedPublicKey
  ) {
    throw new Error(
      "VAPID key mismatch: NEXT_PUBLIC_VAPID_PUBLIC_KEY does not match VAPID_PRIVATE_KEY.",
    );
  }

  if (
    configuredServerPublicKey &&
    configuredServerPublicKey !== derivedPublicKey
  ) {
    console.warn(
      "[push] VAPID_PUBLIC_KEY does not match VAPID_PRIVATE_KEY; using the public key derived from the private key.",
    );
  }

  webpush.setVapidDetails(vapidSubject, derivedPublicKey, vapidPrivateKey);
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