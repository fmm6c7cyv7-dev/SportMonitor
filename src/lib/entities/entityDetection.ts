// src/lib/entities/entityDetection.ts

import type {
  DetectedEntity,
  EntityAliasRecord,
  Sport,
} from "@/lib/entities/entityTypes";

/* ==========================================================================
   NORMALIZATION HELPERS
   ========================================================================== */

function normalizeText(input: string): string {
  return ` ${String(input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

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
   MATCHING HELPERS
   ========================================================================== */

function isAliasMatch(normalizedText: string, normalizedAlias: string): boolean {
  if (!normalizedAlias) {
    return false;
  }

  if (normalizedAlias.length <= 3) {
    const regex = new RegExp(`\\b${normalizedAlias}\\b`, "i");
    return regex.test(normalizedText);
  }

  const needle = ` ${normalizedAlias} `;
  return normalizedText.includes(needle);
}

function shouldReplaceDetectedEntity(
  existing: DetectedEntity | undefined,
  candidateAliasNormalized: string,
): boolean {
  if (!existing) {
    return true;
  }

  return (
    candidateAliasNormalized.length >
    normalizeAlias(existing.matched_alias).length
  );
}

/* ==========================================================================
   PUBLIC DETECTION API
   ========================================================================== */

export function detectEntitiesInText(
  text: string,
  aliases: EntityAliasRecord[],
  sport?: Sport | null,
): DetectedEntity[] {
  const normalizedText = normalizeText(text);
  const bestByEntity = new Map<string, DetectedEntity>();

  for (const aliasRecord of aliases) {
    if (sport && aliasRecord.sport !== sport) continue;
    if (!aliasRecord.alias_normalized) continue;
    if (!isAliasMatch(normalizedText, aliasRecord.alias_normalized)) continue;

    const candidate: DetectedEntity = {
      entity_id: aliasRecord.entity_id,
      entity_name: aliasRecord.entity_name,
      entity_type: aliasRecord.entity_type,
      sport: aliasRecord.sport,
      matched_alias: aliasRecord.alias,
      match_type: "alias",
    };

    const existing = bestByEntity.get(aliasRecord.entity_id);

    if (shouldReplaceDetectedEntity(existing, aliasRecord.alias_normalized)) {
      bestByEntity.set(aliasRecord.entity_id, candidate);
    }
  }

  return Array.from(bestByEntity.values());
}