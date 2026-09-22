# SportMonitor – Editorial & Ranking Model

## 1. Produktens kärna

SportMonitor ska vara ett enkelt sätt att följa:

- svensk fotboll
- svensk hockey
- svenska spelare utomlands
- svenska tränare / staff utomlands

Detta är kärnan. Appen ska inte kännas som en generell sportaggregator.

## 2. Redaktionell prioritetsordning

Nyheter prioriteras i tre nivåer, alltid inom freshness-reglerna.

### Tier 1 — Svensk kärna

- svensk fotboll och hockey i Sverige
- svenska spelare utomlands
- svenska tränare / staff utomlands

### Tier 2 — Direkt relevant omvärld

- lag som har svenska spelare eller svenska tränare / staff
- ligor där dessa lag spelar
- händelser som tydligt påverkar svenskarnas sportsliga kontext

En klubbnyhet kan alltså vara relevant även om svensken inte står i rubriken, men den är fortfarande sekundär till själva svenska kärnan.

### Tier 3 — Övrig utfyllnad

När det finns plats kvar fylls flödet med andra relevanta nyheter från bevakade lag, ligor och starka källor.

## 3. Aktualitet skyddar live-känslan

Svensk relevans får inte göra gamla artiklar odödliga.

Normalflödet använder:

- 0–3 timmar: fresh
- 3–6 timmar: normal fallback
- äldre än 6 timmar: inte i normalflödet
- upp till 72 timmar: endast hide-read backfill när listan annars inte kan fyllas

Inom 0–6 timmar används freshness buckets. En stark core-artikel får bara hoppa en angränsande bucket och endast när de befintliga score-trösklarna är uppfyllda.

Det innebär exempelvis:

- en färsk Isak- eller Gyökeres-händelse kan slå en något nyare generisk klubbnyhet
- en sju timmar gammal svensk artikel får inte tränga undan en färsk och relevant nyhet i normalflödet

## 4. Nyhetstyp

Extra vikt kan ges till exempelvis:

- mål och avgörande moment
- officiella övergångar
- Here we go / Done deal
- rött kort
- matchresultat
- tränarbyte
- live / breaking

Evergreen, krönikor och svag analys får lägre vikt.

## 5. Källprioritering

Source authority är en stödjande signal.

BBC Sport, The Athletic, etablerade nationella medier och relevanta specialistkällor kan få högre authority än svaga aggregatorer eller click-sajter.

Authority ska inte väga tyngre än produktens svenska kärna.

## 6. Liga- och lagrelevans

En liga kan vara relevant av tre olika skäl:

1. svensk liga → Tier 1
2. utländsk liga med svenska spelare/tränare i sina lag → Tier 2
3. annan bevakad liga → Tier 3

Samma princip gäller lag.

Premier League, NHL, Serie A eller andra stora ligor ska därför inte automatiskt få samma redaktionella status som svensk core.

## 7. Favoriter

Favoriter är personlig boost för:

- spelare
- lag
- ligor

Favoriter får förbättra ordningen mellan tillräckligt färska nyheter, men får inte:

- passera 6-timmarsgränsen för normalflödet
- bryta den svenska kärnlogiken
- blandas ihop med lokal-signalen

Klienten tillåter upp till fem favoriter.

## 8. Lokal relevans

Lokal relevans är en separat signal från favorit.

En artikel kan vara:

- lokal men inte favorit
- favorit men inte lokal
- både lokal och favorit
- varken lokal eller favorit

Den distinktionen ska bevaras.

## 9. Anti-kluster

Flödet ska undvika att samma källa dominerar.

Använd:

- mild source balancing
- lookahead/interleaving
- begränsad omordning när score-fallet är acceptabelt

Artiklar ska inte artificiellt tidsfördröjas.

## 10. Framtida Sverige-koppling

En separat framtida kategori kan följa utländska spelare som tidigare spelat i Sverige och sedan flyttat utomlands.

Exempel som diskuterats:

- Mikkel Ladefoged
- Taha Ali

Denna kategori är ännu inte implementerad och ska placeras under svensk core när den införs.

## 11. Förenklad rankingmodell

```text
freshness guardrail
→ editorial relevance tier
→ recency / urgency
→ favorite / local
→ source authority / league fit / country fit
→ penalties
→ source balancing
```

## 12. UX-mål

Flödet ska upplevas:

- levande
- snabbt
- seriöst
- kuraterat
- tydligt svenskt i sitt redaktionella fokus
- utan källkluster
