// src/lib/entities/entityAliasStore.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EntityAliasRecord,
  EntityType,
  Sport,
} from "@/lib/entities/entityTypes";

/* ==========================================================================
   INTERNAL ROW TYPES
   ========================================================================== */

type EntityRow = {
  id: string;
  name: string;
  type: EntityType;
  sport: Sport;
};

type EntityAliasRow = {
  entity_id: string;
  alias: string;
  normalized: string | null;
};

/* ==========================================================================
   NORMALIZATION HELPERS
   ========================================================================== */

function normalizeAlias(alias: string): string {
  return String(alias ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ==========================================================================
   SUPABASE LOADERS
   ========================================================================== */

async function loadEntities(
  supabase: SupabaseClient,
  sport?: Sport | null,
): Promise<EntityRow[]> {
  let query = supabase
    .from("entities")
    .select("id,name,type,sport")
    .in("type", ["team", "player", "league"]);

  if (sport) {
    query = query.eq("sport", sport);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load entities: ${error.message}`);
  }

  return (data ?? []).map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type as EntityType,
    sport: entity.sport as Sport,
  }));
}

async function loadEntityAliasRows(
  supabase: SupabaseClient,
): Promise<EntityAliasRow[]> {
  const { data, error } = await supabase
    .from("entity_aliases")
    .select("entity_id,alias,normalized");

  if (error) {
    throw new Error(`Failed to load entity_aliases: ${error.message}`);
  }

  return (data ?? []).map((alias) => ({
    entity_id: alias.entity_id,
    alias: alias.alias,
    normalized: alias.normalized,
  }));
}

/* ==========================================================================
   PUBLIC DATA API
   ========================================================================== */

export async function loadEntityAliases(
  supabase: SupabaseClient,
  sport?: Sport | null,
): Promise<EntityAliasRecord[]> {
  const entities = await loadEntities(supabase, sport);

  const entityMap = new Map<string, EntityRow>();
  for (const entity of entities) {
    entityMap.set(entity.id, entity);
  }

  if (entityMap.size === 0) {
    return [];
  }

  const aliasRows = await loadEntityAliasRows(supabase);
  const records: EntityAliasRecord[] = [];

  for (const aliasRow of aliasRows) {
    const entity = entityMap.get(aliasRow.entity_id);
    if (!entity) continue;

    const normalizedAlias =
      aliasRow.normalized && aliasRow.normalized.trim().length > 0
        ? aliasRow.normalized
        : normalizeAlias(aliasRow.alias);

    records.push({
      entity_id: entity.id,
      entity_name: entity.name,
      entity_type: entity.type,
      sport: entity.sport,
      alias: aliasRow.alias,
      alias_normalized: normalizedAlias,
    });
  }

  records.sort((a, b) => b.alias_normalized.length - a.alias_normalized.length);

  return records;
}