// src/lib/ranking-v2/scoreBase.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import {
  createEmptyScoreComponents,
  type EngineFavorite,
  type EngineGeoContext,
  type NormalizedArticle,
  type RankedArticle,
} from "@/lib/news-engine/types";
import { scoreBigNewsSignal } from "@/lib/ranking-v2/scoreBigNews";
import { scoreCoreIdentity } from "@/lib/ranking-v2/scoreCoreIdentity";
import { scoreFavoriteAffinity } from "@/lib/ranking-v2/scoreFavoriteAffinity";
import { scoreGeoAffinity } from "@/lib/ranking-v2/scoreGeo";
import { scorePenaltySignal } from "@/lib/ranking-v2/scorePenalties";
import { scoreSourceSignal } from "@/lib/ranking-v2/scoreSource";

export type BaseScoreContext = {
  nowMs: number;
  favorites?: EngineFavorite[];
  geo?: EngineGeoContext | null;
  duplicateCount?: number;
  eventIntensity?: number;
};

function ensureValidArticle(article: NormalizedArticle): void {
  if (!article || typeof article !== "object") {
    throw new EngineValidationError("Article must be an object", {
      article,
    });
  }

  if (typeof article.id !== "string" || article.id.trim().length === 0) {
    throw new EngineValidationError("Article id must be a non-empty string", {
      id: article.id,
    });
  }

  if (typeof article.title !== "string") {
    throw new EngineValidationError("Article title must be a string", {
      title: article.title,
    });
  }

  if (typeof article.source !== "string") {
    throw new EngineValidationError("Article source must be a string", {
      source: article.source,
    });
  }

  if (article.sport !== "football" && article.sport !== "hockey") {
    throw new EngineValidationError("Article sport must be football or hockey", {
      sport: article.sport,
    });
  }

  if (!Array.isArray(article.tags)) {
    throw new EngineValidationError("Article tags must be an array", {
      tags: article.tags,
    });
  }

  if (!Array.isArray(article.entityHits)) {
    throw new EngineValidationError("Article entityHits must be an array", {
      entityHits: article.entityHits,
    });
  }

  if (typeof article.priority !== "number" || !Number.isFinite(article.priority)) {
    throw new EngineValidationError("Article priority must be a finite number", {
      priority: article.priority,
    });
  }

  if (typeof article.urgency !== "number" || !Number.isFinite(article.urgency)) {
    throw new EngineValidationError("Article urgency must be a finite number", {
      urgency: article.urgency,
    });
  }
}

