🧐 Vad gör SportMonitor?

SportMonitor fungerar som en personlig "nyhetsjägare" för sport. Istället för att du ska behöva skanna av flera olika sportsajter, gör systemet grovjobbet åt dig genom att:

    Aggregera: Hämtar automatiskt de senaste rubrikerna från stora sportkällor via RSS-flöden.

    Filtrera (The Bouncer): Rensar bort "brus" (som skidor eller tennis) och fokuserar strikt på herrfotboll och hockey för att hålla flödet relevant [Statusrapport].

    Värdera: Hittar de absolut viktigaste nyheterna genom att skanna efter nyckelord som "JUST NU", "MÅL" eller "KLART" .

    Notifiera: Skickar intelligenta push-notiser baserat på vad du faktiskt bryr dig om – oavsett om det är en specifik spelare (som Isak), ett lag eller en hel liga [Statusrapport].

🛠 Så jobbar du med systemet

Här är en snabbguide till hur du underhåller och bygger vidare på din plattform:
1. Hantera nyhetsflödet (Ingest)

Systemet är konfigurerat att hämta nyheter varannan minut via Vercel Cron när deploymenten körs på en plan som stöder schemat. Cron-schemat `*/2 * * * *` kräver en Vercel-plan som inte är Hobby; på Hobby blockeras deploymenten tills planen uppgraderas eller en extern scheduler används.

    Lägga till källor: Vill du bevaka en ny sajt? Lägg bara till deras RSS-URL i FEEDS-objektet i filen src/lib/feeds.ts [Statusrapport, cite: 140-142].

    Justera filtret: Om du vill börja inkludera damidrott eller andra sporter framöver, ändrar du i isIrrelevantSport-funktionen [Statusrapport].

2. Utveckling & Databas

All data bor i Supabase.

    Övervaka notiser: Kolla push_delivery_log i Supabase för att se vilka notiser som skickats och se till att användarna inte blir "spammade" [Statusrapport].

    Favorit-logik: När du lägger till nya entiteter (lag eller spelare), ser du till att deras ID finns i news_entities-tabellen så att push-motorn kan koppla ihop nyheten med rätt följare [Statusrapport].

3. Användarupplevelsen (UI)

Sidan är byggd i Next.js och är "set and forget" för användaren.

    Topplistan: Styrs av en algoritm som väger samman nyhetens ålder och rubrikens innehåll för att avgöra vad som ska ligga överst .

    PWA-fördelar: Tack vare web-push fungerar sidan nästan som en installerad app på både iPhone och Android [Statusrapport].
