# Semantic editorial classification

Candidate keywords now nominate an article for interpretation; they never directly authorize a badge, urgency, hard-news ranking bonus or VIP event.

## Ingest and persistence

1. Existing sport/source/age checks run unchanged.
2. Duplicate URLs within a feed and already stored URLs are removed **before** AI calls. The database unique URL guard still handles insertion races.
3. For new keyword candidates, the server sends the title (maximum 800 characters) and available RSS summary (HTML stripped, maximum 2,400 characters) to Vercel AI Gateway. Tags nominate candidates but are not sent as factual evidence. No article body scraping or external research is added.
4. Strict JSON contains event category, confirmation status, badge, breaking flag and an exact evidence substring. Unknown fields, invalid values or ungrounded evidence invalidate the assessment. Article content is explicitly untrusted data in the prompt.
5. Version, original title, timestamp and model are stored in `news_items.editorial_assessment` **in the initial insert before push dispatch**. No model calls happen on feed reads or UI refreshes.

The additive migration is `migrations/20261014_editorial_assessment.sql`. Existing/unassessed articles remain available as ordinary news; there is no automatic backfill. The existing URL insert-only contract remains: title updates at the source do not overwrite stored articles. If another process changes a stored title, its old assessment becomes invalid immediately and specials are suppressed until explicit reassessment.

## Shared policy and user effect

The news list, top highlight, ranking urgency/big-news signals, event categories/deduplication and push VIP evaluation consume the same saved interpretation. They no longer independently infer these special signals from source tags or words.

- Leaving a match injured can be categorized as injury without a club-departure badge or transfer priority.
- New/extended contracts require a confirmed agreement. Denials, hypothetical agreements and ambiguous headlines receive no contract badge or keyword priority.
- Confirmed club departures display **LÄMNAR KLUBBEN**.
- Here-we-go reports can display **HERE WE GO** and receive bounded ranking priority, while retaining `reported` status. They do not become official or VIP automatically.
- Rumor labels are allowed only for interpreted reported/rumor transfer, departure, contract or management events. Rumors receive no special urgency/VIP.
- Confirmed relevant transfer/departure/contract/management/goal events, or explicitly interpreted breaking events, are eligible for existing VIP handling. AI does not choose recipients: favorite matching, men's scope, sport, freshness, push subscription, dedupe and rate limits continue to decide delivery.
- Local relevance can still influence top-highlight selection, but does not fabricate a JUST NU badge.
- The independent `/api/top` Google RSS path has no saved assessment. Its positive keyword urgency was removed; recency and existing negative editorial penalties remain.

Fail-closed means a normal article, **not a hidden article**. A favorite injury article can still receive a normal favorite notification under existing delivery rules.

## Operation and cost limits

Server authentication uses `AI_GATEWAY_API_KEY`, falling back to Vercel's automatic `VERCEL_OIDC_TOKEN`. Optional `EDITORIAL_AI_MODEL` overrides the default `openai/gpt-4.1-mini`. No keys or model requests are bundled into client UI.

Each ingest request shares a maximum of 40 model calls and 45 seconds of cumulative active model-request time across all feeds, with two concurrent calls at most and an 8-second per-call timeout. Time spent downloading feeds does not consume the AI budget. A reservation/refund mechanism bounds concurrent requests conservatively. Exhausted budgets leave remaining articles ordinary; there are no model retries or hidden read-time costs. Authentication/credit/limit HTTP 401/402/403/429 errors stop additional model attempts for that ingest run. Overlapping external ingest invocations can still race before insert; the unique URL prevents duplicate articles, but a duplicate model call in that race remains possible.

`[editorial] ingest summary` logs and the ingest JSON response report classification/error/missing-credential/budget counters without credentials. Model errors never abort article ingestion.

## Verification

- Unit/integration tests cover misleading keywords, real positive events, spoofed source tags, title binding, malformed/ungrounded responses, HTTP errors, timeout, shared ranking/category/VIP behavior and pre-push ingest ordering/dedupe.
- `SM_EDITORIAL_LIVE_QA=1 npm test -- src/lib/__tests__/editorial/live.test.ts --silent=false --reporter=verbose` opts into eight read-only real-model headline checks. This is skipped by default, requires Gateway authentication and makes no database writes or notifications.
- Model quality is probabilistic; validate production summary counters and periodically review ambiguous headlines. Stored semantic decisions avoid different results between users or refreshes.
