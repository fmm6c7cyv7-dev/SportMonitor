# SportMonitor – Entity Model Map

## Main Concepts

### News
A news item/article coming from an RSS source.

Possible fields:
- id
- title
- url
- source
- published_at
- sport
- summary
- score
- created_at

---

### Team
A sports team that may be detected in articles.

Possible fields:
- id
- name
- sport
- league_id
- aliases

---

### Player
A player that may be detected in articles.

Possible fields:
- id
- name
- team_id
- aliases

---

### League
A competition or league.

Possible fields:
- id
- name
- sport
- aliases

---

### Favorite
Represents what a user wants prioritized.

Possible fields:
- id
- user_id
- entity_type
- entity_id

entity_type examples:
- team
- player
- league

---

### Push Subscription
A stored web push subscription for a user/device.

Possible fields:
- id
- user_id
- endpoint
- p256dh
- auth
- created_at

---

## Logical Relationships

News
↓ may mention
Team / Player / League

User
↓ has
Favorites

Favorites
↓ influence
Ranking

Favorites + News match
↓ may trigger
Push Dispatch

Push Dispatch
↓ uses
Push Subscription

---

## Typical Flow

RSS article
↓
normalized article
↓
entity detection
↓
match against favorites
↓
ranking boost
↓
possible push notification
