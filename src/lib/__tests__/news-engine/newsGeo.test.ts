import { describe, expect, it } from "vitest";
import {
  buildLocalHaystack,
  GEO_REGIONS,
  isLocalEntityMatch,
  isLocalMatch,
  normalizeToken,
  resolveNewsGeo,
  resolveRegionFromTeamEntityId,
  resolveRegionFromCoords,
} from "@/lib/news/newsGeo";

describe("newsGeo", () => {
  it("builds a normalized haystack from title, url, source and tags", () => {
    const haystack = buildLocalHaystack({
      title: "VSK jagar ny seger!",
      url: "https://pressgurkan.se/fotboll/vasteras-sk/ny-seger",
      source: "VLT Sport",
      tags: ["Allsvenskan", "Västerås"],
    });

    expect(haystack).toBe(
      "vsk jagar ny seger https pressgurkan se fotboll vasteras sk ny seger vlt sport allsvenskan vasteras",
    );
  });

  it("matches local article when region term exists in title", () => {
    const matched = isLocalMatch(
      normalizeToken("VSK vände sent hemma på Hitachi Energy Arena"),
      GEO_REGIONS.vasteras,
    );

    expect(matched).toBe(true);
  });

  it("matches local article when region term exists in source", () => {
    const haystack = buildLocalHaystack({
      title: "Ny tränarrapport inför helgen",
      source: "VLT Sport",
      tags: [],
    });

    const matched = isLocalMatch(haystack, GEO_REGIONS.vasteras);

    expect(matched).toBe(true);
  });

  it("matches local article when region term exists in tags", () => {
    const haystack = buildLocalHaystack({
      title: "Inför omgången",
      source: "Pressgurkan",
      tags: ["Västerås SK"],
    });

    const matched = isLocalMatch(haystack, GEO_REGIONS.vasteras);

    expect(matched).toBe(true);
  });

  it("matches local article when the team appears only in the url path", () => {
    const haystack = buildLocalHaystack({
      title: "Så många biljetter är sålda till hemmapremiären",
      url: "https://pressgurkan.se/fotboll/vasteras-sk/sa-manga-biljetter-ar-salda-till-hemmapremiaren/",
      source: "Pressgurkan",
      tags: [],
    });

    const matched = isLocalMatch(haystack, GEO_REGIONS.vasteras);

    expect(matched).toBe(true);
  });

  it("does not match unrelated region", () => {
    const haystack = buildLocalHaystack({
      title: "Kalmar FF förbereder nästa match",
      source: "Barometern",
      tags: ["Kalmar"],
    });

    const matched = isLocalMatch(haystack, GEO_REGIONS.vasteras);

    expect(matched).toBe(false);
  });

  it("resolves Västerås from nearby coordinates within 50 km", () => {
    const result = resolveRegionFromCoords(59.61, 16.54);

    expect(result?.key).toBe("vasteras");
    expect(result?.region.city).toBe("Västerås");
  });

  it("resolves Kalmar from nearby coordinates", () => {
    const result = resolveRegionFromCoords(56.6634, 16.3568);

    expect(result?.key).toBe("kalmar");
    expect(result?.region.city).toBe("Kalmar");
  });

  it("resolves Nybro coordinates to Kalmar region with current distance model", () => {
    const result = resolveRegionFromCoords(56.7449, 15.9075);

    expect(result?.key).toBe("kalmar");
    expect(result?.region.city).toBe("Kalmar");
  });

  it("does not resolve Växjö coordinates to Kalmar region", () => {
    const result = resolveRegionFromCoords(56.879, 14.8059);

    expect(result?.key).toBe("vaxjo");
    expect(result?.key).not.toBe("kalmar");
  });

  it("does not resolve Jönköping coordinates to Kalmar region", () => {
    const result = resolveRegionFromCoords(57.7826, 14.1618);

    expect(result?.key).toBe("jonkoping");
    expect(result?.key).not.toBe("kalmar");
  });

  it("maps Västerås SK team entity to Västerås region generically", () => {
    const resolved = resolveRegionFromTeamEntityId("football-team-vasteras-sk");

    expect(resolved?.key).toBe("vasteras");
    expect(resolved?.region.city).toBe("Västerås");
  });

  it("maps Västerås IK from generic team entity id to Västerås region", () => {
    const resolved = resolveRegionFromTeamEntityId("team-vasteras-ik");

    expect(resolved?.key).toBe("vasteras");
    expect(resolved?.region.city).toBe("Västerås");
  });

  it("maps IF Elfsborg team entity to Borås region generically", () => {
    const resolved = resolveRegionFromTeamEntityId("football-team-elfsborg");

    expect(resolved?.key).toBe("boras");
    expect(resolved?.region.city).toBe("Borås");
  });

  it("maps Brynäs IF team entity to Gävle region generically", () => {
    const resolved = resolveRegionFromTeamEntityId("hockey-team-brynas-if");

    expect(resolved?.key).toBe("gavle");
    expect(resolved?.region.city).toBe("Gävle");
  });

  it("matches local region from team entity ids without title/source term help", () => {
    const matched = isLocalEntityMatch(
      ["football-team-kalmar"],
      GEO_REGIONS.kalmar,
    );

    expect(matched).toBe(true);
  });

  it("matches Kalmar region from Kalmar HC entity id", () => {
    const matched = isLocalEntityMatch(
      ["hockey-team-kalmar-hc"],
      GEO_REGIONS.kalmar,
    );

    expect(matched).toBe(true);
  });

  it("matches Kalmar region from Nybro Vikings entity id", () => {
    const matched = isLocalEntityMatch(
      ["hockey-team-nybro-vikings-if"],
      GEO_REGIONS.kalmar,
    );

    expect(matched).toBe(true);
  });

  it("does not mark a team local for the wrong user region", () => {
    const matched = isLocalEntityMatch(
      ["football-team-kalmar"],
      GEO_REGIONS.vasteras,
    );

    expect(matched).toBe(false);
  });

  it("matches Västerås region for hockey VIK team entity id", () => {
    const matched = isLocalEntityMatch(
      ["team-vasteras-ik"],
      GEO_REGIONS.vasteras,
    );

    expect(matched).toBe(true);
  });

  it("matches Västerås region when VIK appears in normalized text", () => {
    const matched = isLocalMatch(
      normalizeToken("VIK vann igen i HockeyAllsvenskan"),
      GEO_REGIONS.vasteras,
    );

    expect(matched).toBe(true);
  });

  it("matches Kalmar region for Nybro Vikings text signal", () => {
    const haystack = buildLocalHaystack({
      title: "Nybro Vikings värvar ny center",
      source: "HockeyNews – Nybro Vikings",
      tags: ["HockeyAllsvenskan"],
    });

    const matched = isLocalMatch(haystack, GEO_REGIONS.kalmar);

    expect(matched).toBe(true);
  });

  it("does not match Växjö Lakers article as local for Kalmar region", () => {
    const haystack = buildLocalHaystack({
      title: "Växjö Lakers vann igen i SHL",
      source: "Smålandsposten",
      tags: ["Växjö Lakers"],
    });

    const matched = isLocalMatch(haystack, GEO_REGIONS.kalmar);

    expect(matched).toBe(false);
  });

  it("resolves Nybro debug city to Kalmar region", () => {
    const resolved = resolveNewsGeo({
      debugCity: "Nybro",
      geoLat: null,
      geoLng: null,
      vercelIpCity: null,
    });

    expect(resolved.regionKey).toBe("kalmar");
    expect(resolved.activeRegion?.city).toBe("Kalmar");
    expect(resolved.locationSource).toBe("debug");
  });

  it("resolves Nybro vercel-ip city to Kalmar region when coords/debug are absent", () => {
    const resolved = resolveNewsGeo({
      debugCity: null,
      geoLat: null,
      geoLng: null,
      vercelIpCity: "Nybro",
    });

    expect(resolved.regionKey).toBe("kalmar");
    expect(resolved.activeRegion?.city).toBe("Kalmar");
    expect(resolved.locationSource).toBe("vercel-ip");
  });
});
