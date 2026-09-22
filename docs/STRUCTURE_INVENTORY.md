# SportMonitor 2.0 — Structure Inventory

Status baseline: `2becf2816cc5085a59136755785f3ab9d8423801`

This inventory closes Phase 1 of the SportMonitor 2.0 restructuring work. The purpose is to record what each runtime file does today, whether the responsibility is clean or mixed, the smallest sensible cleanup, and its future classification.

The product invariants in `PRODUCT_CORE.md`, `RANKING_SYSTEM.md` and `SWEDISH_STAFF_ABROAD.md` are higher priority than structural cleanliness. Refactors must preserve working freshness, dedupe, source-balancing, favorite/local separation, men's-sport scope and push safety.

## Classification legend

- **Keep in SportMonitor 2.0** — responsibility is already clear.
- **Keep but split later** — valid responsibility, but the file is too broad.
- **Move later** — responsibility is valid but lives in the wrong domain.
- **Rewrite in engine phase** — legacy/hybrid implementation should be replaced by the new engine.
- **Likely removal candidate** — unused or superseded artifact; remove only after import/search verification.

---

# App shell

| File | Current role | Responsibility assessment | Internal sections / cleanup | Future |
| --- | --- | --- | --- | --- |
| `src/app/layout.tsx` | App shell, metadata and service-worker bootstrap | Clear | Keep metadata/bootstrap separate | Keep in SportMonitor 2.0 |
| `src/app/page.tsx` | Composes main page and server-side shell | Clear | No motor logic belongs here | Keep in SportMonitor 2.0 |
| `src/app/globals.css` | Global visual rules | Clear | Keep UI-only | Keep in SportMonitor 2.0 |
| `src/proxy.ts` | Request proxy/middleware behavior | Clear but security-sensitive | Auth/route rules only | Keep in SportMonitor 2.0 |

# API routes

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/app/api/ingest/route.ts` | Authenticates cron, loads aliases and iterates feeds | Now reasonably thin | Must remain orchestration-only | Keep in SportMonitor 2.0 |
| `src/app/api/news/route.ts` | Candidate load, seen, favorites, geo, dedupe, freshness, ranking, backfill, serialization | **Major hybrid / highest-risk file** | Move all non-HTTP steps to feed pipeline services | Rewrite in engine phase |
| `src/app/api/favorites/route.ts` | Favorite persistence and text-ID→UUID resolution | Mixed API + compatibility resolution | Extract resolver/persistence service later | Keep but split later |
| `src/app/api/entities/route.ts` | Entity browse API | Clear | Delegate catalog/search only | Keep in SportMonitor 2.0 |
| `src/app/api/events/route.ts` | Event write/read API surface | Clear | Keep thin | Keep in SportMonitor 2.0 |
| `src/app/api/seen/route.ts` | Read-state persistence | Clear | Keep thin | Keep in SportMonitor 2.0 |
| `src/app/api/scrape/route.ts` | Admin/debug scraper endpoint | Mostly clear | Route should only call scraper service | Keep in SportMonitor 2.0 |
| `src/app/api/top/route.ts` | Separate top-news fetch/scoring path | Duplicates ranking concepts | Migrate to shared engine/top selection | Rewrite in engine phase |
| `src/app/api/push/dispatch/route.ts` | Internal push trigger | Clear | Keep auth + dispatch only | Keep in SportMonitor 2.0 |
| `src/app/api/push/subscribe/route.ts` | Subscription persistence | Clear | Keep thin | Keep in SportMonitor 2.0 |
| `src/app/api/push/test/route.ts` | Protected push test endpoint | Clear admin role | Keep isolated from production decisions | Keep in SportMonitor 2.0 |
| `src/app/api/force-push/route.ts` | Protected forced push/debug route | Special-purpose | Keep internal-only; review eventual need | Keep but split later |
| `src/app/api/debug-env/route.ts` | Protected environment diagnostics | Special-purpose | Keep strongly protected | Keep in SportMonitor 2.0 |
| `src/app/api/debug/favorite-audit/route.ts` | Favorite delivery diagnostics | Clear debug role | Keep debug-only | Keep in SportMonitor 2.0 |
| `src/app/api/debug/favorite-audit/run/route.ts` | Executes favorite audit | Clear debug role | Keep debug-only | Keep in SportMonitor 2.0 |
| `src/app/api/debug/news-entities/run/route.ts` | Rebuild/debug entity links | Operational migration logic in route | Move worker logic into entity service | Keep but split later |

# UI components

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/components/HomeClient.tsx` | Client wrapper for home | Clear | No motor logic | Keep in SportMonitor 2.0 |
| `src/components/Badge.tsx` | News badges | Clear | Presentation only | Keep in SportMonitor 2.0 |
| `src/components/ToggleSwitch.tsx` | Shared accessible toggle | Clear | Reuse for settings | Keep in SportMonitor 2.0 |
| `src/components/ServiceWorkerRegistrar.tsx` | Registers PWA worker | Clear | No push policy here | Keep in SportMonitor 2.0 |
| `src/components/ClientTopDropper.tsx` | Client behavior for top highlight | Clear enough | Keep state/render separated | Keep in SportMonitor 2.0 |
| `src/components/EnablePushButton.tsx` | Push permission/subscription UI | UI + browser orchestration | Keep policy server-side | Keep in SportMonitor 2.0 |
| `src/components/WelcomeModal.tsx` | Onboarding modal | Clear | Presentation only | Keep in SportMonitor 2.0 |
| `src/components/TopHighlight.tsx` | Top-card rendering and selection support | Some selection logic mixed with presentation | Selection belongs in engine/service | Keep but split later |
| `src/components/NewsColumn.tsx` | Feed UI, settings, favorites search/state, read-state interactions | **Large UI hybrid** | Split settings/favorites/feed rendering into UI modules after motor stabilizes | Keep but split later |

