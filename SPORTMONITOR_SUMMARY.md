# SportMonitor – Fullständig Projektöversikt

## 🎯 VAD ÄR SPORTMONITOR?

**SportMonitor** är en **intelligent Swedish sports news aggregator** som hämtar, klassificerar och rankar nyheter från 60+ RSS-feeds för fotboll och hockey. Appen fokuserar på:

- **Svenska spelare** (både hemma och utomlands)
- **Svenska lag och ligor** (Allsvenskan, SHL, HockeyAllsvenskan)
- **Lokalt innehål** (baserat på användarens geolocation)
- **Favoritmatchning** - hierarkisk (spelare → lag → liga)
- **Intelligenta push-notifikationer** - VIP-nyheter till alla, favoriter til användare

**Användarflöde:**
1. App hämtar nyheter från 60+ feeds (var 2 minut när Vercel-planen stöder Cron)
2. Regelbaserad klassificering identifierar sport (fotboll/hockey) från innehål
3. Nyheter rankas på: Recency, Urgency, Svenska spelare, Favoriter, Käll-auktoritet
4. Frontend visar i två kolumner: ⚽ FOTBOLL | 🏒 HOCKEY
5. Favoriter visas med ★-badge (hierarkisk - spelare → lag)
6. Lokala nyheter märks med 📍 LOKALT

---

## 📚 HISTORIK: TIDIGARE ÄNDRINGAR

Följande punkter är historiska noteringar från tidigare utvecklingsarbete och
beskriver inte nödvändigtvis den aktuella implementationen.

### 1. **Hierarchical Favorite Display** ✅
- **Problem:** Om du favoritmärkerte Alexander Isak, visades bara hans artiklar - inte Liverpools
- **Fix:** Uppdaterade `NewsColumn.tsx` för att visa `favorite_entity_name` från API
- **Resultat:** Nu visar den `★ Alexander Isak` även på Liverpool-artiklar (hierarkisk matching)
- **File:** `src/components/NewsColumn.tsx`

### 2. **Sport Classification Bug** 🐛
- **Problem:** VSK-fotboll från "VLT – Hockey" feedet klassificerades som hockey
- **Root Cause:** Feeds.ts sätter `sport: "hockey"` → sparades direkt utan innehålls-verifie
- **Fix:** Uppdaterade `src/app/api/ingest/route.ts` med `detectSportFromContent()`
- **Resultat:** Artiklar klassificeras RÄTT baserat på innehål (allsvenskan, shl, osv)
- **Files:** 
  - `src/app/api/ingest/route.ts` (ny logic)
  - `src/lib/ranking/score.ts` (historical `detectSportFromContent` helper)

### 3. **Pressgurkan Feed** 📰
- **Vad:** Lade till nya RSS-feed för Allsvenskan-nyheter
- **URL:** http://pressgurkan.se/feed/
- **Authority:** 0.85 (väldigt pålitlig)
- **Files:**
  - `src/lib/feeds.ts` - lagd in som feed med weight: 5
  - `src/lib/ranking/sourceProfiles.ts` - lagd in profil med authority 0.85

### 4. **Version Bump**
- Aktuell package-version: `6.2.0`

---

## 🏗️ ARKITEKTUR & FILSTRUKTUR

