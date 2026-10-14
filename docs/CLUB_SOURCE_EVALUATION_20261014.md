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
- **Technical ingest: unverified**. Live XML/RSS response, schema, publication
  timestamps, endpoint stability and duplicate rate need a real fetch audit.
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
- **Technical ingest: unverified**. RSS label exists, but feed URL, XML
  validity, timestamps, link access and runtime fetch reliability are not yet
  independently proven.
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