# Static/catalog data

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/data/footballPlayers.ts` | Curated Swedish football-player catalog | Clear data ownership | Move under entity catalog domain later | Move later |
| `src/data/footballTeams.ts` | Football team catalog | Clear data ownership | Move under entity catalog domain later | Move later |
| `src/data/hockeyPlayers.ts` | Hockey-player/NHL catalog | Clear but very large | Split generated/static dataset from type definitions | Move later |
| `src/data/hockeyTeams.ts` | Hockey team catalog | Clear | Move under entity catalog domain later | Move later |
| `src/data/leagues.ts` | League catalog | Clear | Move under entity catalog domain later | Move later |
| `src/data/hockeyStaff.ts` | SHL/HockeyAllsvenskan staff catalog | Clear data role, currently not in browse graph | Move to entity catalog/staff | Move later |
| `src/data/swedishStaffAbroad.ts` | Verified Swedish senior staff abroad | Clear and product-critical | Later map to canonical staff entities | Move later |

# Ingest and sources

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/feeds.ts` | Feed types, curated registry, source→feed adapter, active filtering and dedupe | Multiple related responsibilities | Move registry/adaptation into `ingest/sourceRegistry.ts`; retain compatibility facade temporarily | Keep but split later |
| `src/lib/sources/football.sources.ts` | Football source registry | Clear | Move to ingest/sources namespace | Move later |
| `src/lib/sources/hockey.sources.ts` | Hockey source registry | Clear | Move to ingest/sources namespace | Move later |
| `src/lib/rss.ts` | RSS/Atom fetch and parse | Stable, cohesive | Rename/move only if imports benefit | Keep in SportMonitor 2.0 |
| `src/lib/scrape.ts` | Special web scrapers | Multiple scrapers but same domain | Split per source only when needed | Keep but split later |
| `src/lib/ingest/filterPolicy.ts` | Hard content exclusion, including men's-sport boundary | Clear policy module | Keep separately tested | Keep in SportMonitor 2.0 |
| `src/lib/ingest/processFeed.ts` | Load→normalize→filter→verify→entities→priority→persist→push | **Large ingest pipeline hybrid** | Split source load, normalization, classification, persistence, post-persist delivery | Keep but split later |
| `src/lib/scraper.py` | Standalone EliteProspects CSV scraper | Not imported by application; different runtime/tooling | Remove after confirming no operational dependency | Likely removal candidate |

# Entity domain

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/detectEntities.ts` | Compatibility facade over new entity modules | Clear facade | Keep temporarily, later remove after imports migrate | Move later |
| `src/lib/entities/entityTypes.ts` | Entity detection contracts | Clear but DB type lacks staff today | Expand only with explicit schema migration | Keep in SportMonitor 2.0 |
| `src/lib/entities/entityAliasStore.ts` | Loads canonical entity aliases from Supabase | Clear persistence adapter | Keep DB concerns here | Keep in SportMonitor 2.0 |
| `src/lib/entities/entityDetection.ts` | Lexical alias matcher | Clear pure domain logic | Keep independent from relation graph | Keep in SportMonitor 2.0 |
| `src/lib/entityBrowse.ts` | Catalog construction, aliases, relation indexes, search, presentation helpers | **Major entity hybrid** | Split catalog, relation graph and browse/search | Keep but split later |

# News/feed support

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/news/newsTypes.ts` | Route/feed intermediate types | Clear but route-specific | Move contracts toward feed pipeline types | Move later |
| `src/lib/news/feedService.ts` | Feed helper service | Cohesive | Align with final pipeline | Keep in SportMonitor 2.0 |
| `src/lib/news/newsDedupe.ts` | Text normalization, similarity, event heuristics, Swedish fallback terms, stateful dedupe | **Highly mixed legacy core** | Move generic duplicate/event logic into news-engine; remove editorial name lists from dedupe | Rewrite in engine phase |
| `src/lib/news/newsFavorites.ts` | Favorite expansion, entity relations and ranking preparation | Large but bounded | Move relationship expansion to entity graph and favorite policy to personalization | Keep but split later |
| `src/lib/news/newsGeo.ts` | Geo region config, token normalization and local matching | Large but cohesive domain | Separate region registry from matching | Keep but split later |
| `src/lib/news/newsFeedSort.ts` | Legacy/feed sorting helpers | Overlaps route + engine sorting | Consolidate into serving/ranking engine | Rewrite in engine phase |
| `src/lib/news/favoriteSync.ts` | Favorite synchronization | Clear | Keep personalization domain | Keep in SportMonitor 2.0 |