```
SportMonitor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ingest/route.ts          ← RSS ingest pipeline (var 2 min)
│   │   │   ├── news/route.ts            ← News API endpoint
│   │   │   ├── favorites/route.ts       ← Favorite sync
│   │   │   ├── push/                    ← Push notification endpoints
│   │   │   │   ├── subscribe/route.ts
│   │   │   │   ├── dispatch/route.ts
│   │   │   │   └── test/route.ts
│   │   │   ├── entities/route.ts        ← Entity search
│   │   │   ├── events/route.ts          ← Analytics
│   │   │   ├── seen/route.ts            ← Read tracking
│   │   │   ├── top/route.ts             ← Top news
│   │   │   ├── debug-env/route.ts
│   │   │   ├── scrape/route.ts
│   │   │   └── force-push/route.ts
│   │   ├── page.tsx                     ← Frontend app
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── logo.png
│   │   └── og.png
│   │
│   ├── components/
│   │   ├── NewsColumn.tsx               ← Main news feed (⚽ & 🏒)
│   │   ├── Badge.tsx                    ← Status badges (JUST NU, LIVE, osv)
│   │   ├── EnablePushButton.tsx         ← Push subscription
│   │   ├── HomeClient.tsx               ← Home page wrapper
│   │   ├── ServiceWorkerRegistrar.tsx   ← Push worker
│   │   ├── TopHighlight.tsx             ← Top news highlight
│   │   ├── ClientTopDropper.tsx
│   │   └── WelcomeModal.tsx
│   │
│   ├── data/
│   │   ├── footballPlayers.ts           ← Svenska fotboll-spelare
│   │   ├── footballTeams.ts             ← Svenska fotboll-lag
│   │   ├── hockeyPlayers.ts             ← Svenska hockey-spelare
│   │   ├── hockeyTeams.ts               ← Svenska hockey-lag
│   │   ├── hockeyStaff.ts               ← Tränare/staff
│   │   └── leagues.ts                   ← Liga-definitioner
│   │
│   └── lib/
│       ├── feeds.ts                     ← RSS-feeddefinitioner [Pressgurkan]
│       ├── ingest/                       ← ingestfilter och feedbearbetning
│       ├── news-engine/                  ← kandidatpipeline, deduplicering, geo och slutrankning
│       ├── ranking-v2/                   ← aktuell rankingkonfiguration och signaler
│       ├── sources/
│       │   ├── hockey.sources.ts        ← Hockey feeds (VLT, SVT, osv)
│       │   ├── football.sources.ts      ← Football feeds
│       ├── ranking/
│       │   ├── score.ts                 ← Scoring algorithm (recency, urgency, swedish players)
│       │   │                              └── detectSportFromContent() [ANVÄNDS IDAG]
│       │   ├── sourceProfiles.ts        ← Source authority & strengths [UPPDATERAD - Pressgurkan]
│       │   └── interleave.ts            ← Diversity interleaving (top 15)
│       │
│       ├── d3e/                         ← D3-relaterad
│       ├── rss.ts                       ← RSS parser
│       ├── detectEntities.ts            ← Entity extraction (players, teams, leagues)
│       ├── pushDispatch.ts              ← Push notification logic (VIP + favorites)
│       ├── pushClient.ts                ← Client-side push
│       ├── pushServer.ts                ← Server-side push
│       ├── supabase.ts                  ← Database client
│       ├── deviceId.ts                  ← Device tracking
│       ├── entityBrowse.ts              ← Entity search/suggestions
│       ├── scrape.ts                    ← Web scraping utilities
│       ├── scraper.py                   ← Python scraper
│       ├── geoConfig.ts                 ← Geolocation config
│       └── types.ts                     ← TypeScript types
│
├── vercel.json                          ← Cron config: "*/2 * * * *" (var 2 min; kräver icke-Hobby-plan)
├── package.json                         ← v6.2.0
├── next.config.ts
├── tsconfig.json
└── [config files]
```

---

## 🔄 DATA FLOW (INGEST PIPELINE)

```
1. RSS FEEDS (60+ sources)
   ↓
2. parseRssFeed() hämtar artiklar
   ↓
3. Filtrering:
   - Ålder < 12 timmar
   - Inte irrelevant sport (damhockey, bowling, osv)
   ↓
4. SPORT VERIFIKATION (NY!)
   - Feed säger: "hockey"
   - detectSportFromContent() kontrollerar innehål
   - Om innehål = "allsvenskan" → sport = "football" ✅
   ↓
5. Entity Detection
   - Vilka spelare/lag/ligor nämns?
   ↓
6. Priority Calculation
   - Spelare = 100 (högsta)
   - Inhemska lag = 80
   - Övrigt = 50
   ↓
7. Upsert to Supabase
   - news_items table
   - news_entities table (relationer)
   ↓
8. Push Dispatch
   - VIP-nyheter (MÅL, JUST NU, osv) → alla
   - Favoriter → relevanta användare
```

---

## 🎯 RANKING ALGORITHM (score.ts)

**Total Score = Recency + Urgency + SwedishPlayer + SwedishAbroadCore + Favorite + SourceAuthority + SourceLeagueFit + SourceCountryFit - SourceClusterPenalty - EvergreenPenalty - StalenessPenalty**

### Recency (exponential decay)
- 0h: 50p
- 4h: 25p
- 12h: 6p
- 24h: 1p

### Urgency (keyword-based)
- MÅL/ASSIST: 16p
- LIVE/BREAKING: 9p
- DONE DEAL/OFFICIELLT: 12p
- Lineup: 12p
- Injury: 7p

### Swedish Players
- Namnmatch (Alexander Isak): 20p
- Entity-match: 22p

### Source Authority
- BBC Sport: 0.95 × 12 = ~11p
- SvenskaFans: 0.65 × 12 = ~8p
- Pressgurkan: 0.85 × 12 = ~10p

### Penalties
- Evergreen (opinion, guide): -6p
- Stale news (>24h hard news): -24p
- Source cluster (5+ från samma källa): -16p

---

## 🗄️ DATABASE (Supabase PostgreSQL)

### Tables
- `news_items` (id, sport, title, url, source, published_at, tags, priority)
- `news_entities` (news_item_id, entity_id, match_type, matched_alias)
- `entities` (id, type, name, league_id, team_id, sport, is_swedish, is_abroad)
- `user_favorites` (device_id, entity_id)
- `user_seen_news` (device_id, news_item_id)
- `push_subscriptions` (device_id, endpoint, auth, p256dh)

---

## 🔑 KEY FEATURES

