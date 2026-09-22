// src/lib/news/favoriteSync.ts

import type { Sport } from "@/lib/types";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type FavoriteEntityType = "player" | "team" | "league";

export type FavoriteSyncRequest = {
  deviceId: string;
  entityId: string | null;
  name?: string;
  sport?: Sport;
  type?: FavoriteEntityType | null;
};

export type FavoriteListItem = {
  entity_id: string;
  name: string;
  type: FavoriteEntityType;
  sport: Sport | null;
};

type FavoriteApiErrorPayload = {
  error?: string;
  ok?: boolean;
};

/* ==========================================================================
   ERROR HELPERS
   ========================================================================== */

async function readFavoriteApiError(response: Response): Promise<string | null> {
  try {
    const json = (await response.json()) as FavoriteApiErrorPayload;

    if (typeof json?.error === "string" && json.error.trim()) {
      return json.error.trim();
    }

    return null;
  } catch {
    return null;
  }
}

export function normalizeFavoriteSyncError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Kunde inte spara favoriten.";

  if (message.includes("Hittade inte favoriten i databasen")) {
    return "Favoriten hittades inte i databasen. Den visas därför inte som riktig favorit ännu.";
  }

  if (message.includes("Favoriten saknar entity-id")) {
    return "Favoriten kunde inte sparas eftersom entity-id saknas.";
  }

  if (message.includes("Favoriten saknar namn")) {
    return "Favoriten kunde inte sparas eftersom namn saknas för backend-uppslag.";
  }

  if (message.includes("missing params")) {
    return "Favoriten kunde inte sparas eftersom nödvändig data saknas.";
  }

  if (message.includes("Favorite sync failed:")) {
    return "Favoriten kunde inte synkas mot servern.";
  }

  return message || "Kunde inte spara favoriten.";
}

/* ==========================================================================
   NETWORK HELPERS
   ========================================================================== */

async function mutateFavorite(
  method: "POST" | "DELETE",
  payload: FavoriteSyncRequest,
): Promise<void> {
  if (!payload.entityId) {
    throw new Error("Favoriten saknar entity-id.");
  }

  const response = await fetch("/api/favorites", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      device_id: payload.deviceId,
      entity_id: payload.entityId,
      name: payload.name,
      sport: payload.sport,
      type: payload.type,
    }),
  });

  if (!response.ok) {
    const serverError = await readFavoriteApiError(response);

    throw new Error(serverError ?? `Favorite sync failed: ${response.status}`);
  }
}

export async function syncFavoriteAddRequest(
  payload: FavoriteSyncRequest,
): Promise<void> {
  await mutateFavorite("POST", payload);
}

export async function syncFavoriteRemoveRequest(
  payload: FavoriteSyncRequest,
): Promise<void> {
  await mutateFavorite("DELETE", payload);
}

export async function fetchServerFavorites(
  deviceId: string,
): Promise<FavoriteListItem[]> {
  const response = await fetch(
    `/api/favorites?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
    items?: FavoriteListItem[];
  };

  if (!response.ok) {
    throw new Error(json.error ?? `Favorite fetch failed: ${response.status}`);
  }

  return Array.isArray(json.items) ? json.items : [];
}

export async function syncFavoriteClearAllRequest(
  deviceId: string,
): Promise<void> {
  const response = await fetch(
    `/api/favorites?device_id=${encodeURIComponent(deviceId)}&all=1`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const serverError = await readFavoriteApiError(response);
    throw new Error(serverError ?? `Favorite clear failed: ${response.status}`);
  }
}
