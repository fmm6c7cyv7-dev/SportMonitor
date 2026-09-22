// src/app/api/push/dispatch/route.ts

import { NextResponse } from "next/server";
import { dispatchPushForNewsItem } from "@/lib/pushDispatch";
import { requireInternalRouteAuth } from "@/lib/server/internalRouteAuth";

/* ==========================================================================
   HELPERS
   ========================================================================== */

function missingIdResponse() {
  return NextResponse.json(
    { ok: false, error: "missing id" },
    { status: 400 },
  );
}

async function handleDispatch(id: string) {
  const result = await dispatchPushForNewsItem(id);
  return NextResponse.json(result);
}

/* ==========================================================================
   GET
   ========================================================================== */

export async function GET(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return missingIdResponse();
  }

  return handleDispatch(id);
}

/* ==========================================================================
   POST
   ========================================================================== */

export async function POST(req: Request) {
  const unauthorized = requireInternalRouteAuth(req, "admin");
  if (unauthorized) {
    return unauthorized;
  }

  const body = await req.json();
  const id = body.id;

  if (!id) {
    return missingIdResponse();
  }

  return handleDispatch(id);
}