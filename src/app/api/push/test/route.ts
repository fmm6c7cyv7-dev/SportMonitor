// src/app/api/push/test/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { sendWebPush } from "@/lib/pushServer";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

/* ==========================================================================
   TYPES
   ========================================================================== */

type PushTestRequestBody = {
  device_id?: string;
};

type PushSubscriptionRow = {
  id: string;
  device_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
};

type PushSendError = {
  statusCode?: number;
};

/* ==========================================================================
   HELPERS
   ========================================================================== */

function nowIso(): string {
  return new Date().toISOString();
}

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function POST(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = ((await req.json().catch(() => ({}))) ?? {}) as PushTestRequestBody;
    const deviceId = body.device_id;

    const supabase = supabaseService();

    let query = supabase
      .from("push_subscriptions")
      .select("id, device_id, endpoint, p256dh, auth, enabled")
      .eq("enabled", true)
      .order("created_at", { ascending: false });

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    } else {
      query = query.limit(1);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }

    const subscriptions = (data ?? []) as PushSubscriptionRow[];

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No active push subscriptions found" },
        { status: 404 },
      );
    }

    let sent = 0;
    let disabled = 0;

    for (const subscription of subscriptions) {
      try {
        await sendWebPush(
          {
            endpoint: subscription.endpoint,
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
          {
            title: "SportMonitor",
            body: "Testnotis fungerar ✅",
            url: "/push-test",
            tag: "sportmonitor-test",
            data: {
              kind: "test",
            },
          },
        );

        sent += 1;
      } catch (error: unknown) {
        const statusCode = (error as PushSendError | null)?.statusCode;

        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .update({
              enabled: false,
              updated_at: nowIso(),
            })
            .eq("id", subscription.id);

          disabled += 1;
        } else {
          console.error("[push/test] send error:", error);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      sent,
      disabled,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}