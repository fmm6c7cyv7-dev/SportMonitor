// src/app/api/events/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import type { EventRequestBody } from "@/lib/events/eventTypes";
import {
  insertUserEvent,
  normalizeEventPayload,
  toUserEventInsert,
  validateEventPayload,
} from "@/lib/events/eventWrite";
import {
  guardPublicApi,
  readJsonObject,
} from "@/lib/server/publicApiGuard";

const ALLOWED_EVENT_TYPES = new Set([
  "news_impression",
  "news_click",
  "push_open",
  "news_dwell",
]);

function hasValidOptionalString(
  value: unknown,
  maxLength: number,
): boolean {
  return (
    value == null ||
    (typeof value === "string" && value.trim().length <= maxLength)
  );
}

export async function POST(req: Request) {
  const guarded = guardPublicApi(req, {
    key: "events:post",
    limit: 20,
    maxBodyBytes: 4_096,
  });
  if (guarded) return guarded;

  try {
    const parsed = await readJsonObject<Record<string, unknown>>(req, 4_096);
    if (!parsed.ok) return parsed.response;

    const body = parsed.value as EventRequestBody;
    const normalizedPayload = normalizeEventPayload(body);
    const validationError = validateEventPayload(normalizedPayload);

    if (
      validationError ||
      !ALLOWED_EVENT_TYPES.has(normalizedPayload.event_type) ||
      !hasValidOptionalString(normalizedPayload.news_id, 2_048) ||
      !hasValidOptionalString(normalizedPayload.entity_id, 160) ||
      !hasValidOptionalString(normalizedPayload.source, 160) ||
      (normalizedPayload.entity_type != null &&
        !["player", "team", "league"].includes(normalizedPayload.entity_type)) ||
      (normalizedPayload.sport != null &&
        !["football", "hockey"].includes(normalizedPayload.sport))
    ) {
      return NextResponse.json(
        { ok: false, error: validationError ?? "Invalid event payload" },
        { status: 400 },
      );
    }

    const supabase = supabaseService();
    const insertPayload = toUserEventInsert(normalizedPayload);
    const { error } = await insertUserEvent(supabase, insertPayload);

    if (error) {
      console.error("event insert error:", error);
      return NextResponse.json(
        { ok: false, error: "Event could not be saved" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("events route crash:", error);
    return NextResponse.json(
      { ok: false, error: "Event could not be saved" },
      { status: 500 },
    );
  }
}
