// src/lib/feed/types.ts

import type { AcceptedItem } from "@/lib/news/newsTypes";

export type RankedFeedItem = AcceptedItem & {
  ranking_total: number;
  is_local: boolean;
};
