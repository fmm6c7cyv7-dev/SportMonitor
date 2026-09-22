// web/src/components/ClientTopDropper.tsx

"use client";

import { useEffect, useState } from "react";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const POLL_MS = 45_000;
const brandGold = "#DAB661";

/* ==========================================================================
   TYPES
   ========================================================================== */

type TopResponse = {
  ui?: {
    updated_label?: string | null;
    latest_label?: string | null;
    latest_prefix?: string | null;
  };
};

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function ClientTopDropper() {
  const [latestLabel, setLatestLabel] = useState<string | null>(null);

  /* ========================================================================
     POLLING
     ======================================================================== */

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let abortController: AbortController | null = null;
    let isActive = true;

    const stop = (): void => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      abortController?.abort();
      abortController = null;
    };

    const load = async (): Promise<void> => {
      abortController?.abort();
      abortController = new AbortController();

      try {
        const response = await fetch("/api/top", {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("top ping failed");
        }

        const json = (await response.json()) as TopResponse;

        if (!isActive) {
          return;
        }

        setLatestLabel(json.ui?.latest_label ?? null);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("ClientTopDropper load failed", error);
      }
    };

    const start = (): void => {
      stop();
      void load();

      pollTimer = setInterval(() => {
        void load();
      }, POLL_MS);
    };

    const onVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isActive = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, []);

  /* ========================================================================
     RENDER
     ======================================================================== */

  return (
    <div className="w-full pt-1 sm:pt-2">
      <div className="-mx-4 flex justify-center sm:mx-0">
        <img
          src="/logo-sportmonitor.png"
          alt="SportMonitor"
          width={2172}
          height={724}
          className="h-auto w-[96vw] max-w-none sm:w-auto sm:max-w-[460px] md:max-w-[560px]"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center sm:mt-4">
        <span
          style={{
            borderColor: `${brandGold}40`,
            color: brandGold,
            backgroundColor: `${brandGold}08`,
          }}
          className="rounded-md border px-2 py-0.5 text-[9px] font-black tracking-[0.1em]"
        >
          Auto-uppdatering
        </span>

        <div className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-[ping_0.9s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1 text-xs sm-dim">
          <span className="opacity-60">• Senaste artikel:&nbsp;</span>
          <span style={{ color: brandGold }} className="font-semibold">
            {latestLabel ?? "…"}
          </span>
        </div>
      </div>
    </div>
  );
}
