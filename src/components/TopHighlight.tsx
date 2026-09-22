"use client";

import { useEffect, useRef, useState } from "react";
import type { NewsItem, Sport } from "@/lib/types";
import Badge from "@/components/Badge";
import { getDeviceId } from "@/lib/deviceId";

const brandGold = "#DAB661";
const POLL_MS = 45_000;
const HIGHLIGHT_LIMIT_PER_SPORT = 10;
const FRESHNESS_WINDOW_MS = 90 * 60_000;
const TIE_WINDOW_MS = 20 * 60_000;

type StoredFavorite = {
  label?: string | null;
  type?: string | null;
};

type Pick = {
  item: NewsItem;
  favMatch: boolean;
  rankingTotal: number;
  hasSpecialSignal: boolean;
} | null;

function storageKey(sport: Sport): string {
  return `sm:favorites:v3:${sport}`;
}

function getActiveFavoritesForSport(
  sport: Sport,
): Array<{ label: string; type: string | null }> {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(storageKey(sport));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      favorites?: StoredFavorite[];
    };

    if (!Array.isArray(parsed?.favorites)) {
      return [];
    }

    return parsed.favorites
      .map((favorite) => ({
        label:
          typeof favorite?.label === "string" ? favorite.label.trim() : "",
        type:
          typeof favorite?.type === "string" ? favorite.type.trim() : null,
      }))
      .filter((favorite) => favorite.label.length > 0);
  } catch {
    return [];
  }
}

function buildNewsUrl(
  sport: Sport,
  favorites: Array<{ label: string; type: string | null }>,
): string {
  const params = new URLSearchParams();

  params.set("sport", sport);
  params.set("limit", String(HIGHLIGHT_LIMIT_PER_SPORT));

  if (favorites.length > 0) {
    params.set("device_id", getDeviceId());
    params.set("personalized", "1");

    for (const favorite of favorites) {
      if (favorite.type) {
        params.append("fav", `${favorite.type}:${favorite.label}`);
      } else {
        params.append("fav", favorite.label);
      }
    }
  }

  return `/api/news?${params.toString()}`;
}

function getFavoriteMatch(item: NewsItem): boolean {
  return (item as { favorite_match?: boolean }).favorite_match === true;
}

function getRankingTotal(item: NewsItem): number {
  return (item as { ranking_total?: number }).ranking_total ?? 0;
}

function getPublishedAtMs(item: NewsItem): number {
  return new Date(item.published_at ?? 0).getTime();
}

function getUpperTags(item: NewsItem): string[] {
  if (!Array.isArray(item.tags)) return [];
  return item.tags
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toUpperCase());
}

export function isValidTopHighlightItem(item: NewsItem | null): item is NewsItem {
  if (!item?.title || !item?.url || !item?.published_at) {
    return false;
  }

  return Number.isFinite(getPublishedAtMs(item));
}

function hasSillySeasonSignal(item: NewsItem): boolean {
  const titleUpper = item.title.toUpperCase();
  const tagsUpper = getUpperTags(item);

  return (
    titleUpper.includes("SILLY SEASON") ||
    tagsUpper.includes("SILLY_SEASON") ||
    tagsUpper.includes("SILLY SEASON")
  );
}

function hasSparkenSignal(item: NewsItem): boolean {
  const titleUpper = item.title.toUpperCase();
  const tagsUpper = getUpperTags(item);

  return (
    titleUpper.includes("SPARKEN") ||
    titleUpper.includes("FÅR SPARKEN") ||
    titleUpper.includes("SACKED") ||
    titleUpper.includes("DISMISS") ||
    tagsUpper.includes("SPARKEN")
  );
}

export function hasTopHighlightSpecialSignal(item: NewsItem): boolean {
  const tagsUpper = getUpperTags(item);

  if (item.is_local === true) {
    return true;
  }

  if (tagsUpper.includes("JUST_NU") || tagsUpper.includes("HOT")) {
    return true;
  }

  return hasSillySeasonSignal(item) || hasSparkenSignal(item);
}

type Candidate = {
  item: NewsItem;
  favMatch: boolean;
  rankingTotal: number;
  publishedAtMs: number;
  hasSpecialSignal: boolean;
};

export function selectTopHighlightCandidate(
  candidates: NewsItem[],
  nowMs = Date.now(),
): Pick {
  const mapped = candidates
    .filter(isValidTopHighlightItem)
    .map((item): Candidate => ({
      item,
      favMatch: getFavoriteMatch(item),
      rankingTotal: getRankingTotal(item),
      publishedAtMs: getPublishedAtMs(item),
      hasSpecialSignal: hasTopHighlightSpecialSignal(item),
    }));

  if (mapped.length === 0) {
    return null;
  }

  const freshCandidates = mapped.filter(
    (candidate) => nowMs - candidate.publishedAtMs <= FRESHNESS_WINDOW_MS,
  );

  const candidatePool = freshCandidates.length > 0 ? freshCandidates : mapped;
  const freshestPublishedAtMs = candidatePool.reduce(
    (maxValue, candidate) => Math.max(maxValue, candidate.publishedAtMs),
    Number.NEGATIVE_INFINITY,
  );

  const tieBucket = candidatePool.filter(
    (candidate) => freshestPublishedAtMs - candidate.publishedAtMs <= TIE_WINDOW_MS,
  );

  const winner =
    tieBucket.sort((a, b) => {
      if (a.hasSpecialSignal !== b.hasSpecialSignal) {
        return a.hasSpecialSignal ? -1 : 1;
      }

      if (a.favMatch !== b.favMatch) {
        return a.favMatch ? -1 : 1;
      }

      if (b.rankingTotal !== a.rankingTotal) {
        return b.rankingTotal - a.rankingTotal;
      }

      return b.publishedAtMs - a.publishedAtMs;
    })[0] ?? null;

  if (!winner) return null;

  return {
    item: winner.item,
    favMatch: winner.favMatch,
    rankingTotal: winner.rankingTotal,
    hasSpecialSignal: winner.hasSpecialSignal,
  };
}

