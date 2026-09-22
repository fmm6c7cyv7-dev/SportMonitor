# SportMonitor – Auto-Learning Ranking

## Goal
Improve ranking over time using user behavior.

This should begin as simple signal-based learning, not full machine learning.

---

## Evolution Plan

### Phase 1
Rule-based ranking only:
- recency
- source
- entity
- favorite
- urgency
- duplicate penalty
- saturation penalty

### Phase 2
Add behavior signals:
- article clicked
- article opened from push
- dwell time
- ignored despite high placement

### Phase 3
Use behavior score:
Final Score = Base Score + Behavior Score

### Phase 4
Add personal interest score:
Final Score = Base Score + Global Behavior Score + Personal Interest Score

---

## Behavior Signals

Recommended first signals:
- news_impression
- news_click
- push_open
- news_dwell

---

## Behavior Score Example

Behavior Score =
click_bonus
+ push_open_bonus
+ dwell_bonus
+ favorite_engagement_bonus
- ignore_penalty

Example:
- click_bonus = +8
- push_open_bonus = +12
- dwell_bonus = +0 to +10
- favorite_engagement_bonus = +10
- ignore_penalty = -4

---

## Learning Strategy

### Global learning
Learn what generally performs well across users.

### Personal learning
Learn what a specific user prefers.

---

## Recommended Build Order
1. Log events
2. Save ranking breakdown
3. Analyze simple aggregates
4. Adjust rules
5. Add personalization later
