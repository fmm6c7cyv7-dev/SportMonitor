// src/lib/news/newsDedupe.ts

import type { DbItem } from "@/lib/news/newsTypes";
import type { RankingEntity } from "@/lib/ranking/rankingTypes";
import {
  getSourceProfile,
  getSourceRegionalEligibilityPolicy,
  type SourceProfileCategory,
} from "@/lib/ranking/sourceProfiles";
import { scoreSourceSignal } from "@/lib/ranking-v2/scoreSource";

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const PERSON_WHITELIST = [
  "william nylander",
  "nylander",
  "viktor gyokeres",
  "gyokeres",
] as const;

const BANNED_SPORTS_HOCKEY = [
  "bowling",
  "innebandy",
  "floorball",
  "curling",
  "skidskytte",
  "alpint",
  "skidor",
  "rönnby",
  "vallentuna b",
  "uppsala b",
  "innebandylag",
  "ibs",
  "västeråsirsta",
] as const;

/**
 * Denna lista ska vara smal och bokstavlig.
 * Den används i route-lagret för just flaggan "isPremierOrAllsvenskan".
 */
const PREMIER_LEAGUE_OR_ALLSVENSKAN_TERMS = [
  "premier league",
  "epl",
  "allsvenskan",
] as const;

/* ==========================================================================
   BASIC HELPERS
   ========================================================================== */

function foldDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeToken(value: string): string {
  const raw = (value ?? "").trim();

  return foldDiacritics(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSourceSuffix(value: string): string {
  return value.replace(/\s+[-–—]\s+[^-–—]{2,40}$/u, "");
}

export function normalizeTitle(value: string): string {
  const raw = (value ?? "").trim();
  const noSuffix = stripSourceSuffix(raw);

  return foldDiacritics(noSuffix)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(just nu|live|klart|officiellt|uppgifter|uppgift)\b\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeNormalized(value: string): string[] {
  return normalizeToken(value).split(" ").filter(Boolean);
}

function containsNormalizedTerm(haystack: string, term: string): boolean {
  const normalizedHaystack = normalizeToken(haystack);
  const normalizedTerm = normalizeToken(term);

  if (!normalizedHaystack || !normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(" ")) {
    return normalizedHaystack.includes(normalizedTerm);
  }

  const tokens = tokenizeNormalized(normalizedHaystack);
  return tokens.includes(normalizedTerm);
}

function containsAnyNormalizedTerm(
  haystack: string,
  terms: readonly string[],
): boolean {
  return terms.some((term) => containsNormalizedTerm(haystack, term));
}

export function clampInt(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function msFromMinutes(minutes: number): number {
  return minutes * 60_000;
}

/* ==========================================================================
   SIMILARITY HELPERS
   ========================================================================== */

function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);

  let intersection = 0;
  for (const token of A) {
    if (B.has(token)) intersection += 1;
  }

  const union = A.size + B.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function trigrams(value: string): string[] {
  const text = `  ${value}  `.replace(/\s+/g, " ");
  const output: string[] = [];

  for (let i = 0; i < text.length - 2; i += 1) {
    output.push(text.slice(i, i + 3));
  }

  return output;
}

function trigramSim(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);

  const As = new Set(A);
  const Bs = new Set(B);

  let intersection = 0;
  for (const token of As) {
    if (Bs.has(token)) intersection += 1;
  }

  const union = As.size + Bs.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function titleSimilarity(normalizedA: string, normalizedB: string): number {
  return Math.max(
    jaccard(tokenize(normalizedA), tokenize(normalizedB)),
    trigramSim(normalizedA, normalizedB),
  );
}

/* ==========================================================================
   EVENT HELPERS
   ========================================================================== */

export function extractPersonKey(originalTitle: string): string | null {
  const normalizedTitle = normalizeTitle(originalTitle);

  for (const person of PERSON_WHITELIST) {
    if (containsNormalizedTerm(normalizedTitle, person)) {
      if (person.includes("nylander")) return "william_nylander";
      if (person.includes("gyokeres")) return "viktor_gyokeres";
      return person.replace(/\s+/g, "_");
    }
  }

  return null;
}

export function extractEventType(originalTitle: string): string | null {
  const normalizedTitle = normalizeTitle(originalTitle);

  if (/\b(saknas|saknad|saknade|franvar(o|a)nde)\b/.test(normalizedTitle)) {
    return "missing";
  }

  if (/\b(missar|missade)\b/.test(normalizedTitle)) {
    return "missing";
  }

  if (/\b(utanför|utanfor)\s+truppen\b/.test(normalizedTitle)) {
    return "missing";
  }

  if (/\b(petad|petades)\b/.test(normalizedTitle)) {
    return "missing";
  }

  if (/\b(skada|skadad|skadade|skadades)\b/.test(normalizedTitle)) {
    return "injury";
  }

  if (/\b(tr(a|ä)ning|tr(a|ä)nar|tr(a|ä)nade)\b/.test(normalizedTitle)) {
    return "training";
  }

  if (/\b(varvar\s+upp|stegrar|rehabtr(a|ä)nar)\b/.test(normalizedTitle)) {
    return "training";
  }

  if (/\b(comeback|a(ä|a)terkomst|tillbaka)\b/.test(normalizedTitle)) {
    return "return";
  }

  if (/\b(klart|officiellt|bekr(a|ä)ftat|presenteras)\b/.test(normalizedTitle)) {
    return "official";
  }

  if (
    /\b(v(a|ä)rvar|v(a|ä)rv|transfer|k(o|ö)ps|l(a|ä)mnar|l(a|ä)mnade|ansluter)\b/.test(
      normalizedTitle,
    )
  ) {
    return "transfer";
  }

  if (/\b(rykte|rykten|uppgifter|spekulation)\b/.test(normalizedTitle)) {
    return "rumor";
  }

  return null;
}

export function dayBucketISO(publishedAt: string): string | null {
  const date = new Date(publishedAt);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function eventKey(
  personKey: string,
  eventType: string | null,
  bucket: string | null,
): string | null {
  if (!personKey) return null;
  return `${personKey}|${eventType ?? "unknown"}|${bucket ?? "unknown"}`;
}

/* ==========================================================================
   CORE CONTENT HELPERS
   ========================================================================== */

export function isPremierLeagueOrAllsvenskan(
  normalizedTextOrTitle: string,
): boolean {
  const haystack = normalizeToken(normalizedTextOrTitle);
  return containsAnyNormalizedTerm(
    haystack,
    PREMIER_LEAGUE_OR_ALLSVENSKAN_TERMS,
  );
}

export function hasJuniorTeamPattern(normalizedTitle: string): boolean {
  return (
    /\b[uj](\d{1,2}|lag)\b/.test(normalizedTitle) ||
    /\bu\d{2}\b/.test(normalizedTitle) ||
    /\bj-lag\b/.test(normalizedTitle) ||
    /\bj\d{2}\b/.test(normalizedTitle) ||
    /\bjunior\b/.test(normalizedTitle)
  );
}

export function isBannedHockeyTitle(normalizedTitle: string): boolean {
  return containsAnyNormalizedTerm(normalizedTitle, BANNED_SPORTS_HOCKEY);
}

/* ==========================================================================
   STATEFUL DEDUPE PIPELINE
   ========================================================================== */

export type CanonicalDedupeContext = {
  entityIds?: string[];
  entities?: RankingEntity[];
};

type CanonicalArticleAngle = "news" | "analysis" | "followup";

export type DedupeState = {
  lastAcceptedBySource: Map<string, number>;
  lastTitleSeenBySource: Map<string, Map<string, number>>;
  recentAccepted: Array<{
    id: string;
    pubMs: number;
    normTitle: string;
    source: string;
    sourceQuality: number;
    canonicalSourceScore: number;
    eventType: string | null;
    angle: CanonicalArticleAngle;
    entityIds: string[];
    teamEntityIds: string[];
    personEntityIds: string[];
  }>;
  lastEventSeen: Map<string, number>;
};

export function createDedupeState(): DedupeState {
  return {
    lastAcceptedBySource: new Map<string, number>(),
    lastTitleSeenBySource: new Map<string, Map<string, number>>(),
    recentAccepted: [],
    lastEventSeen: new Map<string, number>(),
  };
}

const SOURCE_CATEGORY_DEDUPE_BONUS: Record<SourceProfileCategory, number> = {
  official_local: 0.4,
  local_media: 0.28,
  public_service_local: 0.28,
  aggregator_team_feed: 0.14,
  fan_community: 0.04,
};

const SOURCE_QUALITY_REPLACE_MARGIN = 0.12;
const CANONICAL_SOURCE_REPLACE_MARGIN = 0.08;
const ENTITY_EVENT_SIMILARITY_FLOOR = 0.45;
const MATCH_EVENT_SIMILARITY_FLOOR = 0.55;

function uniqueEntityIds(context?: CanonicalDedupeContext): string[] {
  const ids = new Set<string>();

  for (const id of context?.entityIds ?? []) {
    const normalized = String(id ?? "").trim();
    if (normalized) ids.add(normalized);
  }

  for (const entity of context?.entities ?? []) {
    const normalized = String(entity.id ?? "").trim();
    if (normalized) ids.add(normalized);
  }

  return Array.from(ids);
}

function entityIdsByType(
  context: CanonicalDedupeContext | undefined,
  types: Array<RankingEntity["type"]>,
): string[] {
  const allowed = new Set(types);
  const ids = new Set<string>();

  for (const entity of context?.entities ?? []) {
    const id = String(entity.id ?? "").trim();
    if (!id || !allowed.has(entity.type)) continue;
    ids.add(id);
  }

  return Array.from(ids);
}

function intersectionCount(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const bSet = new Set(b);
  return a.reduce((count, id) => count + (bSet.has(id) ? 1 : 0), 0);
}

function classifyArticleAngle(title: string): CanonicalArticleAngle {
  const normalized = normalizeTitle(title);

  if (
    /\b(analys|analysis|kronika|krönika|opinion|taktik|tactical|betyg|ratings|fem punkter|five reasons|explained)\b/u.test(
      normalized,
    )
  ) {
    return "analysis";
  }

  if (
    /\b(reaktion|reaction|sa gick det till|så gick det till|bakom kulisserna|details|detaljer|intervju|interview|why|darfor|därför)\b/u.test(
      normalized,
    )
  ) {
    return "followup";
  }

  return "news";
}

function canonicalEventType(title: string): string | null {
  const normalized = normalizeTitle(title);

  if (/\b(red card|rott kort|rött kort|utvisning|matchstraff)\b/u.test(normalized)) {
    return "red_card";
  }

  if (/\b(straff|penalty)\b/u.test(normalized)) {
    return "penalty";
  }

  if (
    /\b(goal|mal|mål|malskytt|målskytt|kvitterar|equaliser|equalizer|avgor|avgör|winner|matchvinnare|hattrick|vinstmal|vinstmål)\b/u.test(
      normalized,
    )
  ) {
    return "goal";
  }

  if (/\b(skada|skadad|injury|missar|out injured)\b/u.test(normalized)) {
    return "injury";
  }

  if (
    /\b(klart|officiellt|official|confirmed|done deal|here we go|signs|signerar|varvar|värvar|transfer|ny klubb)\b/u.test(
      normalized,
    )
  ) {
    return "transfer";
  }

  if (
    /\b(sparken|sacked|dismissed|avgar|avgår|resigns|ny tranare|ny tränare|appoint|appointed|tar over|tar över)\b/u.test(
      normalized,
    )
  ) {
    return "management";
  }

  if (
    /\b(vinner|vann|seger|besegrar|forlust|förlust|draw|oavgjort|wins|beats|defeats|lose|lost)\b/u.test(
      normalized,
    )
  ) {
    return "match_result";
  }

  return extractEventType(title);
}

function sameEventByEntities(args: {
  currentTitle: string;
  currentEventType: string | null;
  currentAngle: CanonicalArticleAngle;
  currentEntityIds: string[];
  currentTeamIds: string[];
  currentPersonIds: string[];
  accepted: DedupeState["recentAccepted"][number];
  similarity: number;
}): boolean {
  const {
    currentEventType,
    currentAngle,
    currentEntityIds,
    currentTeamIds,
    currentPersonIds,
    accepted,
    similarity,
  } = args;

  if (!currentEventType || !accepted.eventType) return false;
  if (currentEventType !== accepted.eventType) return false;

  if (
    currentAngle !== accepted.angle &&
    (currentAngle !== "news" || accepted.angle !== "news")
  ) {
    return false;
  }

  const sharedEntities = intersectionCount(currentEntityIds, accepted.entityIds);
  const sharedTeams = intersectionCount(currentTeamIds, accepted.teamEntityIds);
  const sharedPeople = intersectionCount(currentPersonIds, accepted.personEntityIds);

  if (currentEventType === "goal" || currentEventType === "match_result" || currentEventType === "penalty" || currentEventType === "red_card") {
    if (sharedEntities >= 2) return true;

    return (
      sharedEntities >= 1 &&
      sharedTeams >= 1 &&
      similarity >= MATCH_EVENT_SIMILARITY_FLOOR
    );
  }

  if (
    currentEventType === "transfer" ||
    currentEventType === "injury" ||
    currentEventType === "management"
  ) {
    if (sharedPeople >= 1) return true;

    return (
      sharedEntities >= 1 &&
      similarity >= ENTITY_EVENT_SIMILARITY_FLOOR
    );
  }

  return sharedEntities >= 1 && similarity >= ENTITY_EVENT_SIMILARITY_FLOOR;
}

export function getSourceQualityScoreForDedupe(source: string): number {
  const profile = getSourceProfile(source);
  const categoryBonus = profile.sourceCategory
    ? SOURCE_CATEGORY_DEDUPE_BONUS[profile.sourceCategory] ?? 0
    : 0;

  return Math.max(0, profile.authority + categoryBonus);
}


export function getCanonicalSourceScoreForDedupe(
  item: Pick<DbItem, "source" | "sport" | "title" | "tags">,
  context?: CanonicalDedupeContext,
): number {
  const profile = getSourceProfile(item.source);
  const baseQuality = getSourceQualityScoreForDedupe(item.source);
  const sourceSignal = scoreSourceSignal({
    source: item.source,
    sport: item.sport,
    title: item.title,
    tags: item.tags ?? [],
  });

  let score = baseQuality;
  score += sourceSignal.leagueFit * 0.025;
  score += sourceSignal.countryFit * 0.02;

  const policy = getSourceRegionalEligibilityPolicy(item.source);
  const entityIds = new Set(uniqueEntityIds(context));

  if (
    profile.sourceCategory === "official_local" &&
    policy.favoriteEntityIds.some((id) => entityIds.has(id))
  ) {
    score += 0.2;
  } else if (
    (profile.sourceCategory === "local_media" ||
      profile.sourceCategory === "public_service_local") &&
    policy.favoriteEntityIds.some((id) => entityIds.has(id))
  ) {
    score += 0.08;
  }

  return Math.max(0, score);
}

function canonicalPreferenceScore(args: {
  sourceScore: number;
  publishedAtMs: number;
  comparisonPublishedAtMs: number;
}): number {
  const freshnessHours =
    (args.publishedAtMs - args.comparisonPublishedAtMs) / 3_600_000;
  const freshnessBonus = Math.max(-0.06, Math.min(0.06, freshnessHours * 0.02));

  return args.sourceScore + freshnessBonus;
}

export function shouldAcceptNewsItem(
  item: DbItem,
  sport: "football" | "hockey",
  config: {
    cooldownMs: number;
    dupWindowMs: number;
    crossDupMs: number;
    eventWindowMs: number;
    simThreshold: number;
  },
  state: DedupeState,
  context?: CanonicalDedupeContext,
): {
  accepted: boolean;
  publishedAtMs: number | null;
  normalizedTitle: string;
  source: string;
  acceptedItemId: string;
  replaceAcceptedIds: string[];
} {
  const acceptedItemId = String(item?.id ?? item?.url ?? "").trim();

  if (!item?.url || !item?.title || !item?.source || !item?.published_at) {
    return {
      accepted: false,
      publishedAtMs: null,
      normalizedTitle: "",
      source: "",
      acceptedItemId,
      replaceAcceptedIds: [],
    };
  }

  const publishedAtMs = new Date(item.published_at).getTime();
  if (!Number.isFinite(publishedAtMs)) {
    return {
      accepted: false,
      publishedAtMs: null,
      normalizedTitle: "",
      source: "",
      acceptedItemId,
      replaceAcceptedIds: [],
    };
  }

  const source = item.source.trim();
  const normalizedTitle = normalizeTitle(item.title);

  if (sport === "hockey" && isBannedHockeyTitle(normalizedTitle)) {
    return {
      accepted: false,
      publishedAtMs,
      normalizedTitle,
      source,
      acceptedItemId,
      replaceAcceptedIds: [],
    };
  }

  if (hasJuniorTeamPattern(normalizedTitle)) {
    return {
      accepted: false,
      publishedAtMs,
      normalizedTitle,
      source,
      acceptedItemId,
      replaceAcceptedIds: [],
    };
  }

  if (config.cooldownMs > 0) {
    const lastAcceptedMs = state.lastAcceptedBySource.get(source);

    if (
      lastAcceptedMs != null &&
      publishedAtMs >= lastAcceptedMs &&
      publishedAtMs - lastAcceptedMs < config.cooldownMs
    ) {
      return {
        accepted: false,
        publishedAtMs,
        normalizedTitle,
        source,
        acceptedItemId,
        replaceAcceptedIds: [],
      };
    }
  }

  if (config.dupWindowMs > 0 && normalizedTitle) {
    let titleMap = state.lastTitleSeenBySource.get(source);

    if (!titleMap) {
      titleMap = new Map<string, number>();
      state.lastTitleSeenBySource.set(source, titleMap);
    } else {
      for (const [key, value] of titleMap) {
        if (publishedAtMs - value > config.dupWindowMs) {
          titleMap.delete(key);
        }
      }
    }

    const lastTitleMs = titleMap.get(normalizedTitle);
    if (lastTitleMs != null && publishedAtMs - lastTitleMs < config.dupWindowMs) {
      return {
        accepted: false,
        publishedAtMs,
        normalizedTitle,
        source,
        acceptedItemId,
        replaceAcceptedIds: [],
      };
    }

    titleMap.set(normalizedTitle, publishedAtMs);
  }

  if (config.eventWindowMs > 0) {
    const personKey = extractPersonKey(item.title);

    if (personKey) {
      const eventType = extractEventType(item.title);
      const bucket = dayBucketISO(item.published_at);
      const key = eventKey(personKey, eventType, bucket);

      if (key) {
        const lastMs = state.lastEventSeen.get(key);

        if (
          lastMs != null &&
          publishedAtMs <= lastMs &&
          lastMs - publishedAtMs <= config.eventWindowMs
        ) {
          return {
            accepted: false,
            publishedAtMs,
            normalizedTitle,
            source,
            acceptedItemId,
            replaceAcceptedIds: [],
          };
        }

        state.lastEventSeen.set(key, publishedAtMs);
      }
    }
  }

  if (config.crossDupMs > 0 && normalizedTitle) {
    const sourceQuality = getSourceQualityScoreForDedupe(source);
    const canonicalSourceScore = getCanonicalSourceScoreForDedupe(item, context);
    const currentEntityIds = uniqueEntityIds(context);
    const currentTeamIds = entityIdsByType(context, ["team"]);
    const currentPersonIds = entityIdsByType(context, ["player", "staff"]);
    const currentEventType = canonicalEventType(item.title);
    const currentAngle = classifyArticleAngle(item.title);
    const replaceAcceptedIds: string[] = [];

    while (
      state.recentAccepted.length &&
      state.recentAccepted[0]!.pubMs - publishedAtMs > config.crossDupMs
    ) {
      state.recentAccepted.shift();
    }

    for (const acceptedItem of state.recentAccepted) {
      const similarity = titleSimilarity(
        normalizedTitle,
        acceptedItem.normTitle,
      );

      const sameCanonicalEvent = sameEventByEntities({
        currentTitle: item.title,
        currentEventType,
        currentAngle,
        currentEntityIds,
        currentTeamIds,
        currentPersonIds,
        accepted: acceptedItem,
        similarity,
      });

      if (similarity < config.simThreshold && !sameCanonicalEvent) {
        continue;
      }

      if (
        currentAngle !== acceptedItem.angle &&
        (currentAngle !== "news" || acceptedItem.angle !== "news") &&
        similarity < 0.92
      ) {
        continue;
      }

      const candidatePreference = canonicalPreferenceScore({
        sourceScore: canonicalSourceScore,
        publishedAtMs,
        comparisonPublishedAtMs: acceptedItem.pubMs,
      });
      const incumbentPreference = canonicalPreferenceScore({
        sourceScore: acceptedItem.canonicalSourceScore,
        publishedAtMs: acceptedItem.pubMs,
        comparisonPublishedAtMs: publishedAtMs,
      });

      if (
        candidatePreference >
        incumbentPreference + CANONICAL_SOURCE_REPLACE_MARGIN
      ) {
        replaceAcceptedIds.push(acceptedItem.id);
        continue;
      }

      if (
        sourceQuality >
        acceptedItem.sourceQuality + SOURCE_QUALITY_REPLACE_MARGIN
      ) {
        replaceAcceptedIds.push(acceptedItem.id);
        continue;
      }

      return {
        accepted: false,
        publishedAtMs,
        normalizedTitle,
        source,
        acceptedItemId,
        replaceAcceptedIds: [],
      };
    }

    return {
      accepted: true,
      publishedAtMs,
      normalizedTitle,
      source,
      acceptedItemId,
      replaceAcceptedIds,
    };
  }

  return {
    accepted: true,
    publishedAtMs,
    normalizedTitle,
    source,
    acceptedItemId,
    replaceAcceptedIds: [],
  };
}

export function markAcceptedNewsItem(
  acceptedItemId: string,
  publishedAtMs: number,
  normalizedTitle: string,
  source: string,
  sourceQuality: number,
  crossDupMs: number,
  state: DedupeState,
  item?: DbItem,
  context?: CanonicalDedupeContext,
): void {
  state.lastAcceptedBySource.set(source, publishedAtMs);

  if (crossDupMs > 0 && normalizedTitle && acceptedItemId) {
    const entityIds = uniqueEntityIds(context);

    state.recentAccepted.push({
      id: acceptedItemId,
      pubMs: publishedAtMs,
      normTitle: normalizedTitle,
      source,
      sourceQuality,
      canonicalSourceScore: item
        ? getCanonicalSourceScoreForDedupe(item, context)
        : sourceQuality,
      eventType: item ? canonicalEventType(item.title) : null,
      angle: item ? classifyArticleAngle(item.title) : "news",
      entityIds,
      teamEntityIds: entityIdsByType(context, ["team"]),
      personEntityIds: entityIdsByType(context, ["player", "staff"]),
    });
  }
}

export function removeAcceptedItemsFromDedupeState(
  removedItemIds: Set<string>,
  state: DedupeState,
): void {
  if (removedItemIds.size === 0) {
    return;
  }

  state.recentAccepted = state.recentAccepted.filter(
    (item) => !removedItemIds.has(item.id),
  );
}
