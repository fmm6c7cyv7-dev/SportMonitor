// src/app/api/favorites/route.ts

import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase";
import { normalizeToken } from "@/lib/news/newsGeo";
import {
  guardPublicApi,
  isSafeDeviceId,
  readJsonObject,
} from "@/lib/server/publicApiGuard";
import type { Sport } from "@/lib/types";

/* ==========================================================================
   ROUTE CONFIG
   ========================================================================== */

export const dynamic = "force-dynamic";

/* ==========================================================================
   TYPES
   ========================================================================== */

const MAX_FAVORITES = 5;
const MAX_BODY_BYTES = 4_096;

type FavoriteLookupType = "player" | "team" | "league";

type FavoriteRequestBody = {
  device_id?: string;
  entity_id?: string;
  name?: string;
  sport?: string;
  type?: string;
};

type EntityLookupRow = {
  id: string;
  name: string;
  type: FavoriteLookupType;
  sport: Sport | null;
};

type FavoriteListRow = {
  entity_id: string;
  entities: EntityLookupRow | EntityLookupRow[] | null;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown server error";
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function isFavoriteLookupType(
  value: string | undefined,
): value is FavoriteLookupType {
  return value === "player" || value === "team" || value === "league";
}

export function isFavoriteLookupSport(
  value: string | undefined,
): value is Sport {
  return value === "football" || value === "hockey";
}

export function pickBestEntityLookupMatch(
  rows: EntityLookupRow[],
  name: string,
): EntityLookupRow | null {
  if (!rows.length) {
    return null;
  }

  const normalizedName = normalizeToken(name);

  const exactMatch = rows.find(
    (row) => normalizeToken(row.name) === normalizedName,
  );

  return exactMatch ?? rows[0] ?? null;
}

async function resolveEntityUuid(
  entityId: string,
  name: string | undefined,
  sport: string | undefined,
  type: string | undefined,
): Promise<
  | { ok: true; entityId: string }
  | { ok: false; status: number; error: string }
> {
  if (isUuid(entityId)) {
    return { ok: true, entityId };
  }

  const lookupName = name?.trim();

  if (!lookupName) {
    return {
      ok: false,
      status: 400,
      error: "Favoriten saknar namn för backend-uppslag",
    };
  }

  const supabase = supabaseService();

  let query = supabase
    .from("entities")
    .select("id,name,type,sport")
    .ilike("name", lookupName);

  if (isFavoriteLookupSport(sport)) {
    query = query.eq("sport", sport);
  }

  if (isFavoriteLookupType(type)) {
    query = query.eq("type", type);
  }

  const { data, error } = await query.limit(10).returns<EntityLookupRow[]>();

  if (error || !data || data.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Hittade inte favoriten i databasen",
    };
  }

  const picked = pickBestEntityLookupMatch(data, lookupName);

  if (!picked) {
    return {
      ok: false,
      status: 404,
      error: "Hittade inte favoriten i databasen",
    };
  }

  return {
    ok: true,
    entityId: picked.id,
  };
}

function validateBody(body: FavoriteRequestBody): {
  ok: true;
  deviceId: string;
  entityId: string;
  name?: string;
  sport?: string;
  type?: string;
} | {
  ok: false;
  response: NextResponse;
} {
  const deviceId = body.device_id?.trim();
  const entityId = body.entity_id?.trim();
  const name = body.name?.trim();
  const sport = body.sport?.trim();
  const type = body.type?.trim();

  if (
    !isSafeDeviceId(deviceId) ||
    !entityId ||
    entityId.length > 160 ||
    (name != null && name.length > 160) ||
    (sport != null && sport.length > 20) ||
    (type != null && type.length > 20)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "missing params" },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    deviceId,
    entityId,
    name,
    sport,
    type,
  };
}

export function getDeviceIdFromRequest(req: Request): string {
  const url = new URL(req.url);
  return (url.searchParams.get("device_id") ?? "").trim();
}

export function shouldClearAllFavorites(req: Request): boolean {
  const url = new URL(req.url);
  return url.searchParams.get("all") === "1";
}

/* ==========================================================================
   GET
   ========================================================================== */