export default function TopHighlight() {
  const [pick, setPick] = useState<Pick>(null);
  const [isLoading, setIsLoading] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);

  async function load(): Promise<void> {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const footballFavorites = getActiveFavoritesForSport("football");
      const hockeyFavorites = getActiveFavoritesForSport("hockey");

      const [footballResponse, hockeyResponse] = await Promise.all([
        fetch(buildNewsUrl("football", footballFavorites), {
          cache: "no-store",
          signal: abortRef.current.signal,
          headers: { Accept: "application/json" },
        }),
        fetch(buildNewsUrl("hockey", hockeyFavorites), {
          cache: "no-store",
          signal: abortRef.current.signal,
          headers: { Accept: "application/json" },
        }),
      ]);

      if (!footballResponse.ok) {
        throw new Error(`football HTTP ${footballResponse.status}`);
      }

      if (!hockeyResponse.ok) {
        throw new Error(`hockey HTTP ${hockeyResponse.status}`);
      }

      const footballJson = await footballResponse.json();
      const hockeyJson = await hockeyResponse.json();

      const footballItems = (footballJson?.items ?? []) as NewsItem[];
      const hockeyItems = (hockeyJson?.items ?? []) as NewsItem[];
      const bestCandidate = selectTopHighlightCandidate([
        ...footballItems,
        ...hockeyItems,
      ]);

      if (!bestCandidate?.item) {
        setPick(null);
        return;
      }

      setPick(bestCandidate);
    } catch (error: unknown) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // behåll tidigare pick vid vanliga nätverksfel
      }
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      void load();
      pollTimer = setInterval(() => void load(), POLL_MS);
    };

    const stop = () => {
      if (pollTimer) clearInterval(pollTimer);

      pollTimer = null;
      abortRef.current?.abort();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    const onFavoritesChanged = () => {
      void load();
    };

    start();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(
      "sm:favorites:changed",
      onFavoritesChanged as EventListener,
    );
    window.addEventListener("storage", onFavoritesChanged);

    return () => {
      window.removeEventListener("storage", onFavoritesChanged);
      window.removeEventListener(
        "sm:favorites:changed",
        onFavoritesChanged as EventListener,
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
    };
  }, []);

  if (isLoading && !pick?.item) {
    return (
      <div className="sm-panel sm-glow rounded-2xl p-5">
        <div className="h-5 w-56 animate-pulse rounded bg-slate-800/60" />
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-slate-800/40" />
      </div>
    );
  }

  if (!pick?.item) {
    return null;
  }


  const item = pick.item;

  const backgroundUrl =
    item.sport === "football"
      ? "/backgrounds/football-bg.jpg"
      : "/backgrounds/hockey-bg.jpg";

  return (
    <>
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className={[
          "sm-glow block rounded-2xl p-0 transition",
          item.sport === "football"
            ? "sm-highlight-football"
            : "sm-highlight-hockey",
          pick.favMatch ? "ring-1 ring-[#DAB661]/25" : "",
          "hover:border-slate-600/60",
          "active:brightness-95",
          "relative overflow-hidden",
        ].join(" ")}
        style={{
          backgroundImage: `url('${backgroundUrl}')`,
          backgroundSize: "cover",
          backgroundPosition: "right center",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-transparent" />

        {item.sport === "football" ? (
          <div className="pointer-events-none absolute inset-0 sm-stadium-lights" />
        ) : null}

        {item.sport === "hockey" ? (
          <div className="pointer-events-none absolute inset-0 sm-ice-shimmer" />
        ) : null}

        <div className="relative z-10 p-5">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {pick.hasSpecialSignal ? (
                  <Badge variant="justnu">JUST NU</Badge>
                ) : null}
                {pick.favMatch ? (
                  <span
                    style={{
                      borderColor: `${brandGold}40`,
                      backgroundColor: `${brandGold}1a`,
                      color: brandGold,
                    }}
                    className="rounded-md border px-2 py-1 text-[11px] font-semibold"
                  >
                    ★ FAVORIT
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.01em] text-slate-50">
                {item.title}
              </div>

              <div className="mt-2 text-sm sm-dim">
                {item.source}
              </div>
            </div>
          </div>
        </div>
      </a>

      <style jsx>{`
        .sm-stadium-lights {
          background:
            radial-gradient(circle at 86% 18%, rgba(255, 255, 255, 0.18), transparent 42%),
            radial-gradient(circle at 74% 30%, rgba(255, 255, 255, 0.1), transparent 45%);
          animation: smPulse 2.8s ease-in-out infinite;
          mix-blend-mode: screen;
          opacity: 0.9;
        }

        @keyframes smPulse {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 0.7; }
        }

        .sm-ice-shimmer {
          background:
            linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.1) 22%, rgba(255, 255, 255, 0.04) 28%, transparent 42%),
            radial-gradient(circle at 82% 70%, rgba(180, 220, 255, 0.1), transparent 55%);
          background-size: 260% 100%, 100% 100%;
          background-position: 160% 0, 0 0;
          animation: smShimmer 4.6s ease-in-out infinite;
          mix-blend-mode: screen;
          opacity: 0.85;
        }

        @keyframes smShimmer {
          0% { background-position: 160% 0, 0 0; opacity: 0.65; }
          50% { background-position: 40% 0, 0 0; opacity: 0.95; }
          100% { background-position: -60% 0, 0 0; opacity: 0.65; }
        }
      `}</style>
    </>
  );
}
