# Changelog

All notable changes to this project will be documented in this file.

## [6.3.4] - 2026-10-14

### Rättat
- Rykten visas inte längre med en framträdande RYKTE-etikett som kan förväxlas med VIP. Artiklarna behålls i det vanliga flödet, inklusive eventuell favoritmarkering; bekräftade VIP-händelser och HERE WE GO påverkas inte.

## [6.3.3] - 2026-10-14

### Rättat
- AI Gateway får Vercels automatiska OIDC-autentisering från produktionsanropet, inte en otillgänglig runtime-miljövariabel.
- Redan sparade, oklassificerade VIP-kandidater kan kompletteras med AI-bedömning endast om både publicering och inhämtning skett inom de senaste tre timmarna. Befintlig artikel uppdateras utan retroaktiv push.

## [6.3.2] - 2026-10-14

### Rättat
- Uppdateringsdialog visas endast vid MAJOR- eller MINOR-höjning; PATCH-releaser är tysta. Tidigare visade dialoger för 6.3.1 visas inte igen efter 6.3.2.
- VIP-status ger inte längre särskilda pushundantag; succé kan AI-granskas för VIP-märkning och ranking.

## [6.3.1] - 2026-10-14

### Tillagt
- AI tolkar rubrik och tillgänglig ingress före särskilda etiketter och nyckelordsprioritet. Matchavbrott på grund av skada ska skiljas från klubbavsked; rykten skiljs från bekräftade besked.
- Svensk uppdateringsdialog visas vid första öppningen av den nya versionen. Nya användare får välkomstinformation och nyheter i samma dialog; kvittens sparas lokalt.
- Permanent [versions- och uppdateringspolicy](RELEASE_POLICY.md) för framtida releaser.

### Rättat
- Ligans namn i ett klubbsökalias får inte ensamt skapa en falsk favoritträff.

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