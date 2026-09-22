"use client";

import TopHighlight from "@/components/TopHighlight";
import NewsColumn from "@/components/NewsColumn";

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export default function HomeClient() {
  return (
    <div className="space-y-6">
      <TopHighlight />

      <div className="grid gap-6 md:grid-cols-2">
        <NewsColumn sport="football" title="Fotboll" />
        <NewsColumn sport="hockey" title="Hockey" />
      </div>
    </div>
  );
}