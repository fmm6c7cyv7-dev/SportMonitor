// src/lib/detectEntities.ts

export type {
  Sport,
  EntityType,
  EntityAliasRecord,
  DetectedEntity,
} from "@/lib/entities/entityTypes";

export { loadEntityAliases } from "@/lib/entities/entityAliasStore";
export { detectEntitiesInText } from "@/lib/entities/entityDetection";