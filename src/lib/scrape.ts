// web/src/lib/scrape.ts

import * as cheerio from "cheerio";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type ScrapedItem = {
  title: string;
  url: string;
  published_at: string | null;
  source: string;
};

/* ==========================================================================
   GENERIC HELPERS
   ========================================================================== */

function normalizeWs(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function absolutify(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function uniqByUrl(items: ScrapedItem[]): ScrapedItem[] {
  const map = new Map<string, ScrapedItem>();

  for (const item of items) {
    if (!item?.url) continue;
    if (!map.has(item.url)) {
      map.set(item.url, item);
    }
  }

  return Array.from(map.values());
}

function extractIsoDate(value: string): string | null {
  const match = String(value ?? "").match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (!match) return null;

  const timestamp = Date.parse(`${match[1]}T12:00:00Z`);
  if (Number.isNaN(timestamp)) return null;

  return new Date(timestamp).toISOString();
}

function isBadCommon(url: string, title: string): boolean {
  const normalizedTitle = title.toLowerCase();

  if (!title || title.length < 10) return true;
  if (normalizedTitle === "skip to content") return true;
  if (url.includes("#")) return true;
  if (url.includes("/tag/")) return true;
  if (url.includes("/category/")) return true;
  if (url.endsWith("/feed/")) return true;

  return false;
}

function looksLikeArticleSlug(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);

    if (segments.length < 1) return false;
    if (!pathname.includes("-")) return false;

    return true;
  } catch {
    return false;
  }
}

/* ==========================================================================
   EXTRACTION HELPERS
   ========================================================================== */

function extractLinkCandidates(
  $: cheerio.CheerioAPI,
  selectors: string,
  baseUrl: string,
  allowedHostFragment: string,
  source: string,
): ScrapedItem[] {
  const items: ScrapedItem[] = [];

  $(selectors).each((_, element) => {
    const href = String($(element).attr("href") ?? "").trim();
    const title = normalizeWs($(element).text());

    if (!href || !title) return;

    const absoluteUrl = absolutify(baseUrl, href);

    if (!absoluteUrl.includes(allowedHostFragment)) return;
    if (isBadCommon(absoluteUrl, title)) return;
    if (!looksLikeArticleSlug(absoluteUrl)) return;

    items.push({
      title,
      url: absoluteUrl,
      published_at: null,
      source,
    });
  });

  return items;
}

/* ==========================================================================
   ANNO 1904 FILTERS
   ========================================================================== */

const ANNO1904_FOOTBALL_HINTS = [
  "fotboll",
  "superettan",
  "allsvenskan",
  "svenska cupen",
  "cupen",
  "silly",
  "transfer",
  "värv",
  "värvning",
  "nyförvärv",
  "kontrakt",
  "träningsmatch",
  "herr",
  "forward",
  "anfallare",
  "mittfält",
  "back",
  "målvakt",
  "vsk fotboll",
];

const ANNO1904_BANDY_BLOCK = [
  "bandy",
  "bandylag",
  "elitserien",
  "villa",
  "edsbyn",
  "västerås bandy",
];

const ANNO1904_BAD_PAGE_FRAGMENTS = [
  "/vsk-ramsor/",
  "/anno-1904-i-sociala-medier",
  "/kontakt",
  "/om-",
];

function isAllowedAnno1904FallbackUrl(url: string): boolean {
  return !ANNO1904_BAD_PAGE_FRAGMENTS.some((fragment) => url.includes(fragment));
}

function isRelevantAnno1904Item(item: ScrapedItem): boolean {
  const haystack = `${item.title} ${item.url}`.toLowerCase();

  if (ANNO1904_BANDY_BLOCK.some((word) => haystack.includes(word))) {
    return false;
  }

  if (!ANNO1904_FOOTBALL_HINTS.some((word) => haystack.includes(word))) {
    return false;
  }

  return true;
}

/* ==========================================================================
   SITE SCRAPERS
   ========================================================================== */

/**
 * ANNO1904: plockar ut artikel-länkar från sidan
 */
