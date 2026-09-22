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

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EventRequestBody;
    const normalizedPayload = normalizeEventPayload(body);
    const validationError = validateEventPayload(normalizedPayload);

    if (validationError) {
      return NextResponse.json(
        {
          ok: false,
          error: validationError,
        },
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