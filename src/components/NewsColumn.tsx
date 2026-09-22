"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewsItem, Sport } from "@/lib/types";
import Badge, { type BadgeVariant } from "@/components/Badge";
import EnablePushButton from "@/components/EnablePushButton";
import ToggleSwitch from "@/components/ToggleSwitch";
import { getDeviceId } from "@/lib/deviceId";
import {
  foldDiacritics,
  getBrowseEntities,
} from "@/lib/entities/catalog";
import { searchBrowseSuggestions } from "@/lib/entities/browseSearch";
import type { BrowseEntity } from "@/lib/entities/browseTypes";
import {
  fetchServerFavorites,
  normalizeFavoriteSyncError,
  syncFavoriteAddRequest,
  syncFavoriteClearAllRequest,
  syncFavoriteRemoveRequest,
  type FavoriteEntityType,
} from "@/lib/news/favoriteSync";

const POLL_MS = 45_000;
const MAX_FAVORITES = 5;
const MAX_RECENT_SELECTIONS = 20;
const MAX_PINNED_RECENTS = 5;

const LOCATION_STORAGE_KEY = "sm:geo:v1";
const LOCATION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const GEOLOCATION_TIMEOUT_MS = 8_000;

const brandGold = "#DAB661";

let globalDisplayLimit = 12;
const displayLimitListeners = new Set<(limit: number) => void>();

function setGlobalDisplayLimit(limit: number): void {
  globalDisplayLimit = limit;
  displayLimitListeners.forEach((listener) => listener(limit));
}

function getGlobalDisplayLimit(): number {
  return globalDisplayLimit;
}

function subscribeToDisplayLimit(
  listener: (limit: number) => void,
): () => void {
  displayLimitListeners.add(listener);

  return () => {
    displayLimitListeners.delete(listener);
  };
}

type EntityType = "player" | "team" | "league" | "all";

type EntitySuggestion = {
  id: string;
  sport: Sport;
  type: "player" | "team" | "league";
  name: string;
  slug: string;
  score?: number;
  icon?: string;
};

type FavoriteItem = {
  label: string;
  entityId: string | null;
  type: FavoriteEntityType | null;
  sport: Sport;
};

type FlowSettings = {
  hideRead: boolean;
  favoritesFirst: boolean;
};

type RecentFavoriteSelection = {
  entityId: string | null;
  label: string;
  type: "player" | "team" | "league";
  selectedAt: number;
};

type StoredGeoLocation = {
  lat: number;
  lng: number;
  updatedAt: number;
  source: "browser";
};

function storageKey(sport: Sport): string {
  return `sm:favorites:v3:${sport}`;
}

function settingsKey(): string {
  return "sm:settings:v1";
}

function readItemsKey(): string {
  return "sm:read_ids:v1";
}

function recentSelectionsKey(sport: Sport): string {
  return `sm:favorite_history:v1:${sport}`;
}

function parseStoredFavorites(rawFavorites: string | null, sport: Sport): FavoriteItem[] {
  if (!rawFavorites) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawFavorites) as unknown;

    if (!parsed || typeof parsed !== "object" || !("favorites" in parsed)) {
      return [];
    }

    const favoriteEntries = (parsed as { favorites?: unknown }).favorites;

    return Array.isArray(favoriteEntries)
      ? favoriteEntries.flatMap((entry: unknown) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }

          const record = entry as Record<string, unknown>;
          if (typeof record.label !== "string") {
            return [];
          }

          return [
            {
              label: record.label,
              entityId:
                typeof record.entityId === "string" ? record.entityId : null,
              type: isFavoriteEntityType(record.type) ? record.type : null,
              sport: isFavoriteSport(record.sport) ? record.sport : sport,
            } satisfies FavoriteItem,
          ];
        })
      : [];
  } catch {
    return [];
  }
}

function readStoredGeoLocation(): StoredGeoLocation | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredGeoLocation;

    if (
      !parsed ||
      typeof parsed.lat !== "number" ||
      typeof parsed.lng !== "number" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeStoredGeoLocation(value: StoredGeoLocation): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(value));
}

function isFreshGeoLocation(value: StoredGeoLocation | null): boolean {
  if (!value) return false;
  return Date.now() - value.updatedAt <= LOCATION_MAX_AGE_MS;
}

