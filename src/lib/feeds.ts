// src/lib/feeds.ts
//
// Compatibility facade.
// New code should import feed contracts and FEEDS from
// "@/lib/ingest/sourceRegistry".

export type {
  Sport,
  FeedType,
  ScrapeSource,
  FeedDef,
} from "@/lib/ingest/sourceRegistry";

export { FEEDS } from "@/lib/ingest/sourceRegistry";
