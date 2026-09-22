# Swedish Staff Abroad Catalog

## Purpose

`src/data/swedishStaffAbroad.ts` is the curated SportMonitor catalog for Swedish senior coaching staff working abroad.

It exists so the editorial model can treat:

- a named Swedish coach / staff member abroad as **Tier 1 — Swedish core**
- that person's foreign club or national team as **Tier 2 — direct surrounding context**
- that person's foreign competition as **Tier 2 — direct surrounding context**

This extends the same editorial principle already used for Swedish players abroad without changing freshness behavior.

## Current scope

Initial catalog verified: **2026-09-20**

Scope:

- men's senior football
- men's senior ice hockey
- head coaches / managers
- assistant coaches
- goalkeeping coaches
- specialist first-team coaches such as set-piece coaches
- clubs abroad
- foreign senior national teams

The initial catalog contains:

- 13 football staff entries
- 6 hockey staff entries
- 19 entries total

Women, youth, reserve teams, analysts, directors and non-coaching executives are intentionally outside this first bounded scope. They can be added later as separate product decisions rather than silently widening the current core.

## Data rules

Every active row must have:

- stable id
- full name
- sport
- role and title
- current organization
- current competition when applicable
- country
- Swedish nationality marker
- aliases kept narrow enough for safe matching
- verification date
- a concrete HTTPS verification source

Do not add generic hierarchy words as person aliases.

Do not add short ambiguous aliases merely to improve recall. False-positive Tier 1 classification is worse than missing a weak alias.

## Maintenance rule

Staff employment changes more often than league structure.

Before adding or changing an entry:

1. verify the current role from an official club/federation source where available
2. use a current high-quality secondary source only when an official source is unavailable
3. update `verifiedAt`
4. remove or deactivate a person immediately when the current role ends
5. update organization and competition relationships when the person changes job
6. add or adjust regression tests when matching behavior changes

Examples deliberately excluded from the initial active catalog because the old role had ended before the verification date:

- Jens Wedeborg — no longer Strømmen head coach
- Oscar Hiljemark — no longer Pisa head coach

Historical people must not remain Tier 1 solely because an old role once existed.

## Ranking integration

The ranking classifier uses exact normalized phrase/token matching against:

- staff names and person aliases
- organization names and safe organization aliases
- competition names and safe competition aliases

Result:

```text
Kim Hellberg mentioned
→ Tier 1

Middlesbrough article without Hellberg mentioned
→ Tier 2

Championship article without a Swedish person mentioned
→ Tier 2 when the competition is connected to active Swedish player/staff context

Unrelated international article
→ Tier 3
```

The same pattern applies to hockey.

## Freshness guardrail

This catalog does **not** change the established freshness rules.

A staff match cannot bypass:

- 0–3 h fresh pool
- 3–6 h normal fallback
- >6 h exclusion from the normal feed
- 72 h hide-read-only backfill ceiling
- the one-adjacent-bucket maximum for strong core jumps

A stale coach article must not pin above good fresh news simply because the coach is Swedish.

## Database / entity graph status

The current production `entities` table only permits:

- player
- team
- league

The database constraint does not yet permit `staff`.

Therefore this catalog is intentionally app-side for the first implementation. No database schema was changed as part of this task.

A later entity-graph migration can add canonical staff entities and relationships:

```text
staff
→ organization/team
→ competition/league
```

That migration should be handled separately because it affects entity detection, aliases, favorites and production data.

## Related files

- `src/data/swedishStaffAbroad.ts`
- `src/lib/ranking/editorialRelevance.ts`
- `src/lib/__tests__/data/swedishStaffAbroad.test.ts`
- `src/lib/__tests__/ranking/editorialRelevance.test.ts`
- `docs/PRODUCT_CORE.md`
- `docs/RANKING_SYSTEM.md`
