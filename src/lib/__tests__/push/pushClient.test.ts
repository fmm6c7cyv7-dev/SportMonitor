import { describe, expect, it } from "vitest";
import {
  getPushSubscriptionSupportError,
  getServiceWorkerSupportError,
  normalizePushError,
  type PushSupportSnapshot,
} from "@/lib/pushClient";

function createSnapshot(
  overrides: Partial<PushSupportSnapshot> = {},
): PushSupportSnapshot {
  return {
    hasWindow: true,
    isSecureContext: true,
    hasServiceWorker: true,
    hasNotification: true,
    hasPushManager: true,
    vapidPublicKey: "test-public-key",
    notificationPermission: "default",
    ...overrides,
  };
}

describe("pushClient support helpers", () => {
  it("returns secure context error when https is missing", () => {
    const error = getServiceWorkerSupportError(
      createSnapshot({
        isSecureContext: false,
      }),
    );

    expect(error).toBe(
      "Push-notiser kräver en säker anslutning (https eller localhost).",
    );
  });

  it("returns VAPID error when public key is missing", () => {
    const error = getPushSubscriptionSupportError(
      createSnapshot({
        vapidPublicKey: null,
      }),
    );

    expect(error).toBe("NEXT_PUBLIC_VAPID_PUBLIC_KEY saknas.");
  });

  it("returns null when push support is complete", () => {
    const error = getPushSubscriptionSupportError(createSnapshot());

    expect(error).toBeNull();
  });
});

describe("normalizePushError", () => {
  it("normalizes missing VAPID key error", () => {
    const message = normalizePushError(
      new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY saknas."),
    );

    expect(message).toBe(
      "Push-notiser kan inte aktiveras eftersom VAPID-konfiguration saknas.",
    );
  });

  it("normalizes denied permission error", () => {
    const message = normalizePushError(
      new Error("Användaren tillät inte notiser."),
    );

    expect(message).toBe(
      "Notiser är blockerade för den här sajten. Tillåt dem i webbläsarens inställningar och prova igen.",
    );
  });

  it("falls back to raw message for unknown errors", () => {
    const message = normalizePushError(new Error("Något annat gick fel."));

    expect(message).toBe("Något annat gick fel.");
  });
});