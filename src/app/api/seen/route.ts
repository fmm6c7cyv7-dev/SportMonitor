// src/app/api/seen/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";

/* ==========================================================================
   TYPES
   ========================================================================== */

type SeenRequestBody = {
  deviceId?: string;
  newsItemId?: string;
};

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SeenRequestBody;
    const { deviceId, newsItemId } = body;

    if (!deviceId || !newsItemId) {
      return NextResponse.json(
        { error: "Missing parameters" },
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

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking news as seen:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}