# Engine contracts/orchestration

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/news-engine/types.ts` | New engine contracts | Correct foundation | Expand cluster/editorial metadata carefully | Keep in SportMonitor 2.0 |
| `src/lib/news-engine/errors.ts` | Engine error taxonomy | Clear | Shared by motor | Keep in SportMonitor 2.0 |
| `src/lib/news-engine/candidateLoader.ts` | Legacy accepted-item→NormalizedArticle adapter | Useful migration boundary | Enrich canonical entity context before final engine adoption | Keep but split later |
| `src/lib/news-engine/sportGuard.ts` | Sport consistency gate | Clear | Keep as pre-ranking guard | Keep in SportMonitor 2.0 |
| `src/lib/news-engine/pipeline.ts` | Scoring/final ranking orchestration | Clear but incomplete motor | Add clustering/entity stages as they become production-ready | Keep in SportMonitor 2.0 |
| `src/lib/news-engine/finalRanking.ts` | Score floor, order, source balancing, limit | Clear | Preserve presentation shaping separation | Keep in SportMonitor 2.0 |
| `src/lib/news-engine/sourceBalancing.ts` | Anti-source-cluster reorder | Clear | Canonical replacement for legacy interleave | Keep in SportMonitor 2.0 |
| `src/lib/news-engine/duplicateDetection.ts` | Empty scaffold | Missing implementation | Implement generic duplicate analysis | Rewrite in engine phase |
| `src/lib/news-engine/eventClustering.ts` | Empty scaffold | Missing implementation | Implement event grouping | Rewrite in engine phase |
| `src/lib/news-engine/clusterSelection.ts` | Empty scaffold | Missing implementation | Implement representative selection | Rewrite in engine phase |
| `src/lib/news-engine/entityEnrichment.ts` | Empty scaffold | Missing implementation | Implement canonical enrichment bridge | Rewrite in engine phase |
| `src/lib/news-engine/favoriteAffinity.ts` | Empty scaffold | Superseded by ranking-v2 module | Remove or make explicit facade; do not duplicate logic | Likely removal candidate |
| `src/lib/news-engine/geoAffinity.ts` | Empty scaffold | Superseded by ranking-v2 module | Remove or make explicit facade; do not duplicate logic | Likely removal candidate |

# Active ranking v2

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/ranking-v2/rankingConfig.ts` | Ranking thresholds and big-news config | Clear | Add product-tier weights here if centralized | Keep in SportMonitor 2.0 |
| `src/lib/ranking-v2/scoreBase.ts` | Orchestrates active score components | Large orchestrator but correct home | Keep score-only; move text/catalog inference out | Keep but split later |
| `src/lib/ranking-v2/scoreBigNews.ts` | Hard/big-news scoring | Clear | Keep pure | Keep in SportMonitor 2.0 |
| `src/lib/ranking-v2/scoreCoreIdentity.ts` | Swedish/core identity scoring | Important but overlaps editorial classifier | Converge on one editorial relevance input | Rewrite in engine phase |
| `src/lib/ranking-v2/scoreFavoriteAffinity.ts` | Favorite signal scoring | Clear | Use same relation truth as push/news | Keep in SportMonitor 2.0 |
| `src/lib/ranking-v2/scoreGeo.ts` | Geo/local scoring | Clear | Use same local truth as route | Keep in SportMonitor 2.0 |
| `src/lib/ranking-v2/scorePenalties.ts` | Evergreen/staleness/duplicate penalties | Clear | Preserve freshness guardrail separation | Keep in SportMonitor 2.0 |
| `src/lib/ranking-v2/scoreSource.ts` | Source authority/league/country fit | Clear | Keep supporting—not editorial—signal | Keep in SportMonitor 2.0 |

