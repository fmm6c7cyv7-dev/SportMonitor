import { describe, expect, it } from "vitest";
import type { DbItem } from "@/lib/news/newsTypes";
import {
  createDedupeState,
  getCanonicalSourceScoreForDedupe,
  getSourceQualityScoreForDedupe,
  markAcceptedNewsItem,
  removeAcceptedItemsFromDedupeState,
  shouldAcceptNewsItem,
} from "@/lib/news/newsDedupe";

function createDbItem(overrides: Partial<DbItem>): DbItem {
  return {
    id: overrides.id ?? "news-1",
    sport: overrides.sport ?? "football",
    title: overrides.title ?? "Kalmar FF vinner mot Djurgården",
    url: overrides.url ?? "https://example.com/news-1",
    source: overrides.source ?? "Bollsvenskan – Kalmar FF",
    published_at: overrides.published_at ?? "2026-04-13T17:30:00.000Z",
    fetched_at: overrides.fetched_at ?? null,
    tags: overrides.tags ?? [],
    priority: overrides.priority ?? 0,
  };
}

describe("newsDedupe source quality", () => {
  it("orders Kalmar source quality by profile category", () => {
    const official = getSourceQualityScoreForDedupe("Kalmar FF (officiell)");
    const localMedia = getSourceQualityScoreForDedupe("Barometern – Kalmar FF");
    const aggregator = getSourceQualityScoreForDedupe("Bollsvenskan – Kalmar FF");
    const community = getSourceQualityScoreForDedupe("SvenskaFans – Kalmar FF");

    expect(official).toBeGreaterThan(localMedia);
    expect(localMedia).toBeGreaterThan(aggregator);
    expect(aggregator).toBeGreaterThan(community);
  });

  it("allows higher-quality duplicate source to replace an accepted lower-quality item", () => {
    const state = createDedupeState();
    const config = {
      cooldownMs: 0,
      dupWindowMs: 0,
      crossDupMs: 2 * 60 * 60_000,
      eventWindowMs: 0,
      simThreshold: 0.74,
    };

    const aggregatorItem = createDbItem({
      id: "agg-1",
      source: "Bollsvenskan – Kalmar FF",
      title: "Kalmar FF vinner mot Djurgården efter dramatik",
      published_at: "2026-04-13T18:00:00.000Z",
    });

    const firstDecision = shouldAcceptNewsItem(
      aggregatorItem,
      "football",
      config,
      state,
    );

    expect(firstDecision.accepted).toBe(true);
    expect(firstDecision.replaceAcceptedIds).toEqual([]);

    markAcceptedNewsItem(
      firstDecision.acceptedItemId,
      firstDecision.publishedAtMs ?? Date.now(),
      firstDecision.normalizedTitle,
      firstDecision.source,
      getSourceQualityScoreForDedupe(firstDecision.source),
      config.crossDupMs,
      state,
    );

    const officialItem = createDbItem({
      id: "official-1",
      source: "Kalmar FF (officiell)",
      title: "Kalmar FF vinner mot Djurgarden efter dramatik",
      published_at: "2026-04-13T17:40:00.000Z",
      url: "https://kalmarff.se/nyhet-1",
    });

    const secondDecision = shouldAcceptNewsItem(
      officialItem,
      "football",
      config,
      state,
    );

    expect(secondDecision.accepted).toBe(true);
    expect(secondDecision.replaceAcceptedIds).toContain("agg-1");

    const removed = new Set(secondDecision.replaceAcceptedIds);
    removeAcceptedItemsFromDedupeState(removed, state);

    markAcceptedNewsItem(
      secondDecision.acceptedItemId,
      secondDecision.publishedAtMs ?? Date.now(),
      secondDecision.normalizedTitle,
      secondDecision.source,
      getSourceQualityScoreForDedupe(secondDecision.source),
      config.crossDupMs,
      state,
    );

    expect(state.recentAccepted.some((item) => item.id === "agg-1")).toBe(false);
    expect(
      state.recentAccepted.some((item) => item.id === "official-1"),
    ).toBe(true);
  });

  it("applies source cooldown when published_at timestamps are identical", () => {
    const state = createDedupeState();
    const config = {
      cooldownMs: 60_000,
      dupWindowMs: 0,
      crossDupMs: 0,
      eventWindowMs: 0,
      simThreshold: 0.74,
    };

    const firstItem = createDbItem({
      id: "ob-1",
      source: "Ölandsbladet – Kalmar FF",
      title: "Första Kalmar FF-nyheten",
      published_at: "2026-04-13T19:25:11.874Z",
      url: "https://www.olandsbladet.se/sport/forsta-kff-nyheten/",
    });

    const firstDecision = shouldAcceptNewsItem(
      firstItem,
      "football",
      config,
      state,
    );

    expect(firstDecision.accepted).toBe(true);

    markAcceptedNewsItem(
      firstDecision.acceptedItemId,
      firstDecision.publishedAtMs ?? Date.now(),
      firstDecision.normalizedTitle,
      firstDecision.source,
      getSourceQualityScoreForDedupe(firstDecision.source),
      config.crossDupMs,
      state,
    );

    const secondItem = createDbItem({
      id: "ob-2",
      source: "Ölandsbladet – Kalmar FF",
      title: "Andra Kalmar FF-nyheten",
      published_at: "2026-04-13T19:25:11.874Z",
      url: "https://www.olandsbladet.se/sport/andra-kff-nyheten/",
    });

    const secondDecision = shouldAcceptNewsItem(
      secondItem,
      "football",
      config,
      state,
    );

    expect(secondDecision.accepted).toBe(false);
  });
});


