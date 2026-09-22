// src/app/api/debug-env/route.ts

import { NextResponse } from "next/server";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

/* ==========================================================================
   ROUTE
   ========================================================================== */

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const ingestSecret = process.env.INGEST_SECRET ?? "";
  const adminSecret = process.env.FAVORITE_AUDIT_SECRET ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  return NextResponse.json({
    ok: true,
    hasUrl: !!supabaseUrl,
    hasAnon: !!anonKey,
    hasService: !!serviceKey,
    hasIngest: !!ingestSecret,
    hasAdmin: !!adminSecret,
    hasCron: !!cronSecret,
  });
}