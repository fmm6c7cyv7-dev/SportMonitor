# SportMonitor 2.0 — Target Architecture

This document closes Phase 2 and defines the target code ownership for the motor rewrite.

The migration rule is conservative:

> Move responsibility first, remove compatibility surfaces only after imports/tests prove they are no longer needed.

Product behavior is governed by:

- `PRODUCT_CORE.md`
- `SPORTMONITOR_EDITORIAL_MODEL.md`
- `RANKING_SYSTEM.md`
- `SWEDISH_STAFF_ABROAD.md`

Freshness, dedupe quality, source balancing, favorite/local separation, men's-sport scope and push safety are non-regression boundaries.

---

# Target tree

```text
src/
  app/
    api/
      ingest/
      news/
      favorites/
      push/
      ...

  components/
    feed/
    settings/
    shared/

  data/
    # temporary compatibility location only

  lib/
    ingest/
      sourceRegistry.ts
      types.ts
      fetchSource.ts
      normalizeFeedItem.ts
      filterPolicy.ts
      sportVerification.ts
      priority.ts
      persist.ts
      processFeed.ts
      scrapers/

    entities/
      entityTypes.ts
      entityAliasStore.ts
      entityDetection.ts
      catalog.ts
      relationGraph.ts
      browseSearch.ts
      enrichment.ts

    classification/
      sportSignals.ts
      editorialRelevance.ts
      newsworthiness.ts

    clustering/
      duplicateDetection.ts
      eventClustering.ts
      clusterSelection.ts

    ranking/
      config.ts
      scoreArticle.ts
      scoreBigNews.ts
      scoreEditorial.ts
      scoreFavorite.ts
      scoreGeo.ts
      scorePenalties.ts
      scoreSource.ts
      sourceBalancing.ts

    feed/
      types.ts
      candidateRepository.ts
      seenFilter.ts
      personalization.ts
      freshness.ts
      feedPipeline.ts
      serialize.ts

    push/
      pushTypes.ts
      pushPolicy.ts
      pushMatching.ts
      pushAudience.ts
      pushDispatch.ts

    events/
    audit/
    server/
    infrastructure/
```

The exact directory names may stay compatible during migration, but ownership must follow this model.

---

# Domain ownership

## 1. Ingest

Owns:

- source definitions
- RSS/scraper loading
- raw→normalized conversion
- hard product-scope filtering
- sport verification
- entity pre-pass
- ingest priority metadata
- persistence of new articles/entity links
- post-persist hooks

Does **not** own:

- feed ranking
- favorite personalization
- final dedupe/clustering
- UI formatting

Target flow:

```text
source registry
→ fetch
→ parse
→ normalize
→ product-scope filter
→ sport verify
→ entity detection
→ ingest metadata
→ persist
→ post-persist push/audit hook
```

## 2. Entities

Owns one canonical truth for:

- lexical aliases
- canonical entities
- relation graph
- player→team
- staff→team/organization
- team→league
- league→teams
- browse/search projection
- enrichment of article entity hits

The relation graph must be reusable by:

- ranking
- favorites
- push
- browse UI

No ranking weights belong in the entity domain.

## 3. Classification

Owns semantic labels that are not numeric ranking:

- football vs hockey
- men's-sport product boundary
- editorial Tier 1/2/3
- hard/big-news categories
- event type hints

Classification answers **what the article is**. Ranking answers **how high it should appear**.

## 4. Clustering

Owns:

- hard duplicates
- soft duplicates
- event clusters
- representative selection
- duplicate/event metadata for ranking and push

Target distinction:

### Hard duplicate
Same canonical URL or effectively identical normalized title.

### Soft duplicate
Highly similar titles within a short time window, preferably supported by shared entities.

### Event cluster
Different articles about the same real event. Not automatically discarded; one representative is selected for the feed while cluster intensity can boost importance.

Clustering must not suppress legitimate follow-ups merely because the same person appears.

## 5. Ranking

Owns numeric relevance only.

Score composition:

```text
freshness
+ urgency/newsworthiness
+ editorial relevance
+ favorite affinity
+ local/geo
+ source quality/fit
+ event intensity
+ ingest priority compatibility
- evergreen/staleness
- duplicate penalty
```

The ranking module must **not**:

- fetch DB data
- decide seen state
- mutate favorites
- perform HTTP serialization
- enforce route query parsing
- own source interleaving beyond calling the presentation shaping step

## 6. Feed serving

Owns the user-facing feed pipeline:

```text
load candidates
→ sport consistency
→ seen filter
→ favorite expansion
→ geo
→ dedupe/cluster
→ freshness eligibility
→ ranking
→ source balancing
→ unread-push protection
→ backfill
→ serialize
```

`/api/news/route.ts` becomes a thin adapter that:

1. parses HTTP context
2. opens Supabase
3. calls `runFeedPipeline()`
4. returns JSON

