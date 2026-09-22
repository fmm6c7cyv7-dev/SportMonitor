# SportMonitor – AI README

## Project Overview
SportMonitor is a sports news aggregator focused on football and hockey.

The app collects RSS feeds, ranks articles, detects entities (teams, players, leagues) and surfaces the most relevant content to the user.

The system also supports push notifications and PWA installation.

---

## Stack
Frontend:
- Next.js (App Router)
- TypeScript
- Tailwind CSS

Backend:
- Next.js API routes

Database:
- Supabase

Hosting:
- Vercel

---

## Project Root
The active Next.js app is located at the repository root, with application
code under `src/`.

---

## Key System Flow
RSS feeds
↓
Ingest API
↓
Parse RSS
↓
Entity detection
↓
Ranking
↓
Supabase database
↓
Push dispatch
↓
Frontend feed

---

## Important Directories
- `src/app/api/`
- `src/components/`
- `src/lib/`

---

## Important Files
- `src/lib/pushDispatch.ts`
- `src/lib/pushServer.ts`
- `src/lib/pushClient.ts`
- `src/lib/detectEntities.ts`
- `src/lib/feeds.ts`
- `src/lib/ingest/`
- `src/lib/news-engine/`
- `src/lib/ranking-v2/`
- `src/lib/rss.ts`
- `src/lib/supabase.ts`

---

## Deployment Rules
- Production deploy only from `main`
- Prefer feature branch + PR
- Avoid direct commits to `main`

---

## Working Style
- User pastes full files
- Return full corrected files
- Avoid partial diffs unless explicitly requested
- Use exact file paths

---

## PWA Notes
Special care is required for iOS:
- theme-color
- background_color
- apple-mobile-web-app-capable
- startup images
- standalone startup behavior