function ensureValidContext(context: BaseScoreContext): void {
  if (!context || typeof context !== "object") {
    throw new EngineValidationError("Base score context must be an object", {
      context,
    });
  }

  if (typeof context.nowMs !== "number" || !Number.isFinite(context.nowMs)) {
    throw new EngineValidationError(
      "Base score context nowMs must be a finite number",
      {
        nowMs: context.nowMs,
      },
    );
  }

  if (
    context.eventIntensity !== undefined &&
    (typeof context.eventIntensity !== "number" ||
      !Number.isFinite(context.eventIntensity))
  ) {
    throw new EngineValidationError("eventIntensity must be a finite number", {
      eventIntensity: context.eventIntensity,
    });
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getRecencyScore(publishedAt: string | null, nowMs: number): number {
  if (!publishedAt) {
    return 0;
  }

  const publishedMs = new Date(publishedAt).getTime();
  if (!Number.isFinite(publishedMs)) {
    return 0;
  }

  const ageHours = Math.max(0, (nowMs - publishedMs) / 3_600_000);

  if (ageHours <= 1) return 18;
  if (ageHours <= 3) return 14;
  if (ageHours <= 6) return 11;
  if (ageHours <= 12) return 8;
  if (ageHours <= 24) return 5;
  if (ageHours <= 48) return 2;

  return 0;
}

function getUrgencyScore(urgency: number): number {
  if (urgency >= 24) return 14;
  if (urgency >= 16) return 10;
  if (urgency >= 8) return 5;
  if (urgency > 0) return 2;

  return 0;
}

function getPriorityScore(priority: number): number {
  if (priority >= 90) return 18;
  if (priority >= 80) return 12;
  if (priority >= 50) return 6;

  return 0;
}

function getSwedishSignals(entityHits: NormalizedArticle["entityHits"]): {
  swedishPlayer: number;
  swedishAbroadCore: number;
  swedishLeague: number;
} {
  let swedishPlayer = 0;
  let swedishAbroadCore = 0;
  let swedishLeague = 0;

  for (const hit of entityHits) {
    if (!hit || typeof hit !== "object") {
      continue;
    }

    if (hit.isSwedish && hit.type === "player") {
      swedishPlayer += 8;
    }

    if (hit.isAbroadCore) {
      swedishAbroadCore += 14;
    }

    if (
      hit.type === "league" &&
      /\b(allsvenskan|superettan|shl|hockeyallsvenskan)\b/u.test(hit.name)
    ) {
      swedishLeague += 12;
    }
  }

  return {
    swedishPlayer,
    swedishAbroadCore,
    swedishLeague,
  };
}

function getCoreStrength(args: {
  swedishPlayer: number;
  swedishAbroadCore: number;
  swedishLeague: number;
  coreIdentity: number;
  favoriteAffinity: number;
  localGeo: number;
  bigNews: number;
  eventIntensity: number;
}): number {
  return (
    args.swedishPlayer +
    args.swedishAbroadCore +
    args.swedishLeague +
    args.coreIdentity +
    args.favoriteAffinity +
    args.localGeo +
    args.bigNews +
    args.eventIntensity
  );
}

function getBoundedCoreIdentityContribution(
  article: NormalizedArticle,
  rawCoreIdentityScore: number,
): number {
  const hasSwedishAbroadPlayer = article.entityHits.some(
    (hit) =>
      hit.type === "player" &&
      hit.isSwedish === true &&
      hit.isAbroadCore === true,
  );

  if (hasSwedishAbroadPlayer) {
    return rawCoreIdentityScore;
  }

  const hasSwedishDomesticPlayer = article.entityHits.some(
    (hit) =>
      hit.type === "player" &&
      hit.isSwedish === true &&
      hit.isAbroadCore === false,
  );

  return hasSwedishDomesticPlayer
    ? Math.min(rawCoreIdentityScore, 12)
    : rawCoreIdentityScore;
}

function buildArticleText(article: NormalizedArticle): string {
  const entityNames = article.entityHits.map((hit) => hit.name).join(" ");

  return normalizeText(
    `${article.title} ${article.source} ${article.tags.join(" ")} ${entityNames}`,
  );
}

function hasExplicitSwedishFootballContext(article: NormalizedArticle): boolean {
  for (const hit of article.entityHits) {
    if (!hit || typeof hit !== "object") {
      continue;
    }

    if (hit.isSwedish || hit.isAbroadCore) {
      return true;
    }

    if (
      hit.type === "league" &&
      /\b(allsvenskan|superettan)\b/u.test(hit.name)
    ) {
      return true;
    }
  }

  const text = buildArticleText(article);

  return /\b(allsvenskan|superettan|svensk|svenska|sverige)\b/u.test(text);
}

function hasExplicitSwedishHockeyContext(article: NormalizedArticle): boolean {
  for (const hit of article.entityHits) {
    if (!hit || typeof hit !== "object") {
      continue;
    }

    if (hit.isSwedish || hit.isAbroadCore) {
      return true;
    }

    if (
      hit.type === "league" &&
      /\b(shl|hockeyallsvenskan|tre kronor)\b/u.test(hit.name)
    ) {
      return true;
    }
  }

  const text = buildArticleText(article);

  return /\b(svensk|svenska|sverige|tre kronor|shl|hockeyallsvenskan)\b/u.test(
    text,
  );
}

function isTodayInHockeyHistory(
  article: Pick<NormalizedArticle, "sport" | "title" | "source">,
): boolean {
  const normalizedTitle = normalizeText(article.title);
  const normalizedSource = normalizeText(article.source);

  return (
    article.sport === "hockey" &&
    /\btoday in hockey history\b/u.test(normalizedTitle) &&
    /\bthe hockey writers\b/u.test(normalizedSource)
  );
}

function isNhlArticle(article: NormalizedArticle): boolean {
  if (article.sport !== "hockey") {
    return false;
  }

  if (isTodayInHockeyHistory(article)) {
    return false;
  }

  const text = buildArticleText(article);

  if (/\bnhl\b/u.test(text)) {
    return true;
  }

  if (/\b(nhl\.com|sportsnet|tsn|the hockey writers|the hockey news)\b/u.test(text)) {
    return true;
  }

  return article.entityHits.some(
    (hit) => hit.type === "league" && /\bnhl\b/u.test(hit.name),
  );
}

function getSourceMultiplier(
  article: NormalizedArticle,
  coreStrength: number,
  favoriteAffinity: number,
  localGeo: number,
  bigNews: number,
  dailyFeatureBoost: number,
): number {
  if (
    favoriteAffinity > 0 ||
    localGeo > 0 ||
    bigNews > 0 ||
    dailyFeatureBoost > 0
  ) {
    return 1;
  }

  if (article.sport === "football") {
    const hasSwedishContext = hasExplicitSwedishFootballContext(article);

    if (!hasSwedishContext) {
      if (coreStrength >= 28) {
        return 0.12;
      }

      if (coreStrength >= 16) {
        return 0.08;
      }

      return 0.05;
    }

    if (coreStrength >= 28) {
      return 1;
    }

    if (coreStrength >= 16) {
      return 0.6;
    }

    return 0.3;
  }

  if (article.sport === "hockey") {
    const hasSwedishContext = hasExplicitSwedishHockeyContext(article);

    if (isNhlArticle(article) && !hasSwedishContext) {
      if (coreStrength >= 28) {
        return 0.55;
      }

      if (coreStrength >= 16) {
        return 0.35;
      }

      return 0.15;
    }
  }

  if (coreStrength >= 28) {
    return 1;
  }

  if (coreStrength >= 16) {
    return 0.8;
  }

  return 0.55;
}

function getNonCoreForeignFootballPenalty(
  article: NormalizedArticle,
  coreStrength: number,
  favoriteAffinity: number,
  localGeo: number,
  bigNews: number,
): number {
  if (article.sport !== "football") {
    return 0;
  }

  if (favoriteAffinity > 0 || localGeo > 0 || bigNews > 0) {
    return 0;
  }

  if (coreStrength >= 16 && hasExplicitSwedishFootballContext(article)) {
    return 0;
  }

  const text = buildArticleText(article);

  if (/\b(allsvenskan|superettan|svensk|svenska|sverige)\b/u.test(text)) {
    return 0;
  }

  if (coreStrength >= 16) {
    return 12;
  }

  return 16;
}

function getNonCoreNhlPenalty(
  article: NormalizedArticle,
  coreStrength: number,
  favoriteAffinity: number,
  localGeo: number,
  bigNews: number,
  dailyFeatureBoost: number,
): number {
  if (article.sport !== "hockey") {
    return 0;
  }

  if (!isNhlArticle(article)) {
    return 0;
  }

  if (
    favoriteAffinity > 0 ||
    localGeo > 0 ||
    bigNews > 0 ||
    dailyFeatureBoost > 0
  ) {
    return 0;
  }

  if (hasExplicitSwedishHockeyContext(article)) {
    return 0;
  }

  if (coreStrength >= 24) {
    return 8;
  }

  if (coreStrength >= 16) {
    return 12;
  }

  return 18;
}

function getDailyFeatureBoost(article: NormalizedArticle): number {
  if (isTodayInHockeyHistory(article)) {
    return 24;
  }

  return 0;
}

export function scoreBaseArticle(
  article: NormalizedArticle,
  context: BaseScoreContext,
): RankedArticle {
  try {
    ensureValidArticle(article);
    ensureValidContext(context);

    const components = createEmptyScoreComponents();

    components.recency = getRecencyScore(article.publishedAt, context.nowMs);
    components.urgency = getUrgencyScore(article.urgency);

    const swedishSignals = getSwedishSignals(article.entityHits);
    components.swedishPlayer = swedishSignals.swedishPlayer;
    components.swedishAbroadCore = swedishSignals.swedishAbroadCore;
    components.swedishLeague = swedishSignals.swedishLeague;

    const computedFavoriteSignal = scoreFavoriteAffinity(
      {
        title: article.title,
        sport: article.sport,
        entityHits: article.entityHits,
      },
      {
        favorites: context.favorites ?? [],
      },
    );

    // Feed candidates carry a validated favorite decision from AcceptedItem.
    // When favorites-first is active, that trusted decision must override raw
    // entity hits so polluted news_entities cannot manufacture affinity.
    // Non-feed engine callers without trustedFavoriteSignal keep the existing
    // entity-based scorer.
    const favoriteSignal =
      (context.favorites?.length ?? 0) > 0 && article.trustedFavoriteSignal
        ? article.trustedFavoriteSignal
        : computedFavoriteSignal;

    components.favoriteAffinity = favoriteSignal.score;

    const geoScore = scoreGeoAffinity(
      {
        title: article.title,
        sport: article.sport,
        source: article.source,
        tags: article.tags,
        localSignal: article.localSignal,
      },
      {
        geo: context.geo ?? null,
      },
    );

    components.localGeo = geoScore;

    const bigNewsSignal = scoreBigNewsSignal({
      title: article.title,
      tags: article.tags,
      urgency: article.urgency,
    });

    components.bigNews = bigNewsSignal.score;

    const coreIdentity = scoreCoreIdentity({
      title: article.title,
      tags: article.tags,
      priority: article.priority,
      entityHits: article.entityHits,
    });
    const coreIdentityContribution = getBoundedCoreIdentityContribution(
      article,
      coreIdentity.score,
    );

    const eventIntensity = Math.max(0, context.eventIntensity ?? 0);
    components.eventIntensity = eventIntensity;

    components.priority = getPriorityScore(article.priority);

    const dailyFeatureBoost = getDailyFeatureBoost(article);

    const coreStrength = getCoreStrength({
      swedishPlayer: components.swedishPlayer,
      swedishAbroadCore: components.swedishAbroadCore,
      swedishLeague: components.swedishLeague,
      coreIdentity: coreIdentity.score,
      favoriteAffinity: components.favoriteAffinity,
      localGeo: components.localGeo,
      bigNews: components.bigNews,
      eventIntensity: components.eventIntensity,
    });

    const sourceSignal = scoreSourceSignal({
      source: article.source,
      sport: article.sport,
      title: article.title,
      tags: article.tags,
    });

    const sourceMultiplier = getSourceMultiplier(
      article,
      coreStrength,
      components.favoriteAffinity,
      components.localGeo,
      components.bigNews,
      dailyFeatureBoost,
    );

    components.sourceAuthority = Math.round(
      sourceSignal.authority * sourceMultiplier,
    );
    components.sourceLeagueFit = Math.round(
      sourceSignal.leagueFit * sourceMultiplier,
    );
    components.sourceCountryFit = Math.round(
      sourceSignal.countryFit * sourceMultiplier,
    );

    const penaltySignal = scorePenaltySignal(
      {
        title: article.title,
        publishedAt: article.publishedAt,
        tags: article.tags,
      },
      {
        nowMs: context.nowMs,
        duplicateCount: context.duplicateCount ?? 0,
        isHardNews: bigNewsSignal.matched,
      },
    );

    components.evergreenPenalty = penaltySignal.evergreenPenalty;
    components.stalenessPenalty = penaltySignal.stalenessPenalty;
    components.duplicatePenalty = penaltySignal.duplicatePenalty;

    const nonCoreForeignFootballPenalty = getNonCoreForeignFootballPenalty(
      article,
      coreStrength,
      components.favoriteAffinity,
      components.localGeo,
      components.bigNews,
    );

    const nonCoreNhlPenalty = getNonCoreNhlPenalty(
      article,
      coreStrength,
      components.favoriteAffinity,
      components.localGeo,
      components.bigNews,
      dailyFeatureBoost,
    );

    const total =
      components.recency +
      components.urgency +
      components.swedishPlayer +
      components.swedishAbroadCore +
      components.swedishLeague +
      components.favoriteAffinity +
      components.localGeo +
      components.sourceAuthority +
      components.sourceLeagueFit +
      components.sourceCountryFit +
      components.bigNews +
      components.eventIntensity +
      components.priority +
      coreIdentityContribution +
      dailyFeatureBoost -
      components.evergreenPenalty -
      components.stalenessPenalty -
      components.duplicatePenalty -
      nonCoreForeignFootballPenalty -
      nonCoreNhlPenalty;

    return {
      ...article,
      favoriteSignal,
      localSignal: article.localSignal,
      bigNewsSignal,
      score: total,
      scoreComponents: components,
    };
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score base article",
      {
        module: "scoreBaseArticle",
        articleId: article?.id,
      },
    );
  }
}
