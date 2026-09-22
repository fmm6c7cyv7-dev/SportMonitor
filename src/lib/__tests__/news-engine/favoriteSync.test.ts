// src/lib/__tests__/news-engine/favoriteSync.test.ts

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchServerFavorites,
  normalizeFavoriteSyncError,
  syncFavoriteAddRequest,
  syncFavoriteClearAllRequest,
  syncFavoriteRemoveRequest,
} from "@/lib/news/favoriteSync";

describe("favoriteSync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends sport and type when syncing favorite add", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await syncFavoriteAddRequest({
      deviceId: "device-1",
      entityId: "football-league-allsvenskan",
      name: "Allsvenskan",
      sport: "football",
      type: "league",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("/api/favorites");
    expect(init.method).toBe("POST");

    expect(JSON.parse(String(init.body))).toEqual({
      device_id: "device-1",
      entity_id: "football-league-allsvenskan",
      name: "Allsvenskan",
      sport: "football",
      type: "league",
    });
  });

  it("sends delete request with sport and type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await syncFavoriteRemoveRequest({
      deviceId: "device-2",
      entityId: "football-team-vasteras-sk",
      name: "Västerås SK",
      sport: "football",
      type: "team",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe("/api/favorites");
    expect(init.method).toBe("DELETE");

    expect(JSON.parse(String(init.body))).toEqual({
      device_id: "device-2",
      entity_id: "football-team-vasteras-sk",
      name: "Västerås SK",
      sport: "football",
      type: "team",
    });
  });

  it("throws backend favorite error text when sync fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Hittade inte favoriten i databasen" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      syncFavoriteAddRequest({
        deviceId: "device-3",
        entityId: "football-league-superettan",
        name: "Superettan",
        sport: "football",
        type: "league",
      }),
    ).rejects.toThrow("Hittade inte favoriten i databasen");
  });

  it("fetches server favorites for a device", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              entity_id: "football-team-vasteras-sk",
              name: "Västerås SK",
              type: "team",
              sport: "football",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const items = await fetchServerFavorites("device-4");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites?device_id=device-4",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
    expect(items).toEqual([
      {
        entity_id: "football-team-vasteras-sk",
        name: "Västerås SK",
        type: "team",
        sport: "football",
      },
    ]);
  });

  it("sends delete all request for current device", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await syncFavoriteClearAllRequest("device-5");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/favorites?device_id=device-5&all=1",
      expect.objectContaining({
        method: "DELETE",
      }),
    );
  });

  it("normalizes favorite not found error to user-friendly text", () => {
    const message = normalizeFavoriteSyncError(
      new Error("Hittade inte favoriten i databasen"),
    );

    expect(message).toBe(
      "Favoriten hittades inte i databasen. Den visas därför inte som riktig favorit ännu.",
    );
  });
});
