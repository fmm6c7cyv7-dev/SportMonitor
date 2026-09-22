# Regional Source Onboarding (Template)

Syfte: onboarda en ny region med kontrollerad risk, enligt Kalmar-modellen.

## 1) Definiera region i geo

Uppdatera geo-lagret med:
- `regionKey` (ex. `kalmar`)
- stadens koordinater (lat/lng)
- smal termlista för ort + lag
- eventuella stadsalias till region (`CITY_REGION_ALIASES`) när det är produktmässigt rimligt

Krav:
- regionen ska träffa lokala användare korrekt
- närliggande stad kan aliasas in endast om det är avsiktligt
- närliggande men separat region ska inte råka hamna i regionen

## 2) Koppla lag/entities till region

Säkerställ att regionen matchar relevanta team entities (team-id i browse/entity-index), minst:
- primärt herrfotbollslag
- primärt herrhockeylag
- ev. andra tydliga lokala herrlag i scope

Verifiera med tester för:
- `isLocalEntityMatch(...)` positiv för regionens lag
- negativ kontroll för lag i annan region

## 3) Välj lokala termer smalt

Principer:
- använd specifika lagtermer före breda geografiord
- undvik generiska ord som riskerar falska träffar
- lägg till endast termer som behövs för att hitta lokal sport
- håll listan kort och iterera via QA istället för breda listor direkt

## 4) Klassa regionala källor

Varje källa ska ha tydlig profil i source profiling:
- `official_local`
- `local_media`
- `public_service_local`
- `aggregator_team_feed`
- `fan_community`

Prioritetsordning (grundförtroende):
1. `official_local`
2. `local_media` / `public_service_local`
3. `aggregator_team_feed`
4. `fan_community`

## 5) Eligibility-policy

Regional källa exponeras när minst ett av följande gäller:
- Lokal användare: användarens `region_key` matchar källans region
- Favorit-användare: användaren har relevant team/league-favorit
- Big-news override: hard-news får bryta igenom även utanför region

Neutral användare (ej lokal, inga favoriter):
- regional källa ska blockas eller hållas utanför normal topplista

## 6) Minimikrav på tester

Måste finnas:
- geo-resolution: regionstad + närliggande aliasstad + negativa städer
- local entity match: regionens lag positiva, annan region negativa
- eligibility:
  - lokal användare => tillåten
  - favorit-användare => tillåten
  - neutral annan region => blockad
  - hard-news override => tillåten
- source profiling/ranking:
  - official/local media högre än aggregator/community

## 7) Endpoint-QA (obligatorisk)

Kör live endpoints per sport med minst:
- regionstad (`geo_debug=<Regionstad>`)
- aliasstad (`geo_debug=<Aliasstad>`) om används
- negativ stad 1 och 2
- neutral request utan `geo_debug`
- favorit-scenario utanför region

Kontrollera i output:
- `meta.region_key`, `meta.region_city`, `meta.location_source`
- `is_local` / `isLocal`
- källmix i topp (global + regional rimlig)
- dubletter (url/title)
- inga API-fel

## 8) Risker att flagga

Flagga explicit i rapport:
- instabil RSS/WAF/403 eller scrape med hög break-risk
- mixed-sidor som läcker icke-football/hockey
- för bred termmatch som ger falsk lokal badge
- aggregator/community som dominerar topp
- otillräcklig live-data för att verifiera ett scenario

## 9) Kalmar-exempel (referens)

Teams i scope:
- Kalmar FF (football)
- Kalmar HC (hockey)
- Nybro Vikings (hockey)

Källtyper:
- Official: Kalmar FF officiella nyheter, Kalmar HC officiell RSS, Nybro Vikings officiell RSS
- Local media: Barometern Sport, Barometern Kalmar FF, Ölandsbladet Kalmar FF-spår
- Public service local: P4 Kalmar Sporten
- Aggregator team feed: Bollsvenskan Kalmar FF, HockeyNews Kalmar HC/Nybro
- Fan community: SvenskaFans Kalmar FF (endast vid stabilt feed + tydlig nyhetssignal)

SvenskaFans-regel:
- om feed saknar stabila entries eller returnerar block/challenge: håll avstängd
- återaktivera först efter verifierad stabilitet

## 10) Definition of done

En region-batch är klar först när:
- geo + source profiling + eligibility är implementerat
- tester passerar
- endpoint-QA är körd och dokumenterad
- risknivå är satt (låg/medel/hög)
- branch är redo för separat mergebeslut
