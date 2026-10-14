/** Shared, pure policy: source keywords nominate; only persisted AI interpretation authorizes specials. */
export const EDITORIAL_VERSION = 1;
export const CATEGORIES = ["transfer", "departure", "contract", "management", "injury", "match-event", "success", "discipline", "lineup", "live", "other"] as const;
export const STATUSES = ["confirmed", "reported", "rumor", "denied", "unclear"] as const;
export const BADGES = ["HERE_WE_GO", "DONE_DEAL", "OFFICIAL", "CONFIRMED", "PRESENTED", "FIRED", "RESIGNED", "DEPARTURE", "RUMOR", "COACH", "CONTRACT", "BREAKING", "LIVE", "GOAL", "SUCCESS"] as const;
export type EditorialAssessment = {
  version: 1;
  title: string;
  category: typeof CATEGORIES[number];
  status: typeof STATUSES[number];
  badge: typeof BADGES[number] | null;
  breaking: boolean;
  evidence: string;
  assessed_at: string;
  model: string;
};
export type EditorialItem = { title?: string | null; tags?: string[] | null; editorial_assessment?: unknown };

const KEYWORDS = /(?<![\p{L}\p{N}])(?:here[ _]we[ _]go|done[ _]deal|officiellt|official|confirmed|bekräftat|bekraftat|klart|klar för|klar for|klar som|presenterad|presenteras|unveil\p{L}*|får sparken|sparkar|sparken|sacked|dismiss\p{L}*|fired|avgår|avgar|resign\p{L}*|steps down|lämnar|lamnar|depart\p{L}*|leaves|uppgifter|rykte\p{L}*|rumou?r\p{L}*|linked with|appoint\p{L}*|takes over|tar över|tar over|ny tränare|ny tranare|new (?:head )?(?:coach|manager)|kontrakt\p{L}*|contract\p{L}*|signs|signed|signing|signerar|joins|joined|transfer\p{L}*|värvar|varvar|förhandlar|forhandlar|live|just[ _]nu|breaking|hot|må+l\p{L}*|mal|goal\p{L}*|scores|scored|hattrick|avgör|avgor|kvitterar|nätar|natar|matchvinnare|vinstmal|utklassning|succé\p{L}*|succe\p{L}*|red card|rött kort|rott kort|utvisning|matchstraff|silly[ _]season|ny klubb|starting xi|lineups?|startelva|laguppställning|laguppstallning|team news)(?![\p{L}\p{N}])/iu;
export function isEditorialCandidate(item: EditorialItem & { summary?: string | null }): boolean {
  return KEYWORDS.test(`${item.title ?? ""} ${item.summary ?? ""} ${(item.tags ?? []).join(" ")}`);
}
export function getEditorialAssessment(item: EditorialItem): EditorialAssessment | null {
  const a = item.editorial_assessment as EditorialAssessment | null | undefined;
  if (!a || a.version !== EDITORIAL_VERSION || a.title !== item.title ||
      !CATEGORIES.includes(a.category) || !STATUSES.includes(a.status) ||
      (a.badge !== null && !BADGES.includes(a.badge)) || typeof a.breaking !== "boolean" ||
      typeof a.evidence !== "string" || !a.evidence.trim() ||
      typeof a.assessed_at !== "string" || !Number.isFinite(Date.parse(a.assessed_at)) ||
      typeof a.model !== "string" || !a.model) return null;
  return a;
}
export function hasEditorialPriority(item: EditorialItem): boolean {
  const a = getEditorialAssessment(item);
  return !!a && ((a.status === "reported" && a.badge === "HERE_WE_GO" && a.category === "transfer") || (a.status === "confirmed" && (a.breaking ||
    ["transfer", "departure", "contract", "management", "match-event", "success", "discipline", "live"].includes(a.category))));
}
export function editorialUrgency(item: EditorialItem): number {
  return hasEditorialPriority(item) ? 12 : 0;
}
export function isEditorialVip(item: EditorialItem): boolean {
  const a = getEditorialAssessment(item);
  return hasEditorialPriority(item) && !!a && a.status === "confirmed" && (a.breaking ||
    ["transfer", "departure", "contract", "management", "match-event", "success"].includes(a.category));
}
export function editorialBadge(item: EditorialItem): {label: string; variant: "justnu" | "live" | "mal" | "officiellt"} | null {
  const a = getEditorialAssessment(item);
  if (!a || a.status === "denied" || a.status === "unclear" || !a.badge) return null;
  // Rumors remain ordinary feed items: their stored assessment is informative,
  // but it never grants a VIP-style visual badge or editorial urgency.
  if (a.badge === "RUMOR") return null;
  if (a.badge === "HERE_WE_GO") return ["confirmed", "reported"].includes(a.status) && a.category === "transfer" ? {label: "HERE WE GO 🚨", variant: "justnu"} : null;
  if (a.status !== "confirmed") return null;
  const allowed: Partial<Record<NonNullable<EditorialAssessment["badge"]>, readonly string[]>> = {
    DONE_DEAL: ["transfer", "contract"], OFFICIAL: ["transfer", "departure", "contract", "management"], CONFIRMED: ["transfer", "departure", "contract", "management"], PRESENTED: ["transfer", "management"], FIRED: ["management"], RESIGNED: ["management"], DEPARTURE: ["departure"], COACH: ["management"], CONTRACT: ["contract"], BREAKING: CATEGORIES, LIVE: ["live"], GOAL: ["match-event"], SUCCESS: ["success"],
  };
  if (!allowed[a.badge]?.includes(a.category) || (a.badge === "BREAKING" && !a.breaking)) return null;
  const labels = { DONE_DEAL: "DONE DEAL", OFFICIAL: "OFFICIELLT", CONFIRMED: "KLART", PRESENTED: "PRESENTERAD", FIRED: "SPARKEN", RESIGNED: "AVGÅR", DEPARTURE: "LÄMNAR KLUBBEN", COACH: "NY TRÄNARE", CONTRACT: "NYTT KONTRAKT", BREAKING: "JUST NU", LIVE: "LIVE", GOAL: "MÅL", SUCCESS: "SUCCÉ" };
  return {label: labels[a.badge], variant: a.badge === "GOAL" ? "mal" : ["OFFICIAL", "PRESENTED", "COACH", "CONTRACT"].includes(a.badge) ? "officiellt" : a.badge === "DEPARTURE" || a.badge === "LIVE" ? "live" : "justnu"};
}
