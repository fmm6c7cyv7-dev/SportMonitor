// src/app/api/push/subscribe/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import {
  guardPublicApi,
  isSafeDeviceId,
  readJsonObject,
} from "@/lib/server/publicApiGuard";

type PushSubscriptionPayload = {
  endpoint?: string;
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

const MAX_BODY_BYTES = 8_192;
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_USER_AGENT_LENGTH = 512;

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown server error";
}

function isSafePushEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const endpoint = value.trim();

  if (!endpoint || endpoint.length > MAX_ENDPOINT_LENGTH) return false;

  try {
    return new URL(endpoint).protocol === "https:";
  } catch {
    return false;
  }
}

function isSafePushKey(
  value: unknown,
  minLength: number,
  maxLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minLength &&
    value.length <= maxLength &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export async function POST(req: Request) {
  const guarded = guardPublicApi(req, {
    key: "push-subscribe:post",
    limit: 5,
    maxBodyBytes: MAX_BODY_BYTES,
  });
  if (guarded) return guarded;

  try {
    const parsed = await readJsonObject<Record<string, unknown>>(
      req,
      MAX_BODY_BYTES,
    );
    if (!parsed.ok) return parsed.response;

    const body = parsed.value as SubscribeRequestBody;
    const deviceId = body.device_id?.trim();
    const endpoint = body.subscription?.endpoint?.trim();
    const p256dh = body.subscription?.keys?.p256dh;
    const auth = body.subscription?.keys?.auth;
    const userAgent =
      typeof body.userAgent === "string"
        ? body.userAgent.trim().slice(0, MAX_USER_AGENT_LENGTH)
        : null;

    if (
      !isSafeDeviceId(deviceId) ||
      !isSafePushEndpoint(endpoint) ||
      !isSafePushKey(p256dh, 40, 256) ||
      !isSafePushKey(auth, 8, 128)
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid params" },
        { status: 400 },
      );
    }

    const supabase = supabaseService();
    const timestamp = nowIso();

    const { error: disableError } = await supabase
      .from("push_subscriptions")
      .update({
        enabled: false,
        updated_at: timestamp,
      })
      .eq("device_id", deviceId);

    if (disableError) {
      console.error("[push/subscribe] disable failed:", disableError);
      return NextResponse.json(
        { ok: false, error: "Push subscription could not be updated" },
        { status: 500 },
      );
    }

    const { data: existingSubscription, error: lookupError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpoint)
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
          device_id: deviceId,
          p256dh,
          auth,
          enabled: true,
          user_agent: userAgent,
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

    const { error: insertError } = await supabase
      .from("push_subscriptions")
      .insert({
        device_id: deviceId,
        endpoint,
        p256dh,
        auth,
        enabled: true,
        user_agent: userAgent,
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

export async function DELETE(req: Request) {
  const guarded = guardPublicApi(req, {
    key: "push-subscribe:delete",
    limit: 10,
    maxBodyBytes: 4_096,
  });
  if (guarded) return guarded;

  try {
    const parsed = await readJsonObject<Record<string, unknown>>(req, 4_096);
    if (!parsed.ok) return parsed.response;

    const body = parsed.value as UnsubscribeRequestBody;
    const deviceId = body.device_id?.trim();
    const endpoint = body.endpoint?.trim();

    if (
      !isSafeDeviceId(deviceId) ||
      (endpoint != null && endpoint !== "" && !isSafePushEndpoint(endpoint))
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid params" },
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
      .eq("device_id", deviceId);

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
