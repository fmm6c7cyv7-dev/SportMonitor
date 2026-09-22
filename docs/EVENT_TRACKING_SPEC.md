# SportMonitor – Event Tracking Spec

## Goal
Track enough user behavior to improve ranking and push quality over time.

---

## Recommended Initial Events

### news_impression
Triggered when an article is shown in the feed.

### news_click
Triggered when a user clicks an article.

### push_open
Triggered when a user opens an article from a push notification.

### news_dwell
Triggered when article dwell time can be measured.

---

## Recommended Table
Table name:
`user_events`

Suggested fields:
- id
- user_id
- event_type
- news_id
- entity_type
- entity_id
- source
- sport
- created_at
- metadata

---

## Event Notes

### news_impression
Start simple:
- log only top feed positions
- for example top 5 or top 10

### news_click
Highest-value first event to implement.

### push_open
Very useful for push quality analysis.

### news_dwell
Can be implemented later with simple timing logic.

---

## Recommended First Build Order
1. Implement `news_click`
2. Implement `push_open`
3. Implement `news_impression`
4. Implement `news_dwell`
