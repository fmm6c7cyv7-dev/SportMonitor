import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/top/route";

const { state } = vi.hoisted(() => ({ state: { rows: [] as Record<string, unknown>[] } }));
vi.mock("@/lib/server/publicApiGuard", () => ({ guardPublicApi: () => null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => {
    let fields = "";
    const query = {
      select(value: string) { fields = value; return query; },
      eq() { return query; },
      not() { return query; },
      order() { return query; },
      limit: async () => ({ data: fields === "published_at" ? [] : state.rows, error: null }),
    };
    return query;
  } }),
}));

afterEach(() => {
  state.rows = [];
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("top women's scope", () => {
  it.each([
    { title: "AIK:s stjärnskott Nova Selin visar upp unika planerna", description: "" },
    { title: "AIK:s målskytt avgör 2-1 med hattrick", description: "Spelaren avgjorde för damlaget" },
  ])("skips women's RSS title/description and keeps men's AIK: %j", async (women) => {
    vi.stubEnv("TOP_RSS_URL", "https://example.com/rss");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const date = new Date().toUTCString();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<rss><channel>
      <item><title>${women.title}</title><description>${women.description}</description><link>https://example.com/women</link><pubDate>${date}</pubDate></item>
      <item><title>AIK:s herrar vinner i Allsvenskan</title><link>https://example.com/men</link><pubDate>${date}</pubDate></item>
      </channel></rss>`)));
    const response = await GET(new Request("https://example.com/api/top"));
    expect((await response.json()).item.url).toBe("https://example.com/men");
  });

  it("skips already stored women's rows in the DB fallback", async () => {
    vi.stubEnv("TOP_RSS_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    state.rows = [
      { id: "women", sport: "football", title: "AIK:s stjärnskott Nova Selin visar upp unika planerna", url: "https://example.com/women" },
      { id: "men", sport: "football", title: "AIK:s herrar vinner", url: "https://example.com/men" },
    ];
    const response = await GET(new Request("https://example.com/api/top"));
    expect((await response.json()).item.id).toBe("men");
  });

  it("returns no highlight when the fallback has only women's rows", async () => {
    vi.stubEnv("TOP_RSS_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    state.rows = [{ sport: "football", title: "AIK:s stjärnskott Nova Selin visar upp unika planerna" }];
    const response = await GET(new Request("https://example.com/api/top"));
    expect((await response.json()).item).toBeNull();
  });
});
