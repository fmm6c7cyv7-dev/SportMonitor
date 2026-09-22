import { describe, expect, it } from "vitest";
import type { EntityMetaRow } from "@/lib/news/newsTypes";
import {
  buildAllFavoriteTokens,
  isFavoriteMatch,
} from "@/lib/news/newsFavorites";
import { normalizeToken } from "@/lib/news/newsGeo";

describe("newsFavorites", () => {
  it("builds derived shorthand tokens for Swedish team favorites", () => {
    const favoriteMeta = new Map<string, EntityMetaRow>([
      [
        "team-vsk",
        {
          id: "team-vsk",
          type: "team",
          name: "Västerås SK",
        },
      ],
      [
        "team-kff",
        {
          id: "team-kff",
          type: "team",
          name: "Kalmar FF",
        },
      ],
    ]);

    const tokens = buildAllFavoriteTokens([], favoriteMeta);

    expect(tokens).toContain("vasteras sk");
    expect(tokens).toContain("vsk");
    expect(tokens).toContain("vasteras");
    expect(tokens).toContain("kalmar ff");
    expect(tokens).toContain("kff");
    expect(tokens).toContain("kalmar");
  });

  it("matches VSK article title when Västerås SK is a favorite", () => {
    const favoriteMeta = new Map<string, EntityMetaRow>([
      [
        "team-vsk",
        {
          id: "team-vsk",
          type: "team",
          name: "Västerås SK",
        },
      ],
    ]);

    const tokens = buildAllFavoriteTokens([], favoriteMeta);

    const matched = isFavoriteMatch(
      normalizeToken("Stanna i allsvenskan – då behöver VSK ta minst 31 poäng"),
      [],
      tokens,
    );

    expect(matched).toBe(true);
  });

  it("matches favorite when tag contains shorthand club token", () => {
    const favoriteMeta = new Map<string, EntityMetaRow>([
      [
        "team-vsk",
        {
          id: "team-vsk",
          type: "team",
          name: "Västerås SK",
        },
      ],
    ]);

    const tokens = buildAllFavoriteTokens([], favoriteMeta);

    const matched = isFavoriteMatch(
      normalizeToken("Inför omgången"),
      ["VSK"],
      tokens,
    );

    expect(matched).toBe(true);
  });

  it("does not match unrelated team", () => {
    const favoriteMeta = new Map<string, EntityMetaRow>([
      [
        "team-vsk",
        {
          id: "team-vsk",
          type: "team",
          name: "Västerås SK",
        },
      ],
    ]);

    const tokens = buildAllFavoriteTokens([], favoriteMeta);

    const matched = isFavoriteMatch(
      normalizeToken("Kalmar FF vässar formen inför premiären"),
      ["Kalmar FF"],
      tokens,
    );

    expect(matched).toBe(false);
  });
});