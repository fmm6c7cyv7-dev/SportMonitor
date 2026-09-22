# SportMonitor 2.0

SportMonitor 2.0 är en sportnyhetsaggregator för **fotboll och hockey**. Systemet hämtar in artiklar från ett stort antal RSS-källor och utvalda scrapers, lagrar dem i Supabase, rankar dem med flera signaler och visar dem i ett personaliserat flöde med stöd för favoriter, lokala träffar och push-notiser.

Målet är att samla relevanta sportnyheter på ett ställe och ge användaren ett smartare, renare och mer relevant flöde än traditionella generella nyhetsidor.

<img width="682" height="716" alt="Skärmavbild 2026-09-22 kl  17 32 47" src="https://github.com/user-attachments/assets/6926fbe3-4535-48bb-b526-9e90c4db95a3" />

<img width="679" height="750" alt="Skärmavbild 2026-09-22 kl  17 35 25" src="https://github.com/user-attachments/assets/947f0b85-1025-4986-9b05-0a4929573d61" />

<img width="682" height="751" alt="Skärmavbild 2026-09-22 kl  17 34 12" src="https://github.com/user-attachments/assets/c165acc0-bbaa-49e8-8816-50974aa68055" />



---

## Översikt

Projektet är byggt med:

- **Framework:** Next.js (App Router)
- **Språk:** TypeScript
- **UI:** React + Tailwind CSS
- **Databas:** Supabase (PostgreSQL)
- **Hosting & deploy:** Vercel
- **Push:** Web Push / Service Worker / VAPID

SportMonitor kombinerar:
- ingest av sportnyheter
- klassificering och filtrering
- ranking
- entity-detektering
- favoriter och personalisering
- push-notiser
- lokal relevans via geo-matchning

---

## Huvudfunktioner

### 1. Intelligent ingest och klassificering

Systemet hämtar nyheter från ett stort antal RSS-källor samt vissa specialscrapers.

Funktioner i ingest-lagret:

- filtrering av irrelevanta artiklar
- sportklassificering för fotboll och hockey
- skydd mot blandade källor som läcker icke-sportinnehåll
- normalisering av rubriker, källor, taggar och tidsstämplar
- entity-detektering för spelare, lag och ligor
- prioritering av viktiga och lokalt/domestiskt relevanta nyheter

### 2. Ranking och feed-ordning

Nyheter går genom kandidat- och rankingpipelines i `src/lib/news-engine/` och
`src/lib/ranking-v2/`. Äldre hjälpfunktioner i `src/lib/ranking/` finns kvar
för kompatibilitet och återanvändbara signaler.

Exempel på signaler:

- **recency** – nyare artiklar får högre vikt
- **urgency** – mål, live, officiellt, klart, laguppställning, breaking
- **svenska spelare** – särskilt viktiga spelare och svenska spelare i utlandet kan boostas
- **source authority** – vissa källor väger tyngre än andra
- **league fit / country fit** – vissa källor är bättre för vissa ligor eller länder
- **source clustering penalty** – motverkar att många artiklar från samma källa dominerar
- **evergreen penalty** – opinionsmaterial och mindre tidskritiska texter får lägre vikt

Pipeline-steget för källbalansering minskar source-kluster i toppen av listor.

### 3. Entity-modell och favoritlogik

Systemet arbetar med entities som:

- spelare
- lag
- ligor
- i vissa flöden även staff

Favoriter kan kopplas till entities, och logiken stöder både:
- direkt match på entity
- expansionslogik:
  - liga -> lag
  - lag -> spelare/staff
  - spelare -> lag
- lokal textmatchning i UI för att förbättra träffsäkerheten

Det gör att en användare kan få relevanta nyheter även när favoriten inte nämns exakt i rubriken, men en relaterad spelare eller klubb gör det.

### 4. Push-notiser

Push-flödet består av:

- service worker i klient
- VAPID-baserad Web Push
- lagring av subscriptions i Supabase
- dispatch-logik som matchar nyheter mot favoritintresse
- rate limiting och delivery logging
- test- och admin-routes för verifiering

Push-motorn finns huvudsakligen i:

- `src/lib/pushClient.ts`
- `src/lib/pushServer.ts`
- `src/lib/pushDispatch.ts`

### 5. Realtids-UI

UI:t innehåller:

- en toppsektion med aktuell status och top-item
- `TopHighlight` för hetaste nyheten just nu
- två separata nyhetskolumner för fotboll och hockey
- favoritstyrning direkt i UI
- push-opt-in
- auto-refresh
- lokala/lokalt märkta nyheter där det är relevant

---

## Projektstruktur

## App och UI

- `src/app/page.tsx` – komponerar startsidan
- `src/app/layout.tsx` – root layout och service worker bootstrap
- `src/components/*` – UI-komponenter som:
  - `ClientTopDropper.tsx`
  - `TopHighlight.tsx`
  - `NewsColumn.tsx`
  - `EnablePushButton.tsx`
  - `Badge.tsx`
  - `WelcomeModal.tsx`

