// src/lib/events/eventTypes.ts

/* ==========================================================================
   DOMAIN TYPES
   ========================================================================== */

export type EventRequestBody = {
  event_type?: string;
  news_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  source?: string | null;
  sport?: string | null;
};

export type UserEventInsert = {
  event_type: string;
  news_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  source: string | null;
  sport: string | null;
  metadata: null;
};

export type NormalizedEventPayload = {
  event_type: string;
  news_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  source: string | null;
  sport: string | null;
};