## 7. Push

Owns:

- subscription transport
- audience resolution
- push-specific rate/delivery policy
- final push decision

Push must consume the same:

- canonical entities
- relation expansion
- editorial relevance
- event/cluster identity
- newsworthiness

as feed ranking.

Push may use a different threshold, but not a different truth.

---

# Canonical contracts

The motor contract remains based on `src/lib/news-engine/types.ts`, expanded only when needed.

## RawFeedItem

External source payload after parsing, before domain enrichment.

## NormalizedArticle

Stable article representation used by motor stages.

Required principles:

- one sport
- normalized URL/source/title
- published timestamp
- tags
- entity hits
- personalization signals as optional enrichment
- no UI-specific fields

## EntityHit

Must eventually carry enough canonical metadata to determine:

- type
- Swedish relevance
- team/league relation
- confidence/origin

## ArticleCluster

Represents a group of articles about the same or near-same event.

Must distinguish representative selection from cluster membership.

## RankedArticle

A NormalizedArticle plus transparent score components.

Every material scoring signal should be inspectable.

## PushCandidate

Derived from the same RankedArticle/cluster truth, then filtered by push policy.

---

# Migration map

## Phase 3 — move/split without semantic rewrite

| Current | Target | Migration strategy |
| --- | --- | --- |
| `src/lib/feeds.ts` | `src/lib/ingest/sourceRegistry.ts` | Move implementation, leave re-export facade |
| `src/lib/detectEntities.ts` | `src/lib/entities/*` | Already facade; migrate callers then remove |
| `src/lib/entityBrowse.ts` | catalog + relationGraph + browseSearch | Split internals, leave facade |
| `src/lib/news/newsDedupe.ts` | clustering + classification fallbacks | Extract generic duplicate/event logic first |
| `src/lib/ranking/interleave.ts` | `news-engine/sourceBalancing.ts` | Remove legacy implementation after import verification |
| `src/lib/ranking/score.ts` | `ranking-v2/*` | Remove legacy engine after import verification |
| `src/lib/ranking/scoringFeatures.ts` | `ranking-v2/*` | Remove with legacy score |
| `src/lib/pushDispatch.ts` | `src/lib/push/pushDispatch.ts` | Keep re-export until imports migrate |
| `src/app/api/news/route.ts` | `feed/feedPipeline.ts` + thin route | Extract helpers and orchestration gradually |

## Phase 4 — motor rewrite

1. Implement duplicate analysis.
2. Implement event clustering.
3. Implement representative selection.
4. Create shared entity enrichment/relation input.
5. Make editorial Tier 1/2/3 a first-class ranking component.
6. Feed source balancing from the same ranked objects.
7. Move route orchestration to feed pipeline.
8. Align push with shared entity/event/editorial truth.
9. Remove verified-dead legacy ranking/interleave artifacts.
10. Keep compatibility facades only where external imports still exist.

---

# Non-regression contracts

## Freshness

Normal feed:

- 0–3 h fresh pool
- 3–6 h fallback
- >6 h excluded
- up to 72 h only hide-read backfill
- strong core may jump at most one adjacent freshness bucket under existing threshold rules

Clustering/ranking refactors must not bypass this.

## Editorial hierarchy

1. Swedish men's football/hockey and Swedish players/coaches abroad
2. Their directly related clubs/leagues
3. Broader monitored context

A generic foreign league must not become Tier 1 because it is prestigious.

## Men's-sport scope

Explicit women's football/hockey stays outside this product and is rejected at ingest.

## Favorites/local

Favorite and local are distinct additive signals.

Neither bypasses freshness.

## Source balancing

Source balancing is presentation shaping after relevance scoring. It may reorder only within bounded score loss.

## Dedupe

Higher-quality source replacement is allowed for true near-duplicates.

Follow-ups and genuinely distinct events must survive.

## Push

No retroactive push before subscription creation. Push dedupe/event logic must not create notification storms.

---

# Removal criteria

A compatibility/legacy file can only be deleted when all of the following are true:

1. code search shows no runtime imports
2. tests no longer depend on it
3. replacement behavior has regression coverage
4. docs no longer describe it as current
5. CI lint/test/build passes

This applies especially to:

- `src/lib/ranking/score.ts`
- `src/lib/ranking/scoringFeatures.ts`
- `src/lib/ranking/interleave.ts`
- empty duplicate/favorite/geo engine scaffolds
- `src/lib/scraper.py`

---

# Definition of done for SportMonitor 2.0 motor structure

The restructure is considered complete when:

- ingest route is orchestration-only
- news route is orchestration-only
- entity relations have one reusable graph
- duplicate/event clustering is a real motor stage
- active ranking lives in one engine
- source balancing has one implementation
- editorial relevance has one authoritative classifier
- favorites and push consume the same relation truth
- dead legacy ranking code is removed
- every preserved product invariant has regression tests
