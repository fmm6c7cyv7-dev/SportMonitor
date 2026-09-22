## 🏗️ Arkitektur: Sök & Entiteter (Hybrid-modell)

SportMonitor använder en hybrid-arkitektur för att hantera sökningar på lag, spelare och ligor. Systemet är uppdelat i två "världar" för att maximera prestandan i gränssnittet samtidigt som databasen håller koll på relationer och statistik.

### 1. Frontend (Blixtsnabb Sökning)
När en användare söker i appens UI efter ett lag eller en liga, görs **inga** anrop till databasen. Sökningen sker 100% lokalt mot ett hårdkodat index som byggs när appen kompileras.
* **Filer:** `data/leagues.ts`, `data/footballTeams.ts`, `data/hockeyTeams.ts` etc.
* **Varför:** För att sökningen ska ske på millisekunder och kännas omedelbar.

### 2. Backend (Supabase & Nyhetslogik)
När användaren väljer en entitet (t.ex. Allsvenskan) och sparar den, är det backendens jobb att hämta rätt nyheter. Databasen använder sina tabeller för att förstå vad entiteten är och vilka alias som är kopplade till den.
* **Tabeller:** `entities` och `entity_alias`.
* **Varför:** För att kunna koppla tiotusentals nyheter från olika källor (som ibland stavar namnen olika) till ett och samma ID.

---

### 📝 Checklista: Så lägger du till en ny Liga/Lag
Om en ny liga startar eller ett nytt lag går upp i högstaligan, **måste** det läggas till på två ställen:

1. **I Frontend-koden (`data/`-mappen)**
   * Öppna t.ex. `data/leagues.ts`.
   * Lägg till ligan i rätt array (t.ex. `rawFootballLeagues`).
   * *Detta gör att ligan dyker upp när användaren söker i appen.*

2. **I Databasen (Supabase)**
   * Lägg in en ny rad i tabellen `entities`.
   * Sätt `sport` (t.ex. 'football'), `type` ('league'), och `active` = `true`.
   * Lägg in eventuella smeknamn i `entity_alias`.
   * *Detta gör att Supabase förstår vilken liga appen frågar efter och kan leverera rätt nyheter.*


   