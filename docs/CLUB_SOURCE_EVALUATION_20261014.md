# Club-source evaluation — Lincoln City and SC Heerenveen
Date: 2026-10-14. **Research only: no source enabled and no source-weight change.**

## Method and policy
Reference `PRODUCT_CORE.md`, `RANKING_SYSTEM.md` and
`SPORTMONITOR_EDITORIAL_MODEL.md`. Club-relative value must be separated
from reliability and reading accessibility. Do not infer an RSS endpoint from
WordPress conventions alone. A website accessible via search is not proof
that ingestion works (valid feed, stable published timestamps, entries,
robots, rate limits, redirects and durable article URLs).

## The Stacey West — Lincoln City
- Publication: https://staceywest.net/
- Evidence: https://staceywest.net/2026/10/11/500th-episode-special-lincoln-city-head-coaches-chris-cohen-tom-shaw-join-us/
  (interview with Lincoln City head coaches, dated October 11, 2026).
- Publisher's background: https://garyhutchinson.co.uk/about-my-sites/
  (established in 2016; multiple contributors and podcast).
- **Editorial fit: high** for sustained Lincoln coverage, interviews and
  club-context content; can outrank generic national coverage of other
  clubs when relevant to Swedish-player/team context.
- **Reader experience: provisional**. Advertising exists; public web article
  can be opened, but mobile intrusive-ad and paywall behavior remain untested.
- **RSS URL discovered:** https://staceywest.net/feed/ returned an
  `application/rss+xml` content-type to the web retrieval layer on 2026-10-14.
  The tool cannot display/parse XML feeds and reports unsupported content type.
  This is **not** verification of feed entries, 200/304 status, freshness,
  canonical URL quality or backend runtime compatibility.
- **Technical ingest: blocked pending XML parse** and repeated runtime fetch;
  publication timestamps, endpoint stability and duplicate rate remain unknown.
- **Decision: candidate, not yet active**.

## FeanOnline — SC Heerenveen
- Publication: https://www.feanonline.nl/
- Publisher: https://www.feanonline.nl/over-ons/ (BN Media).
- Evidence: dedicated SC Heerenveen news and transfer coverage on homepage;
  explicitly links RSS in site navigation/footer. Official account of
  advertisements, advertorials and gambling affiliate links in publisher info.
- **Editorial fit: high** within SC Heerenveen context; a small-club specialist
  can rank strongly, without granting general international-news authority.
- **Reliability: article-dependent**. Distinguish original reporting,
  sourced reporting, speculation, and advertorials; never convert rumors
  to VIP. Gambling affiliate content must not enter sports-news feed.
- **Reader experience: provisional**. Presence of a login option does not
  establish a compulsory login for reading. Advertising/affiliate disclosure
  is a review flag, not an automatic exclusion; test actual article pages.
- **Mixed sport scope:** women's content has separate navigation; ingest must
  reject it in men's feed. Exclude promotional and generic match-odds posts.
- **RSS URL discovered:** FeanOnline's own visible RSS link resolves to
  https://www.feanonline.nl/feed/news.rss (site footer). On 2026-10-14
  direct web retrieval reported cache miss, so XML, HTTP response status,
  entry dates, GUID and canonical article URLs **remain unverified**.
- **Article accessibility sample:** a publicly retrievable item
  https://www.feanonline.nl/linday-gevraagd-naar-transfer-dat-is-alles-wat-ik-kan-zeggen/
  contains a readable article with headline, timestamp, author, original
  source credit ('bron: Voetbal International'), summary and original citation
  without requiring login in the retrieved HTML view. It describes Swedish
  player Marcus Linday and Braga transfer interest as a report, **not
  confirmed VIP**. One example does not prove the absence of mobile overlays.
- **Scope warning:** mixed site navigation contains women's football; article
  selection must exclude those URLs. The publisher's editorial archive also
  contains bookmaker/odds promotions and unrelated consumer advertorials;
  exclude these from ingestion.
