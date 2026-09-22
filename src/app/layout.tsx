// web/src/app/layout.tsx

import "./globals.css";
import type { ReactNode } from "react";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

/* ==========================================================================
   METADATA
   ========================================================================== */

export const metadata = {
  title: "SportMonitor",
  description: "Sports news aggregator",
};

/* ==========================================================================
   ROOT LAYOUT
   ========================================================================== */

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="sv">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}