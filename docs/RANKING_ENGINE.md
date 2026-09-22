# SportMonitor – Ranking Engine

> This document describes the ranking model conceptually. The active
> implementation is the news-engine pipeline in `src/lib/news-engine/` and the
> sport-specific ranking modules in `src/lib/ranking-v2/`.

## Goal
The ranking engine decides:
- which article is most important right now
- which articles should appear highest in the feed
- which articles are most relevant to the user
- which articles may qualify for push notifications

---

## Base Score Model

Total Score =
Recency Score
+ Source Score
+ Entity Score
+ Favorite Score
+ Urgency Score
+ Quality Score
- Duplicate Penalty
- Saturation Penalty

---

## Score Components

### Recency Score
Example:
- 0–15 min = +40
- 15–60 min = +30
- 1–3 h = +20
- 3–12 h = +10
- 12–24 h = +5
- 24h+ = 0

### Source Score
Example:
- Tier 1 = +20
- Tier 2 = +12
- Tier 3 = +6

### Entity Score
Example:
- league mention = +4
- team mention = +6
- player mention = +5
- multiple matched entities = +8 extra

### Favorite Score
Example:
- favorite team match = +30
- favorite player match = +24
- favorite league match = +16
- multiple favorites matched = +10 extra

### Urgency Score
Example:
- JUST_NU = +20
- LIVE = +18
- MÅL = +22
- official / injury / lineup = +10 to +18

### Quality Score
Example:
- richer content = +5
- clear title = +4
- concrete facts = +6

### Duplicate Penalty
Example:
- near duplicate cluster = -20
- same event cluster = -15

### Saturation Penalty
Example:
- same player already dominates = -10
- same team already dominates = -8
- same source repeated too often = -6

---

## Feed Ranking
Use total score for:
- TopHighlight
- NewsColumn ordering

---

## Push Ranking
Push should not use the exact same threshold as feed ranking.

Push Score =
Favorite Score
+ Urgency Score
+ Recency Score
- Duplicate Penalty

Only send push if score passes a defined threshold.

---

## Ranking Breakdown
Each ranked article should store a structured score breakdown, for example:

```ts
type RankingBreakdown = {
  totalScore: number;
  recencyScore: number;
  sourceScore: number;
  entityScore: number;
  favoriteScore: number;
  urgencyScore: number;
  qualityScore: number;
  duplicatePenalty: number;
  saturationPenalty: number;
};