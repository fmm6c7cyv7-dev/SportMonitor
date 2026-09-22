# SportMonitor – System Map

## High-level Flow

RSS Sources
↓
Ingest API
↓
RSS Parser
↓
Entity Detection
↓
Ranking
↓
Supabase Database
↓
Push Dispatch
↓
Frontend Feed

---

## Detailed Flow

### 1. RSS Sources
External sports news feeds provide incoming articles.

### 2. Ingest API
The ingest route fetches and processes incoming RSS data.

### 3. RSS Parser
`src/lib/rss.ts` parses feed content into normalized article objects.

### 4. Entity Detection
`src/lib/detectEntities.ts` identifies:
- teams
- players
- leagues

### 5. Ranking
Articles are scored based on factors like:
- freshness
- source
- favorite relevance
- entity match

### 6. Supabase Database
Articles, subscriptions and related data are stored in Supabase.

### 7. Push Dispatch
`src/lib/pushDispatch.ts` decides whether notifications should be sent.

### 8. Frontend Feed
The frontend presents content through:
- TopHighlight
- NewsColumn

---

## Push Flow

New article
↓
Entity detection
↓
Favorite / event match
↓
Push decision
↓
Web Push
↓
User device

---

## PWA Flow

User opens installed app
↓
iPhone / Android standalone mode
↓
App startup
↓
Initial render
↓
Feed UI loads

Important iOS concern:
white flash at startup if Apple startup handling and app background are not aligned.
