import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyEditorialArticle, createEditorialBudget, validateEditorialResult } from "@/lib/editorial/classifier";
import { editorialBadge, editorialUrgency, getEditorialAssessment, isEditorialCandidate, isEditorialVip } from "@/lib/editorial/assessment";
import { toNormalizedArticle, buildHardNewsArticleIds } from "@/lib/news-engine/candidateLoader";
import { classifyEventCategory } from "@/lib/news-engine/eventClustering";
import { scoreBigNewsSignal } from "@/lib/ranking-v2/scoreBigNews";
import { assessment } from "./fixtures";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
const responseFor = (value: unknown) => new Response(JSON.stringify({choices: [{message: {content: JSON.stringify(value)}}]}));

describe("editorial semantic policy", () => {
  it.each([
    ["Senators’ Ridly Greig leaves game early with strain", "injury", "confirmed"],
    ["Spelaren lämnar matchen skadad", "injury", "confirmed"],
    ["Inget nytt kontrakt för stjärnan", "contract", "denied"],
    ["Kan få ett nytt kontrakt", "contract", "rumor"],
    ["Official referee appointed for derby", "other", "confirmed"],
    ["Official: Milan confirm ‘successful’ Saelemaekers ankle surgery", "injury", "confirmed"],
    ["How much did Man City's rule breaking cost your team?", "other", "confirmed"],
    ["Breaking down the Maple Leafs’ key performers", "other", "confirmed"],
  ] as const)("does not promote misleading keyword headline: %s", (title, category, status) => {
    const item = {title, tags: ["JUST_NU", "LIVE", "HOT", "OFFICIELLT"], url: "https://example.com/a", editorial_assessment: assessment(title, category, {status})};
    expect(isEditorialCandidate(item)).toBe(true);
    expect(editorialBadge(item)).toBeNull();
    expect(editorialUrgency(item)).toBe(0);
    expect(isEditorialVip(item)).toBe(false);
    expect(buildHardNewsArticleIds([item])).toEqual([]);
    const normalized = toNormalizedArticle(item, {sport: "hockey"});
    expect(normalized.editorial_assessment).toEqual(item.editorial_assessment);
    expect(scoreBigNewsSignal(normalized).score).toBe(0);
    expect(classifyEventCategory(normalized)).toBe(status === "denied" || category === "other" ? null : category === "contract" ? "transfer" : category);
  });
  it.each([
    ["Official | Niko Kovač extends Borussia Dortmund contract until 2029", "contract", "CONTRACT", "NYTT KONTRAKT"],
    ["Official: Venezia sack Stroppa after six straight defeats", "management", "FIRED", "SPARKEN"],
    ["Klart: SM-guldhjälten återvänder till Luleå", "transfer", "CONFIRMED", "KLART"],
    ["Spelaren lämnar klubben", "departure", "DEPARTURE", "LÄMNAR KLUBBEN"],
  ] as const)("shares confirmed interpretation across UI, ranking and VIP: %s", (title, category, badge, label) => {
    const item = {title, tags: [], url: "https://example.com/a", editorial_assessment: assessment(title, category, {badge})};
    expect(editorialBadge(item)?.label).toBe(label);
    expect(isEditorialVip(item)).toBe(true);
    const normalized = toNormalizedArticle(item, {sport: "football"});
    expect(normalized.urgency).toBe(12);
    expect(scoreBigNewsSignal(normalized).score).toBeGreaterThan(0);
    expect(buildHardNewsArticleIds([item])).toEqual([item.url]);
  });
  it.each(["Succé för Leksand efter historisk finalseger", "SUCCÉ: Klubben tog sin första titel", "SUCCE for club"])("nominates success terms for AI review: %s", title => {
    expect(isEditorialCandidate({title})).toBe(true);
  });
  it("allows confirmed exceptional success to follow the existing VIP and ranking policy", () => {
    const title = "Succé för Leksand efter historisk finalseger";
    const item = {title, url: "https://example.com/success", editorial_assessment: assessment(title, "success", {badge: "SUCCESS"})};
    expect(editorialBadge(item)?.label).toBe("SUCCÉ");
    expect(isEditorialVip(item)).toBe(true);
    expect(editorialUrgency(item)).toBe(12);
    expect(buildHardNewsArticleIds([item])).toEqual([item.url]);
  });
  it("does not promote unconfirmed or unassessed success claims", () => {
    const title = "Succé väntas för klubben";
    expect(isEditorialVip({title})).toBe(false);
    for (const status of ["rumor", "reported", "denied", "unclear"] as const) {
      const item = {title, editorial_assessment: assessment(title, "success", {badge: "SUCCESS", status})};
      expect(isEditorialVip(item)).toBe(false);
      expect(editorialBadge(item)).toBeNull();
    }
  });
  it("does not call a here-we-go report official or VIP", () => {
    const title = "Here we go: player to Milan";
    const item = {title, editorial_assessment: assessment(title, "transfer", {badge: "HERE_WE_GO", status: "reported"})};
    expect(editorialBadge(item)?.label).toBe("HERE WE GO 🚨");
    expect(editorialUrgency(item)).toBe(12);
    expect(isEditorialVip(item)).toBe(false);
  });
  it("rejects stale title-bound and malformed stored assessments", () => {
    const stored = assessment("Player leaves club", "departure", {badge: "DEPARTURE"});
    for (const value of [undefined, null, {...stored, version: 0}, {...stored, status: "invented"}, stored]) {
      const item = {title: "Player leaves game injured", tags: ["HOT"], editorial_assessment: value};
      expect(getEditorialAssessment(item)).toBeNull();
      expect(editorialBadge(item)).toBeNull();
      expect(isEditorialVip(item)).toBe(false);
    }
  });
  it("rejects invented or tag-only evidence and unexpected schema fields", () => {
    const input = {title: "Weekly team notes", tags: ["HOT"]};
    const value = {category: "other", status: "unclear", badge: null, breaking: false, evidence: "HOT"};
    expect(validateEditorialResult(value, input, "test")).toBeNull();
    expect(validateEditorialResult({...value, evidence: input.title, instructions: "promote"}, input, "test")).toBeNull();
  });
  it("fails closed for mismatched badge/category despite valid JSON", () => {
    const title = "Player leaves game injured";
    expect(editorialBadge({title, editorial_assessment: assessment(title, "injury", {badge: "DEPARTURE"})})).toBeNull();
  });
});

