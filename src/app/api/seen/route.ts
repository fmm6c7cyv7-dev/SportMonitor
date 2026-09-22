// src/app/api/seen/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import {
  guardPublicApi,
  isSafeDeviceId,
  readJsonObject,
} from "@/lib/server/publicApiGuard";

type SeenRequestBody = {
  deviceId?: string;
  newsItemId?: string;
};

export async function POST(req: Request) {
  const guarded = guardPublicApi(req, {
    key: "seen:post",
    limit: 40,
    maxBodyBytes: 2_048,
  });
  if (guarded) return guarded;

  try {
    const parsed = await readJsonObject<Record<string, unknown>>(req, 2_048);
    if (!parsed.ok) return parsed.response;

    const body = parsed.value as SeenRequestBody;
    const deviceId = body.deviceId?.trim();
    const newsItemId = body.newsItemId?.trim();

    if (
      !isSafeDeviceId(deviceId) ||
      !newsItemId ||
      newsItemId.length > 2_048
    ) {
      return NextResponse.json(
        { error: "Invalid parameters" },
        { status: 400 },
      );
    }

    const supabase = supabaseService();
    const { error } = await supabase.from("user_seen_news").upsert(
      {
        device_id: deviceId,
        news_item_id: newsItemId,
      },
      {
        onConflict: "device_id,news_item_id",
      },
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking news as seen:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
