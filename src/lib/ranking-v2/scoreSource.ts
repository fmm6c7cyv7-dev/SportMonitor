// src/lib/ranking-v2/scoreSource.ts

import {
  EngineValidationError,
  toEngineError,
} from "@/lib/news-engine/errors";
import type { NormalizedArticle } from "@/lib/news-engine/types";
import {
  getSourceProfile,
  type SourceProfileCategory,
} from "@/lib/ranking/sourceProfiles";

export type SourceScoreSignal = {
  authority: number;
  leagueFit: number;
  countryFit: number;
  reasons: string[];
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ensureValidArticle(
  article: Pick<NormalizedArticle, "source" | "sport" | "title" | "tags">,
): void {
  if (!article || typeof article !== "object") {
    throw new EngineValidationError("Article must be an object", {
      article,
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
}

function isNhlFocusedSource(source: string): boolean {
  return /\b(nhl|sportsnet|tsn|the hockey writers|the hockey news)\b/u.test(
    source,
  );
}

function hasNhlContext(text: string): boolean {
  return /\bnhl\b/u.test(text);
}

const SOURCE_CATEGORY_AUTHORITY_BONUS: Record<SourceProfileCategory, number> = {
  official_local: 4,
  local_media: 3,
  public_service_local: 3,
  aggregator_team_feed: 1,
  fan_community: -2,
};

function scoreAuthorityFromHeuristics(
  source: string,
  reasons: string[],
): number {
  let score = 0;

  if (
    /\b(aftonbladet|expressen|svt sport|bbc sport|sky sports|the athletic|espn|nhl|uefa|fifa)\b/u.test(
      source,
    )
  ) {
    score += 10;
    reasons.push("high-authority-source");
  } else if (
    /\b(hockeynews|fotbollskanalen|goal|the hockey writers|manchester evening news|liverpool echo|chroniclelive)\b/u.test(
      source,
    )
  ) {
    score += 7;
    reasons.push("strong-topic-source");
  } else if (/\b(news now|newsnow|fan site|blogg|blog)\b/u.test(source)) {
    score -= 2;
    reasons.push("lower-authority-source");
  }

  return score;
}

function hasHardNewsSignal(text: string): boolean {
  return /\b(officiellt|official|klart|klar|bekraftat|bekräftat|presenterad|presenteras|confirmed|signs|signerar)\b/u.test(
    text,
  );
}

function scoreAuthorityFromSource(
  sourceRaw: string,
  sourceNormalized: string,
  text: string,
  reasons: string[],
): number {
  const profile = getSourceProfile(sourceRaw);

  if (profile.source === "unknown") {
    return scoreAuthorityFromHeuristics(sourceNormalized, reasons);
  }

  let score = Math.round(profile.authority * 10);

  if (profile.authority >= 0.85) {
    reasons.push("high-authority-source");
  } else if (profile.authority >= 0.65) {
    reasons.push("strong-topic-source");
  } else {
    reasons.push("lower-authority-source");
  }

  if (profile.sourceCategory) {
    score += SOURCE_CATEGORY_AUTHORITY_BONUS[profile.sourceCategory] ?? 0;
    reasons.push(`source-category:${profile.sourceCategory}`);
  }

  if (profile.sourceCategory === "aggregator_team_feed") {
    reasons.push("aggregator-secondary-source");
  }

  if (profile.sourceCategory === "fan_community") {
    const hasLowNewsSignal =
      /\b(forum|podd|podcast|opinion|kronika|krönika|infor|inför|livechatt|blogg|blog)\b/u.test(
        text,
      );

    if (hasLowNewsSignal && !hasHardNewsSignal(text)) {
      score -= 4;
      reasons.push("fan-community-low-news-signal");
    }
  }

  return score;
}

function scoreLeagueFitFromText(
  source: string,
  text: string,
  sport: "football" | "hockey",
  reasons: string[],
): number {
  let score = 0;

  if (sport === "football") {
    if (
      /\b(allsvenskan|superettan|premier league|serie a|bundesliga|la liga|champions league|europa league)\b/u.test(
        text,
      )
    ) {
      score += 5;
      reasons.push("football-league-fit-text");
    }

    if (/\b(fotbollskanalen|goal|sky sports|bbc sport)\b/u.test(source)) {
      score += 3;
      reasons.push("football-league-fit-source");
    }
  }

  if (sport === "hockey") {
    if (
      /\b(shl|hockeyallsvenskan|ahl|world championship|tre kronor)\b/u.test(
        text,
      )
    ) {
      score += 5;
      reasons.push("hockey-league-fit-text");
    }

    if (/\b(hockeynews|aftonbladet|expressen|svt sport)\b/u.test(source)) {
      score += 3;
      reasons.push("hockey-league-fit-source");
    }

    if (hasNhlContext(text) || isNhlFocusedSource(source)) {
      reasons.push("nhl-neutralized-source-fit");
    }
  }

  return score;
}

function scoreCountryFitFromText(text: string, reasons: string[]): number {
  let score = 0;

  if (
    /\b(sverige|svensk|svenska|allsvenskan|superettan|shl|hockeyallsvenskan|tre kronor)\b/u.test(
      text,
    )
  ) {
    score += 4;
    reasons.push("swedish-country-fit");
  }

  return score;
}

export function scoreSourceSignal(
  article: Pick<NormalizedArticle, "source" | "sport" | "title" | "tags">,
): SourceScoreSignal {
  try {
    ensureValidArticle(article);

    const reasons: string[] = [];
    const source = normalizeText(article.source);
    const text = normalizeText(`${article.title} ${(article.tags ?? []).join(" ")}`);

    const authority = scoreAuthorityFromSource(
      article.source,
      source,
      text,
      reasons,
    );
    const leagueFit = scoreLeagueFitFromText(
      source,
      text,
      article.sport,
      reasons,
    );
    const countryFit = scoreCountryFitFromText(text, reasons);

    return {
      authority,
      leagueFit,
      countryFit,
      reasons: Array.from(new Set(reasons)),
    };
  } catch (error) {
    throw toEngineError(
      error,
      "ENGINE_SCORING_FAILURE",
      "Failed to score source signal",
      {
        module: "scoreSourceSignal",
      },
    );
  }
}
