// web/src/lib/rss.ts

/* ==========================================================================
   TYPES
   ========================================================================== */

export type ParsedItem = {
  title: string;
  url: string;
  published_at?: string | null;
  source?: string | null;
  summary?: string | null;
  tags?: string[];
};

/* ==========================================================================
   TEXT CLEANUP HELPERS
   ========================================================================== */

function stripCdata(value: string): string {
  return value.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/g, "");
}

function stripHtml(value: string): string {
  return value.replace(/<\/?[^>]+>/g, " ");
}

function decodeEntities(input: string): string {
  let output = input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");

  output = output.replace(/&#x([0-9a-fA-F]+);/g, (full, hex) => {
    const code = parseInt(hex, 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : full;
  });

  output = output.replace(/&#([0-9]+);/g, (full, num) => {
    const code = parseInt(num, 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : full;
  });

  return output;
}

function cleanText(value: string): string {
  return decodeEntities(stripHtml(stripCdata(value ?? "")))
    .replace(/\s+/g, " ")
    .trim();
}

/* ==========================================================================
   XML TAG HELPERS
   ========================================================================== */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTag(block: string, tag: string): string | null {
  const safeTag = escapeRegex(tag);
  const match = block.match(
    new RegExp(`<${safeTag}\\b[^>]*>([\\s\\S]*?)</${safeTag}>`, "i"),
  );

  return match ? match[1] : null;
}

function getAllTagValues(block: string, tag: string): string[] {
  const safeTag = escapeRegex(tag);

  return Array.from(
    block.matchAll(
      new RegExp(`<${safeTag}\\b[^>]*>([\\s\\S]*?)</${safeTag}>`, "gi"),
    ),
  ).map((match) => match[1]);
}

/* ==========================================================================
   FEED TYPE DETECTION
   ========================================================================== */

function inferIsAtom(xml: string): boolean {
  return /<feed\b[^>]*>/i.test(xml) && /<entry\b[^>]*>/i.test(xml);
}

/* ==========================================================================
   LINK EXTRACTION
   ========================================================================== */

function getLinkFromAtomEntry(block: string): string | null {
  const alternateMatch =
    block.match(
      /<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i,
    ) ?? block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);

  return alternateMatch ? alternateMatch[1] : null;
}

function getLinkFromRssItem(block: string): string | null {
  const rssLink = getTag(block, "link");
  if (rssLink) return rssLink;

  const guidMatch = block.match(
    /<guid\b[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i,
  );

  return guidMatch ? guidMatch[1] : null;
}

function getBestLink(block: string, isAtom: boolean): string | null {
  const rawLink = isAtom
    ? getLinkFromAtomEntry(block)
    : getLinkFromRssItem(block);

  const cleanedLink = cleanText(rawLink ?? "");
  return cleanedLink || null;
}

/* ==========================================================================
   VALUE NORMALIZATION
   ========================================================================== */

function parseDateToIso(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value ?? "");
    if (!cleaned) continue;

    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(cleaned);
  }

  return output;
}

/* ==========================================================================
   TAG EXTRACTION
   ========================================================================== */

function getAtomCategoryTerms(block: string): string[] {
  const results: string[] = [];

  const termValues = Array.from(
    block.matchAll(/<category\b[^>]*term=["']([^"']+)["'][^>]*\/?>/gi),
  ).map((match) => match[1]);

  const labelValues = Array.from(
    block.matchAll(/<category\b[^>]*label=["']([^"']+)["'][^>]*\/?>/gi),
  ).map((match) => match[1]);

  const innerTextValues = getAllTagValues(block, "category");

  results.push(...termValues, ...labelValues, ...innerTextValues);

  return dedupeStrings(results);
}

function getRssCategoryTerms(block: string): string[] {
  const categoryValues = getAllTagValues(block, "category");
  const dcSubjectValues = getAllTagValues(block, "dc:subject");
  const mediaKeywordValues = getAllTagValues(block, "media:keywords").flatMap(
    (value) => String(value ?? "").split(","),
  );

  return dedupeStrings([
    ...categoryValues,
    ...dcSubjectValues,
    ...mediaKeywordValues,
  ]);
}

/* ==========================================================================
   CONTENT EXTRACTION
   ========================================================================== */

function getBestSummary(block: string, isAtom: boolean): string | null {
  const candidates = isAtom
    ? [
        getTag(block, "summary"),
        getTag(block, "content"),
        getTag(block, "description"),
      ]
    : [
        getTag(block, "description"),
        getTag(block, "content:encoded"),
        getTag(block, "content"),
        getTag(block, "summary"),
      ];

  const parts = dedupeStrings(candidates);

  if (!parts.length) return null;

  return parts.join(" ");
}

function mapBlocksToItems(blocks: string[], isAtom: boolean): ParsedItem[] {
  return blocks
    .map((block) => {
      const rawTitle = getTag(block, "title") ?? "";
      const title = cleanText(rawTitle);
      const url = getBestLink(block, isAtom);

      if (!title || !url) return null;

      const pubDate = getTag(block, "pubDate");
      const published = getTag(block, "published");
      const updated = getTag(block, "updated");
      const issued = getTag(block, "issued");

      const published_at =
        parseDateToIso(pubDate) ??
        parseDateToIso(published) ??
        parseDateToIso(updated) ??
        parseDateToIso(issued);

      const rawSource =
        getTag(block, "source") ??
        getTag(getTag(block, "author") ?? "", "name") ??
        "";

      const source = cleanText(rawSource) || null;
      const summary = getBestSummary(block, isAtom);
      const tags = isAtom ? getAtomCategoryTerms(block) : getRssCategoryTerms(block);

      return {
        title,
        url,
        published_at,
        source,
        summary,
        tags,
      } satisfies ParsedItem;
    })
    .filter(Boolean) as ParsedItem[];
}

/* ==========================================================================
   PUBLIC API
   ========================================================================== */

export async function parseRssFeed(feedUrl: string): Promise<ParsedItem[]> {
  const response = await fetch(feedUrl, {
    cache: "no-store",
    headers: {
      "User-Agent": "SportMonitor/1.0 (+https://www.sportmonitor.se)",
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `RSS fetch failed: ${response.status} ${response.statusText}`,
    );
  }

  const xml = await response.text();
  const isAtom = inferIsAtom(xml);

  const rssItemBlocks = Array.from(
    xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi),
  ).map((match) => match[1]);

  const atomEntryBlocks = Array.from(
    xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi),
  ).map((match) => match[1]);

  const primaryBlocks = isAtom ? atomEntryBlocks : rssItemBlocks;

  if (primaryBlocks.length === 0) {
    const fallbackBlocks = rssItemBlocks.length ? rssItemBlocks : atomEntryBlocks;
    const fallbackIsAtom = atomEntryBlocks.length > 0;
    return mapBlocksToItems(fallbackBlocks, fallbackIsAtom);
  }

  return mapBlocksToItems(primaryBlocks, isAtom);
}