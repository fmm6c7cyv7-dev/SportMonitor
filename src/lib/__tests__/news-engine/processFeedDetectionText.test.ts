import { describe, expect, it, vi } from "vitest";
import { detectEntitiesInText } from "@/lib/detectEntities";
import { buildDetectionText } from "@/lib/ingest/processFeed";

vi.mock("@/lib/pushDispatch", () => ({
  dispatchPushForNewsItem: vi.fn(),
}));

vi.mock("@/lib/audit/favoriteDeliveryAudit", () => ({
  auditFavoriteDeliveryForNewsItem: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseService: vi.fn(),
}));

describe("processFeed detection text", () => {
  it("includes the url path so team aliases can be detected from feed urls", () => {
    const text = buildDetectionText(
      {
        title: "Så många biljetter är sålda till hemmapremiären",
        url: "https://pressgurkan.se/fotboll/vasteras-sk/sa-manga-biljetter-ar-salda-till-hemmapremiaren/",
        summary: null,
        source: "Pressgurkan",
        tags: [],
      },
      "Pressgurkan",
    );

    const detected = detectEntitiesInText(
      text,
      [
        {
          entity_id: "football-team-vasteras-sk",
          entity_name: "Västerås SK",
          entity_type: "team",
          sport: "football",
          alias: "Västerås SK",
          alias_normalized: "vasteras sk",
        },
      ],
      "football",
    );

    expect(text).toContain("vasteras-sk");
    expect(detected).toEqual([
      expect.objectContaining({
        entity_id: "football-team-vasteras-sk",
        entity_name: "Västerås SK",
      }),
    ]);
  });
});