## API-routes

- `src/app/api/news/route.ts` – bygger och returnerar användarens nyhetsflöde
- `src/app/api/ingest/route.ts` – hämtar feeds, filtrerar, detekterar entities och skriver till databasen
- `src/app/api/entities/route.ts` – sök/browse för entities
- `src/app/api/favorites/route.ts` – lägg till/ta bort favoriter
- `src/app/api/events/route.ts` – enkel eventloggning
- `src/app/api/seen/route.ts` – markerar artiklar som lästa
- `src/app/api/top/route.ts` – top-item för startsidans toppsektion
- `src/app/api/scrape/route.ts` – manuell scraper-route
- `src/app/api/push/*` – push subscriptions, dispatch och tester
- `src/app/api/force-push/route.ts` – manuell push-trigger för test/debug
- `src/app/api/debug-env/route.ts` – debug-route för env-sanity-check

## Core logic

- `src/lib/feeds.ts` – feeddefinitioner och hårda sportfilter
- `src/lib/rss.ts` – parser RSS/Atom
- `src/lib/scrape.ts` – scraperlogik
- `src/lib/detectEntities.ts` – aliasladdning och entity-detektering
- `src/lib/entityBrowse.ts` – browse-index, relationer och sökförslag
- `src/lib/news-engine/` – kandidatpipeline, deduplicering, geo och slutrankning
- `src/lib/ranking-v2/` – aktuell rankingkonfiguration och signaler
- `src/lib/ranking/` – äldre/återanvändbara rankningssignaler
- `src/lib/pushClient.ts` – browser-push
- `src/lib/pushServer.ts` – server-side web push
- `src/lib/pushDispatch.ts` – push-matchning, throttling och dispatch
- `src/lib/supabase.ts` – Supabase-klienter och env-hantering
- `src/lib/types.ts` – centrala typer

---

## Datamodell i stora drag

Projektet använder Supabase för att lagra bland annat:

- `news_items`
- `news_entities`
- `entities`
- `entity_aliases`
- `user_favorites`
- `user_seen_news`
- `push_subscriptions`
- `push_delivery_log`
- `user_events`

---

## Flöde från ingest till UI

1. Feeds definieras i `src/lib/feeds.ts`
2. RSS hämtas och parsas i `src/lib/rss.ts`
3. `src/app/api/ingest/route.ts` filtrerar bort irrelevanta eller felaktiga artiklar
4. Entities detekteras och länkas
5. Nyheter sparas i Supabase
6. `src/app/api/news/route.ts` hämtar, filtrerar, expanderar favoriter, deduplikerar och rankar
7. UI-komponenter som `TopHighlight` och `NewsColumn` presenterar innehållet

---

## RSS-källor

Systemet använder ett större antal RSS-källor inom:

- svenska grundflöden
- internationell klubb- och ligabevakning
- hockeykällor för SHL, HockeyAllsvenskan och NHL
- vissa lokala och regionala tidningar
- vissa specialiserade klubb- och supporterkällor
- utvalda scrapers där RSS inte räcker

Exakta källor definieras i:

- `src/lib/feeds.ts`
- `src/lib/sources/football.sources.ts`
- `src/lib/sources/hockey.sources.ts`

---

## Miljövariabler

Följande variabler krävs i `.env.local` och i Vercel:

| Variabel | Beskrivning |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik läsnyckel |
| `SUPABASE_SERVICE_ROLE_KEY` | Servernyckel för skrivoperationer |
| `CRON_SECRET` | Primär hemlighet för schemalagd ingest via Vercel Cron |
| `INGEST_SECRET` | Tillfällig fallback för header-auth för icke‑Vercel-anropare |
| `FAVORITE_AUDIT_SECRET` | Hemlighet för skyddade admin- och debug-routes |
| `VAPID_PUBLIC_KEY` | VAPID public key |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_SUBJECT` | VAPID subject |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Publik VAPID-nyckel till klienten |
| `TOP_RSS_URL` | RSS-källa för top-sektionen |
| `TOP_MAX_AGE_HOURS` | Maxålder för top-item innan fallback används |

Viktigt för `/api/ingest`:

- Konfigurera `FAVORITE_AUDIT_SECRET` och `CRON_SECRET` i Vercel under **Project Settings → Environment Variables** för varje deployment environment (t.ex. Production/Preview/Development).
- Om `FAVORITE_AUDIT_SECRET` saknas stänger skyddade admin- och debug-routes, inklusive debug-tools, fail closed med HTTP 401.
- Om `CRON_SECRET` saknas skickar Vercel ingen `Authorization`-header, och schemalagd ingest returnerar HTTP 401.
- `INGEST_SECRET` är endast en tillfällig header-auth fallback för anropare som inte är Vercel.
- Cron-schemat `*/2 * * * *` kräver en Vercel-plan som inte är Hobby. På Hobby blockeras deploymenten tills planen uppgraderas eller en extern scheduler används.

---

## Kom igång

### Installation

1. Klona repot
2. Installera dependencies

```bash
npm install
