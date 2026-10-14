import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessment } from "./fixtures";
const mocks = vi.hoisted(() => ({rss: vi.fn(), classify: vi.fn(), push: vi.fn()}));
vi.mock("@/lib/rss", () => ({parseRssFeed: mocks.rss}));
vi.mock("@/lib/pushDispatch", () => ({dispatchPushForNewsItem: mocks.push}));
vi.mock("@/lib/audit/favoriteDeliveryAudit", () => ({auditFavoriteDeliveryForNewsItem: vi.fn()}));
vi.mock("@/lib/detectEntities", () => ({detectEntitiesInText: () => [], loadEntityAliases: vi.fn()}));
vi.mock("@/lib/supabase", () => ({supabaseService: vi.fn()}));
vi.mock("@/lib/classification/sportSignals", () => ({detectSportFromContent: () => "hockey", hasSportContent: () => true}));
vi.mock("@/lib/editorial/classifier", async original => ({...await original<typeof import("@/lib/editorial/classifier")>(), classifyEditorialArticle: mocks.classify}));
import { processFeedIngest } from "@/lib/ingest/processFeed";
import type { FeedDef } from "@/lib/ingest/sourceRegistry";
import { editorialBadge } from "@/lib/editorial/assessment";
const title = "Senators’ Ridly Greig leaves game early with strain";
function database(existingUrls: string[] = []) {
  const persisted: Record<string, unknown>[] = [];
  let insertPayload: Record<string, unknown>[] | null = null;
  const client = {from: () => ({
    select: () => ({in: async () => ({data: existingUrls.map(url => ({url})), error: null})}),
    upsert: (payload: Record<string, unknown>[]) => {
      insertPayload = payload;
      return {select: async () => {
        for (const row of payload) persisted.push({...row, id: `id-${persisted.length}`});
        return {data: persisted, error: null};
      }};
    },
  })};
  return {client, persisted, payload: () => insertPayload};
}
beforeEach(() => {vi.clearAllMocks(); mocks.push.mockResolvedValue({sent: 0}); mocks.classify.mockResolvedValue(assessment(title, "injury"));});
describe("ingest editorial boundary", () => {
  const feed = {type: "rss", name: "Sportsnet – NHL", sport: "hockey", url: "https://example.com/rss"} as FeedDef;
  it("classifies only deduped new articles and persists interpretation before any push", async () => {
    const item = {title, url: "https://example.com/new", published_at: new Date().toISOString(), summary: "Available injury summary", tags: ["HOT"]};
    mocks.rss.mockResolvedValue([item, item, {...item, url: "https://example.com/existing"}]);
    const db = database(["https://example.com/existing"]);
    mocks.push.mockImplementation(async () => {
      expect(db.persisted[0].editorial_assessment).toEqual(assessment(title, "injury"));
      expect(editorialBadge(db.persisted[0] as {title: string})).toBeNull();
      return {sent: 0};
    });
    const result = await processFeedIngest(feed, db.client as never, []);
    expect(mocks.classify).toHaveBeenCalledTimes(1);
    expect(mocks.classify.mock.calls[0][0]).toEqual({title, tags: ["HOT"], summary: "Available injury summary"});
    expect(result.insertedCount).toBe(1);
    expect(result.debug.duplicateOrExistingCount).toBe(2);
    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(db.payload()?.[0].editorial_assessment).toBeTruthy();
  });
  it("keeps failed AI classifications as normal visible news", async () => {
    mocks.rss.mockResolvedValue([{title, url: "https://example.com/new", published_at: new Date().toISOString()}]);
    mocks.classify.mockResolvedValue(null);
    const db = database();
    const result = await processFeedIngest(feed, db.client as never, []);
    expect(result.insertedCount).toBe(1);
    expect(db.persisted[0].editorial_assessment).toBeNull();
    expect(editorialBadge(db.persisted[0] as {title: string})).toBeNull();
  });
  it("never reanalyzes an existing URL", async () => {
    mocks.rss.mockResolvedValue([{title, url: "https://example.com/old", published_at: new Date().toISOString()}]);
    const db = database(["https://example.com/old"]);
    const result = await processFeedIngest(feed, db.client as never, []);
    expect(result.insertedCount).toBe(0);
    expect(mocks.classify).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
