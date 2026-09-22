// src/lib/events/eventWrite.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EventRequestBody,
  NormalizedEventPayload,
  UserEventInsert,
} from "@/lib/events/eventTypes";

/* ==========================================================================
   VALIDATION HELPERS
   ========================================================================== */

function normalizeNullableString(value?: string | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value?: string | null): string {
  return String(value ?? "").trim();
}

/* ==========================================================================
   PUBLIC HELPERS
   ========================================================================== */

export function normalizeEventPayload(
  body: EventRequestBody,
): NormalizedEventPayload {
  return {
    event_type: normalizeRequiredString(body.event_type),
    news_id: normalizeNullableString(body.news_id),
    entity_type: normalizeNullableString(body.entity_type),
    entity_id: normalizeNullableString(body.entity_id),
    source: normalizeNullableString(body.source),
    sport: normalizeNullableString(body.sport),
  };
}

export function validateEventPayload(
  payload: NormalizedEventPayload,
): string | null {
  if (!payload.event_type) {
    return "event_type is required";
  }

  return null;
}

export function toUserEventInsert(
  payload: NormalizedEventPayload,
): UserEventInsert {
  return {
    event_type: payload.event_type,
    news_id: payload.news_id,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    source: payload.source,
    sport: payload.sport,
    metadata: null,
  };
}

export async function insertUserEvent(
  supabase: SupabaseClient,
  payload: UserEventInsert,
) {
  return supabase.from("user_events").insert(payload);
}