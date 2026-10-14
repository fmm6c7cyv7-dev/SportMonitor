import { describe, expect, it } from "vitest";
import { classifyEditorialArticle } from "@/lib/editorial/classifier";
import { editorialBadge, isEditorialVip } from "@/lib/editorial/assessment";

// Deployment-build opt-in only: read-only real-model quality gate, no database or push.
describe.skipIf(process.env.SM_EDITORIAL_LIVE_QA !== "1")("live editorial semantic evaluation", () => {
  const budget = {remaining: 12, activeMs: 120_000, stats: {}};
  const examples = [
    {title: "Senators’ Ridly Greig leaves game early with strain", category: "injury", status: "confirmed", label: null, vip: false},
    {title: "Spelaren förnekar uppgifterna om att han skrivit på ett nytt kontrakt", category: "contract", status: "denied", label: null, vip: false},
    {title: "Official | Niko Kovač extends Borussia Dortmund contract until 2029", category: "contract", status: "confirmed", label: "NYTT KONTRAKT", vip: true},
    {title: "Here we go: Alexander Isak to Liverpool, agreement reached according to transfer journalist", category: "transfer", status: "reported", label: "HERE WE GO 🚨", vip: false},
    {title: "Official referee appointed for Sunday's derby", category: "other", status: "confirmed", label: null, vip: false},
    {title: "Breaking down the Maple Leafs’ key performers, causes for good start", category: "other", status: "confirmed", label: null, vip: false},
    {title: "Official: Milan confirm ‘successful’ Saelemaekers ankle surgery", category: "injury", status: "confirmed", label: null, vip: false},
    {title: "Spelaren lämnar klubben – AIK bekräftar att kontraktet avslutas", category: "departure", status: "confirmed", label: "LÄMNAR KLUBBEN", vip: true},
  ] as const;
  for (const example of examples) {
    it(example.title, async () => {
      const result = await classifyEditorialArticle({title: example.title}, budget);
      expect(result, `AI assessment missing: ${JSON.stringify(budget.stats)}`).not.toBeNull();
      expect(result?.category).toBe(example.category);
      if (example.category !== "other") expect(result?.status).toBe(example.status);
      const item = {title: example.title, editorial_assessment: result};
      // Multiple truthful labels can describe a contract/departure; require semantic equivalence.
      if (example.label === "NYTT KONTRAKT" || example.label === "LÄMNAR KLUBBEN") {
        expect([example.label, "OFFICIELLT", "KLART", "DONE DEAL"]).toContain(editorialBadge(item)?.label);
      } else expect(editorialBadge(item)?.label ?? null).toBe(example.label);
      expect(isEditorialVip(item)).toBe(example.vip);
      console.info("[editorial live QA]", JSON.stringify({title: example.title, category: result?.category, status: result?.status, badge: editorialBadge(item)?.label ?? null, vip: isEditorialVip(item)}));
    }, 25_000);
  }
});
