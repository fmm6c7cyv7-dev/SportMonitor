// src/app/api/push/subscribe/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

/* ==========================================================================
   TYPES
   ========================================================================== */

type PushSubscriptionPayload = {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type SubscribeRequestBody = {
  device_id?: string;
  subscription?: PushSubscriptionPayload;
  userAgent?: string;
};

type UnsubscribeRequestBody = {
  device_id?: string;
  endpoint?: string;
};

/* ==========================================================================
   HELPERS
   ========================================================================== */

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown server error";
}

/* ==========================================================================
   POST
   ========================================================================== */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubscribeRequestBody;

    const { device_id, subscription, userAgent } = body;

    if (
      !device_id ||
      !subscription?.endpoint ||
      !subscription.keys?.p256dh ||
      !subscription.keys?.auth
    ) {
      return NextResponse.json(
        { ok: false, error: "missing params" },
        { status: 400 },
      );
    }

    const supabase = supabaseService();
    const timestamp = nowIso();

    /* ----------------------------------------------------------------------
       Disable all old subscriptions for this device
       ---------------------------------------------------------------------- */

    const { error: disableError } = await supabase
      .from("push_subscriptions")
      .update({
        enabled: false,
        updated_at: timestamp,
      })
      .eq("device_id", device_id);

    if (disableError) {
      console.error("[push/subscribe] disable failed:", disableError);
      return NextResponse.json(
        { ok: false, error: "Push subscription could not be updated" },
        { status: 500 },
      );
    }

    /* ----------------------------------------------------------------------
       Reuse an existing browser endpoint when the client self-heals.
       endpoint is UNIQUE, so repeated registration must be idempotent.
       Preserve created_at so re-registration does not make existing news
       look retroactive to a newly-created subscription.
       ---------------------------------------------------------------------- */

    const { data: existingSubscription, error: lookupError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", subscription.endpoint)
      .maybeSingle();

    if (lookupError) {
      console.error("[push/subscribe] lookup failed:", lookupError);
      return NextResponse.json(
        { ok: false, error: "Push subscription could not be updated" },
        { status: 500 },
      );
    }

    if (existingSubscription?.id) {
      const { error: updateError } = await supabase
        .from("push_subscriptions")
        .update({
          device_id,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          enabled: true,
          user_agent: userAgent ?? null,
          updated_at: timestamp,
        })
        .eq("id", existingSubscription.id);

      if (updateError) {
        console.error("[push/subscribe] update failed:", updateError);
        return NextResponse.json(
          { ok: false, error: "Push subscription could not be updated" },
          { status: 500 },
        );
      }

      return NextResponse.json({ ok: true, reused: true });
    }

    /* ----------------------------------------------------------------------
       Insert a genuinely new subscription
       ---------------------------------------------------------------------- */

    const { error: insertError } = await supabase
      .from("push_subscriptions")
      .insert({
        device_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        enabled: true,
        user_agent: userAgent ?? null,
        created_at: timestamp,
        updated_at: timestamp,
      });

    if (insertError) {
      console.error("[push/subscribe] insert failed:", insertError);
      return NextResponse.json(
        { ok: false, error: "Push subscription could not be saved" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, reused: false });
  } catch (error: unknown) {
    console.error("[push/subscribe] POST crash:", errorMessage(error));
    return NextResponse.json(
      { ok: false, error: "Push subscription could not be saved" },
      { status: 500 },
    );
  }
}

/* ==========================================================================
   DELETE
   ========================================================================== */

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as UnsubscribeRequestBody;

    const { device_id, endpoint } = body;

    if (!device_id) {
      return NextResponse.json(
        { ok: false, error: "missing device_id" },
        { status: 400 },
      );
    }

    const supabase = supabaseService();
    const timestamp = nowIso();

    let query = supabase
      .from("push_subscriptions")
      .update({
        enabled: false,
        updated_at: timestamp,
      })
      .eq("device_id", device_id);

    if (endpoint) {
      query = query.eq("endpoint", endpoint);
    }

    const { error } = await query;

    if (error) {
      console.error("[push/subscribe] DELETE failed:", error);
      return NextResponse.json(
        { ok: false, error: "Push subscription could not be disabled" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error("[push/subscribe] DELETE crash:", errorMessage(error));
    return NextResponse.json(
      { ok: false, error: "Push subscription could not be disabled" },
      { status: 500 },
    );
  }
}