function timeAgo(iso: string, nowMs: number): string {
  const ms = nowMs - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);

  if (minutes < 1) return "nyss";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  return `${hours} h`;
}

function getBadgeInfo(
  title: string,
  tags?: string[] | null,
): { label: string; variant: BadgeVariant } | null {
  const upperTags = (tags ?? []).map((value) => value.toUpperCase());
  const titleUpper = (title ?? "").toUpperCase();

  if (upperTags.includes("JUST_NU")) {
    return { label: "JUST NU", variant: "justnu" };
  }

  if (upperTags.includes("LIVE")) {
    return { label: "LIVE", variant: "live" };
  }

  if (upperTags.includes("HOT")) {
    return { label: "MÅL", variant: "mal" };
  }

  if (titleUpper.includes("HERE WE GO") || upperTags.includes("HERE_WE_GO")) {
    return { label: "HERE WE GO 🚨", variant: "justnu" };
  }

  if (titleUpper.includes("DONE DEAL") || upperTags.includes("DONE_DEAL")) {
    return { label: "DONE DEAL", variant: "justnu" };
  }

  if (
    titleUpper.includes("OFFICIELLT") ||
    titleUpper.includes("OFFICIAL") ||
    upperTags.includes("OFFICIELLT")
  ) {
    return { label: "OFFICIELLT", variant: "officiellt" };
  }

  if (
    titleUpper.includes("KLART:") ||
    titleUpper.includes("ÄR KLART") ||
    titleUpper.includes("KLAR SOM") ||
    upperTags.includes("KLART")
  ) {
    return { label: "KLART", variant: "justnu" };
  }

  if (titleUpper.includes("PRESENTERAD") || titleUpper.includes("UNVEIL")) {
    return { label: "PRESENTERAD", variant: "officiellt" };
  }

  if (
    titleUpper.includes("FÅR SPARKEN") ||
    titleUpper.includes("SPARKAR") ||
    titleUpper.includes("SACKED") ||
    titleUpper.includes("DISMISS")
  ) {
    return { label: "SPARKEN", variant: "justnu" };
  }

  if (
    titleUpper.includes("AVGÅR") ||
    titleUpper.includes("RESIGNS") ||
    titleUpper.includes("STEPS DOWN")
  ) {
    return { label: "AVGÅR", variant: "justnu" };
  }

  if (
    titleUpper.includes("LÄMNAR") ||
    titleUpper.includes("DEPARTS") ||
    titleUpper.includes("LEAVES")
  ) {
    return { label: "LÄMNAR", variant: "live" };
  }

  if (
    titleUpper.includes("UPPGIFTER:") ||
    titleUpper.includes("RYKTE") ||
    titleUpper.includes("LINKED WITH")
  ) {
    return { label: "RYKTE", variant: "live" };
  }

  if (
    titleUpper.includes("APPOINT") ||
    titleUpper.includes("TAKES OVER") ||
    titleUpper.includes("TAR ÖVER") ||
    titleUpper.includes("NY TRÄNARE")
  ) {
    return { label: "NY TRÄNARE", variant: "officiellt" };
  }

  return null;
}

function normalizeEntityLabel(value: string): string {
  return foldDiacritics(value).trim();
}

function normalizeDisplayLabel(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function pushUniqueLabels(target: string[], values: string[]): void {
  for (const value of values) {
    const trimmed = normalizeDisplayLabel(value);
    if (!trimmed) continue;

    const exists = target.some(
      (existing) =>
        normalizeEntityLabel(existing).toLowerCase() ===
        normalizeEntityLabel(trimmed).toLowerCase(),
    );

    if (!exists) {
      target.push(trimmed);
    }
  }
}

function parseStringListLike(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map(normalizeDisplayLabel)
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((entry): entry is string => typeof entry === "string")
          .map(normalizeDisplayLabel)
          .filter(Boolean);
      }
    } catch {
      // fall through to delimiter parsing
    }
  }

  const delimiter = trimmed.includes("||")
    ? "||"
    : trimmed.includes("|")
      ? "|"
      : trimmed.includes("•")
        ? "•"
        : trimmed.includes(",")
          ? ","
          : null;

  if (!delimiter) {
    return [normalizeDisplayLabel(trimmed)].filter(Boolean);
  }

  return trimmed
    .split(delimiter)
    .map(normalizeDisplayLabel)
    .filter(Boolean);
}