- **Technical ingest: blocked pending XML parse** and stable runtime fetch.
- **Decision: candidate, not yet active**.

## Technical onboarding gate (both)
1. Determine exact discoverable RSS/Atom/sitemap or stable HTML ingestion URLs;
   verify response code, content type, publication date, live entries and
   redirect/canonical URLs over a 7-day sample.
2. Confirm article reading without login; assess intrusive ads/popups and
   distinguish editorial material from sponsorship and gambling promotions.
3. Validate men's senior scope and Swedish-player/team canonical associations;
   neutral users must not get broad Tier 3 club-source dominance.
4. Dry-run existing dedupe and source balancing against 12/30 production
   articles, measure net new original articles and duplicates by source.
5. Add source profiles and regression tests only if measurable incremental
   utility is demonstrated; no ranking-weight changes merely by category.

## Decision
**Approve the club-relative assessment principle. Hold feed activation and
score changes until the technical/onboarding gates pass.** No claim is made
that a specific RSS endpoint or automated fetch has been validated.

## Verified observations from follow-up (2026-10-14)

| Gate | The Stacey West | FeanOnline |
|---|---|---|
| Exact publisher RSS link | WordPress-compatible /feed/ observed as RSS MIME | Explicit site footer link /feed/news.rss |
| XML entry parsing | NOT VERIFIED | NOT VERIFIED |
| HTTP 200, timestamps, GUID, links | NOT VERIFIED | NOT VERIFIED |
| Accessible article evidence | Public article indexed; login experience untested | One article readable without login via web retrieval |
| Swedish-player value | Requires canonical club/player relation audit | Marcus Linday article demonstrably relevant |
| Men's scope | Exclude mixed/general content | Explicit women's channel, must filter |
| Ads/paywall mobile QA | Untested | Untested; site discloses ads/affiliates |
| Seven-day net-new / duplicates | NOT MEASURED | NOT MEASURED |
| Activate in ingest | NO | NO |

**Why no activation:** This environment's website fetcher rejects RSS XML
presentation for Stacey West and cannot retrieve FeanOnline's XML. The
container's outbound DNS is also unavailable. These conditions prevent a
valid 7-day article-level dry run and would make an activation speculative.
The correct next implementation block is a controlled read-only probe from
the deployed SportMonitor runtime or an authorized development environment;
only after proven HTTP/XML parsing and scope filters should source registry
entries and associated source profiles be enabled.

## Live read-only runner findings — 2026-10-14

The isolated GitHub Actions probe in PR #17 made HTTPS GET requests only,
without ingest credentials, Supabase writes, editorial model calls or push.

| Result | The Stacey West | FeanOnline |
|---|---:|---:|
| Response | HTTP 200 | HTTP 200 |
| MIME | application/rss+xml | application/rss+xml |
| RSS items | 5 | 88 |
| Valid dated item links | 5 | 88 |
| Items in most recent seven days | 5 | 84 |
| Unique item URLs | 5 | 88 |
| Simple title-filter scope warning | 0 | 1 |

All item links pointed to their expected publisher host. Public production
Supabase read-only URL-domain lookup returned **zero existing articles** for
either domain, so URL-level exact overlap with those sources is zero as of
the query, but **cross-source canonical/event similarity remains unmeasured**.

**Editorial implications:** Stacey West has a manageable, low-volume feed but
its non-league regional roundups and West Ham stories must not automatically
receive Lincoln-specific relevance. FeanOnline's 84 articles in seven days
must be constrained by source and article eligibility, not automatically
displace Swedish Tier 1 news. The single simple scope keyword hit is **not**
proof that other disallowed articles are absent (Dutch content needs more
precise classification than English/Swedish title keywords).

**Decision:** technical RSS transport/entry validation PASS; content
classification, canonical entity linkage, duplicate-event simulation,
mobile article accessibility and first-12/30 impact **NOT YET VERIFIED**.
Do not activate either source in the production registry on RSS response
alone. No source weights, favorites, VIP, push or app version changed.