describe("newsDedupe canonical event clustering", () => {
  const config = {
    cooldownMs: 0,
    dupWindowMs: 0,
    crossDupMs: 2 * 60 * 60_000,
    eventWindowMs: 0,
    simThreshold: 0.75,
  };

  const fulhamUnitedContext = {
    entityIds: [
      "football-team-fulham",
      "football-team-manchester-united",
      "football-player-cunha",
    ],
    entities: [
      { id: "football-team-fulham", type: "team" as const, sport: "football" as const },
      { id: "football-team-manchester-united", type: "team" as const, sport: "football" as const },
      { id: "football-player-cunha", type: "player" as const, sport: "football" as const },
    ],
  };

  function acceptAndMark(
    state: ReturnType<typeof createDedupeState>,
    item: DbItem,
    context: {
      entityIds?: string[];
      entities?: Array<{
        id?: string;
        type?: "player" | "team" | "league" | "staff";
        sport?: "football" | "hockey";
      }>;
    },
  ) {
    const decision = shouldAcceptNewsItem(
      item,
      "football",
      config,
      state,
      context,
    );

    if (decision.accepted && decision.publishedAtMs != null) {
      if (decision.replaceAcceptedIds.length > 0) {
        removeAcceptedItemsFromDedupeState(
          new Set(decision.replaceAcceptedIds),
          state,
        );
      }

      markAcceptedNewsItem(
        decision.acceptedItemId,
        decision.publishedAtMs,
        decision.normalizedTitle,
        decision.source,
        getSourceQualityScoreForDedupe(decision.source),
        config.crossDupMs,
        state,
        item,
        context,
      );
    }

    return decision;
  }

  it("collapses BBC/Sky/MEN-style reports of the same match event by entity and event overlap", () => {
    const state = createDedupeState();

    const men = createDbItem({
      id: "men-goal",
      source: "Manchester Evening News",
      title: "Cunha rescues Manchester United with late equaliser at Fulham",
      published_at: "2026-09-20T16:20:00.000Z",
      url: "https://example.com/men-goal",
    });

    const first = acceptAndMark(state, men, fulhamUnitedContext);
    expect(first.accepted).toBe(true);

    const sky = createDbItem({
      id: "sky-goal",
      source: "Sky Sports",
      title: "Cunha's late goal earns Man Utd a point away to Fulham",
      published_at: "2026-09-20T16:24:00.000Z",
      url: "https://example.com/sky-goal",
    });

    const second = shouldAcceptNewsItem(
      sky,
      "football",
      config,
      state,
      fulhamUnitedContext,
    );

    expect(
      second.accepted === false || second.replaceAcceptedIds.includes("men-goal"),
    ).toBe(true);
  });

  it("lets a higher-ranked source replace a lower-ranked source for the same event", () => {
    const state = createDedupeState();

    const men = createDbItem({
      id: "men-1",
      source: "Manchester Evening News",
      title: "Cunha rescues Manchester United with late goal at Fulham",
      published_at: "2026-09-20T16:20:00.000Z",
      url: "https://example.com/men-1",
    });
    acceptAndMark(state, men, fulhamUnitedContext);

    const bbc = createDbItem({
      id: "bbc-1",
      source: "BBC Sport",
      title: "Late Cunha goal earns Manchester United draw at Fulham",
      published_at: "2026-09-20T16:18:00.000Z",
      url: "https://example.com/bbc-1",
    });

    const decision = shouldAcceptNewsItem(
      bbc,
      "football",
      config,
      state,
      fulhamUnitedContext,
    );

    expect(decision.accepted).toBe(true);
    expect(decision.replaceAcceptedIds).toContain("men-1");
  });

  it("lets an official team source beat a weaker source for its own team event", () => {
    const state = createDedupeState();
    const context = {
      entityIds: ["football-team-kalmar"],
      entities: [
        {
          id: "football-team-kalmar",
          type: "team" as const,
          sport: "football" as const,
        },
      ],
    };

    const weaker = createDbItem({
      id: "community-transfer",
      source: "SvenskaFans – Kalmar FF",
      title: "Klart: Kalmar FF värvar ny anfallare",
      published_at: "2026-09-20T14:10:00.000Z",
      url: "https://example.com/community-transfer",
    });
    acceptAndMark(state, weaker, context);

    const official = createDbItem({
      id: "official-transfer",
      source: "Kalmar FF (officiell)",
      title: "Officiellt: Kalmar FF värvar ny anfallare",
      published_at: "2026-09-20T14:05:00.000Z",
      url: "https://example.com/official-transfer",
    });

    const decision = shouldAcceptNewsItem(
      official,
      "football",
      config,
      state,
      context,
    );

    expect(decision.accepted).toBe(true);
    expect(decision.replaceAcceptedIds).toContain("community-transfer");
    expect(
      getCanonicalSourceScoreForDedupe(official, context),
    ).toBeGreaterThan(
      getCanonicalSourceScoreForDedupe(weaker, context),
    );
  });

  it("does not collapse different events about the same team", () => {
    const state = createDedupeState();
    const context = {
      entityIds: ["football-team-kalmar"],
      entities: [
        {
          id: "football-team-kalmar",
          type: "team" as const,
          sport: "football" as const,
        },
      ],
    };

    acceptAndMark(
      state,
      createDbItem({
        id: "kalmar-transfer",
        source: "Aftonbladet – Fotboll",
        title: "Kalmar FF värvar ny anfallare",
        published_at: "2026-09-20T14:00:00.000Z",
        url: "https://example.com/kalmar-transfer",
      }),
      context,
    );

    const decision = shouldAcceptNewsItem(
      createDbItem({
        id: "kalmar-coach",
        source: "SVT Sport – Fotboll",
        title: "Kalmar FF:s tränare avgår efter säsongen",
        published_at: "2026-09-20T14:20:00.000Z",
        url: "https://example.com/kalmar-coach",
      }),
      "football",
      config,
      state,
      context,
    );

    expect(decision.accepted).toBe(true);
    expect(decision.replaceAcceptedIds).toEqual([]);
  });

  it("preserves a later analysis angle about an already reported event", () => {
    const state = createDedupeState();
    const context = {
      entityIds: ["football-team-kalmar", "football-player-new-signing"],
      entities: [
        {
          id: "football-team-kalmar",
          type: "team" as const,
          sport: "football" as const,
        },
        {
          id: "football-player-new-signing",
          type: "player" as const,
          sport: "football" as const,
        },
      ],
    };

    acceptAndMark(
      state,
      createDbItem({
        id: "breaking-transfer",
        source: "Kalmar FF (officiell)",
        title: "Officiellt: Kalmar FF värvar Erik Nilsson",
        published_at: "2026-09-20T14:00:00.000Z",
        url: "https://example.com/breaking-transfer",
      }),
      context,
    );

    const analysis = shouldAcceptNewsItem(
      createDbItem({
        id: "analysis-transfer",
        source: "Barometern – Kalmar FF",
        title: "Analys: därför passar Erik Nilsson perfekt i Kalmar FF",
        published_at: "2026-09-20T15:00:00.000Z",
        url: "https://example.com/analysis-transfer",
      }),
      "football",
      config,
      state,
      context,
    );

    expect(analysis.accepted).toBe(true);
    expect(analysis.replaceAcceptedIds).toEqual([]);
  });

  it("does not merge different matches just because one team is shared", () => {
    const state = createDedupeState();

    const firstContext = {
      entityIds: ["football-team-kalmar", "football-team-hacken"],
      entities: [
        {
          id: "football-team-kalmar",
          type: "team" as const,
          sport: "football" as const,
        },
        {
          id: "football-team-hacken",
          type: "team" as const,
          sport: "football" as const,
        },
      ],
    };

    acceptAndMark(
      state,
      createDbItem({
        id: "kalmar-hacken",
        source: "SVT Sport – Fotboll",
        title: "Kalmar förlorar mot Häcken efter sen vändning",
        published_at: "2026-09-20T14:00:00.000Z",
        url: "https://example.com/kalmar-hacken",
      }),
      firstContext,
    );

    const secondContext = {
      entityIds: ["football-team-kalmar", "football-team-mjallby"],
      entities: [
        {
          id: "football-team-kalmar",
          type: "team" as const,
          sport: "football" as const,
        },
        {
          id: "football-team-mjallby",
          type: "team" as const,
          sport: "football" as const,
        },
      ],
    };

    const decision = shouldAcceptNewsItem(
      createDbItem({
        id: "kalmar-mjallby",
        source: "Aftonbladet – Fotboll",
        title: "Kalmar förlorar borta mot Mjällby",
        published_at: "2026-09-20T15:30:00.000Z",
        url: "https://example.com/kalmar-mjallby",
      }),
      "football",
      config,
      state,
      secondContext,
    );

    expect(decision.accepted).toBe(true);
    expect(decision.replaceAcceptedIds).toEqual([]);
  });
});