function extractFavoriteLabels(item: NewsItem): string[] {
  const labels: string[] = [];
  const rawItem = item as NewsItem & Record<string, unknown>;

  pushUniqueLabels(labels, parseStringListLike(rawItem.favorite_labels));
  pushUniqueLabels(labels, parseStringListLike(rawItem.favorite_entity_names));

  const rawFavoriteEntities = rawItem.favorite_entities;
  if (Array.isArray(rawFavoriteEntities)) {
    for (const entry of rawFavoriteEntities) {
      if (!entry || typeof entry !== "object") continue;

      const record = entry as Record<string, unknown>;
      const candidate =
        typeof record.entity_name === "string"
          ? record.entity_name
          : typeof record.name === "string"
            ? record.name
            : typeof record.label === "string"
              ? record.label
              : null;

      if (candidate) {
        pushUniqueLabels(labels, [candidate]);
      }
    }
  }

  if (typeof item.favorite_entity_name === "string") {
    pushUniqueLabels(labels, [item.favorite_entity_name]);
  }

  if (labels.length === 0 && item.favorite_match === true) {
    labels.push("Favorit");
  }

  return labels;
}

function getFavoriteMatchCount(item: NewsItem): number {
  return extractFavoriteLabels(item).length;
}

function hasAnyFavoriteMatch(item: NewsItem): boolean {
  return getFavoriteMatchCount(item) > 0 || item.favorite_match === true;
}

function recentSelectionMatchKey(item: {
  id: string | null;
  name: string;
  type: "player" | "team" | "league";
}): string {
  return `${item.type}::${item.id ?? ""}::${normalizeEntityLabel(item.name)}`;
}

function isFavoriteEntityType(value: unknown): value is FavoriteEntityType {
  return value === "player" || value === "team" || value === "league";
}

function isFavoriteSport(value: unknown): value is Sport {
  return value === "football" || value === "hockey";
}

function hasActiveFavorites(favorites: FavoriteItem[]): boolean {
  return favorites.some(
    (favorite) =>
      typeof favorite.label === "string" && favorite.label.trim().length > 0,
  );
}

function appendExplicitFavoriteParams(
  params: URLSearchParams,
  favorites: FavoriteItem[],
): void {
  for (const favorite of favorites) {
    const label = favorite.label.trim();
    if (!label) continue;

    if (favorite.type) {
      params.append("fav", `${favorite.type}:${label}`);
    } else {
      params.append("fav", label);
    }
  }
}

function readRecentSelections(sport: Sport): RecentFavoriteSelection[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(recentSelectionsKey(sport));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as RecentFavoriteSelection[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry) =>
          entry &&
          (entry.type === "player" ||
            entry.type === "team" ||
            entry.type === "league") &&
          typeof entry.label === "string",
      )
      .sort((a, b) => b.selectedAt - a.selectedAt)
      .slice(0, MAX_RECENT_SELECTIONS);
  } catch {
    return [];
  }
}

function writeRecentSelection(sport: Sport, item: EntitySuggestion): void {
  const current = readRecentSelections(sport);

  const incoming: RecentFavoriteSelection = {
    entityId: item.id,
    label: item.name,
    type: item.type,
    selectedAt: Date.now(),
  };

  const deduped = current.filter(
    (entry) =>
      !(
        entry.type === incoming.type &&
        (entry.entityId === incoming.entityId ||
          normalizeEntityLabel(entry.label) ===
            normalizeEntityLabel(incoming.label))
      ),
  );

  const next = [incoming, ...deduped].slice(0, MAX_RECENT_SELECTIONS);

  localStorage.setItem(recentSelectionsKey(sport), JSON.stringify(next));
}

function browseEntityToSuggestion(entity: BrowseEntity): EntitySuggestion {
  return {
    id: entity.id,
    sport: entity.sport,
    type: entity.type,
    name: entity.name,
    slug: entity.slug,
    icon: entity.icon,
  };
}

async function logNewsClick(item: NewsItem): Promise<void> {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        event_type: "news_click",
        news_id: item.id ?? item.url,
        source: item.source ?? null,
        sport: item.sport ?? null,
        metadata: {
          url: item.url ?? null,
          title: item.title ?? null,
        },
      }),
    });
  } catch (error) {
    console.error("news_click log failed", error);
  }
}

