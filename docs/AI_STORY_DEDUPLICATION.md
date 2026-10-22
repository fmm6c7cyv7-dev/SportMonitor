# AI-confirmed story deduplication (2026-10-22)

## Editorial contract
- Ingest and the existing relevance engine decide which articles are eligible.
- Semantic similarity does not qualify otherwise irrelevant articles for ranking.
- VIP, favorite matching, local matching, push policy, and freshness guardrails remain separate.
- Multiple sources can publish the same factual development; serve one chosen source.
- A material follow-up remains a distinct article.
- Publisher brand size is not proof of article quality or accessibility.

## Feature
1. On ingest, URL deduplication and editorial classification run unchanged.
2. The story prefilter proposes pairs within 3 hours, in the same sport, with a shared team/player/staff entity and at least 0.10 lexical similarity.
3. Vercel AI Gateway compares titles and new article summary. It must confirm the same specific development, no material update and confidence >=0.90. Invalid responses fail open.
4. Confirmed pairs receive durable story membership in public.news_story_members; original news_items are retained.
5. Public /api/news selects one representative using existing source scoring and freshness, while protecting unread pushed stories.
6. Hide-read checks all article IDs in a story, preventing a read event from resurfacing after a source replacement.
7. AI-confirmed reposts are excluded from a second push dispatch. Substantive follow-ups remain eligible.

## Cost and deployment
- Max 8 semantic model calls and 18 seconds reserved active model time across one ingest invocation; max 3 candidates per new article. No AI requests on public news reads.
- The budget is separate from editorial classification.
- One bounded candidate retrieval scans at most 160 recent articles per feed ingest.
- Errors are fail-open: no AI or storage means unchanged feed; ingestion is never blocked.
- Deployment order: apply and verify migration migrations/20261022_news_story_members.sql, then merge the verified PR to main. No automatic assumption that code deploy applies SQL.
- Older news is not retroactively grouped. Only newly ingested stories get AI links.

## Current limitations
- Reliable paywall/accessibility data is not held at article level; the source choice uses existing authority and freshness, not verified free access.
- Client-only read markers without hide-read remain article-ID based; server-side hide-read resolves story identity.
- AI may miss or reject ambiguous stories. Observe story_matched, story_distinct, story_invalid, story_timeout, story_storage_unavailable counters.
- The 0.10 similarity floor is only an AI-candidate filter, not a duplicate verdict.
