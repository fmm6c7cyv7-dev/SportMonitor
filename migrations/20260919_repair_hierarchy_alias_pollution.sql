-- Repair catalog aliases that accidentally encoded hierarchy membership as aliases.
-- The canonical alias table must describe names/nicknames of the entity itself,
-- not its parent team or league. Those hierarchy aliases caused broad false
-- news_entities matches (for example every Allsvenskan team matching the word
-- "Allsvenskan").

BEGIN;

CREATE SCHEMA IF NOT EXISTS catalog_rebuild_backup;

CREATE TABLE IF NOT EXISTS catalog_rebuild_backup.bad_hierarchy_aliases_20260919 AS
SELECT a.*
FROM public.entity_aliases a
JOIN public.entities e ON e.id = a.entity_id
LEFT JOIN public.entities t ON t.id = e.team_id
LEFT JOIN public.entities l ON l.id = COALESCE(e.league_id, t.league_id)
WHERE
  (
    e.type = 'team'
    AND l.id IS NOT NULL
    AND a.normalized = lower(trim(regexp_replace(translate(l.name,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g')))
  )
  OR
  (
    e.type = 'player'
    AND (
      (
        t.id IS NOT NULL
        AND a.normalized = lower(trim(regexp_replace(translate(t.name,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g')))
      )
      OR
      (
        l.id IS NOT NULL
        AND a.normalized = lower(trim(regexp_replace(translate(l.name,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g')))
      )
    )
  );

CREATE TABLE IF NOT EXISTS catalog_rebuild_backup.polluted_news_entity_links_20260919 AS
SELECT DISTINCT ne.*
FROM public.news_entities ne
JOIN catalog_rebuild_backup.bad_hierarchy_aliases_20260919 bad
  ON bad.entity_id = ne.entity_id
 AND bad.normalized = lower(trim(regexp_replace(translate(ne.matched_alias,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g')));

DELETE FROM public.entity_aliases a
USING public.entities e
LEFT JOIN public.entities t ON t.id = e.team_id
LEFT JOIN public.entities l ON l.id = COALESCE(e.league_id, t.league_id)
WHERE a.entity_id = e.id
  AND (
    (
      e.type = 'team'
      AND l.id IS NOT NULL
      AND a.normalized = lower(trim(regexp_replace(translate(l.name,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g')))
    )
    OR
    (
      e.type = 'player'
      AND (
        (t.id IS NOT NULL AND a.normalized = lower(trim(regexp_replace(translate(t.name,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g'))))
        OR
        (l.id IS NOT NULL AND a.normalized = lower(trim(regexp_replace(translate(l.name,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g'))))
      )
    )
  );

DELETE FROM public.news_entities ne
WHERE NOT EXISTS (
  SELECT 1
  FROM public.entity_aliases a
  WHERE a.entity_id = ne.entity_id
    AND a.normalized = lower(trim(regexp_replace(translate(ne.matched_alias,'ÅÄÖåäöÉéÜü','AAOaaoEeUu'),'[^[:alnum:][:space:]]',' ','g')))
);

COMMIT;