export async function scrapeAnno1904(): Promise<ScrapedItem[]> {
  const baseUrl = "https://www.anno1904.se/tag/herrfotboll/";
  const response = await fetch(baseUrl, {
    headers: { "User-Agent": "SportMonitorBot/1.0" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`anno1904 fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const items: ScrapedItem[] = [];

  $("article").each((_, article) => {
    const $article = $(article);
    const $link = $article.find("a[href]").filter((__, link) => {
      const href = String($(link).attr("href") ?? "").trim();
      const title = normalizeWs($(link).text());
      if (!href || !title) return false;

      const absoluteUrl = absolutify(baseUrl, href);
      return (
        absoluteUrl.includes("anno1904.se") &&
        !isBadCommon(absoluteUrl, title) &&
        isAllowedAnno1904FallbackUrl(absoluteUrl) &&
        looksLikeArticleSlug(absoluteUrl)
      );
    }).first();

    if ($link.length === 0) return;

    const href = String($link.attr("href") ?? "").trim();
    const title = normalizeWs($link.text());
    const url = absolutify(baseUrl, href);

    const datetime = String(
      $article.find("time[datetime]").first().attr("datetime") ?? "",
    ).trim();

    const publishedAt =
      extractIsoDate(datetime) ?? extractIsoDate(normalizeWs($article.text()));

    // ANNO 1904 must never turn an undated archive item into "new now".
    if (!publishedAt) return;

    items.push({
      title,
      url,
      published_at: publishedAt,
      source: "ANNO 1904",
    });
  });

  return uniqByUrl(items).slice(0, 60);
}

/**
 * VSK Fotboll – herrlag nyheter
 */
export async function scrapeVskHerrlag(): Promise<ScrapedItem[]> {
  const baseUrl = "https://www.vskfotboll.nu/nyheter/herrlag/";
  const response = await fetch(baseUrl, {
    headers: { "User-Agent": "SportMonitorBot/1.0" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`vsk fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  let items = extractLinkCandidates(
    $,
    "main a[href], article a[href]",
    baseUrl,
    "vskfotboll.nu",
    "VSK Fotboll",
  );

  if (items.length < 8) {
    items = [
      ...items,
      ...extractLinkCandidates(
        $,
        "a[href]",
        baseUrl,
        "vskfotboll.nu",
        "VSK Fotboll",
      ),
    ];
  }

  return uniqByUrl(items).slice(0, 60);
}

const OLANDSBLADET_KALMAR_FF_HINTS = ["kalmar ff", "kff"] as const;
const OLANDSBLADET_KALMAR_FF_BLOCK = [
  "/sport/resultat",
  "/kronikor/",
  "/ledare/",
  "/insandare/",
] as const;

function isRelevantOlandsbladetKalmarFFItem(item: ScrapedItem): boolean {
  const haystack = `${item.title} ${item.url}`.toLowerCase();

  if (!haystack.includes("/sport/")) {
    return false;
  }

  if (OLANDSBLADET_KALMAR_FF_BLOCK.some((token) => haystack.includes(token))) {
    return false;
  }

  return OLANDSBLADET_KALMAR_FF_HINTS.some((token) => haystack.includes(token));
}

/**
 * Ölandsbladet – Kalmar FF-spår.
 * Defensiv scrape som endast släpper igenom länkar med tydlig KFF-signal.
 */
export async function scrapeOlandsbladetKalmarFF(): Promise<ScrapedItem[]> {
  const baseUrl =
    "https://www.olandsbladet.se/organisation/cdfdee1b-c997-38cc-950b-c28ac89d6eff?pageSlug=kalmar-ff";

  const response = await fetch(baseUrl, {
    headers: { "User-Agent": "SportMonitorBot/1.0" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`olandsbladet fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  let items = extractLinkCandidates(
    $,
    'main a[href*="/sport/"], article a[href*="/sport/"]',
    baseUrl,
    "olandsbladet.se",
    "Ölandsbladet – Kalmar FF",
  );

  if (items.length < 6) {
    items = [
      ...items,
      ...extractLinkCandidates(
        $,
        'a[href*="/sport/"]',
        baseUrl,
        "olandsbladet.se",
        "Ölandsbladet – Kalmar FF",
      ),
    ];
  }

  return uniqByUrl(items).filter(isRelevantOlandsbladetKalmarFFItem).slice(0, 60);
}
