// web/src/components/ServiceWorkerRegistrar.tsx

"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/pushClient";

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker().catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  return null;
}