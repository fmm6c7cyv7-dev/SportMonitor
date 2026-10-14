import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {backfillRecentEditorialAssessments, withinEditorialBackfillWindow} from "@/lib/editorial/backfill";
import {createEditorialBudget} from "@/lib/editorial/classifier";

const mocks = vi.hoisted(() => ({classify: vi.fn()}));
vi.mock("@/lib/editorial/classifier", async original => ({
  ...await original<typeof import("@/lib/editorial/classifier")>(),
  classifyEditorialArticle: mocks.classify,
}));

function database(rows: Array<Record<string, unknown>>, saved = true) {
  const writes: Array<Record<string, unknown>> = [];
  const filters: Array<[string, string, unknown]> = [];
  const reading = {
    is(column: string, value: unknown) {filters.push(["is", column, value]); return this;},
    gte(column: string, value: string) {filters.push(["gte", column, value]); return this;},
    lte(column: string, value: string) {filters.push(["lte", column, value]); return this;},
    order() {return this;},
    limit: async () => ({data: rows, error: null}),
  };
  const updating = {
    eq(column: string, value: unknown) {filters.push(["eq", column, value]); return this;},
    is(column: string, value: unknown) {filters.push(["is", column, value]); return this;},
    gte(column: string, value: string) {filters.push(["gte", column, value]); return this;},
    lte(column: string, value: string) {filters.push(["lte", column, value]); return this;},
    select: async () => ({data: saved ? [{id: "recent"}] : [], error: null}),
  };
  return {
    writes, filters,
    client: {
      from: (table: string) => {
        expect(table).toBe("news_items");
        return {
          select: () => reading,
          update: (payload: Record<string, unknown>) => {
            writes.push(payload);
            return updating;
          },
        };
      },
    },
  };
}

afterEach(() => {vi.unstubAllEnvs(); vi.useRealTimers();});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.classify.mockImplementation(async ({title}: {title: string}) => ({
    version: 1, title, category: "success", status: "confirmed", badge: "SUCCESS",
    breaking: false, evidence: "Succé", assessed_at: new Date().toISOString(), model: "test",
  }));
});

describe("bounded existing-article editorial catch-up", () => {
  it("rejects future, old and undated articles; requires both timestamps", () => {
    const now = Date.parse("2026-10-14T08:00:00Z");
    const good = new Date(now - 2 * 60 * 60_000).toISOString();
    const old = new Date(now - 3 * 60 * 60_000 - 1).toISOString();
    const future = new Date(now + 1).toISOString();
    expect(withinEditorialBackfillWindow({published_at: good, fetched_at: good}, now)).toBe(true);
    expect(withinEditorialBackfillWindow({published_at: old, fetched_at: good}, now)).toBe(false);
    expect(withinEditorialBackfillWindow({published_at: good, fetched_at: old}, now)).toBe(false);
    expect(withinEditorialBackfillWindow({published_at: future, fetched_at: good}, now)).toBe(false);
    expect(withinEditorialBackfillWindow({published_at: null, fetched_at: good}, now)).toBe(false);
  });

  it("updates only existing recent candidates, guarded by id/title/null/age, and never inserts or dispatches push", async () => {
    const now = Date.now();
    const within = new Date(now - 30 * 60_000).toISOString();
    const tooOld = new Date(now - 4 * 60 * 60_000).toISOString();
    const item = (id: string, title: string, published_at: string, fetched_at = within) =>
      ({id, title, published_at, fetched_at, tags: []});
    const db = database([
      item("recent", "Succé för laget efter historisk finalseger", within),
      item("ordinary", "Veckans träningstider", within),
      item("old", "Succé för klubben förra veckan", tooOld),
      item("old-fetch", "Succé i finalen", within, tooOld),
    ]);
    const result = await backfillRecentEditorialAssessments(db.client as never, createEditorialBudget("private-oidc"));
    expect(result).toMatchObject({scanned: 4, attempted: 1, updated: 1, failed: 0});
    expect(mocks.classify).toHaveBeenCalledTimes(1);
    expect(mocks.classify.mock.calls[0][0].title).toBe("Succé för laget efter historisk finalseger");
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toHaveProperty("editorial_assessment");
    expect(db.filters).toContainEqual(["eq", "id", "recent"]);
    expect(db.filters).toContainEqual(["eq", "title", "Succé för laget efter historisk finalseger"]);
    expect(db.filters).toContainEqual(["is", "editorial_assessment", null]);
    expect(db.filters.filter(([method, column]) => method === "gte" && ["published_at","fetched_at"].includes(column))).toHaveLength(4);
  });

  it("skips DB scan and model calls without production credentials", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", ""); vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const db = database([]);
    const result = await backfillRecentEditorialAssessments(db.client as never, createEditorialBudget());
    expect(result.skippedNoAuth).toBe(true);
    expect(result.scanned).toBe(0);
    expect(mocks.classify).not.toHaveBeenCalled();
  });

  it("enforces the extra-call cap of three", async () => {
    const now = new Date().toISOString();
    const db = database(Array.from({length: 7}, (_, i) => ({
      id: String(i), title: "Succé efter historiskt mål " + i,
      published_at: now, fetched_at: now, tags: [],
    })));
    const result = await backfillRecentEditorialAssessments(db.client as never, createEditorialBudget("private-oidc"));
    expect(result.attempted).toBe(3);
    expect(db.writes).toHaveLength(3);
  });
});
