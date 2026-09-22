# SportMonitor Ranking System

## Purpose

This document defines the ranking and feed-shaping rules for SportMonitor.

The ranking system must support the product core defined in `PRODUCT_CORE.md`:

> Swedish football and hockey, Swedish players and coaches abroad, then the directly related club/league context, then broader fill.

Ranking changes are regression-sensitive. Read this document, `PRODUCT_CORE.md`, the relevant tests, and the current route implementation before changing score weights or feed ordering.

---

## Editorial hierarchy

### Tier 1 — Swedish core

Highest editorial relevance, subject to freshness:

- Swedish football and hockey in Sweden
- Swedish players abroad
- Swedish coaches / staff abroad

### Tier 2 — Direct surrounding context

Next priority:

- clubs that currently contain Swedish players or Swedish coaches / staff
- leagues containing those clubs
- relevant club / league events that affect the Swedish context even when the Swedish person is not named in the headline

### Tier 3 — Broader fill

Use remaining capacity for:

- other relevant monitored football and hockey news
- major international club / league news
- strong-source general context

Tier 3 must not crowd out Tier 1 merely because it is generic Premier League, Serie A, NHL, or similar content.

---

## Freshness discipline — non-regression rules

Freshness is a guardrail around editorial relevance.

The normal feed currently uses:

- **0–3 h**: fresh pool
- **3–6 h**: normal fallback pool
- **>6 h**: excluded from the normal feed
- **up to 72 h**: hide-read backfill only when fresh/normal candidates do not fill the requested list

Within the 0–6 h window, route ordering uses freshness buckets:

- 0–30 min
- 30–90 min
- 90–180 min
- 180–360 min

A strong core item may jump **one adjacent bucket only** when both existing conditions are met:

- core boost is at least `CORE_BUCKET_JUMP_THRESHOLD`
- hybrid-score advantage is at least `CORE_BUCKET_JUMP_MARGIN`

Do not remove or weaken these rules while improving Swedish relevance.

Examples:

- A 55-minute Isak goal may outrank a 20-minute generic club story if the core margin is strong enough.
- A 7-hour-old Swedish-player article must not appear in the normal feed above fresh relevant news.
- Favorites and local signals do not bypass the 6-hour ceiling.

---

## Ranking layers

Keep the model layered.

### Layer 1 — Content relevance

Determine what the article is about:

- Swedish player / coach / staff
- Swedish domestic club / league
- club or league related to a Swedish player / coach
- generic club / league context
- match event
- transfer / official confirmation
- analysis / evergreen

### Layer 2 — Source relevance

Determine how strong the source is for the topic:

- source authority
- country fit
- league fit
- topic specialization

Source authority is a supporting signal, not the editorial core.

### Layer 3 — Personalization

Apply:

- favorite affinity
- local relevance

Favorite and local are separate signals and must remain separate.

### Layer 4 — Presentation shaping

After scoring, preserve:

- dedupe
- freshness guardrails
- source balancing / anti-cluster behavior
- hide-read behavior
- unread-push protection

Presentation shaping must not silently redefine editorial relevance.

---

## Score model

The current score is composed from multiple signals rather than one monolithic rule.

Conceptually:

```ts
score =
  recency
  + urgency
  + swedishCore
  + relatedContext
  + favoriteAffinity
  + localGeo
  + sourceAuthority
  + leagueFit
  + countryFit
  + bigNews
  + eventIntensity
  + ingestPriority
  - evergreenPenalty
  - stalenessPenalty
  - duplicatePenalty
```

The exact weights may evolve, but the editorial hierarchy and freshness guardrails above are invariants unless explicitly changed by a product decision.

---

## Swedish-core detection

Prefer canonical entity relationships over hardcoded name lists.

The desired direction is:

- identify Swedish people and Swedish domestic entities canonically
- use team/league relations to derive Tier 2 context
- keep hardcoded names only as a narrow fallback where canonical data is unavailable

Swedish senior coaching staff abroad are maintained in
`src/data/swedishStaffAbroad.ts` until the production entity schema supports
canonical `staff` rows. See `SWEDISH_STAFF_ABROAD.md` for scope and
maintenance rules.

Do not let a generic player mention automatically become equivalent to a Swedish-player core signal.

---

## League handling

A league can be relevant for different reasons:

1. Swedish domestic league → Tier 1
2. foreign league containing clubs with Swedish players/coaches → Tier 2
3. otherwise monitored foreign league → Tier 3

Premier League must not receive Tier 1 status simply because it is Premier League. The same principle applies to NHL, Serie A, Bundesliga, La Liga, Ligue 1, and other foreign competitions.

---

## Hard-news signals

Important events can receive additional weight, for example:

- goal / decisive match event
- official transfer
- Here we go / done deal
- red card
- confirmed lineup
- management change
- breaking / live

Hard-news weight may improve ordering inside the freshness discipline. It does not bypass the normal-feed age ceiling.

---

## Favorites

Favorites may include:

- players
- teams
- leagues

The client supports up to five favorites.

Favorite matching may boost a sufficiently fresh article, but must not:

- bypass the 6-hour normal-feed ceiling
- turn unrelated expanded entities into generic favorite tokens
- replace the Swedish-core hierarchy

---

## Anti-cluster / source balancing

The feed should avoid visual source clusters.

Current intent:

- prefer separation between repeated sources
- only reorder when score loss is acceptable
- protect the strongest top-ranked items
- do not introduce artificial time delays

Source balancing is presentation shaping, not editorial scoring.

---

## Motor-change checklist

Before changing ranking/root logic:

1. Read `PRODUCT_CORE.md`.
2. Read this file.
3. Inspect the currently executed route/ranking path.
4. Read the relevant regression tests.
5. Identify preserved invariants before editing.
6. Add/update tests for every intentional behavior change.
7. Verify that freshness, dedupe, favorites/local separation and source balancing still behave as intended.

A rewrite is not complete merely because the new code is cleaner. It must preserve the proven behavior unless the product rule explicitly changes it.