export default function NewsColumn({
  sport,
  title,
}: {
  sport: Sport;
  title: string;
}) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [localGeo, setLocalGeo] = useState<StoredGeoLocation | null>(null);
  const [displayLimit, setDisplayLimit] = useState(getGlobalDisplayLimit());
  const [favoriteSyncError, setFavoriteSyncError] = useState<string | null>(null);
  const [favoriteSyncBusy, setFavoriteSyncBusy] = useState(false);
  const [maxFavoriteNotice, setMaxFavoriteNotice] = useState(false);

  const [settings, setSettings] = useState<FlowSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(settingsKey());

      try {
        return saved
          ? JSON.parse(saved)
          : { hideRead: false, favoritesFirst: false };
      } catch {
        return { hideRead: false, favoritesFirst: false };
      }
    }

    return { hideRead: false, favoritesFirst: false };
  });

  const [favInput, setFavInput] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("all");
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  const hasHydrated = useRef(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const doneButtonRef = useRef<HTMLButtonElement | null>(null);
  const suggestAbortRef = useRef<AbortController | null>(null);
  const requestedGeoRef = useRef(false);

  useEffect(() => {
    const unsubscribe = subscribeToDisplayLimit((newLimit) => {
      setDisplayLimit(newLimit);
    });

    return unsubscribe;
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setProgress(0);

    try {
      const params = new URLSearchParams({
        sport,
        limit: "40",
      });

      const hasFavoritesActive = hasActiveFavorites(favorites);
      const shouldSendDeviceState = hasFavoritesActive || settings.hideRead;

      if (shouldSendDeviceState) {
        params.set("device_id", getDeviceId());
      }

      if (settings.hideRead) {
        params.set("hide_read", "1");
      }

      if (hasFavoritesActive) {
        params.set("personalized", "1");
        appendExplicitFavoriteParams(params, favorites);

        if (settings.favoritesFirst) {
          params.set("favorites_first", "1");
        }
      }

      if (
        localGeo &&
        Number.isFinite(localGeo.lat) &&
        Number.isFinite(localGeo.lng)
      ) {
        params.set("lat", String(localGeo.lat));
        params.set("lng", String(localGeo.lng));
      }

      const response = await fetch(`/api/news?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load news for ${sport}: ${response.status}`);
      }

      const json = await response.json();
      setItems((json?.items ?? []) as NewsItem[]);
    } catch (error) {
      console.error(error);
      setItems([]);
    } finally {
      setIsLoading(false);
      setTimeout(() => setProgress(100), 50);
    }
  }, [sport, favorites, settings.hideRead, settings.favoritesFirst, localGeo]);

  const fetchSuggestions = useCallback(
    async (query: string): Promise<void> => {
      if (!panelOpen) return;

      setIsSuggesting(true);
      suggestAbortRef.current?.abort();
      suggestAbortRef.current = new AbortController();

      try {
        const trimmedQuery = query.trim();

        if (!trimmedQuery) {
          if (entityType === "all") {
            setSuggestions([]);
            return;
          }

          const recents = readRecentSelections(sport)
            .filter((entry) => entry.type === entityType)
            .slice(0, MAX_PINNED_RECENTS);

          const recentKeySet = new Set(
            recents.map((entry) =>
              recentSelectionMatchKey({
                id: entry.entityId,
                name: entry.label,
                type: entry.type,
              }),
            ),
          );

          const localSuggestions = getBrowseEntities(sport, entityType)
            .map(browseEntityToSuggestion)
            .sort((a, b) => a.name.localeCompare(b.name, "sv"));

          const recentMatches = localSuggestions.filter((entry) =>
            recentKeySet.has(
              recentSelectionMatchKey({
                id: entry.id,
                name: entry.name,
                type: entry.type,
              }),
            ),
          );

          const remaining = localSuggestions.filter(
            (entry) =>
              !recentKeySet.has(
                recentSelectionMatchKey({
                  id: entry.id,
                  name: entry.name,
                  type: entry.type,
                }),
              ),
          );

          setSuggestions([...recentMatches, ...remaining]);
          return;
        }

        const results = searchBrowseSuggestions(sport, entityType, trimmedQuery);
        setSuggestions(results.map(browseEntityToSuggestion));
      } catch {
        setSuggestions([]);
      } finally {
        setIsSuggesting(false);
      }
    },
    [entityType, panelOpen, sport],
  );

  useEffect(() => {
    const rawFavorites = localStorage.getItem(storageKey(sport));
    const rawReadIds = localStorage.getItem(readItemsKey());
    const storedGeo = readStoredGeoLocation();
    const cachedFavorites = parseStoredFavorites(rawFavorites, sport);

    setFavorites(cachedFavorites);

    if (rawReadIds) {
      try {
        setReadIds(new Set(JSON.parse(rawReadIds)));
      } catch {
        setReadIds(new Set());
      }
    }

    if (storedGeo) {
      setLocalGeo(storedGeo);
    }

    hasHydrated.current = true;

    const deviceId = getDeviceId();

    void fetchServerFavorites(deviceId)
      .then((serverFavorites) => {
        const nextFavorites: FavoriteItem[] = serverFavorites
          .filter((item) => item.sport === sport)
          .map((item) => ({
            label: item.name,
            entityId: item.entity_id,
            type: item.type,
            sport: item.sport ?? sport,
          }));

        setFavorites(nextFavorites);
      })
      .catch((error) => {
        console.error("Failed to hydrate favorites from server", error);
      });
  }, [sport]);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    const storedGeo = readStoredGeoLocation();

    if (storedGeo) {
      setLocalGeo((current) => current ?? storedGeo);

      if (isFreshGeoLocation(storedGeo)) {
        return;
      }
    }

    if (requestedGeoRef.current) {
      return;
    }

    requestedGeoRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: StoredGeoLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updatedAt: Date.now(),
          source: "browser",
        };

        writeStoredGeoLocation(next);

        setLocalGeo((current) => {
          if (
            current &&
            Math.abs(current.lat - next.lat) < 0.0001 &&
            Math.abs(current.lng - next.lng) < 0.0001
          ) {
            return { ...current, updatedAt: next.updatedAt };
          }

          return next;
        });
      },
      (error) => {
        console.error("geolocation failed", error);
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: LOCATION_MAX_AGE_MS,
      },
    );
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === settingsKey() && event.newValue) {
        try {
          setSettings(JSON.parse(event.newValue));
        } catch (error) {
          console.error("Failed to sync settings", error);
        }
      }

      if (event.key === LOCATION_STORAGE_KEY) {
        const stored = readStoredGeoLocation();
        setLocalGeo(stored);
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;
    localStorage.setItem(settingsKey(), JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    localStorage.setItem(storageKey(sport), JSON.stringify({ favorites }));
    window.dispatchEvent(new Event("sm:favorites:changed"));
  }, [favorites, sport]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    void load();
  }, [load, favorites, settings.hideRead, localGeo]);

  useEffect(() => {
    if (!isLoading && progress === 0) {
      setProgress(100);
    }
  }, [isLoading, progress]);

  useEffect(() => {
    const timer = setInterval(() => {
      void load();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchSuggestions(favInput.trim());
    }, 200);

    return () => clearTimeout(timer);
  }, [favInput, entityType, panelOpen, fetchSuggestions]);

  useEffect(() => {
    return () => {
      suggestAbortRef.current?.abort();
    };
  }, []);

  const sortedItems = useMemo(() => {
    let filtered = [...items];

    if (settings.hideRead) {
      filtered = filtered.filter((item) => {
        const id = String(item.id ?? item.url);
        return !readIds.has(id);
      });
    }

    // Server ranking owns feed order. Favorites are still badged locally, but
    // the client must never regroup every favorite ahead of the ranked feed.
    return filtered;
  }, [items, settings.hideRead, readIds]);

  const visibleItems = useMemo(() => {
    return sortedItems.slice(0, displayLimit);
  }, [sortedItems, displayLimit]);

  const nowMs = Date.now();
  const shouldShowSuggestionsBox =
    entityType !== "all" || favInput.trim().length > 0;

  function handleMarkAsRead(item: NewsItem): void {
    const id = String(item.id ?? item.url);
    const newReadIds = new Set(readIds).add(id);

    setReadIds(newReadIds);
    localStorage.setItem(readItemsKey(), JSON.stringify(Array.from(newReadIds)));
  }

  async function handleAddFavorite(suggestion: EntitySuggestion): Promise<void> {
    if (favoriteSyncBusy) return;

    setFavoriteSyncError(null);

    if (favorites.length >= MAX_FAVORITES) {
      setMaxFavoriteNotice(true);
      return;
    }

    setMaxFavoriteNotice(false);

    const alreadyExists = favorites.some(
      (favorite) =>
        favorite.entityId === suggestion.id ||
        favorite.label.trim().toLowerCase() ===
          suggestion.name.trim().toLowerCase(),
    );

    if (alreadyExists) {
      setFavInput("");
      setSuggestions([]);
      return;
    }

    const nextFavorite: FavoriteItem = {
      label: suggestion.name,
      entityId: suggestion.id,
      type: suggestion.type,
      sport: suggestion.sport,
    };

    const previousFavorites = favorites;
    const nextFavorites = [...favorites, nextFavorite];

    setFavoriteSyncError(null);
    setFavorites(nextFavorites);
    writeRecentSelection(sport, suggestion);

    setFavInput("");
    setSuggestions([]);

    try {
      setFavoriteSyncBusy(true);

      await syncFavoriteAddRequest({
        deviceId: getDeviceId(),
        entityId: suggestion.id,
        name: suggestion.name,
        sport: suggestion.sport,
        type: suggestion.type,
      });

      if (nextFavorites.length === MAX_FAVORITES) {
        setTimeout(() => {
          doneButtonRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 150);
      }
    } catch (error) {
      setFavorites(previousFavorites);
      setFavoriteSyncError(normalizeFavoriteSyncError(error));
    } finally {
      setFavoriteSyncBusy(false);
    }
  }

  async function handleRemoveFavorite(favorite: FavoriteItem): Promise<void> {
    if (favoriteSyncBusy) return;

    const previousFavorites = favorites;
    const nextFavorites = favorites.filter(
      (item) =>
        !(
          item.label === favorite.label &&
          item.entityId === favorite.entityId
        ),
    );

    setFavoriteSyncError(null);
    setMaxFavoriteNotice(false);
    setFavorites(nextFavorites);

    try {
      setFavoriteSyncBusy(true);

      await syncFavoriteRemoveRequest({
        deviceId: getDeviceId(),
        entityId: favorite.entityId,
        name: favorite.label,
        sport: favorite.sport,
        type: favorite.type,
      });
    } catch (error) {
      setFavorites(previousFavorites);
      setFavoriteSyncError(normalizeFavoriteSyncError(error));
    } finally {
      setFavoriteSyncBusy(false);
    }
  }

  async function handleClearAllFavorites(): Promise<void> {
    if (favoriteSyncBusy || favorites.length === 0) return;

    const previousFavorites = favorites;

    setFavoriteSyncError(null);
    setMaxFavoriteNotice(false);
    setFavorites([]);

    try {
      setFavoriteSyncBusy(true);

      await syncFavoriteClearAllRequest(getDeviceId());
    } catch (error) {
      setFavorites(previousFavorites);
      setFavoriteSyncError(normalizeFavoriteSyncError(error));
    } finally {
      setFavoriteSyncBusy(false);
    }
  }

  function handleShowMore(): void {
    const newLimit = displayLimit === 12 ? sortedItems.length : 12;
    setGlobalDisplayLimit(newLimit);
    setDisplayLimit(newLimit);
  }

  return (
    <div className="sm-panel relative flex min-h-[400px] flex-col overflow-visible rounded-2xl">
      <div className="flex flex-nowrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <div className="min-w-0 flex items-center gap-2 text-base font-semibold text-slate-50 sm:text-lg">
          <span className="text-xl">{sport === "football" ? "⚽" : "🏒"}</span>
          <span className="truncate uppercase italic font-black tracking-tighter">
            {title}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setPanelOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="flex-shrink-0 whitespace-nowrap rounded-xl border border-[#DAB661]/40 bg-[#DAB661]/10 px-4 py-2 text-[13px] font-semibold text-[#DAB661] transition-all hover:border-[#DAB661] hover:bg-[#DAB661]/20"
        >
          ★ Anpassa ditt flöde
        </button>
      </div>

      <div className="mt-2 px-5 pb-3">
        <div className="h-[6px] w-30 overflow-hidden rounded-full bg-slate-700/35">
          <div
            className="h-[6px] rounded-full transition-all ease-linear"
            style={{
              backgroundColor: sport === "football" ? "#48953e" : "#38bdf8",
              width: `${progress}%`,
              transitionDuration: progress === 100 ? `${POLL_MS}ms` : "0ms",
            }}
          />
        </div>
      </div>

      <ul className="flex flex-1 flex-col gap-3 p-4">
        {isLoading && items.length === 0 ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((index) => (
              <div
                key={index}
                className="h-24 w-full rounded-xl bg-slate-800/40"
              />
            ))}
          </div>
        ) : (
          visibleItems.map((item) => {
            const key = String(item.id ?? item.url);
            const badge = getBadgeInfo(item.title, item.tags);
            const favoriteLabels = extractFavoriteLabels(item);
            const favoriteMatch =
              favoriteLabels.length > 0 || item.favorite_match === true;
            const isLocal = item.is_local === true;

            return (
              <li
                key={key}
                className={`relative overflow-hidden rounded-xl border transition-all duration-200 ${
                  favoriteMatch
                    ? "border-[#DAB661]/20 bg-[#DAB661]/5 shadow-sm"
                    : "border-white/5 bg-slate-950/40 hover:border-white/10 hover:bg-slate-900/20"
                }`}
              >
                {favoriteMatch && (
                  <div
                    className="absolute bottom-0 left-0 top-0 w-1"
                    style={{ backgroundColor: brandGold }}
                  />
                )}

                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    handleMarkAsRead(item);
                    void logNewsClick(item);
                  }}
                  className="block px-4 py-3.5"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      {badge && (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      )}

                      {isLocal && (
                        <span className="lokal-badge-glow rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          📍 LOKALT
                        </span>
                      )}

                      <style>{`
                        @keyframes pulsing-glow {
                          0%, 100% {
                            box-shadow: 0 0 5px rgba(220, 38, 38, 0.5);
                            border-color: rgba(220, 38, 38, 0.5);
                          }
                          50% {
                            box-shadow:
                              0 0 15px rgba(220, 38, 38, 0.9),
                              0 0 25px rgba(220, 38, 38, 0.6);
                            border-color: rgba(220, 38, 38, 0.9);
                          }
                        }

                        .lokal-badge-glow {
                          animation: pulsing-glow 2s ease-in-out infinite;
                          border: 2px solid rgba(220, 38, 38, 0.5) !important;
                        }
                      `}</style>

                      {favoriteLabels.map((label) => (
                        <span
                          key={`${key}:favorite:${label}`}
                          style={{ color: brandGold }}
                          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                        >
                          ★ {label}
                        </span>
                      ))}

                      <span className="sm-dim text-[10px]">
                        {item.source} • {timeAgo(item.published_at, nowMs)}
                      </span>
                    </div>

                    <div className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100">
                      {item.title}
                    </div>
                  </div>
                </a>
              </li>
            );
          })
        )}
      </ul>

      {!isLoading && sortedItems.length > 12 && (
        <div className="px-4 pb-6 pt-2">
          <button
            type="button"
            onClick={handleShowMore}
            className="w-full rounded-xl border border-white/5 bg-slate-900/40 py-3 text-sm font-semibold text-slate-400 transition hover:bg-slate-800/60 hover:text-white"
          >
            {displayLimit === 12
              ? `Visa alla nyheter (${sortedItems.length} totalt)`
              : "Visa bara de 12 första nyheterna"}
          </button>
        </div>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-[5vh] backdrop-blur-md sm:pt-[10vh]">
          <div
            ref={popoverRef}
            className="animate-in fade-in zoom-in-95 w-full max-w-[560px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-[0_0_50px_rgba(0,0,0,0.8)] duration-200"
          >
            <div className="flex items-start justify-between border-b border-slate-800 bg-slate-900/40 p-6">
              <div>
                <h2 className="text-xl font-bold uppercase italic text-white">
                  Anpassa ditt flöde
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Välj upp till {MAX_FAVORITES} lag, spelare eller ligor du vill följa.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-8 p-6">
              <div className="space-y-4">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Notiser
                </label>
                <EnablePushButton />
              </div>

              <div className="space-y-4">
                <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Flöde
                </label>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <span className="text-sm font-bold italic text-slate-100">
                      Sortera favoriter först
                    </span>

                    <ToggleSwitch
                      checked={settings.favoritesFirst}
                      label="Sortera favoriter först"
                      onChange={() =>
                        setSettings((current) => ({
                          ...current,
                          favoritesFirst: !current.favoritesFirst,
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <span className="text-sm font-bold italic text-slate-100">
                      Göm lästa
                    </span>

                    <ToggleSwitch
                      checked={settings.hideRead}
                      label="Göm lästa"
                      onChange={() =>
                        setSettings((current) => ({
                          ...current,
                          hideRead: !current.hideRead,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <select
                    value={entityType}
                    onChange={(event) => {
                      setEntityType(event.target.value as EntityType);
                      setSuggestions([]);
                      setFavoriteSyncError(null);
                      setMaxFavoriteNotice(false);
                    }}
                    className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-white outline-none"
                  >
                    <option value="all">Kategori</option>
                    <option value="player">👤 Spelare</option>
                    <option value="team">🛡️ Lag</option>
                    <option value="league">🏆 Liga</option>
                  </select>

                  <input
                    ref={inputRef}
                    value={favInput}
                    onChange={(event) => {
                      setFavInput(event.target.value);
                      setFavoriteSyncError(null);
                      setMaxFavoriteNotice(false);
                    }}
                    placeholder="Sök på spelare, lag eller liga"
                    className="flex-1 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-white outline-none"
                  />
                </div>

                {shouldShowSuggestionsBox && (
                  <div className="max-h-[30vh] overflow-auto rounded-2xl border border-slate-800 bg-black/20">
                    {isSuggesting ? (
                      <div className="p-4 text-sm text-slate-400">Söker...</div>
                    ) : suggestions.length > 0 ? (
                      suggestions.map((suggestion) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => void handleAddFavorite(suggestion)}
                          onMouseEnter={() => {
                            if (favorites.length >= MAX_FAVORITES) {
                              setMaxFavoriteNotice(true);
                            }
                          }}
                          onFocus={() => {
                            if (favorites.length >= MAX_FAVORITES) {
                              setMaxFavoriteNotice(true);
                            }
                          }}
                          title={
                            favorites.length >= MAX_FAVORITES
                              ? `Du har valt max ${MAX_FAVORITES} favoriter. Ta bort en favorit för att lägga till en ny.`
                              : undefined
                          }
                          disabled={favoriteSyncBusy}
                          className={`flex w-full items-center justify-between border-b border-slate-800/50 p-4 text-left text-sm text-white transition hover:bg-[#DAB661]/5 ${
                            favoriteSyncBusy ? "cursor-not-allowed opacity-60" : ""
                          }`}
                        >
                          <span className="flex items-center gap-4">
                            <span>{suggestion.icon || "🛡️"}</span>
                            {suggestion.name}
                          </span>
                          <span style={{ color: brandGold }}>+</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-slate-500">
                        Inga träffar ännu.
                      </div>
                    )}
                  </div>
                )}

                {maxFavoriteNotice && favorites.length >= MAX_FAVORITES && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-200">
                    Du har valt max {MAX_FAVORITES} favoriter. Ta bort en favorit för att lägga till en ny.
                  </div>
                )}

                <div className="space-y-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-4">
                  <div className="flex flex-wrap gap-2.5">
                    {favorites.length > 0 ? (
                      favorites.map((favorite) => (
                        <span
                          key={`${favorite.label}:${favorite.entityId ?? "none"}`}
                          style={{
                            backgroundColor: `${brandGold}20`,
                            color: brandGold,
                          }}
                          className="flex items-center gap-3 rounded-xl border border-[#DAB661]40 px-4 py-2 text-xs font-bold"
                        >
                          {favorite.label}
                          <button
                            type="button"
                            disabled={favoriteSyncBusy}
                            onClick={() => void handleRemoveFavorite(favorite)}
                            className={favoriteSyncBusy ? "opacity-60" : ""}
                          >
                            ✕
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        Inga favoriter valda.
                      </span>
                    )}
                  </div>

                  {favoriteSyncBusy && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                      Synkar favoriter mot servern...
                    </div>
                  )}

                  {favoriteSyncError && (
                    <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                      {favoriteSyncError}
                    </div>
                  )}

                  {favorites.length > 0 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleClearAllFavorites()}
                        disabled={favoriteSyncBusy}
                        className={`rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white ${
                          favoriteSyncBusy ? "opacity-60" : ""
                        }`}
                      >
                        Rensa favoriter
                      </button>
                    </div>
                  )}
                </div>

                <button
                  ref={doneButtonRef}
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  style={{ backgroundColor: brandGold }}
                  className="w-full rounded-2xl py-4 text-sm font-black uppercase italic tracking-widest text-slate-950"
                >
                  KLAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
