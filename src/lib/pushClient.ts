// src/lib/pushClient.ts

/* ==========================================================================
   TYPES
   ========================================================================== */

export type PushSupportSnapshot = {
  hasWindow: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
  hasNotification: boolean;
  hasPushManager: boolean;
  vapidPublicKey: string | null;
  notificationPermission: NotificationPermission | "unknown";
};

/* ==========================================================================
   ENCODING HELPERS
   ========================================================================== */

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    bytes[index] = rawData.charCodeAt(index);
  }

  return bytes.buffer.slice(0);
}

/* ==========================================================================
   SUPPORT HELPERS
   ========================================================================== */

export function getPushSupportSnapshot(): PushSupportSnapshot {
  const hasWindow = typeof window !== "undefined";
  const hasNotification = hasWindow && "Notification" in window;

  return {
    hasWindow,
    isSecureContext: hasWindow ? window.isSecureContext : false,
    hasServiceWorker: hasWindow && "serviceWorker" in navigator,
    hasNotification,
    hasPushManager: hasWindow && "PushManager" in window,
    vapidPublicKey:
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null,
    notificationPermission: hasNotification
      ? Notification.permission
      : "unknown",
  };
}

export function getServiceWorkerSupportError(
  snapshot: PushSupportSnapshot,
): string | null {
  if (!snapshot.hasWindow) {
    return "Push-notiser kan bara aktiveras i en webbläsare.";
  }

  if (!snapshot.isSecureContext) {
    return "Push-notiser kräver en säker anslutning (https eller localhost).";
  }

  if (!snapshot.hasServiceWorker) {
    return "Service Worker stöds inte i denna webbläsare.";
  }

  return null;
}

export function getPushSubscriptionSupportError(
  snapshot: PushSupportSnapshot,
): string | null {
  const serviceWorkerError = getServiceWorkerSupportError(snapshot);

  if (serviceWorkerError) {
    return serviceWorkerError;
  }

  if (!snapshot.hasNotification) {
    return "Notiser stöds inte i denna webbläsare.";
  }

  if (!snapshot.hasPushManager) {
    return "PushManager stöds inte i denna webbläsare.";
  }

  if (!snapshot.vapidPublicKey) {
    return "NEXT_PUBLIC_VAPID_PUBLIC_KEY saknas.";
  }

  return null;
}

export function normalizePushError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Okänt push-fel.";

  if (message.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY")) {
    return "Push-notiser kan inte aktiveras eftersom VAPID-konfiguration saknas.";
  }

  if (message.includes("secure anslutning") || message.includes("https")) {
    return "Push-notiser kräver https eller localhost.";
  }

  if (message.includes("Service Worker")) {
    return "Service Worker kunde inte registreras i den här webbläsaren.";
  }

  if (message.includes("PushManager")) {
    return "Push-notiser stöds inte i den här webbläsaren.";
  }

  if (
    message.includes("Användaren tillät inte notiser") ||
    message.includes("permission") ||
    message.includes("denied")
  ) {
    return "Notiser är blockerade för den här sajten. Tillåt dem i webbläsarens inställningar och prova igen.";
  }

  if (message.includes("Push subscribe failed:")) {
    return "Prenumeration på push-notiser misslyckades på serversidan.";
  }

  if (message.includes("Push unsubscribe failed:")) {
    return "Avaktivering av push-notiser misslyckades på serversidan.";
  }

  return message || "Okänt push-fel.";
}

/* ==========================================================================
   SERVICE WORKER
   ========================================================================== */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const snapshot = getPushSupportSnapshot();
  const supportError = getServiceWorkerSupportError(snapshot);

  if (supportError) {
    throw new Error(supportError);
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  return registration;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  const snapshot = getPushSupportSnapshot();
  const supportError = getServiceWorkerSupportError(snapshot);

  if (supportError) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/* ==========================================================================
   PUSH SUBSCRIPTION
   ========================================================================== */

export async function subscribeToPush(): Promise<PushSubscription> {
  const snapshot = getPushSupportSnapshot();
  const supportError = getPushSubscriptionSupportError(snapshot);

  if (supportError) {
    throw new Error(supportError);
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Användaren tillät inte notiser.");
  }

  const registration = await registerServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();

  if (existingSubscription) {
    return existingSubscription;
  }

  const vapidPublicKey = getPushSupportSnapshot().vapidPublicKey;

  if (!vapidPublicKey) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY saknas.");
  }

  const applicationServerKey = urlBase64ToArrayBuffer(vapidPublicKey);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  return subscription;
}