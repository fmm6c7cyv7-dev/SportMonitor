// src/lib/news/newsGeo.ts

import { getBrowseEntities } from "@/lib/entities/catalog";
import type { GeoRegion, NewsGeoResolution } from "@/lib/news/newsTypes";

/* ==========================================================================
   GEO CONSTANTS
   ========================================================================== */

const MAX_REGION_DISTANCE_KM = 50;

export const GEO_REGIONS: Record<string, GeoRegion> = {
  vasteras: {
  city: "Västerås",
  lat: 59.6099,
  lng: 16.5448,
  terms: [
    "vsk",
    "vik",
    "vik hockey",
    "västerås sk",
    "västerås ik",
    "västerås",
    "vasteras sk",
    "vasteras ik",
    "vasteras",
    "grönvitt",
    "gronvitt",
    "gulsvart",
    "vlt",
    "vlt sport",
  ],
},
  leksand: {
    city: "Leksand",
    lat: 60.7303,
    lng: 14.9999,
    terms: ["lif", "leksands if", "leksand", "masarna"],
  },
  stockholm: {
    city: "Stockholm",
    lat: 59.3293,
    lng: 18.0686,
    terms: [
      "aik",
      "dif",
      "djurgården",
      "djurgarden",
      "hammarby",
      "bajen",
      "brommapojkarna",
      "gnaget",
      "järnkaminerna",
      "jarnkaminerna",
    ],
  },
  orebro: {
    city: "Örebro",
    lat: 59.2741,
    lng: 15.2066,
    terms: [
      "örebro sk",
      "orebro sk",
      "ösk",
      "osk",
      "örebro hk",
      "orebro hk",
      "öhk",
      "ohk",
      "örebro",
      "orebro",
    ],
  },
  gavle: {
    city: "Gävle",
    lat: 60.6749,
    lng: 17.1413,
    terms: ["brynäs", "brynas", "bif", "gävle", "gavle", "gefle"],
  },
  goteborg: {
    city: "Göteborg",
    lat: 57.7089,
    lng: 11.9746,
    terms: [
      "ifk göteborg",
      "ifk goteborg",
      "blåvitt",
      "blavitt",
      "frölunda",
      "frolunda",
      "häcken",
      "hacken",
      "gais",
      "göteborg",
      "goteborg",
      "bkh",
    ],
  },
  malmo: {
    city: "Malmö",
    lat: 55.605,
    lng: 13.0038,
    terms: [
      "mff",
      "malmö ff",
      "malmo ff",
      "redhawks",
      "malmö",
      "malmo",
      "di blåe",
      "di blave",
    ],
  },
  jonkoping: {
    city: "Jönköping",
    lat: 57.7826,
    lng: 14.1618,
    terms: [
      "hv71",
      "hv 71",
      "jönköping",
      "jonkoping",
      "husqvarna",
      "södra",
      "sodra",
    ],
  },
  karlstad: {
    city: "Karlstad",
    lat: 59.3793,
    lng: 13.5036,
    terms: ["färjestad", "farjestad", "fbk", "karlstad"],
  },
  linkoping: {
    city: "Linköping",
    lat: 58.4108,
    lng: 15.6214,
    terms: ["linköping hc", "linkoping hc", "lhc", "linköping", "linkoping"],
  },
  lulea: {
    city: "Luleå",
    lat: 65.5848,
    lng: 22.1547,
    terms: [
      "luleå hf",
      "lulea hf",
      "luleå",
      "lulea",
      "luleå hockey",
      "lulea hockey",
    ],
  },
  angelholm: {
    city: "Ängelholm",
    lat: 56.2428,
    lng: 12.8627,
    terms: ["rögle", "rogle", "rbk", "ängelholm", "angelholm"],
  },
  skelleftea: {
    city: "Skellefteå",
    lat: 64.7502,
    lng: 20.9509,
    terms: ["skellefteå aik", "skelleftea aik", "saik", "skellefteå", "skelleftea"],
  },
  timra: {
    city: "Timrå",
    lat: 62.4865,
    lng: 17.326,
    terms: ["timrå ik", "timra ik", "timrå", "timra"],
  },
  vaxjo: {
    city: "Växjö",
    lat: 56.879,
    lng: 14.8059,
    terms: [
      "växjö lakers",
      "vaxjo lakers",
      "lakers",
      "växjö",
      "vaxjo",
      "öster",
      "oster",
      "östers if",
      "osters if",
    ],
  },
  umea: {
    city: "Umeå",
    lat: 63.8258,
    lng: 20.263,
    terms: [
      "björklöven",
      "bjorkloven",
      "if björklöven",
      "if bjorkloven",
      "löven",
      "loven",
      "umeå",
      "umea",
      "uik",
    ],
  },
  sodertalje: {
    city: "Södertälje",
    lat: 59.1955,
    lng: 17.6253,
    terms: ["södertälje sk", "sodertalje sk", "ssk", "södertälje", "sodertalje"],
  },
  ornskoldsvik: {
    city: "Örnsköldsvik",
    lat: 63.2909,
    lng: 18.7153,
    terms: ["modo", "örnsköldsvik", "ornskoldsvik"],
  },
  karlskoga: {
    city: "Karlskoga",
    lat: 59.326,
    lng: 14.523,
    terms: ["bik karlskoga", "karlskoga", "bik"],
  },
  oskarshamn: {
    city: "Oskarshamn",
    lat: 57.265,
    lng: 16.4474,
    terms: ["ik oskarshamn", "iko", "oskarshamn"],
  },
  boras: {
    city: "Borås",
    lat: 57.721,
    lng: 12.9401,
    terms: ["elfsborg", "ife", "borås", "boras"],
  },
  norrkoping: {
    city: "Norrköping",
    lat: 58.5877,
    lng: 16.1924,
    terms: [
      "ifk norrköping",
      "ifk norrkopping",
      "peking",
      "snoka",
      "norrköping",
      "norrkopping",
    ],
  },
  uppsala: {
    city: "Uppsala",
    lat: 59.8586,
    lng: 17.6389,
    terms: ["ik sirius", "sirius", "uppsala"],
  },
  halmstad: {
    city: "Halmstad",
    lat: 56.6745,
    lng: 12.8568,
    terms: ["hbk", "halmstads bk", "halmstad"],
  },
  kalmar: {
    city: "Kalmar",
    lat: 56.6634,
    lng: 16.3568,
    terms: [
      "kalmar ff",
      "kff",
      "kalmar hc",
      "nybro",
      "nybro vikings",
      "nybro vikings if",
      "kalmar",
    ],
  },
  varnamo: {
    city: "Värnamo",
    lat: 57.186,
    lng: 14.0404,
    terms: ["ifk värnamo", "ifk varnamo", "värnamo", "varnamo"],
  },
  degerfors: {
    city: "Degerfors",
    lat: 59.2379,
    lng: 14.43,
    terms: ["degerfors if", "degerfors", "rödvitt", "rodvitt"],
  },
  helsingborg: {
    city: "Helsingborg",
    lat: 56.0465,
    lng: 12.6945,
    terms: ["hif", "helsingborgs if", "helsingborg", "di röe", "di roe"],
  },
  solvesborg: {
    city: "Sölvesborg",
    lat: 56.0521,
    lng: 14.5753,
    terms: [
      "mjällby aif",
      "mjallby aif",
      "mjällby",
      "mjallby",
      "maif",
      "sölvesborg",
      "solvesborg",
      "strandvallen",
    ],
  },
  landskrona: {
    city: "Landskrona",
    lat: 55.8708,
    lng: 12.8301,
    terms: ["bois", "landskrona bois", "landskrona"],
  },
};

