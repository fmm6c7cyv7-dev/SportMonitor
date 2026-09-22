import { NextRequest } from "next/server";
import { handleNewsFeedRequest } from "@/lib/feed/newsFeedRequest";

export const FEED_COLUMN_LIMIT = 30;

type BuildNewsFeedArgs = {
  sport: "football" | "hockey";
  limit?: number;
  deviceId?: string;
  hideRead?: boolean;
  personalized?: boolean;
  includeDebug?: boolean;
  favoriteTokens?: string[];
  debugCity?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  vercelIpCity?: string | null;
};

type NewsRouteItem = {
  id?: string | null;
};

type NewsRouteResponse = {
  items?: NewsRouteItem[];
  meta?: Record<string, unknown> & {
    debug?: Record<string, unknown>;
  };
  error?: string;
};

export async function buildNewsFeed(args: BuildNewsFeedArgs) {
  const params = new URLSearchParams({
    sport: args.sport,
    limit: String(args.limit ?? FEED_COLUMN_LIMIT),
  });

  if (args.deviceId) {
    params.set("device_id", args.deviceId);
  }

  if (args.hideRead) {
    params.set("hide_read", "1");
  }

  if (args.personalized) {
    params.set("personalized", "1");
    // Internal feed checks (push/audit) keep the historical personalized
    // ranking behavior. The browser UI controls its own favorites-first mode
    // explicitly with the same query flag.
    params.set("favorites_first", "1");
  }

  if (args.includeDebug) {
    params.set("debug", "1");
  }

  for (const token of args.favoriteTokens ?? []) {
    params.append("fav", token);
  }

  if (args.debugCity) {
    params.set("geo_debug", args.debugCity);
  }

  if (args.geoLat != null) {
    params.set("lat", String(args.geoLat));
  }

  if (args.geoLng != null) {
    params.set("lng", String(args.geoLng));
  }

  const headers = new Headers();
  if (args.vercelIpCity) {
    headers.set("x-vercel-ip-city", args.vercelIpCity);
  }

  const request = new NextRequest(
    `http://localhost/api/news?${params.toString()}`,
    { headers },
  );

  const response = await handleNewsFeedRequest(request);
  const json = (await response.json()) as NewsRouteResponse;

  if (!response.ok) {
    throw new Error(json.error ?? "Failed to build news feed");
  }

  const items = Array.isArray(json.items) ? json.items : [];

  return {
    items,
    meta: json.meta ?? {},
    debug: json.meta?.debug,
    includedIds: new Set(
      items
        .map((item) => item.id)
        .filter(
          (id): id is string => typeof id === "string" && id.trim().length > 0,
        ),
    ),
  };
}
