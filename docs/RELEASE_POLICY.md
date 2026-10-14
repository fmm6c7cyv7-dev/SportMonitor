# Versions- och uppdateringspolicy

Denna policy gäller alla framtida ändringar i SportMonitor. Användarens uttryckliga instruktioner har företräde.

## En enda versionskälla

`package.json` → `version` är versionskällan. Synkronisera samma version i `package-lock.json` på toppnivån och i `packages[""]`. Sidfot och uppdateringsdialog läser versionen från paketfilen; skriv inte separata versionsnummer i UI-kod.

Versionen har tre delar, `MAJOR.MINOR.PATCH`, med följande projektspecifika regler:

| Typ av ändring | Ny version | Exempel |
|---|---|---|
| Mindre rättning eller liten justering | Öka PATCH med 1 | `6.0.1` → `6.0.2` |
| Större funktion eller sammanhängande förbättring | Öka MINOR med 1 och sätt PATCH till 1 | `6.0.1` → `6.1.1` |
| Stor förändring av produkten | Öka MAJOR med 1, sätt MINOR till 0 och PATCH till 1 | `6.0.1` → `7.0.1` |

Detta är projektets versionspolicy; nya funktionsversioner börjar på patch **1**, inte 0. Bestäm nivån utifrån den färdiga ändringens omfattning och gör en versionshöjning per sammanhängande release.

## Uppdateringsinformation till användaren

- Skriv kort svensk information om vad som ändrats och hur det hjälper användaren. Beskriv verklig funktion, utan löften om felfri AI eller garanterat resultat.
- Uppdatera innehållet i `src/components/WelcomeModal.tsx` och dokumentera releasen i `docs/CHANGELOG.md` när versionen höjs.
- Visa en enda dialog första gången den nya appversionens kod öppnas i en webbläsare eller PWA-installation. Befintliga användare ser uppdateringen; nya användare ser välkomstinformationen och uppdateringen i samma dialog.
- Markera informationen som sedd först när användaren bekräftar med knappen eller Escape. Bakgrundsklick stänger inte dialogen.
- Spara kvittensen lokalt per version. Ingen inloggning, serverregistrering eller OS-push behövs. Synkronisera kvittensen mellan öppna flikar via `storage`-händelser.
- Om lokal lagring är blockerad används minne under den aktuella sidans session. En fullständig omladdning kan då visa informationen igen; permanent kvittens kan inte garanteras utan fungerande lagring.
- Dialogen ska fungera med tangentbord, fokuslås, fokusåterställning och skärmläsare samt rymmas inom mobilens viewport med intern scroll vid behov.

## Kontroller före integration och publicering

Verifiera versionssynk, ny/förstagångsöppning, bekräftelse, återöppning, ny version, blockerad lagring och fliksynk. Kör relevanta tester, lint, typkontroll och build enligt `AI_WORKFLOW.md`. Ändra inte AI-, ranking-, push- eller databaslogik som en bieffekt av versionshantering.

Publicering följer befintliga behörigheter och QA-krav. En versionshöjning eller lokal commit innebär inte att en release är publicerad.