const CITY_REGION_ALIASES: Record<string, string> = {
  nybro: "kalmar",
};

/* ==========================================================================
   BASIC HELPERS
   ========================================================================== */

export function foldDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeToken(value: string): string {
  const raw = (value ?? "").trim();

  return foldDiacritics(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCoordinate(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function buildLocalHaystack(input: {
  title?: string | null;
  url?: string | null;
  source?: string | null;
  tags?: string[] | null;
}): string {
  const parts = [
    input.title ?? "",
    input.url ?? "",
    input.source ?? "",
    ...(input.tags ?? []),
  ];

  return normalizeToken(parts.join(" "));
}

function buildNormalizedRegionTermSet(region: GeoRegion): Set<string> {
  return new Set(
    [region.city, ...region.terms]
      .map((value) => normalizeToken(value))
      .filter(Boolean),
  );
}

function buildTeamRegionIndex(): Map<string, string> {
  const regionTermsByKey = new Map(
    Object.entries(GEO_REGIONS).map(([key, region]) => [
      key,
      buildNormalizedRegionTermSet(region),
    ]),
  );

  const result = new Map<string, string>();

  for (const sport of ["football", "hockey"] as const) {
    for (const team of getBrowseEntities(sport, "team")) {
      const teamTokens = new Set(
        [team.name, ...team.aliases]
          .map((value) => normalizeToken(value))
          .filter(Boolean),
      );

      const matchingRegionKeys: string[] = [];

      for (const [regionKey, regionTerms] of regionTermsByKey.entries()) {
        const matchesRegion = Array.from(teamTokens).some((token) =>
          regionTerms.has(token),
        );

        if (matchesRegion) {
          matchingRegionKeys.push(regionKey);
        }
      }

      if (matchingRegionKeys.length === 1) {
        result.set(team.id, matchingRegionKeys[0]);
      }
    }
  }

  return result;
}

const TEAM_REGION_KEY_BY_ENTITY_ID = buildTeamRegionIndex();

function buildTeamSlugRegionIndex(): Map<string, string> {
  const result = new Map<string, string>();

  for (const [entityId, regionKey] of TEAM_REGION_KEY_BY_ENTITY_ID.entries()) {
    const marker = "-team-";
    const markerIndex = entityId.indexOf(marker);

    if (markerIndex === -1) {
      continue;
    }

    const teamSlug = entityId.slice(markerIndex + marker.length).trim();
    if (!teamSlug) {
      continue;
    }

    const existing = result.get(teamSlug);
    if (existing && existing !== regionKey) {
      result.delete(teamSlug);
      continue;
    }

    result.set(teamSlug, regionKey);
  }

  return result;
}

const TEAM_REGION_KEY_BY_TEAM_SLUG = buildTeamSlugRegionIndex();

function extractTeamSlugFromEntityId(entityId: string): string | null {
  const normalizedId = entityId.trim().toLowerCase();
  if (!normalizedId) {
    return null;
  }

  const marker = "team-";
  const markerIndex = normalizedId.lastIndexOf(marker);

  if (markerIndex !== -1) {
    const slug = normalizedId.slice(markerIndex + marker.length).trim();
    return slug.length > 0 ? slug : null;
  }

  return normalizedId;
}

/* ==========================================================================
   DISTANCE HELPERS
   ========================================================================== */

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

/* ==========================================================================
   GEO RESOLUTION
   ========================================================================== */

export function resolveRegionFromCity(city: string | null | undefined) {
  const normalizedCity = normalizeToken(city ?? "");
  if (!normalizedCity) return null;

  for (const [key, region] of Object.entries(GEO_REGIONS)) {
    if (normalizeToken(region.city) === normalizedCity) {
      return { key, region };
    }
  }

  const aliasedRegionKey = CITY_REGION_ALIASES[normalizedCity];
  if (aliasedRegionKey) {
    const region = GEO_REGIONS[aliasedRegionKey];
    if (region) {
      return { key: aliasedRegionKey, region };
    }
  }

  return null;
}

export function resolveRegionFromTeamEntityId(entityId: string | null | undefined) {
  if (!entityId) return null;

  const normalizedEntityId = entityId.trim().toLowerCase();

  const regionKeyFromEntityId =
    TEAM_REGION_KEY_BY_ENTITY_ID.get(normalizedEntityId);
  if (regionKeyFromEntityId) {
    const region = GEO_REGIONS[regionKeyFromEntityId];
    if (!region) return null;

    return { key: regionKeyFromEntityId, region };
  }

  const teamSlug = extractTeamSlugFromEntityId(normalizedEntityId);
  if (!teamSlug) return null;

  const regionKey = TEAM_REGION_KEY_BY_TEAM_SLUG.get(teamSlug);
  if (!regionKey) return null;

  const region = GEO_REGIONS[regionKey];
  if (!region) return null;

  return { key: regionKey, region };
}

export function resolveRegionFromCoords(lat: number, lng: number) {
  let best:
    | {
        key: string;
        region: GeoRegion;
        distanceKm: number;
      }
    | null = null;

  for (const [key, region] of Object.entries(GEO_REGIONS)) {
    const distanceKm = haversineKm(lat, lng, region.lat, region.lng);

    if (!best || distanceKm < best.distanceKm) {
      best = { key, region, distanceKm };
    }
  }

  if (!best) return null;
  if (best.distanceKm > MAX_REGION_DISTANCE_KM) return null;

  return best;
}

export function resolveNewsGeo(params: {
  debugCity: string | null;
  geoLat: number | null;
  geoLng: number | null;
  vercelIpCity: string | null;
}): NewsGeoResolution {
  const debugRegionMatch = resolveRegionFromCity(params.debugCity);
  const coordRegionMatch =
    params.geoLat != null && params.geoLng != null
      ? resolveRegionFromCoords(params.geoLat, params.geoLng)
      : null;
  const ipRegionMatch = resolveRegionFromCity(params.vercelIpCity);

  const activeRegion =
    debugRegionMatch?.region ??
    coordRegionMatch?.region ??
    ipRegionMatch?.region ??
    null;

  const regionKey =
    debugRegionMatch?.key ??
    coordRegionMatch?.key ??
    ipRegionMatch?.key ??
    null;

  const userCity =
    params.debugCity ??
    coordRegionMatch?.region.city ??
    params.vercelIpCity ??
    "unknown";

  const locationSource =
    debugRegionMatch != null
      ? "debug"
      : coordRegionMatch != null
        ? "coords"
        : ipRegionMatch != null
          ? "vercel-ip"
          : "none";

  return {
    activeRegion,
    regionKey,
    userCity,
    locationSource,
    coordRegionDistanceKm: coordRegionMatch
      ? Number(coordRegionMatch.distanceKm.toFixed(1))
      : null,
  };
}

export function isLocalMatch(
  normalizedHaystack: string,
  userRegion: GeoRegion | null,
): boolean {
  if (!userRegion) return false;
  if (!normalizedHaystack.trim()) return false;

  const haystack = ` ${normalizedHaystack} `;

  return userRegion.terms.some((term) => {
    const normalizedTerm = normalizeToken(term);
    if (!normalizedTerm) return false;

    return haystack.includes(` ${normalizedTerm} `);
  });
}

export function isLocalEntityMatch(
  entityIds: string[],
  userRegion: GeoRegion | null,
): boolean {
  if (!userRegion) return false;
  if (!Array.isArray(entityIds) || entityIds.length === 0) return false;

  const userRegionCity = normalizeToken(userRegion.city);

  return entityIds.some((entityId) => {
    const resolvedRegion = resolveRegionFromTeamEntityId(entityId);
    if (!resolvedRegion) return false;

    return normalizeToken(resolvedRegion.region.city) === userRegionCity;
  });
}