### ✅ Hierarchical Favorite Matching
```
User favors: Alexander Isak (player)
  → Visar artiklar om:
     - Alexander Isak direkt
     - Newcastle United (hans lag)
     - Premier League (hans liga)
  → Badge visar alltid: "★ Alexander Isak"
```

### ✅ Intelligent Sport Classification
```
Feed: "VLT – Hockey" (säger hockey)
Article: "VSK stålls mot BP" (innehål = fotboll)
Result: sport = "football" ✅ (inte hockey)
```

### ✅ Push Notifications
```
VIP-nyheter (MÅL, OFFICIELLT):
  → Push till ALLA subscribers
  
Favoriter:
  → Push bara till users som favoritmarkerat relevantla lag/spelare
```

### ✅ Local News (📍 LOKALT)
```
User location: Stockholm
  → Visar SVT-nyheter om AIK, Djurgården, Hammarby
  → Märkt med pulsing 📍 LOKALT badge
```

### ✅ Diversity Interleaving
```
Top 15 artiklar: Mix från många källor
Rest: Ren score-ordning (ingen diversity-tvång längre ner)
```

---

## 📊 DEPLOYMENT

**Platform:** Vercel (Next.js)
**Database:** Supabase (PostgreSQL)
**Cron:** Vercel Cron - `*/2 * * * *` (var 2:e minut på plan som stöder schemat; Hobby blockerar deployment tills planen uppgraderas eller en extern scheduler används)
**Push:** Web Push API (standard)
**CI/CD:** Git → Push → Auto-deploy

**Version Management:**
```bash
npm version patch        # update the package version
git push origin main     # Deploy
git tag -a SportMonitor_backup_<version>
git push origin --tags   # Backup
```

---

## 🚀 NÄSTA STEG / KNOWN ISSUES

### Historiskt genomförda ändringar:
- ✅ Hierarchical favorites visar rätt entity-namn
- ✅ Sport classification från innehål (VSK-fotboll klassificeras rätt)
- ✅ Pressgurkan feed tillagd

### TODO Framtida:
- [ ] Slå samman "VLT – Hockey" och "VLT" feeds (samma URL)
- [ ] Frontend-cache management för sport-ändringar
- [ ] A/B test: How much interleaving is optimal?
- [ ] Analytics dashboard

---

## 💾 IMPORTANT ENVIRONMENT VARIABLES

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INGEST_SECRET=<configured in deployment environment>
```

---

## 📝 SNABBKOMMANDON

```bash
# Dev server
npm run dev

# Build & test
npm run build

# Deploy + version bump
npm version patch
git push origin main
git push origin --tags

# Check ingest status (grep)
grep -n "DOMESTIC_KEYWORDS" src/app/api/ingest/route.ts

# See file structure
find src -type f -name "*.ts" | wc -l  # Count files
tree -L 3 src/
```

---

src/ > /tmp/tree.txt && cat /tmp/tree.txt
src/
├── app
│   ├── api
│   │   ├── debug-env
│   │   ├── entities
│   │   ├── events
│   │   ├── favorites
│   │   ├── force-push
│   │   ├── ingest
│   │   ├── news
│   │   ├── push
│   │   ├── scrape
│   │   ├── seen
│   │   └── top
│   ├── globals.css
│   ├── layout.tsx
│   ├── logo.png
│   ├── og.png
│   └── page.tsx
├── components
│   ├── Badge.tsx
│   ├── ClientTopDropper.tsx
│   ├── EnablePushButton.tsx
│   ├── HomeClient.tsx
│   ├── NewsColumn.tsx
│   ├── ServiceWorkerRegistrar.tsx
│   ├── TopHighlight.tsx
│   └── WelcomeModal.tsx
├── data
│   ├── footballPlayers.ts
│   ├── footballTeams.ts
│   ├── hockeyPlayers.ts
│   ├── hockeyStaff.ts
│   ├── hockeyTeams.ts
│   └── leagues.ts
└── lib
    ├── d3e
    ├── detectEntities.ts
    ├── deviceId.ts
    ├── entityBrowse.ts
    ├── feeds.ts
    ├── geoConfig.ts
    ├── pushClient.ts
    ├── pushDispatch.ts
    ├── pushServer.ts
    ├── ranking
    │   ├── interleave.ts
    │   ├── score.ts
    │   └── sourceProfiles.ts
    ├── rss.ts
    ├── scrape.ts
    ├── scraper.py
    ├── ingest
    │   ├── filterPolicy.ts
    │   └── processFeed.ts
    ├── news-engine
    │   ├── pipeline.ts
    │   ├── candidateLoader.ts
    │   ├── sourceBalancing.ts
    │   └── finalRanking.ts
    ├── ranking-v2
    │   ├── rankingConfig.ts
    │   ├── scoreBase.ts
    │   └── scoreSource.ts
    ├── sources
    │   ├── football.sources.ts
    │   └── hockey.sources.ts
    ├── supabase.ts
    └── types.ts

20 directories, 40 files

**LYCKA TILL MED UTVECKLINGEN!** 🚀