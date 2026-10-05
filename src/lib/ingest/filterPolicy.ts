// src/lib/ingest/filterPolicy.ts

/* ==========================================================================
   FILTER POLICY
   SportMonitor 2.0
   --------------------------------------------------------------------------
   Ansvar:
   - Hålla central policy för innehåll som inte hör hemma i appen
   - Upprätthålla herr-scope för fotboll och hockey vid ingest
   - Normalisera text för robust matchning
   - Exponera rena filterhelpers till ingest-lagret
   ========================================================================== */

const OTHER_SPORT_KEYWORDS = [
  "alpint",
  "bandy",
  "bandy-vm",
  "basket",
  "biathlon",
  "f1",
  "formel 1",
  "friidrott",
  "friidrotts-vm",
  "golf",
  "handboll",
  "längdskidor",
  "orientering",
  "padel",
  "simning",
  "skidor",
  "skid-sm",
  "skid-vm",
  "skidskytte",
  "skidskytt",
  "slalom",
  "störtlopp",
  "tennis",
  "trav",
  "v75",
  "vasaloppet",
  "vinterstudion",
] as const;

/**
 * NON-REGRESSION:
 * SportMonitor football/hockey is men's senior sport unless a future product
 * decision explicitly introduces a separate women's product surface.
 *
 * Keep this list conservative: a false positive here removes an article before
 * entity detection, ranking and persistence.
 */
const WOMENS_SPORT_KEYWORDS = [
  // Svenska termer och tävlingar
  "dam-bandy",
  "dam-em",
  "dam-vm",
  "damallsvensk",
  "damallsvenskan",
  "damfotboll",
  "damhockey",
  "damkronorna",
  "damlag",
  "damlandslag",
  "damlandslaget",
  "damspelare",
  "damspelarna",
  "damserie",
  "damserien",
  "damernas",
  "elitettan",
  "flicklandslaget",
  "flickor",
  "sdhl",
  "u17-damer",
  "u19-damer",
  "f17",
  "f19",

  // Engelska/internationella termer och vanliga tävlingsmarkörer
  "women's super league",
  "womens super league",
  "women's champions league",
  "womens champions league",
  "uefa women's champions league",
  "uefa womens champions league",
  "wsl",
  "uwcl",
  "nwsl",
  "a-league women",
  "women",
  "women's",
  "womens",
  "ladies",
  "female",

  // Vanliga icke-engelska könsmarkörer i internationella källor
  "frauen-bundesliga",
  "frauen bundesliga",
  "frauen",
  "femminile",
  "femenil",
  "femenino",
  "feminina",
  "feminine",
] as const;

// Verified full identities only; never infer scope from a first name.
// AIK identifies Nova Selin as a damlag player:
// https://www.aikfotboll.se/spelare/2025-dam-nova-selin
const VERIFIED_WOMENS_FOOTBALL_ENTITIES = ["nova selin"] as const;

/* ==========================================================================
   NORMALIZATION
   ========================================================================== */

export function normalizeFilterText(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalizedKeyword(
  normalizedText: string,
  keyword: string,
): boolean {
  return normalizedText.includes(normalizeFilterText(keyword));
}

/* ==========================================================================
   PUBLIC FILTER API
   ========================================================================== */

/**
 * Returnerar true när texten tydligt beskriver dam-/kvinnofotboll eller
 * dam-/kvinnohockey. Körs på sammanslagen title + url + summary + tags +
 * source + feednamn innan artikeln får gå vidare i ingest-pipelinen.
 */
export function isWomensSportContent(text: string): boolean {
  const normalizedText = normalizeFilterText(text);

  if (!normalizedText) return false;

  if (
    WOMENS_SPORT_KEYWORDS.some((keyword) =>
      containsNormalizedKeyword(normalizedText, keyword),
    )
  ) {
    return true;
  }

  if (
    /\b(aik|fotboll|football)\b/u.test(normalizedText) &&
    VERIFIED_WOMENS_FOOTBALL_ENTITIES.some((name) => {
      const pattern = name.split(" ").join("[\\s-]+");
      return new RegExp(`(?:^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, "u").test(
        normalizedText,
      );
    })
  ) {
    return true;
  }

  // Svenska könsmarkörer som egna ord. Detta undviker t.ex. "Damian".
  if (/\b(dam|damer|kvinna|kvinnor|kvinnlig|kvinnliga)\b/i.test(normalizedText)) {
    return true;
  }

  // Engelska könsmarkörer som egna ord.
  if (/\b(woman|women|womens|ladies|female)\b/i.test(normalizedText)) {
    return true;
  }

  // Ungdomsdammarkörer.
  if (/\b(f17|f19|u17 damer|u19 damer)\b/i.test(normalizedText)) {
    return true;
  }

  return false;
}

/**
 * Returnerar true om texten innehåller innehåll som inte hör hemma i appen.
 * Tänkt att köras på title + url + summary + tags + source + feednamn.
 */
export function isIrrelevantSport(text: string): boolean {
  const normalizedText = normalizeFilterText(text);

  if (!normalizedText) return false;

  if (isWomensSportContent(normalizedText)) {
    return true;
  }

  return OTHER_SPORT_KEYWORDS.some((keyword) =>
    containsNormalizedKeyword(normalizedText, keyword),
  );
}

/** Shared read/dispatch guard also protects against rows already stored. */
export function isMensScopeArticle(article: {
  title?: string | null;
  url?: string | null;
  summary?: string | null;
  tags?: unknown;
  source?: string | null;
  sport?: string | null;
}): boolean {
  const tags = Array.isArray(article.tags)
    ? article.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  return !isWomensSportContent(
    [article.title, article.url, article.summary, ...tags, article.source, article.sport]
      .filter(Boolean)
      .join(" "),
  );
}