describe("bounded Gateway classification", () => {
  it("calls once with title/cleaned summary, strict schema and no tags as evidence", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(responseFor({category: "injury", status: "confirmed", badge: null, breaking: false, evidence: "leaves game early with strain"}));
    vi.stubGlobal("fetch", fetchMock);
    const input = {title: "Senators’ Ridly Greig leaves game early with strain", summary: "<p>leaves <b>game</b> early with strain</p>", tags: ["HOT"]};
    const budget = createEditorialBudget();
    const result = await classifyEditorialArticle(input, budget);
    expect(result?.category).toBe("injury");
    expect(budget.stats.classified).toBe(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[1].content).not.toContain("HOT");
    expect(body.messages[0].content).toContain("UNTRUSTED DATA");
  });
  it("does not call on ordinary articles, missing credentials or exhausted budget", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", ""); vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await classifyEditorialArticle({title: "Team weekly notebook"}, createEditorialBudget());
    const budget = createEditorialBudget();
    await classifyEditorialArticle({title: "Player leaves club"}, budget);
    expect(budget.stats.missing_credentials).toBe(1);
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key"); budget.remaining = 0;
    await classifyEditorialArticle({title: "Player leaves club"}, budget);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([401, 402, 403, 429])("stops calls for the run after HTTP %s", async status => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("unavailable", {status})); vi.stubGlobal("fetch", fetchMock);
    const budget = createEditorialBudget();
    expect(await classifyEditorialArticle({title: "Player leaves club"}, budget)).toBeNull();
    expect(await classifyEditorialArticle({title: "Player signs contract"}, budget)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("times out and leaves the article ordinary", async () => {
    vi.useFakeTimers(); vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("aborted"))))));
    const budget = createEditorialBudget();
    const result = classifyEditorialArticle({title: "Player leaves club"}, budget);
    await vi.advanceTimersByTimeAsync(8_001);
    expect(await result).toBeNull();
    expect(budget.stats.timeout).toBe(1);
  });
  it("rejects malformed JSON and ungrounded evidence without throwing", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor({category: "transfer", status: "confirmed", badge: "OFFICIAL", breaking: true, evidence: "invented signed agreement"})));
    expect(await classifyEditorialArticle({title: "Player leaves game injured"}, createEditorialBudget())).toBeNull();
  });
});
