// src/components/EnablePushButton.tsx

"use client";

import { useEffect, useState } from "react";
import {
  getExistingPushSubscription,
  getPushSubscriptionSupportError,
  getPushSupportSnapshot,
  normalizePushError,
  subscribeToPush,
} from "@/lib/pushClient";
import { getDeviceId } from "@/lib/deviceId";
import ToggleSwitch from "@/components/ToggleSwitch";

/* ==========================================================================
   HELPERS
   ========================================================================== */

async function registerSubscription(subscription: PushSubscription): Promise<void> {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: getDeviceId(),
      subscription: subscription.toJSON(),
      userAgent: navigator.userAgent,
    }),
  });

  let serverError: string | null = null;

  try {
    const json = (await response.json()) as { error?: string };
    serverError = typeof json?.error === "string" ? json.error : null;
  } catch {
    serverError = null;
  }

  if (!response.ok) {
    throw new Error(serverError ?? `Push subscribe failed: ${response.status}`);
  }
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function EnablePushButton() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">(
    "unknown",
  );
  const [supportError, setSupportError] = useState<string | null>(null);

  /* ========================================================================
     INITIAL STATUS
     ======================================================================== */

  useEffect(() => {
    async function init(): Promise<void> {
      try {
        const snapshot = getPushSupportSnapshot();
        const nextSupportError = getPushSubscriptionSupportError(snapshot);

        setPermission(snapshot.notificationPermission);
        setSupportError(nextSupportError);

        if (nextSupportError) {
          setEnabled(false);
          setError(nextSupportError);
          return;
        }

        const subscription = await getExistingPushSubscription();
        const isEnabled =
          snapshot.notificationPermission === "granted" && !!subscription;

        setEnabled(isEnabled);

        if (snapshot.notificationPermission === "denied") {
          setError(
            "Notiser är blockerade för den här sajten. Tillåt dem i webbläsarens inställningar och prova igen.",
          );
          return;
        }

        // Browsern kan behålla sin PushSubscription även om serverraden har
        // försvunnit. Återregistrera en befintlig aktiv prenumeration vid start
        // så klient- och serverläge självläker utan att användaren behöver
        // stänga av/på push manuellt.
        if (isEnabled && subscription) {
          await registerSubscription(subscription);
        }

        setError(null);
      } catch (caughtError) {
        const normalizedError = normalizePushError(caughtError);

        setEnabled(false);
        setSupportError(normalizedError);
        setError(normalizedError);
      }
    }

    void init();
  }, []);

  /* ========================================================================
     PUSH ACTIONS
     ======================================================================== */

  async function turnOn(): Promise<void> {
    const snapshot = getPushSupportSnapshot();
    const nextSupportError = getPushSubscriptionSupportError(snapshot);

    setPermission(snapshot.notificationPermission);
    setSupportError(nextSupportError);
    setError(null);

    if (nextSupportError) {
      throw new Error(nextSupportError);
    }

    const subscription = await subscribeToPush();
    await registerSubscription(subscription);

    const refreshedSnapshot = getPushSupportSnapshot();

    setPermission(refreshedSnapshot.notificationPermission);
    setEnabled(true);
    setError(null);
  }

  async function turnOff(): Promise<void> {
    setError(null);

    const deviceId = getDeviceId();
    const subscription = await getExistingPushSubscription();
    const endpoint = subscription?.endpoint ?? null;

    if (subscription) {
      try {
        await subscription.unsubscribe();
      } catch {
        // Ignore browser unsubscribe errors and still try server-side cleanup.
      }
    }

    const response = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: deviceId,
        endpoint,
      }),
    });

    let serverError: string | null = null;

    try {
      const json = (await response.json()) as { error?: string };
      serverError = typeof json?.error === "string" ? json.error : null;
    } catch {
      serverError = null;
    }

    if (!response.ok) {
      throw new Error(serverError ?? `Push unsubscribe failed: ${response.status}`);
    }

    const refreshedSnapshot = getPushSupportSnapshot();

    setPermission(refreshedSnapshot.notificationPermission);
    setEnabled(false);
    setError(null);
  }

  async function toggle(): Promise<void> {
    try {
      setBusy(true);

      if (enabled) {
        await turnOff();
      } else {
        await turnOn();
      }
    } catch (caughtError) {
      const normalizedError = normalizePushError(caughtError);
      setError(normalizedError);
      console.error("Push toggle error:", caughtError);
    } finally {
      setBusy(false);
    }
  }

  /* ========================================================================
     RENDER
     ======================================================================== */

  const isDisabled =
    busy || Boolean(supportError) || permission === "denied";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-bold italic text-slate-100">
            Push-notiser
          </span>
          <span className="mt-1 text-xs text-slate-500">
            Få notiser om viktiga nyheter och händelser i ditt flöde.
          </span>
          <span className="mt-2 text-[11px] text-slate-400">
            Status: {enabled ? "Aktiv" : "Avstängd"} • Behörighet:{" "}
            {permission === "granted"
              ? "Tillåten"
              : permission === "denied"
                ? "Blockerad"
                : permission === "default"
                  ? "Inte vald"
                  : "Okänd"}
          </span>
        </div>

        <ToggleSwitch
          checked={enabled}
          label="Push-notiser"
          disabled={isDisabled}
          onChange={() => void toggle()}
        />
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}