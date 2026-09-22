// src/lib/ranking-v2/scoreCoreIdentity.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type { EntityHit, NormalizedArticle } from "@/lib/news-engine/types";

export type CoreIdentitySignal = {
  score: number;
  matched: boolean;
  reasons: string[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ensureEntityHits(value: unknown): EntityHit[] {
  if (!Array.isArray(value)) {
    throw new EngineValidationError("entityHits must be an array", {
      entityHits: value,
    });
  }

  return value as EntityHit[];
}

function ensureValidArticle(
  article: Pick<NormalizedArticle, "title" | "tags" | "priority" | "entityHits">,
): void {
  if (!article || typeof article !== "object") {
    throw new EngineValidationError("Article must be an object", {
      article,
    });
  }

  if (typeof article.title !== "string") {
    throw new EngineValidationError("Article title must be a string", {
      title: article.title,
    });
  }

  if (!Array.isArray(article.tags)) {
    throw new EngineValidationError("Article tags must be an array", {
      tags: article.tags,
    });
  }

  if (typeof article.priority !== "number" || !Number.isFinite(article.priority)) {
    throw new EngineValidationError("Article priority must be a finite number", {
      priority: article.priority,
    });
  }

  ensureEntityHits(article.entityHits);
}

function getPriorityContribution(priority: number, reasons: string[]): number {
  if (priority >= 80) {
    reasons.push("high-priority-ingest-signal");
    return 6;
  }

  if (priority >= 50) {
    reasons.push("medium-priority-ingest-signal");
    return 3;
  }

  return 0;
}

function getSwedishTextContribution(text: string, reasons: string[]): number {
  let score = 0;

  if (/\b(allsvenskan|superettan|svensk fotboll)\b/u.test(text)) {
    score += 12;
    reasons.push("swedish-football-league-text");
  }

  if (/\b(shl|hockeyallsvenskan)\b/u.test(text)) {
    score += 12;
    reasons.push("swedish-hockey-league-text");
  }

  if (/\b(sverige|svensk|svenska|tre kronor)\b/u.test(text)) {
    score += 8;
    reasons.push("swedish-national-context-text");
  }

  return score;
}

function getEntityContribution(entityHits: EntityHit[], reasons: string[]): number {
  let score = 0;

  for (const hit of entityHits) {
    if (!hit || typeof hit !== "object") {
      continue;
    }

    if (hit.isAbroadCore) {
      score += 16;
      reasons.push(`abroad-core:${hit.name}`);
      continue;
    }

    if (hit.type === "league") {
      const normalizedLeague = normalizeText(hit.name);

      if (/\b(allsvenskan|superettan|shl|hockeyallsvenskan)\b/u.test(normalizedLeague)) {
        score += 12;
        reasons.push(`swedish-league-entity:${hit.name}`);
        continue;
      }
    }

    if (hit.isSwedish) {
      if (hit.type === "player") {
        score += 10;
        reasons.push(`swedish-player:${hit.name}`);
        continue;
      }

      if (hit.type === "coach" || hit.type === "staff") {
        score += 8;
        reasons.push(`swedish-staff:${hit.name}`);
        continue;
      }

      if (hit.type === "team") {
        score += 6;
        reasons.push(`swedish-team:${hit.name}`);
        continue;
      }

      score += 5;
      reasons.push(`swedish-entity:${hit.name}`);
    }
  }

  return score;
}

export function scoreCoreIdentity(
  article: Pick<NormalizedArticle, "title" | "tags" | "priority" | "entityHits">,
): CoreIdentitySignal {
  try {
    ensureValidArticle(article);

    const reasons: string[] = [];
    const text = normalizeText(`${article.title} ${(article.tags ?? []).join(" ")}`);

    let score = 0;
    score += getPriorityContribution(article.priority, reasons);
    score += getSwedishTextContribution(text, reasons);
    score += getEntityContribution(article.entityHits, reasons);

    return {
      score,
      matched: score > 0,
      reasons: Array.from(new Set(reasons)),
    };
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score core identity",
      {
        module: "scoreCoreIdentity",
      },
    );
  }
}