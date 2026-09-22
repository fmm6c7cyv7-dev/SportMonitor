// src/lib/entities/entityTypes.ts

/* ==========================================================================
   DOMAIN TYPES
   ========================================================================== */

export type Sport = "football" | "hockey";
export type EntityType = "team" | "player" | "league";

export type EntityAliasRecord = {
  entity_id: string;
  entity_name: string;
  entity_type: EntityType;
  sport: Sport;
  alias: string;
  alias_normalized: string;
};

export type DetectedEntity = {
  entity_id: string;
  entity_name: string;
  entity_type: EntityType;
  sport: Sport;
  matched_alias: string;
  match_type: "alias";
};