# Ranking compatibility / legacy area

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/ranking/contentSignals.ts` | Sport/content classification helpers | Active outside legacy ranking | Move to classification domain | Move later |
| `src/lib/ranking/editorialRelevance.ts` | Current Tier 1/2/3 product classifier | Active and product-critical | Move into engine/classification | Move later |
| `src/lib/ranking/sourceProfiles.ts` | Source registry + authority + regional policies | Very large configuration hybrid | Split source data, authority and regional policy | Keep but split later |
| `src/lib/ranking/rankingTypes.ts` | Transitional types used by ingest/news/sport guard | Active compatibility contract | Shrink as engine types take over | Move later |
| `src/lib/ranking/rankingSignals.ts` | Keyword registries; some active sport detection, some legacy Swedish lists | Mixed | Keep sport signals; remove duplicate person lists | Keep but split later |
| `src/lib/ranking/score.ts` | Previous ranking engine | No runtime imports found | Remove after documentation/tests migrate | Likely removal candidate |
| `src/lib/ranking/scoringFeatures.ts` | Previous ranking score components | Only imported by legacy `score.ts` | Remove together with legacy ranking | Likely removal candidate |
| `src/lib/ranking/interleave.ts` | Previous source interleave | No runtime imports found; replaced by `sourceBalancing.ts` | Remove after verification | Likely removal candidate |

# Push

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/pushClient.ts` | Browser subscription/service-worker client | Clear | Keep client-only | Keep in SportMonitor 2.0 |
| `src/lib/pushServer.ts` | Web-push transport | Clear | Transport only | Keep in SportMonitor 2.0 |
| `src/lib/pushDispatch.ts` | Compatibility re-export | Clear migration facade | Remove after callers use push domain | Move later |
| `src/lib/push/pushTypes.ts` | Push contracts | Clear | Align PushCandidate with engine | Keep in SportMonitor 2.0 |
| `src/lib/push/pushPolicy.ts` | Push eligibility policy | Clear | Reuse engine signals | Keep in SportMonitor 2.0 |
| `src/lib/push/pushMatching.ts` | Favorite/entity matching for push | Potential duplicate truth | Migrate to shared entity/favorite relations | Keep but split later |
| `src/lib/push/pushAudience.ts` | Recipient/subscription selection | Clear | Keep DB/user concerns here | Keep in SportMonitor 2.0 |
| `src/lib/push/pushDispatch.ts` | Push orchestration and delivery logging | Valid but should consume engine decision | Refactor after cluster/entity truth is shared | Keep but split later |

# Events/audit/server/common

| File | Current role | Responsibility assessment | Cleanup / target | Future |
| --- | --- | --- | --- | --- |
| `src/lib/events/eventTypes.ts` | Event contracts | Clear | May merge with engine event cluster types later | Keep in SportMonitor 2.0 |
| `src/lib/events/eventWrite.ts` | Event persistence | Clear | Persistence only | Keep in SportMonitor 2.0 |
| `src/lib/audit/favoriteDeliveryAudit.ts` | Favorite push/feed delivery diagnostics | Clear audit role | Keep separate from runtime policy | Keep in SportMonitor 2.0 |
| `src/lib/server/internalRouteAuth.ts` | Internal route authentication | Clear security boundary | No business logic | Keep in SportMonitor 2.0 |
| `src/lib/supabase.ts` | Supabase clients | Clear infrastructure role | Keep centralized | Keep in SportMonitor 2.0 |
| `src/lib/deviceId.ts` | Device identity helper | Clear client utility | Keep | Keep in SportMonitor 2.0 |
| `src/lib/types.ts` | Shared frontend/news types | Transitional shared contract | Gradually narrow domain leakage | Keep in SportMonitor 2.0 |

## Phase 1 conclusions

The codebase is not structurally broken. The principal risks come from **parallel truths** and **hybrid orchestration**, not from lack of folders.

Highest-priority problem files:

1. `src/app/api/news/route.ts`
2. `src/lib/news/newsDedupe.ts`
3. `src/lib/entityBrowse.ts`
4. `src/lib/ingest/processFeed.ts`
5. `src/lib/ranking/sourceProfiles.ts`
6. `src/components/NewsColumn.tsx`

Highest-priority duplicated concepts:

- legacy ranking vs `ranking-v2`
- legacy interleave vs `news-engine/sourceBalancing`
- hardcoded Swedish player lists vs canonical player catalog
- route-level editorial boosts vs ranking core identity
- event heuristics in `newsDedupe.ts` vs empty event engine
- relation logic spread between browse, favorites and push

Phase 2 should therefore optimize for **one source of truth per concept**, not simply fewer files.