export async function GET(req: Request) {
  const guarded = guardPublicApi(req, { key: "favorites:get", limit: 60 });
  if (guarded) return guarded;

  try {
    const deviceId = getDeviceIdFromRequest(req);

    if (!isSafeDeviceId(deviceId)) {
      return NextResponse.json(
        { ok: false, error: "missing device_id" },
        { status: 400 },
      );
    }

    const supabase = supabaseService();

    const { data, error } = await supabase
      .from("user_favorites")
      .select("entity_id,entities(id,name,type,sport)")
      .eq("device_id", deviceId)
      .returns<FavoriteListRow[]>();

    if (error) {
      throw error;
    }

    const items = (data ?? [])
      .map((row) => {
        const entity = Array.isArray(row.entities)
          ? row.entities[0] ?? null
          : row.entities;

        if (!row.entity_id || !entity?.name || !entity?.type) {
          return null;
        }

        return {
          entity_id: row.entity_id,
          name: entity.name,
          type: entity.type,
          sport: entity.sport,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      ok: true,
      device_id: deviceId,
      items,
    });
  } catch (error: unknown) {
    console.error("Krasch i favorites GET:", errorMessage(error));
    return NextResponse.json(
      { ok: false, error: "Kunde inte läsa favoriter." },
      { status: 500 },
    );
  }
}

/* ==========================================================================
   POST
   ========================================================================== */

export async function POST(req: Request) {
  const guarded = guardPublicApi(req, {
    key: "favorites:post",
    limit: 20,
    maxBodyBytes: MAX_BODY_BYTES,
  });
  if (guarded) return guarded;

  try {
    const parsed = await readJsonObject<Record<string, unknown>>(
      req,
      MAX_BODY_BYTES,
    );
    if (!parsed.ok) return parsed.response;

    const body = parsed.value as FavoriteRequestBody;
    const validated = validateBody(body);

    if (!validated.ok) {
      return validated.response;
    }

    const resolved = await resolveEntityUuid(
      validated.entityId,
      validated.name,
      validated.sport,
      validated.type,
    );

    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: resolved.error },
        { status: resolved.status },
      );
    }

    const supabase = supabaseService();

    const { data: existingFavorites, error: existingError } = await supabase
      .from("user_favorites")
      .select("entity_id")
      .eq("device_id", validated.deviceId)
      .limit(MAX_FAVORITES + 1);

    if (existingError) {
      throw existingError;
    }

    const alreadyExists = (existingFavorites ?? []).some(
      (row) => row.entity_id === resolved.entityId,
    );

    if (!alreadyExists && (existingFavorites?.length ?? 0) >= MAX_FAVORITES) {
      return NextResponse.json(
        { ok: false, error: `Max ${MAX_FAVORITES} favoriter` },
        { status: 409 },
      );
    }

    const { error } = await supabase.from("user_favorites").upsert(
      {
        device_id: validated.deviceId,
        entity_id: resolved.entityId,
      },
      {
        onConflict: "device_id,entity_id",
      },
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("Krasch i favorites POST:", message);

    return NextResponse.json(
      { ok: false, error: "Kunde inte spara favoriten." },
      { status: 500 },
    );
  }
}

/* ==========================================================================
   DELETE
   ========================================================================== */

export async function DELETE(req: Request) {
  const guarded = guardPublicApi(req, {
    key: "favorites:delete",
    limit: 20,
    maxBodyBytes: MAX_BODY_BYTES,
  });
  if (guarded) return guarded;

  try {
    const queryDeviceId = getDeviceIdFromRequest(req);
    const clearAll = shouldClearAllFavorites(req);

    if (clearAll) {
      if (!isSafeDeviceId(queryDeviceId)) {
        return NextResponse.json(
          { ok: false, error: "missing device_id" },
          { status: 400 },
        );
      }

      const supabase = supabaseService();
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("device_id", queryDeviceId);

      if (error) {
        throw error;
      }

      return NextResponse.json({ ok: true, cleared: true });
    }

    const parsed = await readJsonObject<Record<string, unknown>>(
      req,
      MAX_BODY_BYTES,
    );
    if (!parsed.ok) return parsed.response;

    const body = parsed.value as FavoriteRequestBody;
    const validated = validateBody(body);

    if (!validated.ok) {
      return validated.response;
    }

    const resolved = await resolveEntityUuid(
      validated.entityId,
      validated.name,
      validated.sport,
      validated.type,
    );

    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, error: resolved.error },
        { status: resolved.status },
      );
    }

    const supabase = supabaseService();

    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("device_id", validated.deviceId)
      .eq("entity_id", resolved.entityId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = errorMessage(error);
    console.error("Krasch i favorites DELETE:", message);

    return NextResponse.json(
      { ok: false, error: "Kunde inte ta bort favoriten." },
      { status: 500 },
    );
  }
}
