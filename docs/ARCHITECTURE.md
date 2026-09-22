# SportMonitor – System Architecture

## Purpose

This document describes the high-level architecture of SportMonitor.

The goal is to clarify how the system collects, processes, ranks, and presents sports news focused on Swedish football and hockey, plus Swedish players and coaches abroad and the directly related club / league context.

It complements the following documents:

- PRODUCT_CORE.md → product vision
- SPORTMONITOR_EDITORIAL_MODEL.md → editorial principles
- RANKING_SYSTEM.md → ranking logic
- STRUCTURE_INVENTORY.md → Phase 1 file-by-file inventory
- TARGET_ARCHITECTURE.md → Phase 2 target ownership and migration map

---

# System Overview

SportMonitor consists of four main layers:

1. Data ingestion
2. Processing and classification
3. Ranking and feed shaping
4. Client presentation


# SportMonitor Push System & UUID Bridge (v4.6.2)

## Övergripande flöde
Systemet använder en "Hybrid ID-modell" för att balansera enkel frontend-utveckling med strikt databassäkerhet.

1. **Frontend (NewsColumn.tsx):** Använder statiska text-ID:n (t.ex. `football-team-arsenal`) för sökning och UI.
2. **API-brygga (/api/favorites):** Tar emot text-ID + Namn (t.ex. "Arsenal").
3. **UUID Resolver:** Om ID:t inte är ett UUID, gör servern en lookup i `entities`-tabellen baserat på namnet för att hitta rätt `uuid`.
4. **Matching:** `pushDispatch.ts` matchar nyhetens titel/entiteter mot användarens sparade UUID:n.

## Viktiga spärrar (Guardrails)
- **Retroaktiv spärr:** Systemet skickar aldrig nyheter som publicerades *innan* användarens prenumeration skapades (förhindrar spam vid omstart).
- **Matchnings-logik:** Om en nyhet inte är en "VIP-nyhet" (KLART, MÅL, etc.), måste lagets namn eller dess UUID finnas i nyheten för att en push ska skickas.