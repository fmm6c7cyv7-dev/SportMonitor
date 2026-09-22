# Changelog

All notable changes to this project will be documented in this file.

## [4.7.0] - 2026-03-16

### Added
- **Geografisk intelligens:** Automatisk detektering av användarens stad via Vercel Edge Headers (`x-vercel-ip-city`).
- **Geografisk prioritering:** Lokala nyheter rankas nu högre i flödet (direkt under personliga favoriter).
- **📍 LOKALT-badge:** Visuell indikator i nyhetslistan för artiklar som matchar användarens nuvarande position.
- **Geo-simulering (Fusk-meny):** Gränssnitt i development-läge för att testa appen som om man befann sig i olika svenska städer.
- **Utökad region-mappning:** Omfattande stöd för städer i SHL, Hockeyallsvenskan, Allsvenskan och Superettan.

### Changed
- Uppdaterat API-routen för nyheter att hantera `geo_debug`-parametrar.
- Trimmade `NewsColumn` för att visa lokala badges snyggt bredvid källhänvisningar.

---

## [4.6.6] - 2026-03-16
### Added
- "Visa fler"-funktion i nyhetskolumnerna (visar 12 artiklar initialt).
- Lazy loading av inställningar för bättre stabilitet vid sidladdning.