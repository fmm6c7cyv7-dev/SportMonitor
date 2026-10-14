# SportMonitor – Product Core Rules

## Core mission

SportMonitor is a simple way to follow:

- Swedish football and hockey in Sweden
- Swedish football and hockey players abroad
- Swedish coaches / staff abroad

This is the primary product task. SportMonitor is not a general sports aggregator.

## Competition scope — hard product boundary

The current football and hockey product is **men's senior sport**.

Women's football and women's hockey must not enter the normal SportMonitor news
pipeline, entity/ranking context or SportAdmin surface by accident. Explicit
women's-sport content is rejected at ingest by
`src/lib/ingest/filterPolicy.ts` before entity detection, ranking and database
persistence.

This is a non-regression rule. A future women's product would require an
explicit separate product decision and data/ranking scope; it must not be
silently mixed into the men's feed.

---

## Editorial priority

### Tier 1 — Swedish core

The feed should first prioritize sufficiently fresh news about:

- Swedish football and hockey leagues, clubs and relevant domestic events
- Swedish players abroad
- Swedish coaches / staff abroad

Tier 1 is the product core.

### Tier 2 — Direct surrounding context

When Tier 1 does not fill the feed, prioritize news from:

- clubs that currently have Swedish players or Swedish coaches / staff
- leagues in which those clubs compete
- events that materially affect the Swedish player's or coach's sporting context even when the Swede is not named in the headline

Tier 2 should support the Swedish core, not compete with it as equal generic world news.

### Tier 3 — Broader sports context

If there is still room, fill the feed with other relevant football and hockey news from monitored clubs, leagues and high-quality sources.

Generic international news is fill, not the product core.

---

## Freshness is a hard guardrail

Editorial relevance must never make stale news dominate the live feed.

Current non-regression rules:

- 0–3 hours: fresh pool
- 3–6 hours: normal fallback pool
- older than 6 hours: excluded from the normal feed
- up to 72 hours: only eligible as hide-read backfill when the normal feed cannot fill the requested slots
- a strong core item may only jump one adjacent freshness bucket, and only when the existing score thresholds allow it

A Swedish player, Swedish club, favorite or local match is therefore **not** a license to pin old news above good fresh news.

---

## Favorites and local relevance

Favorites and local relevance are additive personalization signals.

They may reorder sufficiently fresh items, but they must not:

- bypass the normal freshness ceiling
- collapse local and favorite into the same signal
- override the Swedish-core editorial purpose

---

## Source and presentation principles

The feed should:

- prioritize relevance over volume
- remain live and readable
- avoid clusters from the same source
- use source authority as a supporting signal, not the main editorial signal
- preserve dedupe, source balancing and hide-read behavior

---

## Club-relative source value and reader experience

For a smaller club, a specialist local or supporter-run publication can be the
most useful primary coverage. **Do not impose an automatic authority penalty
because a publisher is labelled fan/community or is smaller than BBC.**
Evaluate independently:

- **Club relevance and original coverage:** detailed reporting, continuity,
  interviews, team context and direct value to followers of the club.
- **Reliability:** distinguish independently verified reporting, first-hand
  sources, official announcements, sourced reports, speculation and promotion.
  A trusted specialist source cannot make an unconfirmed rumor into VIP.
- **Reader accessibility:** free readable articles are preferred. Moderate
  advertising is not disqualifying. Intrusive ads, forced login, paywalls,
  advertorials or betting-affiliate-heavy landing pages lower reader-value
  suitability, but do not automatically negate reliable journalism.
- **Coverage scope:** men's senior first-team news must be separated from
  women's, academy, ticket sales, merchandising, podcasts and generic football.

A club-focused article can outrank a less relevant story from a major news
brand **within existing Tier 1/2/3 editorial relevance and freshness
guardrails**. This is a proposed source evaluation policy, not a newly enabled
scoring signal or a change to current ranking weights. Preserve canonical
dedupe, bounded source balancing, favorite/local separation and push policy.
Only onboard after real endpoint/feed tests establish freshness, accessible
article URLs, original reporting, source reliability and scope filtering.

Initial cases: Lincoln City / The Stacey West and SC Heerenveen / FeanOnline.
See `docs/CLUB_SOURCE_EVALUATION_20261014.md`.

---

## Future extension — former Sweden players

A future category may track selected foreign players who previously played in Sweden and later moved abroad.

Examples discussed:

- Mikkel Ladefoged
- Taha Ali

This category is **not implemented yet** and must remain below the Swedish core when introduced.

---

## Product feel

SportMonitor should feel like:

> Sweden and Swedes first, the football and hockey world around them second, and the rest of the sports world only when there is room.
